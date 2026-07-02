"""
Auth router — register, login, refresh, logout, password reset, email verification.

Rate limiting is applied via slowapi decorators.  The limiter instance is
created in main.py and attached to app.state.limiter so it's available here
via the request object.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError as JWTError
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import (
    get_client_ip,
    get_current_user,
    get_redis,
    get_user_agent,
)
from app.core.limiter import limiter
from app.core.security import decode_access_token
from app.schemas.user import (
    DermatologistRegister,
    ForgotPasswordRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserWithProfileResponse,
)
from app.services import auth_service

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Inline schemas used only in this router
# ---------------------------------------------------------------------------

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class ResendOtpRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# POST /register/user
# ---------------------------------------------------------------------------

@router.post(
    "/register/user",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new end-user account",
)
@limiter.limit("5/hour")
async def register_user(
    request: Request,
    body: UserRegister,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    ip = get_client_ip(request)
    try:
        async with db.begin():
            await auth_service.register_user(db, redis, body, ip_address=ip)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return MessageResponse(
        message="Account created. Please check your email for a verification code."
    )


# ---------------------------------------------------------------------------
# POST /register/dermatologist
# ---------------------------------------------------------------------------

@router.post(
    "/register/dermatologist",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a dermatologist account (pending admin approval)",
)
@limiter.limit("5/hour")
async def register_dermatologist(
    request: Request,
    body: DermatologistRegister,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    ip = get_client_ip(request)
    try:
        async with db.begin():
            await auth_service.register_dermatologist(db, redis, body, ip_address=ip)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return MessageResponse(
        message=(
            "Application submitted. Please verify your email, then wait for "
            "admin approval before logging in."
        )
    )


# ---------------------------------------------------------------------------
# POST /login
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive access + refresh tokens",
)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: UserLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    try:
        async with db.begin():
            tokens = await auth_service.login_user(
                db, redis,
                email=body.email,
                password=body.password,
                ip_address=ip,
                user_agent=ua,
            )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )
    return tokens


# ---------------------------------------------------------------------------
# POST /refresh
# ---------------------------------------------------------------------------

@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and return a new token pair",
)
async def refresh_token(
    request: Request,
    body: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    try:
        async with db.begin():
            tokens = await auth_service.rotate_refresh_token(
                db, redis, body.refresh_token,
                ip_address=ip, user_agent=ua,
            )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )
    return tokens


# ---------------------------------------------------------------------------
# POST /logout
# ---------------------------------------------------------------------------

@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke current session tokens",
)
async def logout(
    request: Request,
    body: RefreshTokenRequest,
    current_user=Depends(get_current_user),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    redis=Depends(get_redis),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
):
    # Compute remaining TTL of the access token so the JTI blacklist expires naturally
    remaining_ttl = 0
    if credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            exp = payload.get("exp", 0)
            jti = payload.get("jti", "")
            remaining_ttl = max(0, int(exp - datetime.now(timezone.utc).timestamp()))
        except JWTError:
            jti = ""
    else:
        jti = ""

    await auth_service.logout_user(
        db, redis,
        user_id=current_user.id,
        jti=jti,
        access_token_remaining_ttl=remaining_ttl,
        opaque_refresh_token=body.refresh_token,
    )
    await db.commit()
    return MessageResponse(message="Logged out successfully")


# ---------------------------------------------------------------------------
# POST /verify-email
# ---------------------------------------------------------------------------

@router.post(
    "/verify-email",
    response_model=MessageResponse,
    summary="Verify email address with 6-digit OTP",
)
async def verify_email(
    body: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    try:
        async with db.begin():
            await auth_service.confirm_email_verification(
                db, redis, body.email, body.otp
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return MessageResponse(message="Email verified successfully. You can now log in.")


# ---------------------------------------------------------------------------
# POST /resend-otp
# ---------------------------------------------------------------------------

@router.post(
    "/resend-otp",
    response_model=MessageResponse,
    summary="Resend email verification OTP",
)
async def resend_otp(
    request: Request,
    body: ResendOtpRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    from sqlalchemy import select
    from app.models.user import User

    result = await db.execute(
        select(User).where(User.email == body.email.lower(), User.is_verified.is_(False))
    )
    user = result.scalar_one_or_none()
    if user:
        await auth_service.resend_verification_otp(redis, body.email, user.full_name)

    # Always return same message to prevent enumeration
    return MessageResponse(
        message="If an unverified account exists for this email, a new code has been sent."
    )


# ---------------------------------------------------------------------------
# POST /forgot-password
# ---------------------------------------------------------------------------

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request a password reset link",
)
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    async with db.begin():
        await auth_service.initiate_password_reset(db, redis, body.email)

    # Always the same message — never confirm whether email exists
    return MessageResponse(
        message="If an account with that email exists, a password reset link has been sent."
    )


# ---------------------------------------------------------------------------
# POST /reset-password
# ---------------------------------------------------------------------------

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Complete password reset using the emailed token",
)
async def reset_password(
    body: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    # ResetPasswordRequest uses otp field name — here it carries the reset token
    try:
        async with db.begin():
            await auth_service.complete_password_reset(
                db, redis, token=body.otp, new_password=body.new_password
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return MessageResponse(message="Password reset successfully. Please log in.")


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserWithProfileResponse,
    summary="Return the currently authenticated user's profile",
)
async def get_me(current_user=Depends(get_current_user)):
    return current_user
