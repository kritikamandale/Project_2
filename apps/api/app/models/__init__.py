"""
Import every model so Alembic autogenerate and `Base.metadata` see them all.
"""

from app.models.base import Base  # noqa: F401

from app.models.user import User, UserProfile, RefreshToken, AuditLog  # noqa: F401
from app.models.scan import SkinScan, SkinCondition  # noqa: F401
from app.models.questionnaire import (  # noqa: F401
    QuestionnaireResponse, EnvironmentProfile, SkincareRoutineCurrent,
)
from app.models.product import Product, ProductEmbedding  # noqa: F401
from app.models.recommendation import Recommendation, RecommendationProduct  # noqa: F401
from app.models.progress import ProgressScan, ProgressMetric  # noqa: F401
from app.models.admin import DermatologistProfile, ReviewQueue, PlatformSetting  # noqa: F401

__all__ = [
    "Base",
    "User", "UserProfile", "RefreshToken", "AuditLog",
    "SkinScan", "SkinCondition",
    "QuestionnaireResponse", "EnvironmentProfile", "SkincareRoutineCurrent",
    "Product", "ProductEmbedding",
    "Recommendation", "RecommendationProduct",
    "ProgressScan", "ProgressMetric",
    "DermatologistProfile", "ReviewQueue", "PlatformSetting",
]
