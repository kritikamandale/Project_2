"""Recommendation domain Pydantic v2 schemas — Phase 6."""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Inbound
# ---------------------------------------------------------------------------

class RecommendationGenerateRequest(BaseModel):
    scan_id: uuid.UUID
    questionnaire_id: Optional[uuid.UUID] = None


class FeedbackRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: Optional[str] = Field(None, max_length=1000)


# ---------------------------------------------------------------------------
# Internal recommendation engine output shape (used for parsing LLM response)
# ---------------------------------------------------------------------------

class EngineProductItem(BaseModel):
    """One product slot inside the AI recommendation JSON."""
    category: str
    name: str
    brand: str
    reason: str
    key_ingredient: str
    usage: str
    time_of_day: Literal["morning", "night", "both", "weekly"] = "both"
    phase: Literal[1, 2, 3] = 1
    start_week: int = Field(ge=1, le=20, default=1)
    fitzpatrick_note: Optional[str] = None
    climate_note: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)


class EngineOutput(BaseModel):
    """Full JSON structure returned by the recommendation engine."""
    skin_score: float = Field(ge=0.0, le=100.0)
    products: list[EngineProductItem]
    morning_routine: list[str] = Field(default_factory=list)
    night_routine: list[str] = Field(default_factory=list)
    ingredients_to_use: list[str] = Field(default_factory=list)
    ingredients_to_avoid: list[str] = Field(default_factory=list)
    lifestyle_tips: list[str] = Field(default_factory=list)
    dermatologist_note: str = ""
    climate_insight: str = ""
    overall_confidence: float = Field(ge=0.0, le=1.0, default=0.8)


# Aliases for backward compatibility
ClaudeProductItem = EngineProductItem
ClaudeOutput = EngineOutput


# ---------------------------------------------------------------------------
# Product nested inside a recommendation response
# ---------------------------------------------------------------------------

class ProductInRecommendation(BaseModel):
    id: uuid.UUID
    brand: str
    product_name: str
    category: str
    price_inr: Optional[float] = None
    product_url: Optional[str] = None
    image_url: Optional[str] = None
    key_ingredients: Optional[list[str]] = None
    targets_conditions: Optional[list[str]] = None
    rating_avg: float
    is_dermatologist_approved: bool

    model_config = {"from_attributes": True}


class RecommendedProductEntry(BaseModel):
    id: uuid.UUID
    product: ProductInRecommendation
    order_in_routine: int
    start_week: int
    reason_text: Optional[str] = None
    is_mandatory: bool
    phase: int
    highlighted_ingredient: Optional[str] = None
    usage_instruction: Optional[str] = None
    time_of_day: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Roadmap
# ---------------------------------------------------------------------------

class RoadmapWeekEntry(BaseModel):
    week: int
    phase: int
    action: str
    product_name: Optional[str] = None
    instruction: str
    is_introduction: bool = False


class RoadmapPhase(BaseModel):
    phase: int
    title: str
    weeks_start: int
    weeks_end: int
    goal: str
    product_names: list[str] = Field(default_factory=list)


class ConditionTimeline(BaseModel):
    condition: str
    expected_improvement_week: int
    expected_improvement_pct: int
    note: str


class RoadmapResponse(BaseModel):
    total_weeks: int
    phases: list[RoadmapPhase]
    week_entries: list[RoadmapWeekEntry]
    condition_timelines: list[ConditionTimeline] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Full recommendation detail
# ---------------------------------------------------------------------------

class RecommendationDetailResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    scan_id: uuid.UUID
    questionnaire_id: Optional[uuid.UUID] = None
    generated_at: datetime
    recommendation_engine_version: str

    skin_score: Optional[float] = None
    skin_type: Optional[str] = None
    fitzpatrick_tone: Optional[str] = None
    conditions_summary: list[dict] = Field(default_factory=list)

    products: list[RecommendedProductEntry] = Field(default_factory=list)
    roadmap: Optional[RoadmapResponse] = None

    climate_insight: Optional[str] = None
    estimated_monthly_cost_inr: Optional[float] = None
    morning_routine: list[str] = Field(default_factory=list)
    night_routine: list[str] = Field(default_factory=list)
    ingredients_to_use: list[str] = Field(default_factory=list)
    ingredients_to_avoid: list[str] = Field(default_factory=list)
    lifestyle_tips: list[str] = Field(default_factory=list)
    dermatologist_note: Optional[str] = None

    allergen_flags: list[str] = Field(default_factory=list)
    requires_derm_review: bool = False
    is_dermatologist_reviewed: bool = False
    reviewer_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None

    feedback_rating: Optional[int] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Generate endpoint response
# ---------------------------------------------------------------------------

class RecommendationGenerateResponse(BaseModel):
    recommendation_id: uuid.UUID
    message: str = "Recommendation generated successfully."
    skin_score: Optional[float] = None
    products_count: int = 0
    requires_derm_review: bool = False
    estimated_monthly_cost_inr: Optional[float] = None


# ---------------------------------------------------------------------------
# List / slim views
# ---------------------------------------------------------------------------

class RecommendationListItem(BaseModel):
    id: uuid.UUID
    # Cycle linkage — lets the history view group questionnaire + scan + rec together
    scan_id: Optional[uuid.UUID] = None
    questionnaire_id: Optional[uuid.UUID] = None
    generated_at: datetime
    skin_score: Optional[float] = None
    roadmap_weeks: int = 20
    estimated_monthly_cost_inr: Optional[float] = None
    products_count: int = 0
    is_dermatologist_reviewed: bool
    requires_derm_review: bool
    feedback_rating: Optional[int] = None

    model_config = {"from_attributes": True}


class PaginatedRecommendations(BaseModel):
    items: list[RecommendationListItem]
    total: int
    page: int
    per_page: int
    has_more: bool


# ---------------------------------------------------------------------------
# Legacy schemas kept for backward compatibility
# ---------------------------------------------------------------------------

class RecommendationProductResponse(BaseModel):
    id: uuid.UUID
    product: "ProductInRecommendation"
    order_in_routine: int
    start_week: int
    reason_text: Optional[str] = None
    is_mandatory: bool
    phase: int

    model_config = {"from_attributes": True}


class RecommendationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    scan_id: uuid.UUID
    questionnaire_id: Optional[uuid.UUID] = None
    generated_at: datetime
    recommendation_engine_version: str
    ai_reasoning: Optional[str] = None
    roadmap_weeks: int
    is_dermatologist_reviewed: bool
    reviewer_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    products: list[RecommendationProductResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationRoutineResponse(BaseModel):
    recommendation_id: uuid.UUID
    roadmap_weeks: int
    phase_1: list[RecommendationProductResponse] = Field(default_factory=list)
    phase_2: list[RecommendationProductResponse] = Field(default_factory=list)
    phase_3: list[RecommendationProductResponse] = Field(default_factory=list)


class DermReviewRequest(BaseModel):
    notes: Optional[str] = None
    modified_product_ids: Optional[list[uuid.UUID]] = None
