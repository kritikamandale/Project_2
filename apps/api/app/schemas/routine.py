"""
Routine-intelligence Pydantic v2 schemas — Phase 3.

Covers POST /products/routine-check (cost, conflicts, duplicate actives, gaps,
AM/PM layering) and GET /products/optimise-routine (budget-fit greedy picker).
"""

import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.product import ProductCategoryStr, ProductResponse

# ---------------------------------------------------------------------------
# POST /products/routine-check
# ---------------------------------------------------------------------------

class RoutineCheckRequest(BaseModel):
    product_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)


class ConflictPair(BaseModel):
    """A pair of actives that shouldn't be layered together."""
    active_a: str
    active_b: str
    reason: str
    products_a: list[str]
    products_b: list[str]


class DuplicateActive(BaseModel):
    active: str
    product_names: list[str]
    message: str


RoutineGapCode = Literal["missing_sunscreen", "missing_moisturiser", "missing_cleanser"]


class RoutineGap(BaseModel):
    code: RoutineGapCode
    message: str


class LayerStep(BaseModel):
    order: int
    product_id: Optional[uuid.UUID] = None
    product_name: Optional[str] = None
    step_label: str
    wait_minutes: int = 0
    note: Optional[str] = None


class LayeringPlan(BaseModel):
    am: list[LayerStep] = Field(default_factory=list)
    pm: list[LayerStep] = Field(default_factory=list)


class RoutineCheckResponse(BaseModel):
    total_cost_inr: float
    cost_per_day_inr: float
    conflicts: list[ConflictPair] = Field(default_factory=list)
    duplicate_actives: list[DuplicateActive] = Field(default_factory=list)
    gaps: list[RoutineGap] = Field(default_factory=list)
    layering: LayeringPlan


# ---------------------------------------------------------------------------
# GET /products/optimise-routine
# ---------------------------------------------------------------------------

class OptimisedStep(BaseModel):
    step_label: str
    category: ProductCategoryStr
    product: Optional[ProductResponse] = None


class OptimiseRoutineResponse(BaseModel):
    steps: list[OptimisedStep]
    total_cost_inr: float
    cost_per_day_inr: float
    drop_suggestion: Optional[str] = None
