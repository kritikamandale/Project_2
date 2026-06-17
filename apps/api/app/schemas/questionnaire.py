"""Questionnaire domain Pydantic v2 schemas — Phase 5 full implementation."""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Literal types
# ---------------------------------------------------------------------------

DietTypeStr = Literal["veg", "non_veg", "vegan", "mixed"]
ExerciseFrequencyStr = Literal["none", "light", "moderate", "active"]
RoutineFrequencyStr = Literal["daily", "alternate", "weekly", "none"]
WaterHardnessStr = Literal["soft", "moderate", "hard", "very_hard"]
ClimateZoneStr = Literal["tropical", "arid", "semi_arid", "temperate", "coastal"]
SugarConsumptionStr = Literal["low", "moderate", "high"]
DairyConsumptionStr = Literal["never", "sometimes", "daily"]
StressSourceStr = Literal["work", "studies", "family", "financial", "other"]
WorkEnvironmentStr = Literal["indoor_ac", "indoor_non_ac", "outdoor", "mixed"]
PollutionExposureStr = Literal["low_city", "metro", "industrial"]
CleanserFrequencyStr = Literal["morning_only", "morning_night", "night_only", "rarely"]
SunscreenUseStr = Literal["yes_always", "sometimes", "rarely", "never"]
RoutineStepStr = Literal[
    "cleanser", "toner", "moisturiser", "sunscreen",
    "serum", "exfoliant", "face_mask", "nothing"
]
DiagnosedConditionStr = Literal[
    "acne", "rosacea", "eczema", "psoriasis",
    "melasma", "none", "prefer_not_to_say"
]


# ---------------------------------------------------------------------------
# Climate enrichment
# ---------------------------------------------------------------------------

class ClimateEnrichRequest(BaseModel):
    city: str = Field(..., min_length=2, max_length=100)


class ClimateProfileResponse(BaseModel):
    city: str
    state: str
    avg_temperature_c: float
    avg_humidity_pct: float
    uv_index: float
    water_hardness: Optional[WaterHardnessStr] = None
    climate_zone: ClimateZoneStr

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Questionnaire submit (Phase 5 — 7 sections)
# ---------------------------------------------------------------------------

class QuestionnaireSubmitRequest(BaseModel):
    # Section 1: Sleep
    sleep_hours_avg: float = Field(..., ge=3, le=10)
    sleep_quality: int = Field(..., ge=1, le=5)
    sleep_consistency: bool

    # Section 2: Hydration & Diet
    water_intake_liters: float = Field(..., ge=0.5, le=4)
    diet_type: DietTypeStr
    sugar_consumption: SugarConsumptionStr
    dairy_consumption: DairyConsumptionStr

    # Section 3: Stress & Wellbeing
    stress_level: int = Field(..., ge=1, le=5)
    stress_source: list[StressSourceStr] = Field(default_factory=list)
    exercise_frequency: ExerciseFrequencyStr

    # Section 4: Screen Time & Environment
    screen_time_hours: float = Field(..., ge=0, le=16)
    work_environment: WorkEnvironmentStr
    pollution_exposure: PollutionExposureStr

    # Section 5: Location & Climate
    city: str = Field(..., min_length=2, max_length=100)
    water_hardness: WaterHardnessStr

    # Section 6: Skincare Routine
    routine_steps: list[RoutineStepStr] = Field(default_factory=list)
    cleanser_frequency: Optional[CleanserFrequencyStr] = None   # skip if nothing
    sunscreen_use: Optional[SunscreenUseStr] = None             # skip if nothing
    known_allergens_text: Optional[str] = Field(None, max_length=500)
    products_currently_using: Optional[str] = Field(None, max_length=1000)

    # Section 7: Health & Medical
    diagnosed_conditions: list[DiagnosedConditionStr] = Field(default_factory=list)
    medication_affects_skin: bool
    medication_name_text: Optional[str] = Field(None, max_length=500)

    # Section 8: Lifestyle & Habits (all optional)
    spicy_food_frequency: Optional[Literal["never", "sometimes", "often", "daily"]] = None
    junk_food_frequency: Optional[Literal["never", "sometimes", "often", "daily"]] = None
    fruits_veggies_per_day: Optional[Literal["less_than_1", "1_to_2", "3_to_5", "more_than_5"]] = None
    bedtime: Optional[Literal["before_10pm", "10pm_to_midnight", "after_midnight"]] = None
    phone_before_bed: Optional[bool] = None
    sleep_environment: Optional[Literal["ac", "fan", "natural_air"]] = None
    daily_sun_exposure: Optional[Literal["minimal", "moderate", "high", "very_high"]] = None
    smoking_status: Optional[Literal["never", "ex_smoker", "occasionally", "regularly"]] = None
    alcohol_consumption: Optional[Literal["never", "occasionally", "regularly"]] = None


class QuestionnaireSubmitResponse(BaseModel):
    questionnaire_id: str
    message: str
    climate_profile: Optional[ClimateProfileResponse] = None


# ---------------------------------------------------------------------------
# Questionnaire detail (GET /latest response)
# ---------------------------------------------------------------------------

class RoutineDetail(BaseModel):
    uses_cleanser: bool
    uses_toner: bool
    uses_moisturiser: bool
    uses_sunscreen: bool
    uses_serum: bool
    uses_exfoliant: bool
    uses_face_mask: bool
    uses_nothing: bool
    known_allergens_text: Optional[str] = None
    products_currently_using: Optional[dict] = None

    model_config = {"from_attributes": True}


class QuestionnaireDetailResponse(BaseModel):
    id: uuid.UUID
    submitted_at: datetime
    questionnaire_version: int

    # S1
    sleep_hours_avg: Optional[float] = None
    sleep_quality: Optional[int] = None
    sleep_consistency: Optional[bool] = None
    # S2
    water_intake_liters: Optional[float] = None
    diet_type: Optional[str] = None
    sugar_consumption: Optional[str] = None
    dairy_consumption: Optional[str] = None
    # S3
    stress_level: Optional[int] = None
    stress_source: Optional[list] = None
    exercise_frequency: Optional[str] = None
    # S4
    screen_time_hours: Optional[float] = None
    work_environment: Optional[str] = None
    pollution_exposure: Optional[str] = None
    # S6
    cleanser_frequency: Optional[str] = None
    sunscreen_use: Optional[str] = None
    diagnosed_conditions: Optional[list] = None
    medication_affects_skin: Optional[bool] = None

    climate_profile: Optional[ClimateProfileResponse] = None
    routine: Optional[RoutineDetail] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Questionnaire update (PUT /{id})
# ---------------------------------------------------------------------------

class QuestionnaireUpdateRequest(BaseModel):
    sleep_hours_avg: Optional[float] = Field(None, ge=3, le=10)
    sleep_quality: Optional[int] = Field(None, ge=1, le=5)
    sleep_consistency: Optional[bool] = None
    water_intake_liters: Optional[float] = Field(None, ge=0.5, le=4)
    diet_type: Optional[DietTypeStr] = None
    sugar_consumption: Optional[SugarConsumptionStr] = None
    dairy_consumption: Optional[DairyConsumptionStr] = None
    stress_level: Optional[int] = Field(None, ge=1, le=5)
    stress_source: Optional[list[StressSourceStr]] = None
    exercise_frequency: Optional[ExerciseFrequencyStr] = None
    screen_time_hours: Optional[float] = Field(None, ge=0, le=16)
    work_environment: Optional[WorkEnvironmentStr] = None
    pollution_exposure: Optional[PollutionExposureStr] = None
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    water_hardness: Optional[WaterHardnessStr] = None
    cleanser_frequency: Optional[CleanserFrequencyStr] = None
    sunscreen_use: Optional[SunscreenUseStr] = None
    known_allergens_text: Optional[str] = Field(None, max_length=500)
    diagnosed_conditions: Optional[list[DiagnosedConditionStr]] = None
    medication_affects_skin: Optional[bool] = None
    medication_name_text: Optional[str] = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# Legacy schemas (kept for backwards compat)
# ---------------------------------------------------------------------------

class QuestionnaireCreate(BaseModel):
    sleep_hours_avg: Optional[float] = Field(None, ge=0, le=24)
    sleep_quality: Optional[int] = Field(None, ge=1, le=5)
    water_intake_liters: Optional[float] = Field(None, ge=0, le=20)
    diet_type: Optional[DietTypeStr] = None
    stress_level: Optional[int] = Field(None, ge=1, le=5)
    exercise_frequency: Optional[ExerciseFrequencyStr] = None
    screen_time_hours: Optional[float] = Field(None, ge=0, le=24)
    alcohol_consumption: Optional[str] = Field(None, max_length=50)
    smoking_status: Optional[str] = Field(None, max_length=50)
    current_medications_text: Optional[str] = None


class EnvironmentProfileCreate(BaseModel):
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    avg_temperature_c: Optional[float] = None
    avg_humidity_pct: Optional[float] = Field(None, ge=0, le=100)
    pollution_index: Optional[float] = Field(None, ge=0)
    water_hardness: Optional[WaterHardnessStr] = None
    uv_index: Optional[float] = Field(None, ge=0)
    climate_zone: Optional[ClimateZoneStr] = None


class EnvironmentProfileResponse(EnvironmentProfileCreate):
    id: uuid.UUID
    user_id: uuid.UUID
    last_updated: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SkincareRoutineCreate(BaseModel):
    uses_cleanser: bool = False
    uses_toner: bool = False
    uses_moisturiser: bool = False
    uses_sunscreen: bool = False
    uses_serum: bool = False
    uses_exfoliant: bool = False
    routine_frequency: Optional[RoutineFrequencyStr] = None
    known_allergens_text: Optional[str] = None
    products_currently_using: Optional[dict] = None


class SkincareRoutineResponse(SkincareRoutineCreate):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
