"""
Admin / dermatologist models: DermatologistProfile, ReviewQueue, PlatformSettings.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

# ---------------------------------------------------------------------------
# ENUMs
# ---------------------------------------------------------------------------

ReviewPriorityEnum = Enum(
    "high", "normal", "low",
    name="review_priority_enum",
    create_constraint=True,
)

ReviewStatusEnum = Enum(
    "pending", "in_review", "approved", "rejected", "escalated",
    name="review_status_enum",
    create_constraint=True,
)


# ---------------------------------------------------------------------------
# DermatologistProfile
# ---------------------------------------------------------------------------

class DermatologistProfile(TimestampMixin, Base):
    """Extended profile for DERMATOLOGIST-role users. PK is user_id (one-to-one)."""
    __tablename__ = "dermatologist_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True, nullable=False,
    )
    medical_license_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    specialization: Mapped[Optional[str]] = mapped_column(String(200))
    hospital_affiliation: Mapped[Optional[str]] = mapped_column(String(300))
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    verification_document_url: Mapped[Optional[str]] = mapped_column(String(500))

    user: Mapped["User"] = relationship("User", back_populates="dermatologist_profile")  # noqa: F821


# ---------------------------------------------------------------------------
# ReviewQueue
# ---------------------------------------------------------------------------

class ReviewQueue(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Every new Recommendation is automatically added to the review queue.
    Dermatologists pick from the queue by priority.
    """
    __tablename__ = "review_queue"

    recommendation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendations.id", ondelete="CASCADE"),
        unique=True, nullable=False, index=True,
    )
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    priority: Mapped[str] = mapped_column(ReviewPriorityEnum, default="normal", nullable=False)
    status: Mapped[str] = mapped_column(ReviewStatusEnum, default="pending", nullable=False, index=True)
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    recommendation: Mapped["Recommendation"] = relationship(  # noqa: F821
        "Recommendation", back_populates="review_queue_entry"
    )

    __table_args__ = (
        Index("ix_review_queue_status_priority", "status", "priority"),
        Index("ix_review_queue_assigned_to", "assigned_to"),
    )


# ---------------------------------------------------------------------------
# PlatformSettings
# ---------------------------------------------------------------------------

class PlatformSetting(Base):
    """
    Key-value store for runtime platform configuration and feature flags.
    PK is the setting key (varchar) — no UUID needed.
    """
    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True, nullable=False)
    value: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
