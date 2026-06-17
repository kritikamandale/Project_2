"""
Questionnaire-domain models: QuestionnaireResponse, EnvironmentProfile,
SkincareRoutineCurrent.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index,
    Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# ---------------------------------------------------------------------------
# ENUMs (original schema)
# ---------------------------------------------------------------------------

DietTypeEnum = Enum(
    "veg", "non_veg", "vegan", "mixed",
    name="diet_type_enum",
    create_constraint=True,
)

ExerciseFrequencyEnum = Enum(
    "none", "light", "moderate", "active",
    name="exercise_frequency_enum",
    create_constraint=True,
)

RoutineFrequencyEnum = Enum(
    "daily", "alternate", "weekly", "none",
    name="routine_frequency_enum",
    create_constraint=True,
)

WaterHardnessEnum = Enum(
    "soft", "moderate", "hard", "very_hard",
    name="water_hardness_enum",
    create_constraint=True,
)

ClimateZoneEnum = Enum(
    "tropical", "arid", "semi_arid", "temperate", "coastal",
    name="climate_zone_enum",
    create_constraint=True,
)


# ---------------------------------------------------------------------------
# QuestionnaireResponse
# ---------------------------------------------------------------------------

class QuestionnaireResponse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "questionnaire_responses"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ---------- Section 1: Sleep ----------
    sleep_hours_avg: Mapped[Optional[float]] = mapped_column(Float)
    sleep_quality: Mapped[Optional[int]] = mapped_column(Integer)       # 1–5
    sleep_consistency: Mapped[Optional[bool]] = mapped_column(Boolean)  # same wake time?

    # ---------- Section 2: Hydration & Diet ----------
    water_intake_liters: Mapped[Optional[float]] = mapped_column(Float)
    diet_type: Mapped[Optional[str]] = mapped_column(DietTypeEnum)
    sugar_consumption: Mapped[Optional[str]] = mapped_column(String(20))  # low/moderate/high
    dairy_consumption: Mapped[Optional[str]] = mapped_column(String(20))  # never/sometimes/daily

    # ---------- Section 3: Stress & Wellbeing ----------
    stress_level: Mapped[Optional[int]] = mapped_column(Integer)        # 1–5
    stress_source: Mapped[Optional[list]] = mapped_column(JSONB)        # ["work","family",...]
    exercise_frequency: Mapped[Optional[str]] = mapped_column(ExerciseFrequencyEnum)

    # ---------- Section 4: Screen Time & Environment ----------
    screen_time_hours: Mapped[Optional[float]] = mapped_column(Float)
    work_environment: Mapped[Optional[str]] = mapped_column(String(30))   # indoor_ac/indoor_non_ac/outdoor/mixed
    pollution_exposure: Mapped[Optional[str]] = mapped_column(String(30)) # low_city/metro/industrial

    # ---------- Section 6: Skincare Routine details ----------
    cleanser_frequency: Mapped[Optional[str]] = mapped_column(String(30))  # morning_only/morning_night/night_only/rarely
    sunscreen_use: Mapped[Optional[str]] = mapped_column(String(20))       # yes_always/sometimes/rarely/never

    # ---------- Section 7: Health & Medical ----------
    diagnosed_conditions: Mapped[Optional[list]] = mapped_column(JSONB)   # ["acne","eczema",...]
    medication_affects_skin: Mapped[Optional[bool]] = mapped_column(Boolean)
    medication_name_text: Mapped[Optional[str]] = mapped_column(Text)

    # ---------- Section 8: Lifestyle & Habits (JSONB — avoids migration for each new field) ----------
    extra_lifestyle: Mapped[Optional[dict]] = mapped_column(JSONB)

    # ---------- Legacy fields (kept for backwards compat) ----------
    alcohol_consumption: Mapped[Optional[str]] = mapped_column(String(50))
    smoking_status: Mapped[Optional[str]] = mapped_column(String(50))
    current_medications_text: Mapped[Optional[str]] = mapped_column(Text)

    # ---------- Schema version ----------
    questionnaire_version: Mapped[int] = mapped_column(Integer, default=2)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="questionnaire_responses")  # noqa: F821
    recommendations: Mapped[list["Recommendation"]] = relationship(  # noqa: F821
        "Recommendation", back_populates="questionnaire"
    )


# ---------------------------------------------------------------------------
# EnvironmentProfile
# ---------------------------------------------------------------------------

class EnvironmentProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Stores the user's local environmental conditions affecting skin health.
    One per user — upserted when location changes or climate data refreshes.
    """
    __tablename__ = "environment_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False, index=True,
    )
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    avg_temperature_c: Mapped[Optional[float]] = mapped_column(Float)
    avg_humidity_pct: Mapped[Optional[float]] = mapped_column(Float)
    pollution_index: Mapped[Optional[float]] = mapped_column(Float)
    water_hardness: Mapped[Optional[str]] = mapped_column(WaterHardnessEnum)
    uv_index: Mapped[Optional[float]] = mapped_column(Float)
    climate_zone: Mapped[Optional[str]] = mapped_column(ClimateZoneEnum)
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship("User", back_populates="environment_profile")  # noqa: F821

    __table_args__ = (
        Index("ix_environment_profiles_city_state", "city", "state"),
    )


# ---------------------------------------------------------------------------
# SkincareRoutineCurrent
# ---------------------------------------------------------------------------

class SkincareRoutineCurrent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks the user's existing skincare routine at questionnaire time."""
    __tablename__ = "skincare_routine_current"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False, index=True,
    )
    uses_cleanser: Mapped[bool] = mapped_column(Boolean, default=False)
    uses_toner: Mapped[bool] = mapped_column(Boolean, default=False)
    uses_moisturiser: Mapped[bool] = mapped_column(Boolean, default=False)
    uses_sunscreen: Mapped[bool] = mapped_column(Boolean, default=False)
    uses_serum: Mapped[bool] = mapped_column(Boolean, default=False)
    uses_exfoliant: Mapped[bool] = mapped_column(Boolean, default=False)
    uses_face_mask: Mapped[bool] = mapped_column(Boolean, default=False)
    uses_nothing: Mapped[bool] = mapped_column(Boolean, default=False)
    routine_frequency: Mapped[Optional[str]] = mapped_column(RoutineFrequencyEnum)
    known_allergens_text: Mapped[Optional[str]] = mapped_column(Text)
    products_currently_using: Mapped[Optional[dict]] = mapped_column(JSONB)

    user: Mapped["User"] = relationship("User", back_populates="skincare_routine")  # noqa: F821
