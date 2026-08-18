"""
Recommendation-domain models: Recommendation, RecommendationProduct.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Recommendation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "recommendations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skin_scans.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    questionnaire_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questionnaire_responses.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    recommendation_engine_version: Mapped[str] = mapped_column(String(50), default="2.0")
    ai_reasoning: Mapped[Optional[str]] = mapped_column(Text)
    roadmap_weeks: Mapped[int] = mapped_column(Integer, default=20, nullable=False)

    # --- Phase 6 additions ---
    skin_score: Mapped[Optional[float]] = mapped_column(Float)              # 0–100 overall health
    confidence_score: Mapped[Optional[float]] = mapped_column(Float)        # 0–1 AI Engine confidence
    estimated_monthly_cost_inr: Mapped[Optional[float]] = mapped_column(Float)
    roadmap_json: Mapped[Optional[dict]] = mapped_column(JSONB)             # 20-week week-by-week structure
    allergen_flags: Mapped[Optional[list]] = mapped_column(JSONB)           # Ingredient conflict / allergen warnings
    requires_derm_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    feedback_rating: Mapped[Optional[int]] = mapped_column(Integer)         # 1–5
    feedback_text: Mapped[Optional[str]] = mapped_column(Text)
    # Extra AI Engine output fields stored as JSON
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    # ^ contains: lifestyle_tips, ingredients_to_use, ingredients_to_avoid,
    #             dermatologist_note, climate_insight, morning_routine, night_routine

    # Dermatologist review
    is_dermatologist_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="recommendations", foreign_keys=[user_id]
    )
    scan: Mapped["SkinScan"] = relationship("SkinScan", back_populates="recommendations")  # noqa: F821
    questionnaire: Mapped[Optional["QuestionnaireResponse"]] = relationship(  # noqa: F821
        "QuestionnaireResponse", back_populates="recommendations"
    )
    products: Mapped[list["RecommendationProduct"]] = relationship(
        "RecommendationProduct", back_populates="recommendation",
        cascade="all, delete-orphan", order_by="RecommendationProduct.order_in_routine",
    )
    review_queue_entry: Mapped[Optional["ReviewQueue"]] = relationship(  # noqa: F821
        "ReviewQueue", back_populates="recommendation", uselist=False
    )
    progress_scans: Mapped[list["ProgressScan"]] = relationship(  # noqa: F821
        "ProgressScan", back_populates="recommendation"
    )

    __table_args__ = (
        Index("ix_recommendations_user_scan", "user_id", "scan_id"),
    )


class RecommendationProduct(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "recommendation_products"

    recommendation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    order_in_routine: Mapped[int] = mapped_column(Integer, default=0)
    start_week: Mapped[int] = mapped_column(Integer, default=1)
    reason_text: Mapped[Optional[str]] = mapped_column(Text)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True)
    phase: Mapped[int] = mapped_column(Integer, default=1)  # 1, 2, or 3

    # --- Phase 6 additions ---
    highlighted_ingredient: Mapped[Optional[str]] = mapped_column(String(100))
    usage_instruction: Mapped[Optional[str]] = mapped_column(Text)
    time_of_day: Mapped[Optional[str]] = mapped_column(String(20))  # morning/night/both/weekly

    recommendation: Mapped["Recommendation"] = relationship(
        "Recommendation", back_populates="products"
    )
    product: Mapped["Product"] = relationship("Product", back_populates="recommendation_products")  # noqa: F821
