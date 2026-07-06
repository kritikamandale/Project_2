"""
Progress-tracking models: ProgressScan, ProgressMetric, RoutineCheckin,
ProductFeedback, InAppNotification.
"""

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, Float, ForeignKey, Index,
    Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ---------------------------------------------------------------------------
# ENUMs
# ---------------------------------------------------------------------------

AdherenceLevelEnum = Enum(
    "yes", "mostly", "no",
    name="adherence_level_enum",
    create_constraint=True,
)

ProductRatingEnum = Enum(
    "working", "unsure", "not_working",
    name="product_rating_enum",
    create_constraint=True,
)

NotificationTypeEnum = Enum(
    "scan_reminder", "derm_review_complete", "new_product_suggestion", "routine_tip",
    name="notification_type_enum",
    create_constraint=True,
)


# ---------------------------------------------------------------------------
# ProgressScan
# ---------------------------------------------------------------------------

class ProgressScan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Periodic check-in scan linked to a user's recommendation roadmap.
    scan_number increments each time the user re-scans (1 = baseline).
    """
    __tablename__ = "progress_scans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    recommendation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendations.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    scan_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skin_scans.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    scan_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    overall_skin_score: Mapped[Optional[float]] = mapped_column(Float)    # 0–100
    delta_from_baseline: Mapped[Optional[float]] = mapped_column(Float)   # +/- change
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="progress_scans")  # noqa: F821
    recommendation: Mapped[Optional["Recommendation"]] = relationship(  # noqa: F821
        "Recommendation", back_populates="progress_scans"
    )
    scan: Mapped[Optional["SkinScan"]] = relationship("SkinScan", back_populates="progress_scans")  # noqa: F821
    metrics: Mapped[list["ProgressMetric"]] = relationship(
        "ProgressMetric", back_populates="progress_scan", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_progress_scans_user_number", "user_id", "scan_number"),
    )


# ---------------------------------------------------------------------------
# ProgressMetric
# ---------------------------------------------------------------------------

class ProgressMetric(UUIDPrimaryKeyMixin, Base):
    """Stores per-condition delta values for each progress scan."""
    __tablename__ = "progress_metrics"

    progress_scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("progress_scans.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    previous_value: Mapped[Optional[float]] = mapped_column(Float)
    current_value: Mapped[Optional[float]] = mapped_column(Float)
    improvement_pct: Mapped[Optional[float]] = mapped_column(Float)

    progress_scan: Mapped["ProgressScan"] = relationship(
        "ProgressScan", back_populates="metrics"
    )


# ---------------------------------------------------------------------------
# RoutineCheckin
# ---------------------------------------------------------------------------

class RoutineCheckin(UUIDPrimaryKeyMixin, Base):
    """Daily routine adherence log — one entry per user per calendar day."""
    __tablename__ = "routine_checkins"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    checkin_date: Mapped[date] = mapped_column(Date, nullable=False)
    adherence: Mapped[str] = mapped_column(AdherenceLevelEnum, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="routine_checkins")  # noqa: F821

    __table_args__ = (
        UniqueConstraint("user_id", "checkin_date", name="uq_routine_checkin_user_date"),
        Index("ix_routine_checkins_user_date", "user_id", "checkin_date"),
    )


# ---------------------------------------------------------------------------
# ProductFeedback
# ---------------------------------------------------------------------------

class ProductFeedback(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User ratings on recommended products — feeds back to recommendation engine."""
    __tablename__ = "product_feedback"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    recommendation_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendation_products.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    rating: Mapped[str] = mapped_column(ProductRatingEnum, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped["User"] = relationship("User", back_populates="product_feedback")  # noqa: F821

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_product_feedback_user_product"),
        Index("ix_product_feedback_user_product", "user_id", "product_id"),
    )


# ---------------------------------------------------------------------------
# InAppNotification
# ---------------------------------------------------------------------------

class InAppNotification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """In-app notification bell entries stored in DB."""
    __tablename__ = "in_app_notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    type: Mapped[str] = mapped_column(NotificationTypeEnum, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    action_url: Mapped[Optional[str]] = mapped_column(String(500))

    user: Mapped["User"] = relationship("User", back_populates="notifications")  # noqa: F821

    __table_args__ = (
        Index("ix_in_app_notifications_user_read", "user_id", "is_read"),
    )
