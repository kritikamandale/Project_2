"""
Shared SQLAlchemy mixins and the typed Base class.
All models inherit from Base; domain-appropriate models also inherit mixins.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Project-wide declarative base — imported by every model module."""
    pass


class UUIDPrimaryKeyMixin:
    """Adds a UUID primary key named `id`."""
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )


class TimestampMixin:
    """Adds server-generated created_at / updated_at timestamps."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """
    Adds soft-delete support via `deleted_at` and `is_active`.
    Rows are never physically removed — set deleted_at + is_active=False instead.
    Application code must filter `WHERE is_active = TRUE AND deleted_at IS NULL`.
    """
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    def soft_delete(self) -> None:
        self.is_active = False
        self.deleted_at = func.now()

    def restore(self) -> None:
        self.is_active = True
        self.deleted_at = None
