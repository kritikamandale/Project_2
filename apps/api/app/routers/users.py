"""Users router — profile management."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter()


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    # TODO: return UserSchema.model_validate(current_user)
    return {"id": str(current_user.id), "email": current_user.email, "role": current_user.role}


@router.patch("/me")
async def update_me(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: validate UpdateUserSchema, partial update
    raise NotImplementedError


# DELETE /me is handled by the privacy router (DPDP erasure implementation).
# Do not add a stub here — FastAPI first-registered-wins would shadow it.
