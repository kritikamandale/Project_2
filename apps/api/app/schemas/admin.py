"""Admin domain Pydantic v2 schemas — Phase 9."""

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


ReviewPriorityStr = Literal["high", "normal", "low"]
ReviewStatusStr = Literal["pending", "in_review", "approved", "rejected", "escalated"]
UserRoleStr = Literal["USER", "DERMATOLOGIST", "ADMIN"]
UserStatusAction = Literal["suspend", "activate", "delete"]


# ---------------------------------------------------------------------------
# Analytics — Overview KPIs
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
    user_growth_sparkline: list[SparklinePoint]


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
    registration_trend: list[RegistrationTrendPoint]
    skin_type_distribution: list[SkinTypeDistributionItem]
    top_cities: list[CityDistributionItem]
    fitzpatrick_distribution: list[FitzpatrickDistributionItem]
    improvement_by_condition: list[ConditionImprovementItem]


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------

class AdminUserListItem(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRoleStr
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


class AdminUserRoleUpdate(BaseModel):
    role: UserRoleStr


class AdminUserStatusUpdate(BaseModel):
    action: UserStatusAction
    reason: Optional[str] = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# Dermatologist Verification Queue
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


class DermVerificationAction(BaseModel):
    action: Literal["approve", "reject"]
    rejection_reason: Optional[str] = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# Product Admin
# ---------------------------------------------------------------------------

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


class AdminProductCreate(BaseModel):
    brand: Literal["nykaa", "minimalist", "dermaco", "others"]
    product_name: str = Field(min_length=1, max_length=255)
    product_url: Optional[str] = Field(None, max_length=1000)
    price_inr: Optional[float] = Field(None, ge=0)
    category: Literal["cleanser", "toner", "serum", "moisturiser", "sunscreen", "treatment", "mask"]
    key_ingredients: list[str] = Field(default_factory=list)
    targets_conditions: list[str] = Field(default_factory=list)
    skin_types_suitable: list[str] = Field(default_factory=list)
    fitzpatrick_suitable: list[str] = Field(default_factory=list)
    climate_zones_suitable: list[str] = Field(default_factory=list)
    is_dermatologist_approved: bool = False


class AdminProductUpdate(BaseModel):
    product_name: Optional[str] = Field(None, max_length=255)
    product_url: Optional[str] = None
    price_inr: Optional[float] = Field(None, ge=0)
    category: Optional[Literal["cleanser", "toner", "serum", "moisturiser", "sunscreen", "treatment", "mask"]] = None
    key_ingredients: Optional[list[str]] = None
    targets_conditions: Optional[list[str]] = None
    skin_types_suitable: Optional[list[str]] = None
    fitzpatrick_suitable: Optional[list[str]] = None
    climate_zones_suitable: Optional[list[str]] = None
    is_dermatologist_approved: Optional[bool] = None
    is_active: Optional[bool] = None
    rating_avg: Optional[float] = Field(None, ge=0, le=5)
    review_count: Optional[int] = Field(None, ge=0)


class ProductEmbeddingRegenerateResponse(BaseModel):
    product_id: uuid.UUID
    status: str
    message: str


# ---------------------------------------------------------------------------
# Bias Report
# ---------------------------------------------------------------------------

class BiasReportItem(BaseModel):
    fitzpatrick_tone: str
    user_count: int
    avg_confidence: float
    recommendation_count: int
    avg_skin_score: float


class BiasReportResponse(BaseModel):
    items: list[BiasReportItem]
    overall_avg_confidence: float
    tones_below_threshold: list[str]
    generated_at: datetime


# ---------------------------------------------------------------------------
# Audit Logs
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
# Platform Settings
# ---------------------------------------------------------------------------

class PlatformSettingResponse(BaseModel):
    key: str
    value: Optional[Any] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlatformSettingUpdate(BaseModel):
    value: Any


class PlatformSettingsAllResponse(BaseModel):
    settings: dict[str, Any]
    updated_at: datetime


class FeatureFlagsUpdate(BaseModel):
    enable_camera_scan: Optional[bool] = None
    enable_auto_climate_fetch: Optional[bool] = None
    enable_dermatologist_review: Optional[bool] = None
    maintenance_mode: Optional[bool] = None
    derm_review_confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    recommendation_engine_version: Optional[Literal["v1", "v2"]] = None


# ---------------------------------------------------------------------------
# TOTP / Admin 2FA
# ---------------------------------------------------------------------------

class TOTPSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class TOTPVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class TOTPStatusResponse(BaseModel):
    enabled: bool


# ---------------------------------------------------------------------------
# Bulk / Notifications
# ---------------------------------------------------------------------------

class BulkUserNotificationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=1000)
    user_ids: Optional[list[uuid.UUID]] = None


# ---------------------------------------------------------------------------
# Legacy / Kept for compatibility with Phase 1 stubs
# ---------------------------------------------------------------------------

class DermatologistProfileCreate(BaseModel):
    medical_license_number: str = Field(min_length=5, max_length=100)
    specialization: Optional[str] = Field(None, max_length=200)
    hospital_affiliation: Optional[str] = Field(None, max_length=300)
    verification_document_url: Optional[str] = None


class DermatologistProfileResponse(DermatologistProfileCreate):
    user_id: uuid.UUID
    verified_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewQueueItemResponse(BaseModel):
    id: uuid.UUID
    recommendation_id: uuid.UUID
    assigned_to: Optional[uuid.UUID] = None
    priority: ReviewPriorityStr
    status: ReviewStatusStr
    reviewer_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformStatsResponse(BaseModel):
    total_users: int
    total_scans: int
    scans_today: int
    recommendations_generated: int
    derm_queue_pending: int
    derm_queue_approved: int
    active_products: int


class ScanAnalyticsEntry(BaseModel):
    date: str
    count: int
    avg_confidence: Optional[float] = None


class TopProductEntry(BaseModel):
    product_id: uuid.UUID
    product_name: str
    brand: str
    recommendation_count: int
