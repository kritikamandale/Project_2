"""Dermatologist service — review queue, case assembly, encryption, stats."""

import base64
import hashlib
import os
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from cryptography.fernet import Fernet
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.admin import ReviewQueue
from app.models.product import Product
from app.models.questionnaire import EnvironmentProfile, QuestionnaireResponse, SkincareRoutineCurrent
from app.models.recommendation import Recommendation, RecommendationProduct
from app.models.scan import SkinCondition, SkinScan
from app.models.user import User, UserProfile
from app.schemas.dermatologist import (
    AnonymizedPatient,
    CaseDetailResponse,
    ConditionDetail,
    DermStatsResponse,
    ProductForReview,
    ReviewQueueItem,
    ReviewQueueResponse,
)


# ---------------------------------------------------------------------------
# Envelope encryption helpers
# ---------------------------------------------------------------------------

def _derive_fernet_key(user_id: uuid.UUID) -> bytes:
    """
    Derives a deterministic per-user Fernet key from the platform secret + user_id.
    Using PBKDF2-HMAC-SHA256 with 100k iterations.
    """
    salt = str(user_id).encode()
    key_bytes = hashlib.pbkdf2_hmac(
        "sha256",
        settings.secret_key.encode(),
        salt,
        iterations=100_000,
        dklen=32,
    )
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_patient_note(note: str, user_id: uuid.UUID) -> str:
    """Encrypt derm-to-patient note with user-derived key. Returns base64 ciphertext."""
    key = _derive_fernet_key(user_id)
    f = Fernet(key)
    return f.encrypt(note.encode()).decode()


def decrypt_patient_note(ciphertext: str, user_id: uuid.UUID) -> Optional[str]:
    """Decrypt patient note. Returns None on any decryption failure."""
    try:
        key = _derive_fernet_key(user_id)
        f = Fernet(key)
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Anonymization helpers
# ---------------------------------------------------------------------------

def _anonymize_id(user_id: uuid.UUID) -> str:
    return f"PAT-{str(user_id).replace('-', '')[:8].upper()}"


def _age_group(dob: Optional[date]) -> Optional[str]:
    if not dob:
        return None
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    brackets = [(18, "18–24"), (25, "25–34"), (35, "35–44"), (45, "45–54"), (55, "55–64")]
    for lower, label in brackets:
        if age < lower + (10 if lower < 55 else 100):
            if age >= lower:
                return label
    return "65+"


def _current_routine_items(routine: Optional[SkincareRoutineCurrent]) -> list[str]:
    if not routine:
        return []
    mapping = {
        "cleanser": routine.uses_cleanser,
        "toner": routine.uses_toner,
        "serum": getattr(routine, "uses_serum", False),
        "moisturiser": getattr(routine, "uses_moisturizer", False),
        "sunscreen": getattr(routine, "uses_sunscreen", False),
        "eye cream": getattr(routine, "uses_eye_cream", False),
        "face mask": getattr(routine, "uses_face_mask", False),
    }
    return [k for k, v in mapping.items() if v]


# ---------------------------------------------------------------------------
# Queue
# ---------------------------------------------------------------------------

async def get_review_queue(
    db: AsyncSession,
    dermatologist_id: uuid.UUID,
    page: int = 1,
    per_page: int = 20,
    status_filter: Optional[str] = None,
    skin_type_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    sort_by: str = "submission_date",
    sort_dir: str = "asc",
) -> ReviewQueueResponse:
    base_q = (
        select(ReviewQueue)
        .join(Recommendation, ReviewQueue.recommendation_id == Recommendation.id)
        .options(
            selectinload(ReviewQueue.recommendation).selectinload(Recommendation.scan),
        )
        .where(
            ReviewQueue.assigned_to == dermatologist_id,
        )
    )

    if status_filter:
        base_q = base_q.where(ReviewQueue.status == status_filter)
    if priority_filter:
        base_q = base_q.where(ReviewQueue.priority == priority_filter)
    if date_from:
        base_q = base_q.where(ReviewQueue.created_at >= date_from)
    if date_to:
        base_q = base_q.where(ReviewQueue.created_at <= date_to)

    # Count total
    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Sort
    sort_col = ReviewQueue.created_at
    if sort_by == "priority":
        sort_col = ReviewQueue.priority
    elif sort_by == "status":
        sort_col = ReviewQueue.status

    if sort_dir == "desc":
        sort_col = sort_col.desc()

    paginated_q = base_q.order_by(sort_col).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(paginated_q)).scalars().all()

    items: list[ReviewQueueItem] = []
    for rq in rows:
        rec: Recommendation = rq.recommendation
        scan: Optional[SkinScan] = rec.scan if rec else None

        # Skin type from scan raw_analysis_json
        skin_type = None
        fitzpatrick = None
        if scan and scan.raw_analysis_json:
            skin_type = scan.raw_analysis_json.get("skin_type")
            fitzpatrick = scan.raw_analysis_json.get("fitzpatrick_tone")

        # Filter by skin_type if requested
        if skin_type_filter and skin_type != skin_type_filter:
            continue

        # Top conditions from skin scan conditions
        top_conditions: list[str] = []
        if scan:
            cond_q = (
                select(SkinCondition.condition_name)
                .where(SkinCondition.scan_id == scan.id)
                .order_by(SkinCondition.severity.desc())
                .limit(3)
            )
            top_conditions = list((await db.execute(cond_q)).scalars().all())

        # Age group: need UserProfile
        profile_q = select(UserProfile).where(UserProfile.user_id == rec.user_id)
        profile: Optional[UserProfile] = (await db.execute(profile_q)).scalar_one_or_none()

        items.append(
            ReviewQueueItem(
                queue_id=rq.id,
                recommendation_id=rec.id,
                patient_id=_anonymize_id(rec.user_id),
                skin_type=skin_type,
                fitzpatrick_tone=fitzpatrick,
                top_conditions=top_conditions,
                submission_date=rq.created_at,
                priority=rq.priority,
                status=rq.status,
                age_group=_age_group(profile.date_of_birth if profile else None),
            )
        )

    total_pages = max(1, (total + per_page - 1) // per_page)
    return ReviewQueueResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


# ---------------------------------------------------------------------------
# Case detail
# ---------------------------------------------------------------------------

async def get_case_detail(
    db: AsyncSession,
    recommendation_id: uuid.UUID,
    dermatologist_id: uuid.UUID,
) -> CaseDetailResponse:
    """
    Returns full anonymised case. Raises ValueError if not found or not assigned.
    """
    rq_q = (
        select(ReviewQueue)
        .where(
            ReviewQueue.recommendation_id == recommendation_id,
            ReviewQueue.assigned_to == dermatologist_id,
        )
        .options(selectinload(ReviewQueue.recommendation))
    )
    rq: Optional[ReviewQueue] = (await db.execute(rq_q)).scalar_one_or_none()
    if not rq:
        raise ValueError("Case not found or not assigned to you")

    rec: Recommendation = rq.recommendation

    # Mark in_review + stamp start time if first open
    if rq.status == "pending":
        rq.status = "in_review"
    if not rq.review_started_at:
        rq.review_started_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(rq)

    # ---- Scan ----
    scan_q = (
        select(SkinScan)
        .options(selectinload(SkinScan.conditions))
        .where(SkinScan.id == rec.scan_id)
    )
    scan: Optional[SkinScan] = (await db.execute(scan_q)).scalar_one_or_none()

    skin_type = None
    fitzpatrick = None
    if scan and scan.raw_analysis_json:
        skin_type = scan.raw_analysis_json.get("skin_type")
        fitzpatrick = scan.raw_analysis_json.get("fitzpatrick_tone")

    conditions: list[ConditionDetail] = []
    if scan:
        for c in scan.conditions:
            conditions.append(
                ConditionDetail(
                    name=c.condition_name,
                    severity=c.severity,
                    affected_zone=getattr(c, "affected_zone", None),
                )
            )

    # ---- Profile ----
    profile_q = select(UserProfile).where(UserProfile.user_id == rec.user_id)
    profile: Optional[UserProfile] = (await db.execute(profile_q)).scalar_one_or_none()

    # ---- Questionnaire ----
    q_resp: Optional[QuestionnaireResponse] = None
    if rec.questionnaire_id:
        q_q = select(QuestionnaireResponse).where(
            QuestionnaireResponse.id == rec.questionnaire_id
        )
        q_resp = (await db.execute(q_q)).scalar_one_or_none()

    # ---- Environment ----
    env_q = select(EnvironmentProfile).where(EnvironmentProfile.user_id == rec.user_id)
    env: Optional[EnvironmentProfile] = (await db.execute(env_q)).scalar_one_or_none()

    # ---- Routine ----
    routine_q = select(SkincareRoutineCurrent).where(
        SkincareRoutineCurrent.user_id == rec.user_id
    )
    routine: Optional[SkincareRoutineCurrent] = (
        await db.execute(routine_q)
    ).scalar_one_or_none()

    # ---- Build patient block ----
    patient = AnonymizedPatient(
        patient_id=_anonymize_id(rec.user_id),
        age_group=_age_group(profile.date_of_birth if profile else None),
        gender=profile.gender if profile else None,
        city=profile.city if profile else (env.city if env else None),
        skin_type=skin_type,
        fitzpatrick_tone=fitzpatrick,
        conditions=conditions,
        confidence_score=rec.confidence_score,
        sleep_hours_avg=q_resp.sleep_hours_avg if q_resp else None,
        sleep_quality=q_resp.sleep_quality if q_resp else None,
        stress_level=q_resp.stress_level if q_resp else None,
        water_intake_liters=q_resp.water_intake_liters if q_resp else None,
        diet_type=q_resp.diet_type if q_resp else None,
        exercise_frequency=q_resp.exercise_frequency if q_resp else None,
        work_environment=q_resp.work_environment if q_resp else None,
        pollution_exposure=q_resp.pollution_exposure if q_resp else None,
        climate_zone=env.climate_zone if env else None,
        avg_humidity_pct=env.avg_humidity_pct if env else None,
        uv_index=env.uv_index if env else None,
        water_hardness=q_resp.water_hardness if q_resp else (
            env.water_hardness if env else None
        ),
        current_routine_items=_current_routine_items(routine),
        diagnosed_conditions=list(q_resp.diagnosed_conditions or []) if q_resp else [],
        medication_affects_skin=q_resp.medication_affects_skin if q_resp else None,
        medication_name=(
            q_resp.medication_name_text
            if q_resp and q_resp.medication_affects_skin
            else None
        ),
    )

    # ---- Products ----
    prod_q = (
        select(RecommendationProduct)
        .options(selectinload(RecommendationProduct.product))
        .where(RecommendationProduct.recommendation_id == rec.id)
        .order_by(RecommendationProduct.order_in_routine)
    )
    rec_products = (await db.execute(prod_q)).scalars().all()

    products_for_review: list[ProductForReview] = []
    for rp in rec_products:
        p: Product = rp.product
        products_for_review.append(
            ProductForReview(
                recommendation_product_id=rp.id,
                product_id=p.id,
                product_name=p.product_name,
                brand=p.brand,
                category=p.category,
                key_ingredients=list(p.key_ingredients or []),
                price_inr=p.price_inr,
                product_url=p.product_url,
                ai_reasoning=rp.reason_text or "",
                highlighted_ingredient=rp.highlighted_ingredient,
                usage_instruction=rp.usage_instruction,
                time_of_day=rp.time_of_day,
                phase=rp.phase,
                order_in_routine=rp.order_in_routine,
                derm_action=getattr(rp, "derm_action", None),
                derm_override_note=getattr(rp, "derm_override_note", None),
            )
        )

    # ---- Roadmap summary ----
    roadmap_phase_count = 0
    roadmap_total_weeks = 0
    if rec.roadmap_json:
        phases = rec.roadmap_json.get("phases", [])
        roadmap_phase_count = len(phases)
        roadmap_total_weeks = rec.roadmap_json.get("total_weeks", rec.roadmap_weeks)

    # ---- Decrypt patient note if exists ----
    patient_note = None
    if rq.patient_encrypted_note:
        patient_note = decrypt_patient_note(rq.patient_encrypted_note, rec.user_id)

    # ---- AI summary ----
    ai_summary = rec.ai_reasoning
    if not ai_summary and rec.metadata_json:
        ai_summary = rec.metadata_json.get("dermatologist_note")

    return CaseDetailResponse(
        recommendation_id=rec.id,
        queue_id=rq.id,
        status=rq.status,
        priority=rq.priority,
        requires_derm_review=rec.requires_derm_review,
        patient=patient,
        ai_summary=ai_summary,
        skin_score=rec.skin_score,
        confidence_score=rec.confidence_score,
        estimated_monthly_cost_inr=rec.estimated_monthly_cost_inr,
        allergen_flags=list(rec.allergen_flags or []),
        products=products_for_review,
        roadmap_phase_count=roadmap_phase_count,
        roadmap_total_weeks=roadmap_total_weeks,
        patient_note=patient_note,
        submission_date=rq.created_at,
        review_started_at=rq.review_started_at,
    )


# ---------------------------------------------------------------------------
# Submit review
# ---------------------------------------------------------------------------

async def submit_review(
    db: AsyncSession,
    recommendation_id: uuid.UUID,
    dermatologist_id: uuid.UUID,
    decision: str,
    reviewer_notes: Optional[str],
    patient_note: Optional[str],
    product_actions: Optional[dict],
) -> ReviewQueue:
    rq_q = select(ReviewQueue).where(
        ReviewQueue.recommendation_id == recommendation_id,
        ReviewQueue.assigned_to == dermatologist_id,
    )
    rq: Optional[ReviewQueue] = (await db.execute(rq_q)).scalar_one_or_none()
    if not rq:
        raise ValueError("Case not found or not assigned to you")

    rec_q = select(Recommendation).where(Recommendation.id == recommendation_id)
    rec: Optional[Recommendation] = (await db.execute(rec_q)).scalar_one_or_none()
    if not rec:
        raise ValueError("Recommendation not found")

    now = datetime.now(timezone.utc)

    # Map decision to status
    status_map = {
        "approved": "approved",
        "rejected": "rejected",
        "request_info": "escalated",
    }
    rq.status = status_map[decision]
    rq.reviewer_notes = reviewer_notes
    rq.completed_at = now

    # Encrypt patient note with user's derived key
    if patient_note:
        rq.patient_encrypted_note = encrypt_patient_note(patient_note, rec.user_id)

    # Update recommendation
    rec.is_dermatologist_reviewed = True
    rec.reviewer_id = dermatologist_id
    rec.reviewed_at = now

    # Apply per-product actions
    if product_actions:
        for prod_id_str, action_req in product_actions.items():
            try:
                prod_uuid = uuid.UUID(prod_id_str)
            except ValueError:
                continue
            rp_q = select(RecommendationProduct).where(
                RecommendationProduct.id == prod_uuid,
                RecommendationProduct.recommendation_id == recommendation_id,
            )
            rp: Optional[RecommendationProduct] = (
                await db.execute(rp_q)
            ).scalar_one_or_none()
            if rp:
                rp.derm_action = action_req["action"]
                if action_req.get("override_note"):
                    rp.derm_override_note = action_req["override_note"]

    await db.commit()
    await db.refresh(rq)
    return rq


# ---------------------------------------------------------------------------
# Per-product override
# ---------------------------------------------------------------------------

async def override_product(
    db: AsyncSession,
    recommendation_id: uuid.UUID,
    product_id: uuid.UUID,
    dermatologist_id: uuid.UUID,
    action: str,
    override_note: Optional[str],
) -> RecommendationProduct:
    # Verify assignment
    rq_q = select(ReviewQueue).where(
        ReviewQueue.recommendation_id == recommendation_id,
        ReviewQueue.assigned_to == dermatologist_id,
    )
    rq = (await db.execute(rq_q)).scalar_one_or_none()
    if not rq:
        raise ValueError("Case not found or not assigned to you")

    rp_q = select(RecommendationProduct).where(
        RecommendationProduct.id == product_id,
        RecommendationProduct.recommendation_id == recommendation_id,
    )
    rp: Optional[RecommendationProduct] = (
        await db.execute(rp_q)
    ).scalar_one_or_none()
    if not rp:
        raise ValueError("Product not found in this recommendation")

    rp.derm_action = action
    if override_note is not None:
        rp.derm_override_note = override_note

    await db.commit()
    await db.refresh(rp)
    return rp


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def get_derm_stats(
    db: AsyncSession,
    dermatologist_id: uuid.UUID,
) -> DermStatsResponse:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total assigned this month
    total_q = select(func.count(ReviewQueue.id)).where(
        ReviewQueue.assigned_to == dermatologist_id,
        ReviewQueue.created_at >= month_start,
    )
    total_this_month: int = (await db.execute(total_q)).scalar_one()

    # Pending
    pending_q = select(func.count(ReviewQueue.id)).where(
        ReviewQueue.assigned_to == dermatologist_id,
        ReviewQueue.status.in_(["pending", "in_review"]),
    )
    pending: int = (await db.execute(pending_q)).scalar_one()

    # Approved today
    approved_q = select(func.count(ReviewQueue.id)).where(
        ReviewQueue.assigned_to == dermatologist_id,
        ReviewQueue.status == "approved",
        ReviewQueue.completed_at >= today_start,
    )
    approved_today: int = (await db.execute(approved_q)).scalar_one()

    # Average review time (seconds → minutes)
    avg_q = select(
        func.avg(
            func.extract(
                "epoch",
                ReviewQueue.completed_at - ReviewQueue.review_started_at,
            )
        )
    ).where(
        ReviewQueue.assigned_to == dermatologist_id,
        ReviewQueue.completed_at.isnot(None),
        ReviewQueue.review_started_at.isnot(None),
    )
    avg_seconds = (await db.execute(avg_q)).scalar_one()
    avg_minutes = round(avg_seconds / 60, 1) if avg_seconds else None

    return DermStatsResponse(
        total_assigned_this_month=total_this_month,
        pending_review=pending,
        approved_today=approved_today,
        avg_review_time_minutes=avg_minutes,
    )


# ---------------------------------------------------------------------------
# Product suggestion
# ---------------------------------------------------------------------------

async def create_product_suggestion(
    db: AsyncSession,
    dermatologist_id: uuid.UUID,
    suggestion_data: dict,
) -> uuid.UUID:
    """Inserts a new product suggestion row. Returns the new row UUID."""
    from sqlalchemy import text

    suggestion_id = uuid.uuid4()
    stmt = text("""
        INSERT INTO product_suggestions
          (id, suggested_by, product_name, brand, category, price_inr,
           product_url, key_ingredients, targets_conditions, reason_for_suggestion)
        VALUES
          (:id, :suggested_by, :product_name, :brand, :category, :price_inr,
           :product_url, :key_ingredients, :targets_conditions, :reason_for_suggestion)
    """)
    await db.execute(
        stmt,
        {
            "id": suggestion_id,
            "suggested_by": dermatologist_id,
            "product_name": suggestion_data["product_name"],
            "brand": suggestion_data["brand"],
            "category": suggestion_data["category"],
            "price_inr": suggestion_data.get("price_inr"),
            "product_url": suggestion_data.get("product_url"),
            "key_ingredients": suggestion_data.get("key_ingredients", []),
            "targets_conditions": suggestion_data.get("targets_conditions", []),
            "reason_for_suggestion": suggestion_data["reason_for_suggestion"],
        },
    )
    await db.commit()
    return suggestion_id
