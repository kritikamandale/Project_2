"""Users router — profile management."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import UserProfile
from app.schemas.user import UserProfileUpdate

router = APIRouter()


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    # TODO: return UserSchema.model_validate(current_user)
    return {"id": str(current_user.id), "email": current_user.email, "role": current_user.role}


@router.patch("/me")
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
    await db.refresh(profile)

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "profile": {
            "date_of_birth": profile.date_of_birth,
            "gender": profile.gender,
            "city": profile.city,
            "state": profile.state,
            "country": profile.country,
            "skin_tone_category": profile.skin_tone_category,
            "consent_given_at": profile.consent_given_at,
        },
    }


# DELETE /me is handled by the privacy router (DPDP erasure implementation).
# Do not add a stub here — FastAPI first-registered-wins would shadow it.
