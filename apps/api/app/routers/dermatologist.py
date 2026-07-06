"""Dermatologist router — case review queue and approval workflow (Phase 8)."""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_dermatologist
from app.schemas.dermatologist import (
    CaseDetailResponse,
    DermStatsResponse,
    ProductOverrideRequest,
    ProductOverrideResponse,
    ProductSuggestionRequest,
    ProductSuggestionResponse,
    ReviewQueueResponse,
    ReviewSubmitRequest,
    ReviewSubmitResponse,
)
from app.services import dermatologist as derm_svc

router = APIRouter()


@router.get(
    "/queue",
    response_model=ReviewQueueResponse,
    summary="Paginated review queue for the logged-in dermatologist",
)
async def get_queue(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    skin_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sort_by: str = Query("submission_date", pattern="^(submission_date|priority|status)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    current_user=Depends(require_dermatologist),
    db: AsyncSession = Depends(get_db),
):
    return await derm_svc.get_review_queue(
        db=db,
        dermatologist_id=current_user.id,
        page=page,
        per_page=per_page,
        status_filter=status_filter,
        skin_type_filter=skin_type,
        priority_filter=priority,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


@router.get(
    "/case/{recommendation_id}",
    response_model=CaseDetailResponse,
    summary="Full anonymised case detail for a specific recommendation",
)
async def get_case(
    recommendation_id: uuid.UUID,
    current_user=Depends(require_dermatologist),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await derm_svc.get_case_detail(
            db=db,
            recommendation_id=recommendation_id,
            dermatologist_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.post(
    "/case/{recommendation_id}/review",
    response_model=ReviewSubmitResponse,
    summary="Submit review decision (approved / rejected / request_info)",
)
async def submit_review(
    recommendation_id: uuid.UUID,
    payload: ReviewSubmitRequest,
    current_user=Depends(require_dermatologist),
    db: AsyncSession = Depends(get_db),
):
    try:
        rq = await derm_svc.submit_review(
            db=db,
            recommendation_id=recommendation_id,
            dermatologist_id=current_user.id,
            decision=payload.decision,
            reviewer_notes=payload.reviewer_notes,
            patient_note=payload.patient_note,
            product_actions=(
                {k: v.model_dump() for k, v in payload.product_actions.items()}
                if payload.product_actions
                else None
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e

    from datetime import timezone
    from datetime import datetime as _dt
    return ReviewSubmitResponse(
        recommendation_id=recommendation_id,
        new_status=rq.status,
        reviewed_at=rq.completed_at or _dt.now(timezone.utc),
        message=f"Case {rq.status} successfully.",
    )


@router.put(
    "/case/{recommendation_id}/product/{product_id}",
    response_model=ProductOverrideResponse,
    summary="Override a single product in the AI recommendation",
)
async def override_product(
    recommendation_id: uuid.UUID,
    product_id: uuid.UUID,
    payload: ProductOverrideRequest,
    current_user=Depends(require_dermatologist),
    db: AsyncSession = Depends(get_db),
):
    try:
        rp = await derm_svc.override_product(
            db=db,
            recommendation_id=recommendation_id,
            product_id=product_id,
            dermatologist_id=current_user.id,
            action=payload.action,
            override_note=payload.override_note,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e

    return ProductOverrideResponse(
        recommendation_product_id=rp.id,
        action=rp.derm_action,
        message=f"Product marked as '{rp.derm_action}'.",
    )


@router.get(
    "/stats",
    response_model=DermStatsResponse,
    summary="Performance stats for the logged-in dermatologist",
)
async def get_stats(
    current_user=Depends(require_dermatologist),
    db: AsyncSession = Depends(get_db),
):
    return await derm_svc.get_derm_stats(db=db, dermatologist_id=current_user.id)


@router.post(
    "/products/suggest",
    response_model=ProductSuggestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Suggest a new product to be added to the platform catalog",
)
async def suggest_product(
    payload: ProductSuggestionRequest,
    current_user=Depends(require_dermatologist),
    db: AsyncSession = Depends(get_db),
):
    suggestion_id = await derm_svc.create_product_suggestion(
        db=db,
        dermatologist_id=current_user.id,
        suggestion_data=payload.model_dump(),
    )
    return ProductSuggestionResponse(
        suggestion_id=suggestion_id,
        status="pending",
        message="Suggestion submitted for admin review.",
    )
