"""
Scan router — feature vector submission, history, result retrieval.

Privacy contract: the raw facial image NEVER reaches this server.
Only the 512-dim feature vector and classification labels are accepted.
Every scan record is stored with image_permanently_deleted = TRUE.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import require_user
from app.models.scan import SkinCondition, SkinScan
from app.schemas.scan import (
    PaginatedScans,
    ScanListResponse,
    ScanResponse,
    ScanSubmitRequest,
    ScanSubmitResponse,
)
from app.services.skin_analysis import SkinAnalysisService

router = APIRouter()
_analysis_svc = SkinAnalysisService()


@router.post("/submit", response_model=ScanSubmitResponse, status_code=status.HTTP_201_CREATED)
async def submit_scan(
    payload: ScanSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_user),
):
    """
    Accept the browser's skin analysis result (feature vector + labels only).

    The 512-dim feature vector is cross-validated server-side:
    - Dimension and range plausibility checks
    - Confidence threshold enforcement
    - Bias flag for Fitzpatrick IV-VI below 0.70 confidence

    The scan is saved with image_permanently_deleted = TRUE regardless of
    the analysis outcome — the server never receives a raw image.
    """
    validation = _analysis_svc.validate_feature_vector(
        feature_vector=payload.feature_vector,
        skin_type=payload.skin_type,
        skin_type_confidence=payload.skin_type_confidence,
        fitzpatrick_tone=payload.fitzpatrick_tone,
    )

    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Feature vector validation failed",
                "warnings": validation.warnings,
            },
        )

    async with db.begin():
        scan = SkinScan(
            user_id=current_user.id,
            scan_timestamp=datetime.now(timezone.utc),
            skin_type=payload.skin_type,
            analysis_confidence_score=payload.skin_type_confidence,
            lighting_quality_score=payload.lighting_quality_score,
            image_permanently_deleted=True,
            image_was_processed_locally=True,
            image_deleted_at=datetime.now(timezone.utc),
            raw_analysis_json={
                "fitzpatrick_tone": payload.fitzpatrick_tone,
                "model_version": payload.model_version,
                "analysis_timestamp": payload.analysis_timestamp,
                "vector_stats": validation.vector_stats,
                "warnings": validation.warnings,
                "bias_flag": validation.bias_flag,
            },
        )
        db.add(scan)
        await db.flush()  # populate scan.id before inserting conditions

        for cond in payload.conditions:
            db.add(SkinCondition(
                scan_id=scan.id,
                condition_name=cond.name,
                severity=cond.severity,
                affected_zone=cond.zone,
                confidence_score=cond.confidence,
            ))

    bias_message = validation.warnings[0] if validation.bias_flag and validation.warnings else None

    return ScanSubmitResponse(
        scan_id=scan.id,
        skin_type=payload.skin_type,
        fitzpatrick_tone=payload.fitzpatrick_tone,
        confidence=payload.skin_type_confidence,
        conditions_detected=len(payload.conditions),
        bias_flag=validation.bias_flag,
        bias_message=bias_message,
    )


@router.get("/history", response_model=PaginatedScans)
async def scan_history(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_user),
):
    """Return paginated scan history for the authenticated user, newest first."""
    offset = (page - 1) * per_page

    total_q = await db.execute(
        select(func.count(SkinScan.id)).where(SkinScan.user_id == current_user.id)
    )
    total = total_q.scalar_one()

    scans_q = await db.execute(
        select(SkinScan)
        .where(SkinScan.user_id == current_user.id)
        .order_by(SkinScan.scan_timestamp.desc())
        .offset(offset)
        .limit(per_page)
    )
    scans = scans_q.scalars().all()

    return PaginatedScans(
        items=[ScanListResponse.model_validate(s) for s in scans],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + per_page) < total,
    )


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_user),
):
    """
    Return a single scan with its conditions.
    Users can only access their own scans.
    fitzpatrick_tone is injected from the raw_analysis_json JSONB column.
    """
    result = await db.execute(
        select(SkinScan)
        .options(selectinload(SkinScan.conditions))
        .where(SkinScan.id == scan_id)
    )
    scan = result.scalar_one_or_none()

    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    if scan.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    response = ScanResponse.model_validate(scan)

    # fitzpatrick_tone lives in JSONB until a dedicated column is added in a future migration
    if scan.raw_analysis_json:
        response.fitzpatrick_tone = scan.raw_analysis_json.get("fitzpatrick_tone")

    return response
