"""
Recommendations router — Phase 6 full implementation.

Endpoints:
  POST /generate                — run full engine, return recommendation_id
  GET  /latest                  — most recent recommendation for current user
  GET  /{id}                    — full recommendation detail
  GET  /{id}/roadmap            — week-by-week roadmap only
  GET  /{id}/products           — all recommended products with reasons
  POST /{id}/feedback           — user rates recommendation (1–5 + text)
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_verified_user
from app.core.limiter import limiter
from app.models.recommendation import Recommendation, RecommendationProduct
from app.models.scan import SkinScan
from app.schemas.recommendation import (
    FeedbackRequest,
    RecommendationDetailResponse,
    RecommendationGenerateRequest,
    RecommendationGenerateResponse,
    PaginatedRecommendations,
    RecommendationListItem,
    RecommendedProductEntry,
    ProductInRecommendation,
    RoadmapResponse,
)
from app.services import onboarding_service
from app.services.recommendation import RecommendationService

router = APIRouter()

# Singleton service — Pinecone and Anthropic clients are shared across requests
_service = RecommendationService()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_recommendation_or_404(
    rec_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Recommendation:
    rec = await db.scalar(
        select(Recommendation)
        .options(
            selectinload(Recommendation.products).selectinload(RecommendationProduct.product),
            selectinload(Recommendation.scan).selectinload(SkinScan.conditions),
        )
        .where(Recommendation.id == rec_id, Recommendation.user_id == user_id)
    )
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found.")
    return rec


def _build_detail(rec: Recommendation) -> RecommendationDetailResponse:
    meta = rec.metadata_json or {}
    scan = rec.scan

    # Conditions summary from scan
    conditions_summary = []
    if scan and scan.conditions:
        for c in scan.conditions:
            conditions_summary.append({
                "condition_name": c.condition_name,
                "severity": c.severity,
                "affected_zone": c.affected_zone,
                "confidence_score": c.confidence_score,
            })

    # Products
    products_out: list[RecommendedProductEntry] = []
    for rp in (rec.products or []):
        p = rp.product
        if p is None:
            continue
        products_out.append(RecommendedProductEntry(
            id=rp.id,
            product=ProductInRecommendation(
                id=p.id,
                brand=p.brand,
                product_name=p.product_name,
                category=p.category,
                price_inr=p.price_inr,
                product_url=p.product_url,
                key_ingredients=p.key_ingredients,
                targets_conditions=p.targets_conditions,
                rating_avg=p.rating_avg,
                is_dermatologist_approved=p.is_dermatologist_approved,
            ),
            order_in_routine=rp.order_in_routine,
            start_week=rp.start_week,
            reason_text=rp.reason_text,
            is_mandatory=rp.is_mandatory,
            phase=rp.phase,
            highlighted_ingredient=rp.highlighted_ingredient,
            usage_instruction=rp.usage_instruction,
            time_of_day=rp.time_of_day,
        ))

    # Roadmap from stored JSON
    roadmap: Optional[RoadmapResponse] = None
    if rec.roadmap_json:
        try:
            roadmap = RoadmapResponse(**rec.roadmap_json)
        except Exception:
            roadmap = None

    return RecommendationDetailResponse(
        id=rec.id,
        user_id=rec.user_id,
        scan_id=rec.scan_id,
        questionnaire_id=rec.questionnaire_id,
        generated_at=rec.generated_at,
        recommendation_engine_version=rec.recommendation_engine_version,
        skin_score=rec.skin_score,
        skin_type=scan.skin_type if scan else None,
        fitzpatrick_tone=(scan.raw_analysis_json or {}).get("fitzpatrick_tone") if scan else None,
        conditions_summary=conditions_summary,
        products=products_out,
        roadmap=roadmap,
        climate_insight=meta.get("climate_insight"),
        estimated_monthly_cost_inr=rec.estimated_monthly_cost_inr,
        morning_routine=meta.get("morning_routine", []),
        night_routine=meta.get("night_routine", []),
        ingredients_to_use=meta.get("ingredients_to_use", []),
        ingredients_to_avoid=meta.get("ingredients_to_avoid", []),
        lifestyle_tips=meta.get("lifestyle_tips", []),
        dermatologist_note=meta.get("dermatologist_note"),
        allergen_flags=rec.allergen_flags or [],
        requires_derm_review=rec.requires_derm_review,
        is_dermatologist_reviewed=rec.is_dermatologist_reviewed,
        reviewer_id=rec.reviewer_id,
        reviewed_at=rec.reviewed_at,
        feedback_rating=rec.feedback_rating,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=RecommendationGenerateResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def generate_recommendation(
    request: Request,
    body: RecommendationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """
    Run the full recommendation engine for a scan.
    Combines scan results + questionnaire + climate profile → Claude AI → 20-week roadmap.
    """
    try:
        rec = await _service.generate_recommendation(
            scan_id=body.scan_id,
            questionnaire_id=body.questionnaire_id,
            user=current_user,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    # Step 3 complete: a recommendation now exists and is stored — this is the
    # only place onboarding is marked `completed`, satisfying the rule that
    # completion means a real recommendation was generated (not merely viewed).
    if onboarding_service.advance_onboarding(current_user, "completed"):
        await db.commit()

    return RecommendationGenerateResponse(
        recommendation_id=rec.id,
        message="Recommendation generated successfully.",
        skin_score=rec.skin_score,
        products_count=len(rec.products or []),
        requires_derm_review=rec.requires_derm_review,
        estimated_monthly_cost_inr=rec.estimated_monthly_cost_inr,
    )


@router.get("/latest", response_model=RecommendationDetailResponse)
async def get_latest_recommendation(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Return the most recent recommendation for the authenticated user."""
    rec = await db.scalar(
        select(Recommendation)
        .options(
            selectinload(Recommendation.products).selectinload(RecommendationProduct.product),
            selectinload(Recommendation.scan).selectinload(SkinScan.conditions),
        )
        .where(Recommendation.user_id == current_user.id)
        .order_by(Recommendation.generated_at.desc())
    )
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recommendation found. Complete a scan first.",
        )
    return _build_detail(rec)


# NOTE: /history must be declared before /{recommendation_id}, otherwise the
# literal path segment "history" would be captured by the UUID path parameter.
@router.get("/history", response_model=PaginatedRecommendations)
async def recommendation_history(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Return paginated recommendation history for the authenticated user, newest first."""
    offset = (page - 1) * per_page

    total = (
        await db.execute(
            select(func.count(Recommendation.id)).where(
                Recommendation.user_id == current_user.id
            )
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(Recommendation)
            .options(selectinload(Recommendation.products))
            .where(Recommendation.user_id == current_user.id)
            .order_by(Recommendation.generated_at.desc())
            .offset(offset)
            .limit(per_page)
        )
    ).scalars().all()

    items = []
    for rec in rows:
        item = RecommendationListItem.model_validate(rec)
        item.products_count = len(rec.products)
        items.append(item)

    return PaginatedRecommendations(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + per_page) < total,
    )


@router.get("/{recommendation_id}", response_model=RecommendationDetailResponse)
async def get_recommendation(
    recommendation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Return full recommendation detail including products, roadmap, and insights."""
    rec = await _get_recommendation_or_404(recommendation_id, current_user.id, db)
    return _build_detail(rec)


@router.get("/{recommendation_id}/roadmap", response_model=RoadmapResponse)
async def get_roadmap(
    recommendation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Return the week-by-week skincare roadmap for a recommendation."""
    rec = await db.scalar(
        select(Recommendation).where(
            Recommendation.id == recommendation_id,
            Recommendation.user_id == current_user.id,
        )
    )
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found.")
    if not rec.roadmap_json:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roadmap not yet generated.")
    return RoadmapResponse(**rec.roadmap_json)


@router.get("/{recommendation_id}/products", response_model=list[RecommendedProductEntry])
async def get_recommendation_products(
    recommendation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Return all recommended products with reasons and usage instructions."""
    rec = await _get_recommendation_or_404(recommendation_id, current_user.id, db)
    detail = _build_detail(rec)
    return detail.products


@router.post("/{recommendation_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def submit_feedback(
    recommendation_id: uuid.UUID,
    body: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """User rates this recommendation 1–5 with optional text feedback."""
    rec = await db.scalar(
        select(Recommendation).where(
            Recommendation.id == recommendation_id,
            Recommendation.user_id == current_user.id,
        )
    )
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found.")
    rec.feedback_rating = body.rating
    rec.feedback_text = body.text
    await db.commit()
