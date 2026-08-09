"""
Product-domain models: Product, ProductEmbedding.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index,
    Integer, String, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

try:
    from pgvector.sqlalchemy import Vector
    _HAS_PGVECTOR = True
except ImportError:  # graceful fallback during local setup without pgvector
    from sqlalchemy import Text as Vector  # type: ignore[assignment]
    _HAS_PGVECTOR = False

# ---------------------------------------------------------------------------
# ENUMs
# ---------------------------------------------------------------------------

ProductBrandEnum = Enum(
    "nykaa", "minimalist", "dermaco", "others",
    name="product_brand_enum",
    create_constraint=True,
)

ProductCategoryEnum = Enum(
    "cleanser", "toner", "serum", "moisturiser",
    "sunscreen", "treatment", "mask",
    name="product_category_enum",
    create_constraint=True,
)


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class Product(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "products"

    brand: Mapped[str] = mapped_column(ProductBrandEnum, nullable=False, index=True)
    # Free-text marketing brand ("Re'equil", "CeraVe", "Bioderma"). The `brand`
    # enum stays for affiliate grouping (use "others" for non-partners); this is
    # what the UI shows. Additive — does not touch ProductBrandStr.
    brand_display: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_url: Mapped[Optional[str]] = mapped_column(String(1000))
    # Product photo shown on cards — resolved from the brand's own product page
    # (og:image) where reachable; NULL falls back to a category icon in the UI.
    image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    price_inr: Mapped[Optional[float]] = mapped_column(Float)
    # List/MRP price; discount % = (mrp_inr - price_inr) / mrp_inr when both set.
    mrp_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 1 = single, 2/3 = combo pack. Powers the "combos" filter.
    pack_size: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    category: Mapped[str] = mapped_column(ProductCategoryEnum, nullable=False, index=True)

    # Array columns — native PostgreSQL TEXT[]
    key_ingredients: Mapped[Optional[list]] = mapped_column(ARRAY(TEXT))
    targets_conditions: Mapped[Optional[list]] = mapped_column(ARRAY(TEXT))
    skin_types_suitable: Mapped[Optional[list]] = mapped_column(ARRAY(TEXT))
    fitzpatrick_suitable: Mapped[Optional[list]] = mapped_column(ARRAY(TEXT))
    climate_zones_suitable: Mapped[Optional[list]] = mapped_column(ARRAY(TEXT))

    # Dermatologist approval
    is_dermatologist_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approval_dermatologist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Multi-store buy links: [{"store": "Amazon", "url": "https://…"}, …]
    store_links: Mapped[Optional[list]] = mapped_column(JSONB, default=list, server_default="[]")
    # Normalised actives for Match Score / duplicate-active / comedogenic checks
    # (e.g. ["salicylic acid", "niacinamide"]). Derived from key_ingredients if empty.
    key_actives: Mapped[Optional[list]] = mapped_column(JSONB, default=list, server_default="[]")
    # false for retinoids / high-dose salicylic / hydroquinone; NULL = unknown.
    pregnancy_safe: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    # Manual "newly added" flag; endpoint also treats created_at within 30 days as new.
    is_new: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    # Social proof
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    embedding: Mapped[Optional["ProductEmbedding"]] = relationship(
        "ProductEmbedding", back_populates="product", uselist=False, cascade="all, delete-orphan"
    )
    recommendation_products: Mapped[list["RecommendationProduct"]] = relationship(  # noqa: F821
        "RecommendationProduct", back_populates="product"
    )

    __table_args__ = (
        Index("ix_products_brand_category", "brand", "category"),
        Index("ix_products_active", "is_active"),
    )


# ---------------------------------------------------------------------------
# ProductEmbedding
# ---------------------------------------------------------------------------

class ProductEmbedding(Base):
    """
    Stores the 1536-dim vector for each product for Pinecone-style local search.
    One-to-one with Product; updated whenever product metadata changes.
    """
    __tablename__ = "product_embeddings"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True, nullable=False,
    )
    # Vector column: JSONB array [0.12, -0.4, ...], universal fallback for local/prod DBs
    embedding_vector = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    product: Mapped["Product"] = relationship("Product", back_populates="embedding")
