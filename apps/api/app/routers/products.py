"""
Products router — filterable, scored, safety-flagged product catalogue.

GET /products is the data source for the results-page intelligence layer:
personalised (non-random) Match Score + reason, safety flags, honest
multi-store links, and the full filter bar (budget / brand / rating / combos /
new / discount / category), with a relax-fallback so the list is never empty.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.limiter import limiter
from app.models.product import Product
from app.models.questionnaire import EnvironmentProfile, SkincareRoutineCurrent
from app.models.scan import SkinScan
from app.schemas.product import PaginatedProducts, ProductResponse
from app.schemas.routine import (
    OptimisedStep,
    OptimiseRoutineResponse,
    RoutineCheckRequest,
    RoutineCheckResponse,
)
from app.services import product_scoring as scoring
from app.services import routine_intelligence as routine_intel

router = APIRouter()

# When personalisation narrows the list below this, relax personalisation
# filters so the user always sees a usable set (mirrors _db_retrieve).
_MIN_RESULTS = 6
_NEW_WINDOW_DAYS = 30
_BRAND_ENUM_VALUES = {"nykaa", "minimalist", "dermaco", "others"}


# ---------------------------------------------------------------------------
# Context resolution
# ---------------------------------------------------------------------------

async def _resolve_context(
    db: AsyncSession,
    user,
    *,
    skin_type: Optional[str],
    condition: Optional[str],
    climate_zone: Optional[str],
    fitzpatrick: Optional[str],
    scan_id: Optional[uuid.UUID],
    pregnant: bool,
) -> scoring.UserContext:
    """
    Build the scoring context. Explicit query params win; when scan_id is given
    (or any resolvable signal is missing) we backfill from the user's latest
    scan + EnvironmentProfile + current routine — the "score by skin type,
    issue and climate, not randomly" path.
    """
    ctx = scoring.UserContext(
        skin_type=skin_type,
        conditions=[condition] if condition else [],
        climate_zone=climate_zone,
        fitzpatrick=fitzpatrick,
        is_pregnant=pregnant,
    )

    need_backfill = scan_id is not None or not all([skin_type, climate_zone, fitzpatrick])
    if not need_backfill:
        return ctx

    # Latest (or specified) scan for this user.
    scan_q = (
        select(SkinScan)
        .options(selectinload(SkinScan.conditions))
        .where(SkinScan.user_id == user.id)
    )
    if scan_id is not None:
        scan_q = scan_q.where(SkinScan.id == scan_id)
    scan_q = scan_q.order_by(SkinScan.scan_timestamp.desc()).limit(1)
    scan = (await db.execute(scan_q)).scalar_one_or_none()

    if scan is not None:
        if ctx.skin_type is None:
            ctx.skin_type = scan.skin_type
        if ctx.fitzpatrick is None:
            ctx.fitzpatrick = (scan.raw_analysis_json or {}).get("fitzpatrick_tone")
        if not ctx.conditions:
            ctx.conditions = [
                c.condition_name for c in (scan.conditions or []) if c.severity != "none"
            ]

    # Climate from the user's environment profile.
    if ctx.climate_zone is None or ctx.city is None:
        env = (
            await db.execute(
                select(EnvironmentProfile).where(EnvironmentProfile.user_id == user.id)
            )
        ).scalar_one_or_none()
        if env is not None:
            ctx.climate_zone = ctx.climate_zone or env.climate_zone
            ctx.city = env.city

    # Allergens from the current-routine free text.
    routine = (
        await db.execute(
            select(SkincareRoutineCurrent).where(SkincareRoutineCurrent.user_id == user.id)
        )
    ).scalar_one_or_none()
    if routine and routine.known_allergens_text:
        ctx.allergens = [
            a.strip().lower() for a in routine.known_allergens_text.split(",") if a.strip()
        ]

    return ctx


# ---------------------------------------------------------------------------
# Query building
# ---------------------------------------------------------------------------

def _apply_hard_filters(stmt, *, max_price, brand, min_rating, pack_size, is_combo,
                        is_new, min_discount_pct, on_sale, category):
    """User-chosen filters that are always respected (not relaxed)."""
    if max_price is not None:
        stmt = stmt.where(Product.price_inr.isnot(None), Product.price_inr <= max_price)
    if brand:
        clauses = []
        for b in brand:
            # Only compare the enum column to a *valid* enum value — Postgres
            # rejects e.g. brand == "cerave". brand_display carries those.
            if b.lower() in _BRAND_ENUM_VALUES:
                clauses.append(Product.brand == b.lower())
            clauses.append(Product.brand_display.ilike(f"%{b}%"))
        stmt = stmt.where(or_(*clauses))
    if min_rating is not None:
        stmt = stmt.where(Product.rating_avg >= min_rating)
    if pack_size is not None:
        stmt = stmt.where(Product.pack_size == pack_size)
    if is_combo:
        stmt = stmt.where(Product.pack_size > 1)
    if is_new:
        cutoff = datetime.now(timezone.utc) - timedelta(days=_NEW_WINDOW_DAYS)
        stmt = stmt.where(or_(Product.is_new.is_(True), Product.created_at >= cutoff))
    if on_sale:
        stmt = stmt.where(Product.mrp_inr.isnot(None), Product.mrp_inr > Product.price_inr)
    if min_discount_pct is not None:
        stmt = stmt.where(
            Product.mrp_inr.isnot(None),
            Product.price_inr.isnot(None),
            Product.mrp_inr > Product.price_inr,
            ((Product.mrp_inr - Product.price_inr) / Product.mrp_inr * 100) >= min_discount_pct,
        )
    if category:
        stmt = stmt.where(Product.category == category)
    return stmt


def _apply_personalisation(stmt, *, skin_type, condition, climate_zone, fitzpatrick):
    """
    Personalisation FILTERS (relaxable) — only the explicitly-requested query
    params narrow the list. Values resolved from the user's scan/profile drive
    the Match Score (ranking) instead of hard-filtering, so a scan-personalised
    call ranks by skin type + issue + climate without ever emptying the list.
    """
    if skin_type:
        stmt = stmt.where(Product.skin_types_suitable.contains([skin_type]))
    if condition:
        stmt = stmt.where(Product.targets_conditions.contains([condition]))
    if climate_zone:
        stmt = stmt.where(Product.climate_zones_suitable.contains([climate_zone]))
    if fitzpatrick:
        stmt = stmt.where(Product.fitzpatrick_suitable.contains([fitzpatrick]))
    return stmt


# ---------------------------------------------------------------------------
# Enrichment
# ---------------------------------------------------------------------------

def _enrich(product: Product, ctx: scoring.UserContext) -> ProductResponse:
    resp = ProductResponse.model_validate(product)
    resp.discount_pct = scoring.compute_discount_pct(product.price_inr, product.mrp_inr)
    result = scoring.score_product(product, ctx)
    resp.match_score = result.match_score
    resp.match_reason = result.match_reason
    resp.flags = result.flags  # list[{code,message}] — validated by ProductFlag
    resp.store_links = scoring.build_store_links(
        product.product_name,
        product_url=product.product_url,
        existing=product.store_links,
        brand_display=product.brand_display,
    )
    return resp


# All default to "best first" (descending) except the two explicit price orders.
_SORTERS = {
    "match_score": lambda r: (-(r.match_score if r.match_score is not None else -1), -r.rating_avg),
    "price_asc":   lambda r: (r.price_inr if r.price_inr is not None else float("inf"),),
    "price_desc":  lambda r: (-(r.price_inr if r.price_inr is not None else 0),),
    "rating":      lambda r: (-r.rating_avg,),
    "discount":    lambda r: (-(r.discount_pct or 0),),
    "newest":      lambda r: (-r.created_at.timestamp(),),
}


# ---------------------------------------------------------------------------
# GET /products
# ---------------------------------------------------------------------------

@router.get("", response_model=PaginatedProducts)
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    # personalisation (non-random core)
    skin_type: Optional[str] = Query(None),
    condition: Optional[str] = Query(None, description="maps to targets_conditions"),
    climate_zone: Optional[str] = Query(None),
    fitzpatrick: Optional[str] = Query(None),
    scan_id: Optional[uuid.UUID] = Query(None, description="resolve skin_type/conditions/climate from this scan"),
    questionnaire_id: Optional[uuid.UUID] = Query(None),
    pregnant: bool = Query(False),
    # table-stakes filters
    max_price: Optional[float] = Query(None, ge=0),
    brand: Optional[list[str]] = Query(None, description="matches brand OR brand_display; repeatable"),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    pack_size: Optional[int] = Query(None, ge=1),
    is_combo: bool = Query(False),
    is_new: bool = Query(False),
    min_discount_pct: Optional[int] = Query(None, ge=0, le=100),
    on_sale: bool = Query(False),
    category: Optional[str] = Query(None),
    sort: str = Query("match_score"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    if brand and len(brand) > 20:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Too many brand filters — pass at most 20.",
        )

    ctx = await _resolve_context(
        db, current_user,
        skin_type=skin_type, condition=condition, climate_zone=climate_zone,
        fitzpatrick=fitzpatrick, scan_id=scan_id, pregnant=pregnant,
    )

    base = select(Product).where(Product.is_active.is_(True))
    base = _apply_hard_filters(
        base, max_price=max_price, brand=brand, min_rating=min_rating,
        pack_size=pack_size, is_combo=is_combo, is_new=is_new,
        min_discount_pct=min_discount_pct, on_sale=on_sale, category=category,
    )

    # Try personalised (explicit params only), relax if too few results.
    personalised = _apply_personalisation(
        base, skin_type=skin_type, condition=condition,
        climate_zone=climate_zone, fitzpatrick=fitzpatrick,
    )
    rows = list((await db.scalars(personalised)).all())
    if len(rows) < _MIN_RESULTS:
        rows = list((await db.scalars(base)).all())

    # Enrich (score, flags, discount, store links) + sort in Python — the
    # catalogue is small and match_score isn't expressible in SQL.
    enriched = [_enrich(p, ctx) for p in rows]
    sorter = _SORTERS.get(sort, _SORTERS["match_score"])
    enriched.sort(key=sorter)

    total = len(enriched)
    start = (page - 1) * page_size
    items = enriched[start:start + page_size]

    return PaginatedProducts(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(start + page_size) < total,
    )


# ---------------------------------------------------------------------------
# POST /products/routine-check — Phase 3 routine-level reasoning.
# Declared before /{product_id} so the literal path isn't swallowed by the
# UUID path parameter (see the /history-before-/{id} note in recommendations.py).
# ---------------------------------------------------------------------------

@router.post("/routine-check", response_model=RoutineCheckResponse)
@limiter.limit("30/minute")
async def routine_check(
    request: Request,
    body: RoutineCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = list(
        (await db.scalars(
            select(Product).where(Product.id.in_(body.product_ids), Product.is_active.is_(True))
        )).all()
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matching products found.")

    actives_by_product = {p.product_name: set(scoring._actives_for(p)) for p in rows}
    conflicts = routine_intel.find_conflicts(actives_by_product)
    duplicate_actives = routine_intel.find_duplicate_actives(actives_by_product)
    gaps = routine_intel.find_gaps({p.category for p in rows})

    routine_products = [
        routine_intel.RoutineProduct(
            id=p.id, name=p.product_name, category=p.category,
            actives=actives_by_product[p.product_name],
        )
        for p in rows
    ]
    layering = routine_intel.build_layering(routine_products, conflicts)
    total_cost_inr, cost_per_day_inr = routine_intel.compute_cost(
        [p.price_inr for p in rows if p.price_inr is not None]
    )

    return RoutineCheckResponse(
        total_cost_inr=total_cost_inr,
        cost_per_day_inr=cost_per_day_inr,
        conflicts=conflicts,
        duplicate_actives=duplicate_actives,
        gaps=gaps,
        layering=layering,
    )


# ---------------------------------------------------------------------------
# GET /products/optimise-routine — "fit my routine under ₹X".
# ---------------------------------------------------------------------------

@router.get("/optimise-routine", response_model=OptimiseRoutineResponse)
@limiter.limit("30/minute")
async def optimise_routine(
    request: Request,
    budget_inr: float = Query(..., gt=0),
    steps: int = Query(3, ge=3, le=5),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    skin_type: Optional[str] = Query(None),
    condition: Optional[str] = Query(None),
    climate_zone: Optional[str] = Query(None),
    fitzpatrick: Optional[str] = Query(None),
    scan_id: Optional[uuid.UUID] = Query(None),
    questionnaire_id: Optional[uuid.UUID] = Query(None),
    pregnant: bool = Query(False),
):
    if steps not in routine_intel.STEPS_BY_COMPLEXITY:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="steps must be 3, 4 or 5.")

    ctx = await _resolve_context(
        db, current_user,
        skin_type=skin_type, condition=condition, climate_zone=climate_zone,
        fitzpatrick=fitzpatrick, scan_id=scan_id, pregnant=pregnant,
    )

    steps_def = routine_intel.STEPS_BY_COMPLEXITY[steps]
    candidates_by_category: dict[str, list[Product]] = {}
    for step in steps_def:
        cat = step["category"]
        rows = await db.scalars(
            select(Product).where(Product.category == cat, Product.is_active.is_(True))
        )
        candidates_by_category[cat] = list(rows.all())

    result = routine_intel.optimise_routine(steps_def, candidates_by_category, ctx, budget_inr)

    step_out = [
        OptimisedStep(
            step_label=step["label"],
            category=step["category"],
            product=_enrich(result.chosen[step["category"]], ctx) if step["category"] in result.chosen else None,
        )
        for step in steps_def
    ]

    return OptimiseRoutineResponse(
        steps=step_out,
        total_cost_inr=result.total_cost_inr,
        cost_per_day_inr=result.cost_per_day_inr,
        drop_suggestion=result.drop_suggestion,
    )


# ---------------------------------------------------------------------------
# GET /products/{product_id}
# ---------------------------------------------------------------------------

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    scan_id: Optional[uuid.UUID] = Query(None),
    pregnant: bool = Query(False),
):
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if product is None or not product.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    ctx = await _resolve_context(
        db, current_user,
        skin_type=None, condition=None, climate_zone=None, fitzpatrick=None,
        scan_id=scan_id, pregnant=pregnant,
    )
    return _enrich(product, ctx)
