"""Dermatologist portal Pydantic v2 schemas — Phase 8."""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Queue
# ---------------------------------------------------------------------------

class ReviewQueueItem(BaseModel):
    queue_id: uuid.UUID
    recommendation_id: uuid.UUID
    patient_id: str          # anonymised: "PAT-<first8ofuserid>"
    skin_type: Optional[str] = None
    fitzpatrick_tone: Optional[str] = None
    top_conditions: list[str] = Field(default_factory=list)  # up to 3 condition names
    submission_date: datetime
    priority: str            # high | normal | low
    status: str              # pending | in_review | approved | rejected | escalated
    age_group: Optional[str] = None   # e.g. "25–34"

    model_config = {"from_attributes": True}


class ReviewQueueResponse(BaseModel):
    items: list[ReviewQueueItem]
    total: int
    page: int
    per_page: int
    total_pages: int


# ---------------------------------------------------------------------------
# Case detail — anonymised patient block (left column)
# ---------------------------------------------------------------------------

class ConditionDetail(BaseModel):
    name: str
    severity: str
    affected_zone: Optional[str] = None


class AnonymizedPatient(BaseModel):
    patient_id: str
    age_group: Optional[str] = None       # "25–34"
    gender: Optional[str] = None
    city: Optional[str] = None            # city only, never address

    # Scan results
    skin_type: Optional[str] = None
    fitzpatrick_tone: Optional[str] = None
    conditions: list[ConditionDetail] = Field(default_factory=list)
    confidence_score: Optional[float] = None

    # Lifestyle
    sleep_hours_avg: Optional[float] = None
    sleep_quality: Optional[int] = None
    stress_level: Optional[int] = None
    water_intake_liters: Optional[float] = None
    diet_type: Optional[str] = None
    exercise_frequency: Optional[str] = None
    work_environment: Optional[str] = None
    pollution_exposure: Optional[str] = None

    # Climate
    climate_zone: Optional[str] = None
    avg_humidity_pct: Optional[float] = None
    uv_index: Optional[float] = None
    water_hardness: Optional[str] = None

    # Current routine (product category names)
    current_routine_items: list[str] = Field(default_factory=list)

    # Medical (privacy-filtered — no PII)
    diagnosed_conditions: list[str] = Field(default_factory=list)
    medication_affects_skin: Optional[bool] = None
    medication_name: Optional[str] = None     # only shown if medication_affects_skin=True


# ---------------------------------------------------------------------------
# Product card for review (right column)
# ---------------------------------------------------------------------------

class ProductForReview(BaseModel):
    recommendation_product_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    brand: str
    category: str
    key_ingredients: list[str] = Field(default_factory=list)
    price_inr: Optional[float] = None
    product_url: Optional[str] = None
    ai_reasoning: str
    highlighted_ingredient: Optional[str] = None
    usage_instruction: Optional[str] = None
    time_of_day: Optional[str] = None
    phase: int
    order_in_routine: int
    # Derm's prior action on this product (if already partially reviewed)
    derm_action: Optional[Literal["approve", "modify", "remove"]] = None
    derm_override_note: Optional[str] = None


# ---------------------------------------------------------------------------
# Full case detail response
# ---------------------------------------------------------------------------

class CaseDetailResponse(BaseModel):
    recommendation_id: uuid.UUID
    queue_id: uuid.UUID
    status: str
    priority: str
    requires_derm_review: bool

    patient: AnonymizedPatient
    ai_summary: Optional[str] = None
    skin_score: Optional[float] = None
    confidence_score: Optional[float] = None
    estimated_monthly_cost_inr: Optional[float] = None
    allergen_flags: list[str] = Field(default_factory=list)

    products: list[ProductForReview] = Field(default_factory=list)

    # Roadmap quick-summary from roadmap_json
    roadmap_phase_count: int = 0
    roadmap_total_weeks: int = 0

    # Existing patient note (decrypted, shown if derm previously saved one)
    patient_note: Optional[str] = None

    # Meta
    submission_date: datetime
    review_started_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Review submission
# ---------------------------------------------------------------------------

class ProductActionRequest(BaseModel):
    action: Literal["approve", "modify", "remove"]
    override_note: Optional[str] = Field(None, max_length=1000)


class ReviewSubmitRequest(BaseModel):
    decision: Literal["approved", "rejected", "request_info"]
    reviewer_notes: Optional[str] = Field(None, max_length=2000)
    patient_note: Optional[str] = Field(None, max_length=1500)
    # keyed by recommendation_product_id (str UUID)
    product_actions: Optional[dict[str, ProductActionRequest]] = None


class ReviewSubmitResponse(BaseModel):
    recommendation_id: uuid.UUID
    new_status: str
    reviewed_at: datetime
    message: str


# ---------------------------------------------------------------------------
# Per-product override
# ---------------------------------------------------------------------------

class ProductOverrideRequest(BaseModel):
    action: Literal["approve", "modify", "remove"]
    override_note: Optional[str] = Field(None, max_length=1000)


class ProductOverrideResponse(BaseModel):
    recommendation_product_id: uuid.UUID
    action: str
    message: str


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class DermStatsResponse(BaseModel):
    total_assigned_this_month: int
    pending_review: int
    approved_today: int
    avg_review_time_minutes: Optional[float] = None


# ---------------------------------------------------------------------------
# Product suggestion
# ---------------------------------------------------------------------------

class ProductSuggestionRequest(BaseModel):
    product_name: str = Field(min_length=2, max_length=255)
    brand: str = Field(min_length=2, max_length=100)
    category: Literal["cleanser", "toner", "serum", "moisturiser",
                      "sunscreen", "treatment", "mask"]
    price_inr: Optional[float] = Field(None, ge=0)
    product_url: Optional[str] = Field(None, max_length=1000)
    key_ingredients: list[str] = Field(default_factory=list, max_length=20)
    targets_conditions: list[str] = Field(default_factory=list, max_length=10)
    reason_for_suggestion: str = Field(min_length=10, max_length=1000)


class ProductSuggestionResponse(BaseModel):
    suggestion_id: uuid.UUID
    status: str
    message: str
