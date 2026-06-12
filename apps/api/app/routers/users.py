"""Users router — profile management."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin

router = APIRouter()


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    # TODO: return UserSchema.model_validate(current_user)
    return {"id": str(current_user.id), "email": current_user.email, "role": current_user.role}


@router.patch("/me")
async def update_me(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: validate UpdateUserSchema, partial update
    raise NotImplementedError


@router.delete("/me", status_code=204)
async def delete_me(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    # TODO: cascade delete all user data, revoke sessions
    raise NotImplementedError


@router.get("", dependencies=[Depends(require_admin)])
async def list_users(db: AsyncSession = Depends(get_db)):
    # TODO: paginated user list for admin
    raise NotImplementedError


@router.patch("/{user_id}/role", dependencies=[Depends(require_admin)])
async def change_role(user_id: str, db: AsyncSession = Depends(get_db)):
    # TODO: update role, log audit event
    raise NotImplementedError
