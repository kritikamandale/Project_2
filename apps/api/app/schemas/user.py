"""User domain Pydantic v2 schemas."""

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class DermatologistRegister(UserRegister):
    medical_license_number: str = Field(min_length=5, max_length=100)
    specialization: Optional[str] = Field(None, max_length=200)
    hospital_name: str = Field(min_length=2, max_length=300)
    years_of_experience: Optional[int] = Field(None, ge=0, le=60)
    verification_document_s3_key: Optional[str] = Field(
        None, description="S3 key of the uploaded license document"
    )


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    user: "UserResponse"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=200)
    is_verified: Optional[bool] = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_verified: bool
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_verified: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# UserProfile
# ---------------------------------------------------------------------------

class UserProfileCreate(BaseModel):
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=20)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: str = Field(default="India", max_length=100)
    skin_tone_category: Optional[Literal["I", "II", "III", "IV", "V", "VI"]] = None
    consent_given_at: Optional[datetime] = None


class UserProfileUpdate(UserProfileCreate):
    pass


class UserProfileResponse(UserProfileCreate):
    id: uuid.UUID
    user_id: uuid.UUID
    profile_photo_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserWithProfileResponse(UserResponse):
    profile: Optional[UserProfileResponse] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Admin user management
# ---------------------------------------------------------------------------

class ChangeRoleRequest(BaseModel):
    role: Literal["USER", "DERMATOLOGIST"]
