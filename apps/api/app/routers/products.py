"""Products router — product catalogue management."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin

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


@router.post("", dependencies=[Depends(require_admin)], status_code=201)
async def create_product(db: AsyncSession = Depends(get_db)):
    # TODO: validate ProductCreateSchema, insert, trigger Pinecone embed
    raise NotImplementedError


@router.patch("/{product_id}", dependencies=[Depends(require_admin)])
async def update_product(product_id: str, db: AsyncSession = Depends(get_db)):
    raise NotImplementedError


@router.delete("/{product_id}", dependencies=[Depends(require_admin)], status_code=204)
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db)):
    # Soft delete — sets active=False
    raise NotImplementedError


@router.post("/embed", dependencies=[Depends(require_admin)])
async def rebuild_embeddings():
    """Rebuilds all product embeddings in Pinecone. Long-running — returns job_id."""
    raise NotImplementedError
