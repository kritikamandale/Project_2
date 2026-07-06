"""
Scan-domain models: SkinScan, SkinCondition.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# ---------------------------------------------------------------------------
# ENUMs
# ---------------------------------------------------------------------------

SkinTypeEnum = Enum(
    "oily", "dry", "combination", "normal", "sensitive",
    name="skin_type_enum",
    create_constraint=True,
)

ConditionNameEnum = Enum(
    "acne", "dark_spots", "pigmentation", "wrinkles",
    "dryness", "redness", "pores", "texture", "uneven_tone",
    name="condition_name_enum",
    create_constraint=True,
)

SeverityEnum = Enum(
    "none", "mild", "moderate", "severe",
    name="severity_enum",
    create_constraint=True,
)

AffectedZoneEnum = Enum(
    "forehead", "nose", "cheeks", "chin", "under_eye", "full_face",
    name="affected_zone_enum",
    create_constraint=True,
)


# ---------------------------------------------------------------------------
# SkinScan
# ---------------------------------------------------------------------------

class SkinScan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skin_scans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    scan_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Image privacy fields
    image_deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    image_was_processed_locally: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    image_permanently_deleted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Analysis quality
    lighting_quality_score: Mapped[Optional[float]] = mapped_column(Float)  # 0.0–1.0

    # Results
    skin_type: Mapped[Optional[str]] = mapped_column(SkinTypeEnum)
    analysis_confidence_score: Mapped[Optional[float]] = mapped_column(Float)
    raw_analysis_json: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="scans")  # noqa: F821
    conditions: Mapped[list["SkinCondition"]] = relationship(
        "SkinCondition", back_populates="scan", cascade="all, delete-orphan"
    )
    recommendations: Mapped[list["Recommendation"]] = relationship(  # noqa: F821
        "Recommendation", back_populates="scan"
    )
    progress_scans: Mapped[list["ProgressScan"]] = relationship(  # noqa: F821
        "ProgressScan", back_populates="scan"
    )

    __table_args__ = (
        Index("ix_skin_scans_user_timestamp", "user_id", "scan_timestamp"),
    )


# ---------------------------------------------------------------------------
# SkinCondition
# ---------------------------------------------------------------------------

class SkinCondition(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "skin_conditions"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skin_scans.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    condition_name: Mapped[str] = mapped_column(ConditionNameEnum, nullable=False)
    severity: Mapped[str] = mapped_column(SeverityEnum, nullable=False)
    affected_zone: Mapped[str] = mapped_column(AffectedZoneEnum, nullable=False)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float)

    scan: Mapped["SkinScan"] = relationship("SkinScan", back_populates="conditions")

    __table_args__ = (
        Index("ix_skin_conditions_name_severity", "condition_name", "severity"),
        Index("ix_skin_conditions_scan_id", "scan_id"),
    )
