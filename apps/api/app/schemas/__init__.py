"""
Schema package — re-exports for convenient importing.
"""

from app.schemas.user import (  # noqa: F401
    UserRegister, DermatologistRegister, UserLogin, UserUpdate, UserResponse,
    UserListResponse, UserWithProfileResponse, UserProfileCreate, UserProfileUpdate,
    UserProfileResponse, TokenResponse, RefreshTokenRequest,
    ForgotPasswordRequest, ResetPasswordRequest, ChangeRoleRequest,
)
from app.schemas.scan import (  # noqa: F401
    UploadUrlResponse, TFJSResult, ScanAnalyzeRequest,
    ScanResponse, ScanListResponse, SkinConditionResponse,
)
from app.schemas.questionnaire import (  # noqa: F401
    QuestionnaireCreate, QuestionnaireResponse,
    EnvironmentProfileCreate, EnvironmentProfileResponse,
    SkincareRoutineCreate, SkincareRoutineResponse,
)
from app.schemas.product import (  # noqa: F401
    ProductCreate, ProductUpdate, ProductResponse, ProductListItem,
)
from app.schemas.recommendation import (  # noqa: F401
    RecommendationResponse, RecommendationProductResponse,
    RecommendationRoutineResponse, DermReviewRequest,
)
from app.schemas.progress import (  # noqa: F401
    ProgressScanCreate, ProgressScanResponse,
    ProgressMetricResponse, ProgressTimelineResponse,
)
from app.schemas.admin import (  # noqa: F401
    DermatologistProfileCreate, DermatologistProfileResponse,
    ReviewQueueItemResponse, ReviewQueueAssignRequest, ReviewQueueUpdateRequest,
    PlatformSettingResponse, PlatformSettingUpdate,
    PlatformStatsResponse, ScanAnalyticsEntry, TopProductEntry,
)
