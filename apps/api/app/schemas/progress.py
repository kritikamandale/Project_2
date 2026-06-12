"""Progress tracking Pydantic v2 schemas — Phase 7."""

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared / metric
# ---------------------------------------------------------------------------

class ProgressMetricResponse(BaseModel):
    id: uuid.UUID
    metric_name: str
    previous_value: Optional[float] = None
    current_value: Optional[float] = None
    improvement_pct: Optional[float] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Progress scan
# ---------------------------------------------------------------------------

class ConditionScoreItem(BaseModel):
    """A single condition severity reading submitted with a re-scan."""
    condition: str
    severity: int = Field(..., ge=0, le=3, description="0=none 1=mild 2=moderate 3=severe")


class ProgressScanCreate(BaseModel):
    recommendation_id: uuid.UUID
    scan_id: Optional[uuid.UUID] = None
    overall_skin_score: float = Field(..., ge=0, le=100)
    condition_scores: list[ConditionScoreItem] = Field(default_factory=list)
    notes: Optional[str] = None


class ProgressScanResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    recommendation_id: Optional[uuid.UUID] = None
    scan_id: Optional[uuid.UUID] = None
    scan_number: int
    scanned_at: datetime
    overall_skin_score: Optional[float] = None
    delta_from_baseline: Optional[float] = None
    notes: Optional[str] = None
    metrics: list[ProgressMetricResponse] = Field(default_factory=list)
    celebration_threshold_met: bool = False   # improvement >= 20 points
    slow_progress_flag: bool = False          # <5% after 8+ weeks

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------

class TimelinePoint(BaseModel):
    id: uuid.UUID
    scan_number: int
    scanned_at: datetime
    overall_skin_score: Optional[float] = None
    delta_from_baseline: Optional[float] = None

    model_config = {"from_attributes": True}


class TimelineResponse(BaseModel):
    user_id: uuid.UUID
    total_scans: int
    baseline_score: Optional[float] = None
    latest_score: Optional[float] = None
    total_improvement: Optional[float] = None   # raw point change
    improvement_pct: Optional[float] = None     # % toward healthy baseline (80)
    points: list[TimelinePoint] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Conditions
# ---------------------------------------------------------------------------

ImprovementStatus = Literal["improved", "unchanged", "worsened"]


class ConditionProgressItem(BaseModel):
    condition: str
    baseline_severity: Optional[float] = None   # 0–3 numeric
    latest_severity: Optional[float] = None
    improvement_pct: Optional[float] = None
    status: ImprovementStatus = "unchanged"
    scan_history: list[float] = Field(default_factory=list)  # ordered severity values for sparkline


class ConditionsProgressResponse(BaseModel):
    user_id: uuid.UUID
    conditions: list[ConditionProgressItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Routine adherence
# ---------------------------------------------------------------------------

class RoutineCheckinCreate(BaseModel):
    adherence: Literal["yes", "mostly", "no"]
    checkin_date: Optional[date] = None   # defaults to today if omitted
    notes: Optional[str] = None


class RoutineCheckinResponse(BaseModel):
    id: uuid.UUID
    checkin_date: date
    adherence: str
    notes: Optional[str] = None
    current_streak: int = 0

    model_config = {"from_attributes": True}


class HeatmapDay(BaseModel):
    date: date
    adherence: Optional[Literal["yes", "mostly", "no"]] = None


class AdherenceHeatmapResponse(BaseModel):
    user_id: uuid.UUID
    days: list[HeatmapDay] = Field(default_factory=list)   # last 90 days
    current_streak: int = 0
    longest_streak: int = 0
    total_checkins: int = 0


# ---------------------------------------------------------------------------
# Product feedback
# ---------------------------------------------------------------------------

class ProductFeedbackCreate(BaseModel):
    product_id: uuid.UUID
    recommendation_product_id: Optional[uuid.UUID] = None
    rating: Literal["working", "unsure", "not_working"]
    notes: Optional[str] = None


class ProductFeedbackResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    rating: str
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class ProductEffectivenessItem(BaseModel):
    product_id: uuid.UUID
    product_name: str
    brand: str
    targets_condition: Optional[str] = None
    highlighted_ingredient: Optional[str] = None
    weeks_used: Optional[int] = None
    condition_improvement_pct: Optional[float] = None
    user_rating: Optional[Literal["working", "unsure", "not_working"]] = None


# ---------------------------------------------------------------------------
# Summary (full dashboard)
# ---------------------------------------------------------------------------

class AlertItem(BaseModel):
    type: Literal["worsened_condition", "slow_progress", "overdue_scan"]
    condition: Optional[str] = None
    message: str


class ProgressSummaryResponse(BaseModel):
    user_id: uuid.UUID
    # Skin score headline
    baseline_score: Optional[float] = None
    latest_score: Optional[float] = None
    total_improvement: Optional[float] = None
    improvement_pct_toward_healthy: Optional[float] = None  # % progress to 80/100
    # Timeline (last 8 scans for chart)
    timeline: list[TimelinePoint] = Field(default_factory=list)
    # Conditions
    conditions: list[ConditionProgressItem] = Field(default_factory=list)
    # Adherence
    current_streak: int = 0
    last_7_days: list[HeatmapDay] = Field(default_factory=list)
    # Products
    product_effectiveness: list[ProductEffectivenessItem] = Field(default_factory=list)
    # Re-scan CTA
    last_scan_date: Optional[datetime] = None
    days_until_rescan: Optional[int] = None    # None if overdue
    is_rescan_overdue: bool = False
    # Alerts
    alerts: list[AlertItem] = Field(default_factory=list)
    # Notifications
    unread_notification_count: int = 0


# ---------------------------------------------------------------------------
# In-app notifications
# ---------------------------------------------------------------------------

class InAppNotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    message: str
    is_read: bool
    action_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
