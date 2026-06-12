"""
Admin service — analytics, user management, product CRUD, settings, TOTP.
All mutating operations write to audit_logs.
"""

import base64
import io
import math
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pyotp
from sqlalchemy import cast, func, select, text, update
from sqlalchemy.dialects.postgresql import ARRAY, TEXT
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import DermatologistProfile, PlatformSetting, ReviewQueue
from app.models.product import Product
from app.models.recommendation import Recommendation
from app.models.scan import SkinScan
from app.models.user import AuditLog, User, UserProfile
from app.schemas.admin import (
    AdminProductCreate,
    AdminProductUpdate,
    AnalyticsOverviewResponse,
    AuditLogItem,
    BiasReportItem,
    BiasReportResponse,
    ChartsDataResponse,
    CityDistributionItem,
    ConditionImprovementItem,
    DermVerificationItem,
    FitzpatrickDistributionItem,
    PaginatedAdminProducts,
    PaginatedAdminUsers,
    PaginatedAuditLogs,
    RegistrationTrendPoint,
    SkinTypeDistributionItem,
    SparklinePoint,
    TOTPSetupResponse,
)

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _write_audit(
    db: AsyncSession,
    admin_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    log = AuditLog(
        user_id=admin_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip_address,
        metadata_=metadata,
    )
    db.add(log)


def _pct(part: int, total: int) -> float:
    return round(part / total * 100, 1) if total else 0.0


# ---------------------------------------------------------------------------
# Analytics — Overview
# ---------------------------------------------------------------------------

async def get_analytics_overview(db: AsyncSession) -> AnalyticsOverviewResponse:
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    prev_month_start = month_start - timedelta(days=30)

    # Total users
    total_users = (await db.execute(
        select(func.count(User.id)).where(User.deleted_at.is_(None))
    )).scalar_one()

    # Users last 30 days
    users_this_month = (await db.execute(
        select(func.count(User.id)).where(
            User.deleted_at.is_(None),
            User.created_at >= month_start,
        )
    )).scalar_one()

    # Users prev 30 days
    users_prev_month = (await db.execute(
        select(func.count(User.id)).where(
            User.deleted_at.is_(None),
            User.created_at >= prev_month_start,
            User.created_at < month_start,
        )
    )).scalar_one()

    mom_growth = _pct(users_this_month - users_prev_month, users_prev_month) if users_prev_month else 0.0

    # Scans
    scans_today = (await db.execute(
        select(func.count(SkinScan.id)).where(SkinScan.created_at >= today_start)
    )).scalar_one()

    scans_week = (await db.execute(
        select(func.count(SkinScan.id)).where(SkinScan.created_at >= week_start)
    )).scalar_one()

    scans_month = (await db.execute(
        select(func.count(SkinScan.id)).where(SkinScan.created_at >= month_start)
    )).scalar_one()

    # Avg skin improvement (compare first vs latest recommendation skin_score per user)
    avg_improvement_row = await db.execute(text("""
        SELECT AVG(latest.skin_score - first.skin_score) AS avg_improvement
        FROM (
            SELECT DISTINCT ON (user_id) user_id, skin_score
            FROM recommendations
            WHERE skin_score IS NOT NULL
            ORDER BY user_id, created_at ASC
        ) first
        JOIN (
            SELECT DISTINCT ON (user_id) user_id, skin_score
            FROM recommendations
            WHERE skin_score IS NOT NULL
            ORDER BY user_id, created_at DESC
        ) latest ON first.user_id = latest.user_id
        WHERE latest.skin_score > first.skin_score
    """))
    avg_improvement = avg_improvement_row.scalar() or 0.0

    # Recommendation acceptance rate (feedback_rating >= 4)
    total_feedback = (await db.execute(
        select(func.count(Recommendation.id)).where(
            Recommendation.feedback_rating.isnot(None)
        )
    )).scalar_one()

    accepted_feedback = (await db.execute(
        select(func.count(Recommendation.id)).where(
            Recommendation.feedback_rating >= 4
        )
    )).scalar_one()

    acceptance_rate = _pct(accepted_feedback, total_feedback)

    # Pending derm reviews
    pending_reviews = (await db.execute(
        select(func.count(ReviewQueue.id)).where(ReviewQueue.status == "pending")
    )).scalar_one()

    # Active products
    active_products = (await db.execute(
        select(func.count(Product.id)).where(Product.is_active.is_(True))
    )).scalar_one()

    # 30-day sparkline (daily user registrations)
    sparkline_rows = await db.execute(text("""
        SELECT
            TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            COUNT(*) AS cnt
        FROM users
        WHERE deleted_at IS NULL
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day
    """))
    sparkline = [
        SparklinePoint(date=r.day, value=float(r.cnt))
        for r in sparkline_rows.fetchall()
    ]

    return AnalyticsOverviewResponse(
        total_users=total_users,
        users_mom_growth_pct=mom_growth,
        scans_today=scans_today,
        scans_this_week=scans_week,
        scans_this_month=scans_month,
        avg_skin_improvement_score=round(float(avg_improvement), 1),
        recommendation_acceptance_rate=acceptance_rate,
        pending_derm_reviews=pending_reviews,
        active_products=active_products,
        user_growth_sparkline=sparkline,
    )


# ---------------------------------------------------------------------------
# Analytics — Charts
# ---------------------------------------------------------------------------

async def get_charts_data(db: AsyncSession) -> ChartsDataResponse:
    # 90-day registration trend
    trend_rows = await db.execute(text("""
        SELECT
            TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            COUNT(*) AS cnt
        FROM users
        WHERE deleted_at IS NULL
          AND created_at >= NOW() - INTERVAL '90 days'
        GROUP BY day
        ORDER BY day
    """))
    registration_trend = [
        RegistrationTrendPoint(date=r.day, count=int(r.cnt))
        for r in trend_rows.fetchall()
    ]

    # Skin type distribution from questionnaire skin_type field
    skin_rows = await db.execute(text("""
        SELECT skin_type, COUNT(*) AS cnt
        FROM questionnaire_responses
        WHERE skin_type IS NOT NULL
        GROUP BY skin_type
        ORDER BY cnt DESC
    """))
    skin_type_data = skin_rows.fetchall()
    total_skin = sum(r.cnt for r in skin_type_data)
    skin_type_distribution = [
        SkinTypeDistributionItem(
            skin_type=r.skin_type,
            count=int(r.cnt),
            percentage=_pct(r.cnt, total_skin),
        )
        for r in skin_type_data
    ]

    # Top cities (limit 10)
    city_rows = await db.execute(text("""
        SELECT city, COUNT(*) AS cnt
        FROM user_profiles
        WHERE city IS NOT NULL
        GROUP BY city
        ORDER BY cnt DESC
        LIMIT 10
    """))
    top_cities = [
        CityDistributionItem(city=r.city, user_count=int(r.cnt))
        for r in city_rows.fetchall()
    ]

    # Fitzpatrick distribution
    fitz_rows = await db.execute(text("""
        SELECT skin_tone_category, COUNT(*) AS cnt
        FROM user_profiles
        WHERE skin_tone_category IS NOT NULL
        GROUP BY skin_tone_category
        ORDER BY skin_tone_category
    """))
    fitz_data = fitz_rows.fetchall()
    total_fitz = sum(r.cnt for r in fitz_data)
    fitzpatrick_distribution = [
        FitzpatrickDistributionItem(
            tone=r.skin_tone_category,
            count=int(r.cnt),
            percentage=_pct(r.cnt, total_fitz),
        )
        for r in fitz_data
    ]

    # Average improvement by skin condition (from progress_scans conditions_json)
    condition_rows = await db.execute(text("""
        SELECT
            cond_key AS condition,
            AVG((latest_val::float - baseline_val::float) / NULLIF(baseline_val::float, 0) * 100) AS avg_improvement,
            COUNT(DISTINCT user_id) AS user_count
        FROM (
            SELECT
                user_id,
                kv.key AS cond_key,
                FIRST_VALUE((kv.value::text)::float) OVER (
                    PARTITION BY user_id, kv.key ORDER BY created_at ASC
                ) AS baseline_val,
                LAST_VALUE((kv.value::text)::float) OVER (
                    PARTITION BY user_id, kv.key ORDER BY created_at ASC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                ) AS latest_val
            FROM progress_scans,
                 jsonb_each(conditions_json) AS kv
            WHERE conditions_json IS NOT NULL
        ) sub
        WHERE baseline_val > 0
        GROUP BY condition
        ORDER BY avg_improvement DESC
        LIMIT 8
    """))
    improvement_by_condition = []
    for r in condition_rows.fetchall():
        try:
            improvement_by_condition.append(
                ConditionImprovementItem(
                    condition=r.condition,
                    avg_improvement_pct=round(float(r.avg_improvement or 0), 1),
                    user_count=int(r.user_count),
                )
            )
        except Exception:
            continue

    return ChartsDataResponse(
        registration_trend=registration_trend,
        skin_type_distribution=skin_type_distribution,
        top_cities=top_cities,
        fitzpatrick_distribution=fitzpatrick_distribution,
        improvement_by_condition=improvement_by_condition,
    )


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------

async def get_admin_users(
    db: AsyncSession,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedAdminUsers:
    from app.schemas.admin import AdminUserListItem

    base_q = (
        select(
            User.id,
            User.email,
            User.full_name,
            User.role,
            User.is_verified,
            User.is_active,
            User.totp_enabled,
            User.last_login,
            User.created_at,
            UserProfile.city,
            func.count(SkinScan.id).label("scan_count"),
        )
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .outerjoin(SkinScan, SkinScan.user_id == User.id)
        .where(User.deleted_at.is_(None))
        .group_by(User.id, UserProfile.city)
        .order_by(User.created_at.desc())
    )

    if search:
        like = f"%{search}%"
        base_q = base_q.where(
            (User.email.ilike(like)) | (User.full_name.ilike(like))
        )
    if role:
        base_q = base_q.where(User.role == role)
    if is_active is not None:
        base_q = base_q.where(User.is_active.is_(is_active))

    total = (await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )).scalar_one()

    offset = (page - 1) * page_size
    rows = (await db.execute(base_q.offset(offset).limit(page_size))).fetchall()

    items = [
        AdminUserListItem(
            id=r.id,
            email=r.email,
            full_name=r.full_name,
            role=r.role,
            is_verified=r.is_verified,
            is_active=r.is_active,
            totp_enabled=r.totp_enabled,
            last_login=r.last_login,
            scan_count=r.scan_count,
            city=r.city,
            created_at=r.created_at,
        )
        for r in rows
    ]

    return PaginatedAdminUsers(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


async def change_user_role(
    db: AsyncSession,
    target_user_id: uuid.UUID,
    new_role: str,
    admin_id: uuid.UUID,
    ip: Optional[str] = None,
) -> None:
    user = (await db.execute(
        select(User).where(User.id == target_user_id, User.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    if str(target_user_id) == str(admin_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Admin cannot change own role")

    old_role = user.role
    await db.execute(
        update(User).where(User.id == target_user_id).values(role=new_role)
    )
    await _write_audit(
        db, admin_id, "role_change", "user", target_user_id, ip,
        {"old_role": old_role, "new_role": new_role},
    )
    await db.commit()


async def change_user_status(
    db: AsyncSession,
    target_user_id: uuid.UUID,
    action: str,
    admin_id: uuid.UUID,
    ip: Optional[str] = None,
    reason: Optional[str] = None,
) -> None:
    user = (await db.execute(
        select(User).where(User.id == target_user_id, User.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    if str(target_user_id) == str(admin_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Admin cannot act on own account")

    now = datetime.now(UTC)
    if action == "suspend":
        await db.execute(update(User).where(User.id == target_user_id).values(is_active=False))
    elif action == "activate":
        await db.execute(update(User).where(User.id == target_user_id).values(is_active=True))
    elif action == "delete":
        await db.execute(
            update(User).where(User.id == target_user_id).values(deleted_at=now, is_active=False)
        )

    await _write_audit(
        db, admin_id, f"user_{action}", "user", target_user_id, ip,
        {"reason": reason},
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Dermatologist Verification
# ---------------------------------------------------------------------------

async def get_derm_verification_queue(db: AsyncSession) -> list[DermVerificationItem]:
    rows = await db.execute(
        select(
            User.id,
            User.full_name,
            User.email,
            User.created_at,
            DermatologistProfile.medical_license_number,
            DermatologistProfile.specialization,
            DermatologistProfile.hospital_affiliation,
            DermatologistProfile.verification_document_url,
        )
        .join(DermatologistProfile, DermatologistProfile.user_id == User.id)
        .where(
            User.role == "DERMATOLOGIST",
            User.deleted_at.is_(None),
            DermatologistProfile.verified_at.is_(None),
        )
        .order_by(User.created_at.asc())
    )
    return [
        DermVerificationItem(
            user_id=r.id,
            full_name=r.full_name,
            email=r.email,
            medical_license_number=r.medical_license_number,
            specialization=r.specialization,
            hospital_affiliation=r.hospital_affiliation,
            verification_document_url=r.verification_document_url,
            registered_at=r.created_at,
        )
        for r in rows.fetchall()
    ]


async def verify_dermatologist(
    db: AsyncSession,
    target_user_id: uuid.UUID,
    action: str,
    rejection_reason: Optional[str],
    admin_id: uuid.UUID,
    ip: Optional[str] = None,
) -> None:
    from fastapi import HTTPException

    derm_profile = (await db.execute(
        select(DermatologistProfile).where(DermatologistProfile.user_id == target_user_id)
    )).scalar_one_or_none()
    if not derm_profile:
        raise HTTPException(status_code=404, detail="Dermatologist profile not found")

    now = datetime.now(UTC)
    if action == "approve":
        derm_profile.verified_at = now
        await db.execute(
            update(User).where(User.id == target_user_id).values(is_verified=True)
        )
        meta = {"action": "approve"}
    else:
        meta = {"action": "reject", "reason": rejection_reason}
        await db.execute(
            update(User).where(User.id == target_user_id).values(is_active=False)
        )

    await _write_audit(
        db, admin_id, f"derm_verification_{action}", "user", target_user_id, ip, meta
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Product Management
# ---------------------------------------------------------------------------

async def get_admin_products(
    db: AsyncSession,
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedAdminProducts:
    from app.schemas.admin import AdminProductListItem

    base_q = (
        select(
            Product.id,
            Product.brand,
            Product.product_name,
            Product.category,
            Product.price_inr,
            Product.is_active,
            Product.is_dermatologist_approved,
            Product.rating_avg,
            Product.review_count,
            Product.created_at,
            func.count(text("rp.id")).label("recommendation_count"),
        )
        .outerjoin(text("recommendation_products rp"), text("rp.product_id = products.id"))
        .group_by(Product.id)
        .order_by(Product.created_at.desc())
    )

    if search:
        like = f"%{search}%"
        base_q = base_q.where(Product.product_name.ilike(like))
    if status == "active":
        base_q = base_q.where(Product.is_active.is_(True))
    elif status == "inactive":
        base_q = base_q.where(Product.is_active.is_(False))

    total = (await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )).scalar_one()

    offset = (page - 1) * page_size
    rows = (await db.execute(base_q.offset(offset).limit(page_size))).fetchall()

    items = [
        AdminProductListItem(
            id=r.id,
            brand=r.brand,
            product_name=r.product_name,
            category=r.category,
            price_inr=r.price_inr,
            is_active=r.is_active,
            is_dermatologist_approved=r.is_dermatologist_approved,
            rating_avg=r.rating_avg,
            review_count=r.review_count,
            recommendation_count=int(r.recommendation_count),
            created_at=r.created_at,
        )
        for r in rows
    ]

    return PaginatedAdminProducts(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


async def create_product(
    db: AsyncSession,
    data: AdminProductCreate,
    admin_id: uuid.UUID,
    ip: Optional[str] = None,
) -> Product:
    product = Product(**data.model_dump(), approval_dermatologist_id=admin_id if data.is_dermatologist_approved else None)
    db.add(product)
    await db.flush()
    await _write_audit(db, admin_id, "product_create", "product", product.id, ip)
    await db.commit()
    await db.refresh(product)
    return product


async def update_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    data: AdminProductUpdate,
    admin_id: uuid.UUID,
    ip: Optional[str] = None,
) -> Product:
    from fastapi import HTTPException

    product = (await db.execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = data.model_dump(exclude_none=True)
    for key, val in updates.items():
        setattr(product, key, val)

    await _write_audit(db, admin_id, "product_update", "product", product_id, ip, updates)
    await db.commit()
    await db.refresh(product)
    return product


async def soft_delete_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip: Optional[str] = None,
) -> None:
    from fastapi import HTTPException

    product = (await db.execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = False
    await _write_audit(db, admin_id, "product_soft_delete", "product", product_id, ip)
    await db.commit()


async def regenerate_product_embedding(
    db: AsyncSession,
    product_id: uuid.UUID,
    admin_id: uuid.UUID,
    ip: Optional[str] = None,
) -> dict:
    from fastapi import HTTPException

    product = (await db.execute(
        select(Product).where(Product.id == product_id, Product.is_active.is_(True))
    )).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or inactive")

    # In a real system this would enqueue a Celery/RQ task to re-embed via Pinecone.
    # Here we mark the embedding as stale so the background worker picks it up.
    await db.execute(text(
        "UPDATE product_embeddings SET updated_at = '2000-01-01' WHERE product_id = :pid"
    ), {"pid": str(product_id)})
    await _write_audit(db, admin_id, "product_embedding_regenerate", "product", product_id, ip)
    await db.commit()

    return {"product_id": product_id, "status": "queued", "message": "Embedding marked for regeneration"}


# ---------------------------------------------------------------------------
# Platform Settings
# ---------------------------------------------------------------------------

async def get_platform_settings(db: AsyncSession) -> dict[str, Any]:
    rows = (await db.execute(select(PlatformSetting))).scalars().all()
    return {r.key: r.value for r in rows}


async def update_platform_settings(
    db: AsyncSession,
    updates: dict[str, Any],
    admin_id: uuid.UUID,
    ip: Optional[str] = None,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    for key, value in updates.items():
        existing = (await db.execute(
            select(PlatformSetting).where(PlatformSetting.key == key)
        )).scalar_one_or_none()
        if existing:
            existing.value = value
            existing.updated_by = admin_id
            existing.updated_at = now
        else:
            db.add(PlatformSetting(key=key, value=value, updated_by=admin_id, updated_at=now))

    await _write_audit(db, admin_id, "settings_update", "platform_settings", None, ip, updates)
    await db.commit()
    return await get_platform_settings(db)


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------

async def get_audit_logs(
    db: AsyncSession,
    user_id: Optional[uuid.UUID] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
) -> PaginatedAuditLogs:
    base_q = (
        select(
            AuditLog.id,
            AuditLog.user_id,
            User.email.label("user_email"),
            AuditLog.action,
            AuditLog.entity_type,
            AuditLog.entity_id,
            AuditLog.ip_address,
            AuditLog.timestamp,
            AuditLog.metadata_,
        )
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.timestamp.desc())
    )

    if user_id:
        base_q = base_q.where(AuditLog.user_id == user_id)
    if action:
        base_q = base_q.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        base_q = base_q.where(AuditLog.entity_type == entity_type)
    if date_from:
        base_q = base_q.where(AuditLog.timestamp >= date_from)
    if date_to:
        base_q = base_q.where(AuditLog.timestamp <= date_to)

    total = (await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )).scalar_one()

    offset = (page - 1) * page_size
    rows = (await db.execute(base_q.offset(offset).limit(page_size))).fetchall()

    items = [
        AuditLogItem(
            id=r.id,
            user_id=r.user_id,
            user_email=r.user_email,
            action=r.action,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            ip_address=r.ip_address,
            timestamp=r.timestamp,
            metadata=r.metadata_,
        )
        for r in rows
    ]

    return PaginatedAuditLogs(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ---------------------------------------------------------------------------
# Bias Report
# ---------------------------------------------------------------------------

async def get_bias_report(db: AsyncSession) -> BiasReportResponse:
    rows = await db.execute(text("""
        SELECT
            up.skin_tone_category AS tone,
            COUNT(DISTINCT up.user_id) AS user_count,
            AVG(s.analysis_confidence_score) AS avg_confidence,
            COUNT(r.id) AS recommendation_count,
            AVG(r.skin_score) AS avg_skin_score
        FROM user_profiles up
        LEFT JOIN skin_scans s ON s.user_id = up.user_id
        LEFT JOIN recommendations r ON r.user_id = up.user_id
        WHERE up.skin_tone_category IS NOT NULL
        GROUP BY up.skin_tone_category
        ORDER BY up.skin_tone_category
    """))

    items = []
    for r in rows.fetchall():
        items.append(BiasReportItem(
            fitzpatrick_tone=r.tone,
            user_count=int(r.user_count),
            avg_confidence=round(float(r.avg_confidence or 0), 3),
            recommendation_count=int(r.recommendation_count),
            avg_skin_score=round(float(r.avg_skin_score or 0), 1),
        ))

    overall_avg = sum(i.avg_confidence for i in items) / len(items) if items else 0.0
    # Tones with confidence meaningfully below the overall average (more than 10% below)
    threshold = overall_avg * 0.9
    tones_below = [i.fitzpatrick_tone for i in items if i.avg_confidence < threshold]

    return BiasReportResponse(
        items=items,
        overall_avg_confidence=round(overall_avg, 3),
        tones_below_threshold=tones_below,
        generated_at=datetime.now(UTC),
    )


# ---------------------------------------------------------------------------
# TOTP / Admin 2FA
# ---------------------------------------------------------------------------

async def setup_totp(db: AsyncSession, user: User) -> TOTPSetupResponse:
    """Generate a new TOTP secret and store it (unconfirmed until verify_totp is called)."""
    secret = pyotp.random_base32()
    user.totp_secret = secret
    user.totp_enabled = False
    await db.commit()

    issuer = "SkinAI Admin"
    otp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=issuer)

    return TOTPSetupResponse(secret=secret, otpauth_uri=otp_uri)


async def verify_and_enable_totp(db: AsyncSession, user: User, code: str) -> bool:
    """Verify a TOTP code against the stored secret and enable TOTP if correct."""
    if not user.totp_secret:
        return False
    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(code, valid_window=1):
        user.totp_enabled = True
        await db.commit()
        return True
    return False


async def disable_totp(db: AsyncSession, user: User, code: str) -> bool:
    """Verify code then disable TOTP."""
    if not user.totp_enabled or not user.totp_secret:
        return False
    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(code, valid_window=1):
        user.totp_enabled = False
        user.totp_secret = None
        await db.commit()
        return True
    return False


def check_totp_code(secret: str, code: str) -> bool:
    """Stateless check — used by the route dependency."""
    return pyotp.TOTP(secret).verify(code, valid_window=1)
