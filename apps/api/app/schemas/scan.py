"""Scan domain Pydantic v2 schemas.

Privacy contract: raw images are NEVER accepted by the API.
Only the 512-dim feature vector + classification labels arrive from the browser.
All scan records are stored with image_permanently_deleted = TRUE.
"""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# String literals — kept as type aliases so routers can use them directly
# ---------------------------------------------------------------------------

SkinTypeStr = Literal["oily", "dry", "combination", "normal", "sensitive"]
ConditionNameStr = Literal[
    "acne", "dark_spots", "pigmentation", "wrinkles",
    "dryness", "redness", "pores", "texture", "uneven_tone",
]
SeverityStr = Literal["none", "mild", "moderate", "severe"]
AffectedZoneStr = Literal["forehead", "nose", "cheeks", "chin", "under_eye", "full_face"]
FitzpatrickToneStr = Literal["I", "II", "III", "IV", "V", "VI"]

FEATURE_VECTOR_DIM = 512


# ---------------------------------------------------------------------------
# Upload URL (kept for dermatologist license document uploads)
# ---------------------------------------------------------------------------

class UploadUrlResponse(BaseModel):
    upload_url: str
    s3_key: str
    expires_in_seconds: int


# ---------------------------------------------------------------------------
# Scan submission — browser sends feature vector only, never the raw image
# ---------------------------------------------------------------------------

class ConditionInput(BaseModel):
    name: ConditionNameStr
    severity: SeverityStr
    zone: AffectedZoneStr
    confidence: float = Field(ge=0.0, le=1.0)


class ScanSubmitRequest(BaseModel):
    model_config = {"protected_namespaces": ()}

    skin_type: SkinTypeStr
    skin_type_confidence: float = Field(ge=0.0, le=1.0)
    fitzpatrick_tone: FitzpatrickToneStr
    conditions: list[ConditionInput] = Field(default_factory=list)
    lighting_quality_score: float = Field(ge=0.0, le=1.0)
    feature_vector: list[float] = Field(
        min_length=FEATURE_VECTOR_DIM,
        max_length=FEATURE_VECTOR_DIM,
        description="512-dim MobileNetV2 feature vector for server-side validation",
    )
    model_version: str = Field(min_length=1, max_length=50)
    processed_locally: Literal[True]          # Must always be True — enforced by type
    analysis_timestamp: str = Field(min_length=1)


class ScanSubmitResponse(BaseModel):
    scan_id: uuid.UUID
    message: str = "Analysis saved. Your photo was never stored on our servers."
    skin_type: SkinTypeStr
    fitzpatrick_tone: FitzpatrickToneStr
    confidence: float
    conditions_detected: int
    bias_flag: bool = False
    bias_message: Optional[str] = None
    image_permanently_deleted: bool = True


# ---------------------------------------------------------------------------
# Scan responses
# ---------------------------------------------------------------------------

class SkinConditionResponse(BaseModel):
    id: uuid.UUID
    condition_name: ConditionNameStr
    severity: SeverityStr
    affected_zone: AffectedZoneStr
    confidence_score: Optional[float] = None

    model_config = {"from_attributes": True}


class ScanResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    scan_timestamp: datetime
    skin_type: Optional[SkinTypeStr] = None
    analysis_confidence_score: Optional[float] = None
    lighting_quality_score: Optional[float] = None
    fitzpatrick_tone: Optional[FitzpatrickToneStr] = None   # sourced from raw_analysis_json
    image_permanently_deleted: bool
    image_was_processed_locally: bool
    conditions: list[SkinConditionResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanListResponse(BaseModel):
    id: uuid.UUID
    scan_timestamp: datetime
    skin_type: Optional[SkinTypeStr] = None
    analysis_confidence_score: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedScans(BaseModel):
    items: list[ScanListResponse]
    total: int
    page: int
    per_page: int
    has_more: bool
