"""
Privacy router — DPDP Act 2023 compliance endpoints.

DELETE /me  — Right to Erasure: hard-deletes all user data
GET    /me/export — Data Portability: returns ZIP of all user data as JSON
"""

import io
import json
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_verified_user, get_redis

router = APIRouter()


class ErasureResponse(BaseModel):
    message: str
    erased_at: datetime


# ---------------------------------------------------------------------------
# DELETE /api/v1/users/me  — Right to Erasure
# ---------------------------------------------------------------------------

@router.delete(
    "/me",
    response_model=ErasureResponse,
    summary="Right to Erasure — permanently delete all your data (DPDP Act 2023)",
)
async def erase_account(
    current_user=Depends(get_current_verified_user),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    redis=Depends(get_redis),
):
    user_id: uuid.UUID = current_user.id

    # Revoke all refresh tokens
    from app.models.user import RefreshToken
    await db.execute(
        delete(RefreshToken).where(RefreshToken.user_id == user_id)
    )

    # Hard-delete scan records (feature vectors, analysis results)
    await db.execute(
        text("DELETE FROM skin_scans WHERE user_id = :uid"),
        {"uid": user_id},
    )

    # Hard-delete questionnaire responses
    await db.execute(
        text("DELETE FROM questionnaire_responses WHERE user_id = :uid"),
        {"uid": user_id},
    )

    # Hard-delete recommendations (cascades recommendation_products)
    await db.execute(
        text("DELETE FROM recommendations WHERE user_id = :uid"),
        {"uid": user_id},
    )

    # Hard-delete progress scans, checkins, product feedback
    await db.execute(
        text("DELETE FROM progress_scans WHERE user_id = :uid"),
        {"uid": user_id},
    )
    await db.execute(
        text("DELETE FROM routine_checkins WHERE user_id = :uid"),
        {"uid": user_id},
    )
    await db.execute(
        text("DELETE FROM product_feedback WHERE user_id = :uid"),
        {"uid": user_id},
    )

    # Hard-delete in-app notifications
    await db.execute(
        text("DELETE FROM in_app_notifications WHERE user_id = :uid"),
        {"uid": user_id},
    )

    # Keep audit_logs — legally required records; nullify user_id foreign key
    await db.execute(
        text(
            "UPDATE audit_logs SET user_id = NULL, "
            "metadata = jsonb_set(COALESCE(metadata, '{}'), '{erased}', 'true') "
            "WHERE user_id = :uid"
        ),
        {"uid": user_id},
    )

    # Hard-delete user profile and user row (cascades via FK)
    from app.models.user import User
    await db.execute(
        delete(User).where(User.id == user_id)
    )

    await db.commit()

    # Flush Redis keys for this user
    pattern = f"*:{user_id}*"
    keys = await redis.keys(pattern)
    if keys:
        await redis.delete(*keys)

    return ErasureResponse(
        message=(
            "Your account and all associated personal data have been permanently deleted. "
            "Audit records required by law have been anonymised and retained."
        ),
        erased_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# GET /api/v1/users/me/export — Data Portability (ZIP of JSON)
# ---------------------------------------------------------------------------

@router.get(
    "/me/export",
    summary="Data Export — download all your data as a ZIP of JSON files (DPDP Act 2023)",
)
async def export_account_data(
    current_user=Depends(get_current_verified_user),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    user_id: uuid.UUID = current_user.id

    # Collect all user data via raw SQL so we're schema-agnostic
    tables = {
        "profile": "SELECT * FROM user_profiles WHERE user_id = :uid",
        "scans": "SELECT id, created_at, skin_type, fitzpatrick_tone, analysis_confidence_score FROM skin_scans WHERE user_id = :uid",
        "questionnaires": "SELECT * FROM questionnaire_responses WHERE user_id = :uid",
        "recommendations": "SELECT id, created_at, skin_score, estimated_monthly_cost_inr, requires_derm_review FROM recommendations WHERE user_id = :uid",
        "progress_scans": "SELECT * FROM progress_scans WHERE user_id = :uid",
        "routine_checkins": "SELECT * FROM routine_checkins WHERE user_id = :uid",
        "product_feedback": "SELECT * FROM product_feedback WHERE user_id = :uid",
    }

    export_data: dict = {
        "export_generated_at": datetime.now(timezone.utc).isoformat(),
        "user_id": str(user_id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at.isoformat() if hasattr(current_user, "created_at") else None,
    }

    for key, query in tables.items():
        result = await db.execute(text(query), {"uid": user_id})
        rows = result.mappings().all()
        export_data[key] = [dict(row) for row in rows]

    # Build ZIP in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "my_skinest_data.json",
            json.dumps(export_data, indent=2, default=str),
        )
        zf.writestr(
            "README.txt",
            (
                "Skinest — Personal Data Export\n"
                "===============================\n"
                f"Generated: {export_data['export_generated_at']}\n\n"
                "This ZIP contains all personal data held about you under the\n"
                "Digital Personal Data Protection (DPDP) Act 2023.\n\n"
                "Files:\n"
                "  my_skinest_data.json — All account, scan, and recommendation data\n\n"
                "To request permanent deletion, use the Delete Account option\n"
                "in Settings > Privacy, or contact privacy@yourdomain.com\n"
            ),
        )
    buf.seek(0)

    filename = f"skinest_data_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
