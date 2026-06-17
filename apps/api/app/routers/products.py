"""Products router — product catalogue (read-only for authenticated users)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter()


@router.get("")
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # TODO: paginated + filterable (brand, category, skin_type, price range)
    raise NotImplementedError


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    raise NotImplementedError
