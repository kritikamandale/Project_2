"""
User-domain models: User, UserProfile, RefreshToken, AuditLog.
"""

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Index,
    String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

# ---------------------------------------------------------------------------
# ENUMs
# ---------------------------------------------------------------------------

UserRoleEnum = Enum(
    "USER", "DERMATOLOGIST", "ADMIN",
    name="user_role_enum",
    create_constraint=True,
)

FitzpatrickScaleEnum = Enum(
    "I", "II", "III", "IV", "V", "VI",
    name="fitzpatrick_scale_enum",
    create_constraint=True,
)

# First-time onboarding progression for USER-role accounts. Advances only:
# not_started → questionnaire_done → scan_done → completed.
OnboardingStatusEnum = Enum(
    "not_started", "questionnaire_done", "scan_done", "completed",
    name="onboarding_status_enum",
    create_constraint=True,
)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(UUIDPrimaryKeyMixin, SoftDeleteMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(UserRoleEnum, default="USER", nullable=False, index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    totp_secret: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    onboarding_status: Mapped[str] = mapped_column(
        OnboardingStatusEnum, default="not_started", server_default="not_started", nullable=False,
    )

    # Relationships
    profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    scans: Mapped[list["SkinScan"]] = relationship(  # noqa: F821
        "SkinScan", back_populates="user", cascade="all, delete-orphan"
    )
    questionnaire_responses: Mapped[list["QuestionnaireResponse"]] = relationship(  # noqa: F821
        "QuestionnaireResponse", back_populates="user", cascade="all, delete-orphan"
    )
    environment_profile: Mapped[Optional["EnvironmentProfile"]] = relationship(  # noqa: F821
        "EnvironmentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    skincare_routine: Mapped[Optional["SkincareRoutineCurrent"]] = relationship(  # noqa: F821
        "SkincareRoutineCurrent", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    recommendations: Mapped[list["Recommendation"]] = relationship(  # noqa: F821
        "Recommendation", back_populates="user", foreign_keys="Recommendation.user_id",
        cascade="all, delete-orphan",
    )
    progress_scans: Mapped[list["ProgressScan"]] = relationship(  # noqa: F821
        "ProgressScan", back_populates="user", cascade="all, delete-orphan"
    )
    routine_checkins: Mapped[list["RoutineCheckin"]] = relationship(  # noqa: F821
        "RoutineCheckin", back_populates="user", cascade="all, delete-orphan"
    )
    product_feedback: Mapped[list["ProductFeedback"]] = relationship(  # noqa: F821
        "ProductFeedback", back_populates="user", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["InAppNotification"]] = relationship(  # noqa: F821
        "InAppNotification", back_populates="user", cascade="all, delete-orphan"
    )
    dermatologist_profile: Mapped[Optional["DermatologistProfile"]] = relationship(  # noqa: F821
        "DermatologistProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", back_populates="user"
    )


# ---------------------------------------------------------------------------
# UserProfile
# ---------------------------------------------------------------------------

class UserProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False, index=True,
    )
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    state: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100), default="India")
    skin_tone_category: Mapped[Optional[str]] = mapped_column(FitzpatrickScaleEnum)
    profile_photo_url: Mapped[Optional[str]] = mapped_column(String(500))
    consent_given_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship("User", back_populates="profile")


# ---------------------------------------------------------------------------
# RefreshToken
# ---------------------------------------------------------------------------

class RefreshToken(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

    __table_args__ = (
        Index("ix_refresh_tokens_user_revoked", "user_id", "revoked"),
    )


# ---------------------------------------------------------------------------
# AuditLog
# ---------------------------------------------------------------------------

class AuditLog(UUIDPrimaryKeyMixin, Base):
    """
    Written automatically by PostgreSQL triggers on users, skin_scans,
    recommendations. Can also be written explicitly for application-level events
    (login, logout, role change).
    """
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_timestamp", "timestamp"),
    )
