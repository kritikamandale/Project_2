"""Users router — profile management."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserProfile
from app.schemas.user import UserProfileUpdate, UserWithProfileResponse

router = APIRouter()


async def _load_with_profile(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    return result.scalar_one()


@router.get("/me", response_model=UserWithProfileResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await _load_with_profile(db, current_user.id)


@router.patch("/me", response_model=UserWithProfileResponse)
async def update_me(
    body: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Partial update of the caller's own profile. Uses UserProfileUpdate's
    explicit field allow-list (city/state/gender/date_of_birth/skin_tone/
    country/consent) — full_name/role/is_verified live outside this schema
    on purpose, so a user can't self-escalate verification or role via PATCH.
    """
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()

    return await _load_with_profile(db, current_user.id)


# DELETE /me is handled by the privacy router (DPDP erasure implementation).
# Do not add a stub here — FastAPI first-registered-wins would shadow it.
