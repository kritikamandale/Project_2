"""Admin domain Pydantic v2 schemas — analytics, user/product management, audit logs."""

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.product import ProductCategoryStr, StoreLink, _require_http_scheme

# ---------------------------------------------------------------------------
# Analytics — Overview
# ---------------------------------------------------------------------------

class SparklinePoint(BaseModel):
    date: str
    value: float


class AnalyticsOverviewResponse(BaseModel):
    total_users: int
    users_mom_growth_pct: float
    scans_today: int
    scans_this_week: int
    scans_this_month: int
    avg_skin_improvement_score: float
    recommendation_acceptance_rate: float
    pending_derm_reviews: int
    active_products: int
    user_growth_sparkline: list[SparklinePoint] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Analytics — Charts
# ---------------------------------------------------------------------------

class RegistrationTrendPoint(BaseModel):
    date: str
    count: int


class SkinTypeDistributionItem(BaseModel):
    skin_type: str
    count: int
    percentage: float


class CityDistributionItem(BaseModel):
    city: str
    user_count: int


class FitzpatrickDistributionItem(BaseModel):
    tone: str
    count: int
    percentage: float


class ConditionImprovementItem(BaseModel):
    condition: str
    avg_improvement_pct: float
    user_count: int


class ChartsDataResponse(BaseModel):
    registration_trend: list[RegistrationTrendPoint] = Field(default_factory=list)
    skin_type_distribution: list[SkinTypeDistributionItem] = Field(default_factory=list)
    top_cities: list[CityDistributionItem] = Field(default_factory=list)
    fitzpatrick_distribution: list[FitzpatrickDistributionItem] = Field(default_factory=list)
    improvement_by_condition: list[ConditionImprovementItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

class AdminUserListItem(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_verified: bool
    is_active: bool
    totp_enabled: bool
    last_login: Optional[datetime] = None
    scan_count: int
    city: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAdminUsers(BaseModel):
    items: list[AdminUserListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class ChangeUserStatusRequest(BaseModel):
    action: str = Field(pattern="^(suspend|activate|delete)$")
    reason: Optional[str] = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# Dermatologist verification
# ---------------------------------------------------------------------------

class DermVerificationItem(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    medical_license_number: str
    specialization: Optional[str] = None
    hospital_affiliation: Optional[str] = None
    verification_document_url: Optional[str] = None
    registered_at: datetime

    model_config = {"from_attributes": True}


class DermVerificationRequest(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def _reason_required_on_rejection(self) -> "DermVerificationRequest":
        # A field_validator on rejection_reason alone would NOT fire when the
        # field is omitted entirely (pydantic skips validators on defaults
        # unless validate_default=True) — a model validator always runs.
        if not self.approved and not self.rejection_reason:
            raise ValueError("rejection_reason is required when approved is false")
        return self


# ---------------------------------------------------------------------------
# Product management (admin) — explicit allow-list, same http(s)-only URL
# guard as the public ProductCreate/ProductUpdate (MED-4).
# ---------------------------------------------------------------------------

class AdminProductCreate(BaseModel):
    brand: str
    brand_display: Optional[str] = Field(None, max_length=120)
    product_name: str = Field(min_length=1, max_length=255)
    product_url: Optional[str] = Field(None, max_length=1000)
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

    @field_validator("product_url")
    @classmethod
    def _validate_product_url(cls, v: Optional[str]) -> Optional[str]:
        return _require_http_scheme(v)


class AdminProductUpdate(BaseModel):
    brand_display: Optional[str] = Field(None, max_length=120)
    product_name: Optional[str] = Field(None, max_length=255)
    product_url: Optional[str] = Field(None, max_length=1000)
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

    @field_validator("product_url")
    @classmethod
    def _validate_product_url(cls, v: Optional[str]) -> Optional[str]:
        return _require_http_scheme(v)


class AdminProductListItem(BaseModel):
    id: uuid.UUID
    brand: str
    product_name: str
    category: str
    price_inr: Optional[float] = None
    is_active: bool
    is_dermatologist_approved: bool
    rating_avg: float
    review_count: int
    recommendation_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAdminProducts(BaseModel):
    items: list[AdminProductListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Platform settings
# ---------------------------------------------------------------------------

class PlatformSettingsUpdate(BaseModel):
    """Free-form key/value updates — validated per-key by the caller's intent,
    not a fixed schema, since settings are a JSONB key/value store. Restricted
    to a small set of known keys so a client can't inject arbitrary settings rows."""
    updates: dict[str, Any]

    @field_validator("updates")
    @classmethod
    def _known_keys_only(cls, v: dict[str, Any]) -> dict[str, Any]:
        allowed = {
            "enable_dermatologist_review", "enable_waitlist",
            "max_scans_per_user_per_day", "maintenance_mode",
        }
        unknown = set(v) - allowed
        if unknown:
            raise ValueError(f"Unknown setting key(s): {sorted(unknown)}")
        return v


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

class AuditLogItem(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    ip_address: Optional[str] = None
    timestamp: datetime
    metadata: Optional[dict] = None

    model_config = {"from_attributes": True}


class PaginatedAuditLogs(BaseModel):
    items: list[AuditLogItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Bias report
# ---------------------------------------------------------------------------

class BiasReportItem(BaseModel):
    fitzpatrick_tone: str
    user_count: int
    avg_confidence: float
    recommendation_count: int
    avg_skin_score: float


class BiasReportResponse(BaseModel):
    items: list[BiasReportItem] = Field(default_factory=list)
    overall_avg_confidence: float
    tones_below_threshold: list[str] = Field(default_factory=list)
    generated_at: datetime


# ---------------------------------------------------------------------------
# TOTP / admin 2FA
# ---------------------------------------------------------------------------

class TOTPSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class TOTPVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)
