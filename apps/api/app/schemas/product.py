"""Product domain Pydantic v2 schemas."""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


ProductBrandStr = Literal["nykaa", "minimalist", "dermaco", "others"]
ProductCategoryStr = Literal[
    "cleanser", "toner", "serum", "moisturiser", "sunscreen", "treatment", "mask"
]


class ProductCreate(BaseModel):
    brand: ProductBrandStr
    product_name: str = Field(min_length=1, max_length=255)
    product_url: Optional[str] = Field(None, max_length=1000)
    price_inr: Optional[float] = Field(None, ge=0)
    category: ProductCategoryStr
    key_ingredients: list[str] = Field(default_factory=list)
    targets_conditions: list[str] = Field(default_factory=list)
    skin_types_suitable: list[str] = Field(default_factory=list)
    fitzpatrick_suitable: list[str] = Field(default_factory=list)
    climate_zones_suitable: list[str] = Field(default_factory=list)
    is_dermatologist_approved: bool = False


class ProductUpdate(BaseModel):
    product_name: Optional[str] = Field(None, max_length=255)
    product_url: Optional[str] = None
    price_inr: Optional[float] = Field(None, ge=0)
    category: Optional[ProductCategoryStr] = None
    key_ingredients: Optional[list[str]] = None
    targets_conditions: Optional[list[str]] = None
    skin_types_suitable: Optional[list[str]] = None
    fitzpatrick_suitable: Optional[list[str]] = None
    climate_zones_suitable: Optional[list[str]] = None
    is_dermatologist_approved: Optional[bool] = None
    is_active: Optional[bool] = None
    rating_avg: Optional[float] = Field(None, ge=0, le=5)
    review_count: Optional[int] = Field(None, ge=0)


class ProductResponse(BaseModel):
    id: uuid.UUID
    brand: ProductBrandStr
    product_name: str
    product_url: Optional[str] = None
    price_inr: Optional[float] = None
    category: ProductCategoryStr
    key_ingredients: Optional[list[str]] = None
    targets_conditions: Optional[list[str]] = None
    skin_types_suitable: Optional[list[str]] = None
    fitzpatrick_suitable: Optional[list[str]] = None
    climate_zones_suitable: Optional[list[str]] = None
    is_dermatologist_approved: bool
    rating_avg: float
    review_count: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductListItem(BaseModel):
    id: uuid.UUID
    brand: ProductBrandStr
    product_name: str
    category: ProductCategoryStr
    price_inr: Optional[float] = None
    rating_avg: float
    is_dermatologist_approved: bool

    model_config = {"from_attributes": True}
