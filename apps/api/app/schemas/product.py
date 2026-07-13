"""Product domain Pydantic v2 schemas."""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


ProductBrandStr = Literal["nykaa", "minimalist", "dermaco", "others"]
ProductCategoryStr = Literal[
    "cleanser", "toner", "serum", "moisturiser", "sunscreen", "treatment", "mask"
]

# Safety / advisory flags surfaced at the point of decision.
ProductFlagStr = Literal["comedogenic", "contains_allergen", "pregnancy_unsafe", "fragrance"]


def _require_http_scheme(v: Optional[str]) -> Optional[str]:
    """Reject javascript:/data: and any other non-http(s) scheme before it
    can ever be stored and rendered as a clickable <a href> on the frontend."""
    if v and not v.lower().startswith(("http://", "https://")):
        raise ValueError("URL must start with http:// or https://")
    return v


class StoreLink(BaseModel):
    """A single buy link. `url` is always a resolvable http(s) URL (never "#")."""
    store: str
    url: str

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v: str) -> str:
        return _require_http_scheme(v)


class ProductFlag(BaseModel):
    """A safety/advisory flag: machine `code` for icons/filtering + human `message`."""
    code: ProductFlagStr
    message: str


class ProductCreate(BaseModel):
    brand: ProductBrandStr
    brand_display: Optional[str] = Field(None, max_length=120)
    product_name: str = Field(min_length=1, max_length=255)
    product_url: Optional[str] = Field(None, max_length=1000)
    image_url: Optional[str] = Field(None, max_length=1000)
    price_inr: Optional[float] = Field(None, ge=0)
    mrp_inr: Optional[float] = Field(None, ge=0)
    pack_size: int = Field(default=1, ge=1)
    category: ProductCategoryStr
    key_ingredients: list[str] = Field(default_factory=list)
    key_actives: list[str] = Field(default_factory=list)
    targets_conditions: list[str] = Field(default_factory=list)
    skin_types_suitable: list[str] = Field(default_factory=list)
    fitzpatrick_suitable: list[str] = Field(default_factory=list)
    climate_zones_suitable: list[str] = Field(default_factory=list)
    store_links: list[StoreLink] = Field(default_factory=list)
    pregnancy_safe: Optional[bool] = None
    is_new: bool = False
    is_dermatologist_approved: bool = False

    @field_validator("product_url", "image_url")
    @classmethod
    def _validate_product_url(cls, v: Optional[str]) -> Optional[str]:
        return _require_http_scheme(v)


class ProductUpdate(BaseModel):
    brand_display: Optional[str] = Field(None, max_length=120)
    product_name: Optional[str] = Field(None, max_length=255)
    product_url: Optional[str] = Field(None, max_length=1000)
    image_url: Optional[str] = Field(None, max_length=1000)
    price_inr: Optional[float] = Field(None, ge=0)
    mrp_inr: Optional[float] = Field(None, ge=0)
    pack_size: Optional[int] = Field(None, ge=1)
    category: Optional[ProductCategoryStr] = None
    key_ingredients: Optional[list[str]] = None
    key_actives: Optional[list[str]] = None
    targets_conditions: Optional[list[str]] = None
    skin_types_suitable: Optional[list[str]] = None
    fitzpatrick_suitable: Optional[list[str]] = None
    climate_zones_suitable: Optional[list[str]] = None
    store_links: Optional[list[StoreLink]] = None
    pregnancy_safe: Optional[bool] = None
    is_new: Optional[bool] = None
    is_dermatologist_approved: Optional[bool] = None
    is_active: Optional[bool] = None
    rating_avg: Optional[float] = Field(None, ge=0, le=5)
    review_count: Optional[int] = Field(None, ge=0)

    @field_validator("product_url", "image_url")
    @classmethod
    def _validate_product_url(cls, v: Optional[str]) -> Optional[str]:
        return _require_http_scheme(v)


class ProductResponse(BaseModel):
    id: uuid.UUID
    brand: ProductBrandStr
    brand_display: Optional[str] = None
    product_name: str
    product_url: Optional[str] = None
    image_url: Optional[str] = None
    price_inr: Optional[float] = None
    mrp_inr: Optional[float] = None
    pack_size: int = 1
    category: ProductCategoryStr
    key_ingredients: Optional[list[str]] = None
    key_actives: Optional[list[str]] = None
    targets_conditions: Optional[list[str]] = None
    skin_types_suitable: Optional[list[str]] = None
    fitzpatrick_suitable: Optional[list[str]] = None
    climate_zones_suitable: Optional[list[str]] = None
    store_links: list[StoreLink] = Field(default_factory=list)
    pregnancy_safe: Optional[bool] = None
    is_new: bool = False
    is_dermatologist_approved: bool
    rating_avg: float
    review_count: int
    is_active: bool
    created_at: datetime

    # ---- Derived, computed per-request against the user's context ----
    # discount % = round((mrp_inr - price_inr) / mrp_inr * 100) when both present.
    discount_pct: Optional[int] = None
    # Transparent 0–100 relevance score (see product_scoring.py). None when no
    # user context was supplied (plain catalogue browse).
    match_score: Optional[int] = None
    # One plain-English sentence: skin type + climate + concern + active + mechanism.
    match_reason: Optional[str] = None
    # Safety / advisory flags for the point-of-decision safety net.
    flags: list[ProductFlag] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ProductListItem(BaseModel):
    id: uuid.UUID
    brand: ProductBrandStr
    brand_display: Optional[str] = None
    product_name: str
    image_url: Optional[str] = None
    category: ProductCategoryStr
    price_inr: Optional[float] = None
    mrp_inr: Optional[float] = None
    rating_avg: float
    is_dermatologist_approved: bool
    discount_pct: Optional[int] = None
    match_score: Optional[int] = None

    model_config = {"from_attributes": True}


class PaginatedProducts(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int
    has_more: bool
