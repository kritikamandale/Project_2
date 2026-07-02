"""
Onboarding router — read and advance the current user's first-time onboarding
progress. The dashboard and other post-onboarding routes are gated on this
status (enforced in the Next.js middleware), so the frontend reads it on load.

Status transitions to `questionnaire_done` / `scan_done` / `completed` are also
driven server-side from the questionnaire/scan/recommendation flows; this router
exposes an explicit advance endpoint as a belt-and-braces fallback. `completed`
is never settable here — it is reserved for successful recommendation generation.
"""

from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services import onboarding_service

router = APIRouter()


class OnboardingStatusResponse(BaseModel):
    onboarding_status: str
    current_step: Optional[str]
    next_path: str


class OnboardingAdvanceRequest(BaseModel):
    # Client may report reaching an intermediate stage; `completed` is server-only.
    status: Literal["questionnaire_done", "scan_done"]


def _to_response(onboarding_status: str) -> OnboardingStatusResponse:
    return OnboardingStatusResponse(
        onboarding_status=onboarding_status,
        current_step=onboarding_service.current_step(onboarding_status),
        next_path=onboarding_service.next_path(onboarding_status),
    )


@router.get(
    "/status",
    response_model=OnboardingStatusResponse,
    summary="Get the current user's onboarding progress",
)
async def get_status(current_user=Depends(get_current_user)):
    return _to_response(current_user.onboarding_status)


@router.patch(
    "/status",
    response_model=OnboardingStatusResponse,
    summary="Advance the current user's onboarding progress (advance-only)",
)
async def advance_status(
    body: OnboardingAdvanceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    try:
        onboarding_service.advance_onboarding(current_user, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    await db.commit()
    await db.refresh(current_user)
    return _to_response(current_user.onboarding_status)
