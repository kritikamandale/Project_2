"""
Auth service — all authentication business logic.

Redis key conventions:
  login_attempts:{email}          → int, TTL = lockout_minutes
  login_locked:{email}            → "1", TTL = lockout_minutes
  otp:verify:{email}              → JSON {code_hash, attempts, expires_at}
  pwd_reset:{token_hash}          → JSON {user_id, email, expires_at, used}
  revoked_jti:{jti}               → "1", TTL = remaining token lifetime (secs)
"""

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_otp,
    generate_refresh_token,
    generate_reset_token,
    hash_password,
    hash_token,
    is_common_password,
    is_disposable_email,
    verify_password,
)
from app.models.admin import DermatologistProfile
from app.models.user import AuditLog, RefreshToken, User, UserProfile
from app.schemas.user import (
    DermatologistRegister,
    TokenResponse,
    UserRegister,
    UserResponse,
)
from app.services.email_service import (
    send_derm_pending_notification,
    send_verification_otp,
    send_password_reset,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_ts(dt: datetime) -> float:
    return dt.timestamp()


def _from_ts(ts: float) -> datetime:
    return datetime.fromtimestamp(ts, tz=timezone.utc)


async def _redis_get_json(redis: aioredis.Redis, key: str) -> Optional[dict]:
    raw = await redis.get(key)
    return json.loads(raw) if raw else None


async def _redis_set_json(
    redis: aioredis.Redis, key: str, value: dict, ttl_seconds: int
) -> None:
    await redis.set(key, json.dumps(value), ex=ttl_seconds)


# ---------------------------------------------------------------------------
# Login attempt / lockout
# ---------------------------------------------------------------------------

async def check_login_locked(redis: aioredis.Redis, email: str) -> bool:
    return bool(await redis.get(f"login_locked:{email}"))


async def record_failed_login(redis: aioredis.Redis, email: str) -> int:
    """Increment failure counter; lock account after max_attempts. Returns current count."""
    key = f"login_attempts:{email}"
    lockout_secs = settings.login_lockout_minutes * 60
    count = await redis.incr(key)
    await redis.expire(key, lockout_secs)
    if count >= settings.login_max_attempts:
        await redis.set(f"login_locked:{email}", "1", ex=lockout_secs)
        logger.warning("Account locked after failed attempts: %s", email)
    return count


async def reset_login_attempts(redis: aioredis.Redis, email: str) -> None:
    await redis.delete(f"login_attempts:{email}", f"login_locked:{email}")


# ---------------------------------------------------------------------------
# OTP — email verification
# ---------------------------------------------------------------------------

async def create_verification_otp(redis: aioredis.Redis, email: str) -> str:
    """Generate OTP, store hash in Redis, return plaintext for email."""
    otp = generate_otp()
    ttl = settings.otp_expire_minutes * 60
    await _redis_set_json(redis, f"otp:verify:{email}", {
        "code_hash": hash_token(otp),
        "attempts": 0,
        "expires_at": _to_ts(_now() + timedelta(seconds=ttl)),
    }, ttl)
    return otp


async def verify_email_otp(redis: aioredis.Redis, email: str, otp: str) -> bool:
    """
    Returns True if OTP is correct and not expired.
    Increments attempt counter; returns False (and may delete key) on exhaustion.
    """
    key = f"otp:verify:{email}"
    data = await _redis_get_json(redis, key)
    if not data:
        return False

    if _from_ts(data["expires_at"]) < _now():
        await redis.delete(key)
        return False

    data["attempts"] += 1
    if data["attempts"] > settings.otp_max_attempts:
        await redis.delete(key)
        return False

    if hash_token(otp) != data["code_hash"]:
        # Update attempt count
        remaining_ttl = int((_from_ts(data["expires_at"]) - _now()).total_seconds())
        if remaining_ttl > 0:
            await _redis_set_json(redis, key, data, remaining_ttl)
        return False

    # Correct — consume the OTP
    await redis.delete(key)
    return True


# ---------------------------------------------------------------------------
# Password reset token
# ---------------------------------------------------------------------------

async def create_password_reset_token(
    redis: aioredis.Redis, user_id: str, email: str
) -> str:
    token = generate_reset_token()
    token_hash = hash_token(token)
    ttl = settings.password_reset_expire_minutes * 60
    await _redis_set_json(redis, f"pwd_reset:{token_hash}", {
        "user_id": user_id,
        "email": email,
        "expires_at": _to_ts(_now() + timedelta(seconds=ttl)),
        "used": False,
    }, ttl)
    return token


async def consume_password_reset_token(
    redis: aioredis.Redis, token: str
) -> Optional[dict]:
    """Returns {user_id, email} if valid and unused, else None. Marks as used."""
    token_hash = hash_token(token)
    key = f"pwd_reset:{token_hash}"
    data = await _redis_get_json(redis, key)
    if not data:
        return None
    if data.get("used") or _from_ts(data["expires_at"]) < _now():
        await redis.delete(key)
        return None
    await redis.delete(key)
    return {"user_id": data["user_id"], "email": data["email"]}


# ---------------------------------------------------------------------------
# Access token revocation (jti blacklist)
# ---------------------------------------------------------------------------

async def revoke_access_jti(redis: aioredis.Redis, jti: str, ttl_seconds: int) -> None:
    await redis.set(f"revoked_jti:{jti}", "1", ex=ttl_seconds)


async def is_jti_revoked(redis: aioredis.Redis, jti: str) -> bool:
    return bool(await redis.get(f"revoked_jti:{jti}"))


# ---------------------------------------------------------------------------
# Refresh token DB helpers
# ---------------------------------------------------------------------------

async def create_db_refresh_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    opaque_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> RefreshToken:
    rt = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(opaque_token),
        expires_at=_now() + timedelta(days=settings.refresh_token_expire_days),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(rt)
    await db.flush()
    return rt


async def get_valid_refresh_token(
    db: AsyncSession, opaque_token: str
) -> Optional[RefreshToken]:
    token_hash = hash_token(opaque_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > _now(),
        )
    )
    return result.scalar_one_or_none()


async def revoke_all_user_refresh_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Revoke every refresh token for a user — used on token reuse detection."""
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked.is_(False),
        )
    )
    for rt in result.scalars().all():
        rt.revoked = True


# ---------------------------------------------------------------------------
# Audit log writer
# ---------------------------------------------------------------------------

async def write_audit_log(
    db: AsyncSession,
    action: str,
    entity_type: str,
    user_id: Optional[uuid.UUID] = None,
    entity_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip_address,
        metadata_=metadata or {},
    )
    db.add(log)


# ---------------------------------------------------------------------------
# Token pair helper
# ---------------------------------------------------------------------------

def _build_token_response(user: User, access_token: str, refresh_token: str) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",  # noqa: S106 — OAuth2 scheme name, not a secret
        user=UserResponse.model_validate(user),
    )


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

async def register_user(
    db: AsyncSession,
    redis: aioredis.Redis,
    body: UserRegister,
    ip_address: Optional[str] = None,
) -> User:
    """
    Create a new USER-role account.
    Raises ValueError with a user-facing message on invalid input.
    """
    if is_disposable_email(body.email):
        raise ValueError("Disposable email addresses are not allowed")
    if is_common_password(body.password):
        raise ValueError("Password is too common. Please choose a more secure password")

    email = body.email.lower()

    # Uniqueness check — compare against the normalized (lowercased) email that we
    # actually store, otherwise "Alice@x.com" slips past a check for "alice@x.com"
    # and then trips the DB unique constraint as an uncaught 500.
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ValueError("An account with this email already exists")

    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role="USER",
        is_verified=False,
        is_active=True,
    )
    db.add(user)
    await db.flush()  # get user.id

    # Record consent timestamp (DPDP Act Section 6 requirement)
    db.add(UserProfile(
        user_id=user.id,
        consent_given_at=datetime.now(timezone.utc),
        country="India",
    ))

    # Send OTP
    otp = await create_verification_otp(redis, body.email.lower())
    await send_verification_otp(body.email, body.full_name, otp)

    await write_audit_log(
        db, "REGISTER", "users", user_id=user.id,
        entity_id=user.id, ip_address=ip_address,
        metadata={"email": body.email, "role": "USER"},
    )
    return user


async def register_dermatologist(
    db: AsyncSession,
    redis: aioredis.Redis,
    body: DermatologistRegister,
    ip_address: Optional[str] = None,
) -> User:
    """
    Create a DERMATOLOGIST-role account in pending_verification state.
    Account cannot be used until an Admin approves it.
    """
    if is_disposable_email(body.email):
        raise ValueError("Disposable email addresses are not allowed")
    if is_common_password(body.password):
        raise ValueError("Password is too common. Please choose a more secure password")

    email = body.email.lower()

    # Normalized uniqueness check — see register_user for the rationale.
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ValueError("An account with this email already exists")

    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role="DERMATOLOGIST",
        is_verified=False,
        is_active=False,  # Inactive until Admin approves
    )
    db.add(user)
    await db.flush()

    derm_profile = DermatologistProfile(
        user_id=user.id,
        medical_license_number=body.medical_license_number,
        specialization=body.specialization,
        hospital_affiliation=body.hospital_name,
        verification_document_url=body.verification_document_s3_key,
    )
    db.add(derm_profile)

    # Send OTP for email verification + pending notification
    otp = await create_verification_otp(redis, body.email.lower())
    await send_verification_otp(body.email, body.full_name, otp)
    await send_derm_pending_notification(body.email, body.full_name)

    await write_audit_log(
        db, "REGISTER", "users", user_id=user.id,
        entity_id=user.id, ip_address=ip_address,
        metadata={"email": body.email, "role": "DERMATOLOGIST", "license": body.medical_license_number},
    )
    return user


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

async def login_user(
    db: AsyncSession,
    redis: aioredis.Redis,
    email: str,
    password: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> TokenResponse:
    """
    Authenticate and return a token pair.
    Raises ValueError with a user-facing message on any failure.
    Generic "Invalid credentials" is returned for wrong email/password to
    prevent user enumeration.
    """
    email = email.lower()

    if await check_login_locked(redis, email):
        raise ValueError(
            f"Too many failed attempts. Account is locked for "
            f"{settings.login_lockout_minutes} minutes"
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password or not verify_password(password, user.hashed_password):
        await record_failed_login(redis, email)
        raise ValueError("Invalid credentials")

    if not user.is_active:
        if user.role == "DERMATOLOGIST":
            raise ValueError("Your account is pending verification by our team")
        raise ValueError("Your account has been deactivated. Contact support")

    if not user.is_verified:
        raise ValueError("Please verify your email before logging in")

    # Successful login — reset failure counter
    await reset_login_attempts(redis, email)

    # Issue tokens
    access_token, jti = create_access_token(str(user.id), user.role, user.email)
    refresh_token_str = generate_refresh_token()
    await create_db_refresh_token(db, user.id, refresh_token_str, ip_address, user_agent)

    # Update last login
    user.last_login = _now()

    await write_audit_log(
        db, "LOGIN", "users", user_id=user.id,
        entity_id=user.id, ip_address=ip_address,
        metadata={"user_agent": user_agent},
    )

    return _build_token_response(user, access_token, refresh_token_str)


# ---------------------------------------------------------------------------
# Token refresh (with rotation + reuse detection)
# ---------------------------------------------------------------------------

async def rotate_refresh_token(
    db: AsyncSession,
    redis: aioredis.Redis,
    opaque_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> TokenResponse:
    token_hash = hash_token(opaque_token)

    # Concurrency guard: check if this token was already rotated in the last 30 seconds
    cache_key = f"rotated_token:{token_hash}"
    cached_data = await redis.get(cache_key)
    if cached_data:
        try:
            cached = json.loads(cached_data)
            result = await db.execute(select(User).where(User.id == uuid.UUID(cached["user_id"])))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return _build_token_response(user, cached["access_token"], cached["refresh_token"])
        except Exception as exc:
            logger.warning("Failed to parse cached rotated token: %s", exc)

    # Check if this hash was already revoked (reuse detection)
    revoked_check = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(True),
        )
    )
    if revoked_check.scalar_one_or_none():
        # Token reuse detected — revoke ALL sessions for this user
        user_check = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        compromised_rt = user_check.scalar_one_or_none()
        if compromised_rt:
            await revoke_all_user_refresh_tokens(db, compromised_rt.user_id)
            logger.warning(
                "Refresh token reuse detected for user %s — all sessions revoked",
                compromised_rt.user_id,
            )
        raise ValueError("Session has been invalidated due to a security event. Please log in again")

    rt = await get_valid_refresh_token(db, opaque_token)
    if not rt:
        raise ValueError("Invalid or expired refresh token")

    # Revoke old token
    rt.revoked = True

    # Load user
    result = await db.execute(select(User).where(User.id == rt.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise ValueError("User account is no longer active")

    # Issue new pair
    access_token, _ = create_access_token(str(user.id), user.role, user.email)
    new_refresh = generate_refresh_token()
    await create_db_refresh_token(db, user.id, new_refresh, ip_address, user_agent)

    # Cache this rotation mapping in Redis for 30 seconds to handle concurrent requests
    try:
        await redis.set(
            cache_key,
            json.dumps({
                "user_id": str(user.id),
                "access_token": access_token,
                "refresh_token": new_refresh,
            }),
            ex=30
        )
    except Exception as exc:
        logger.warning("Failed to cache rotated token in Redis: %s", exc)

    return _build_token_response(user, access_token, new_refresh)


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

async def logout_user(
    db: AsyncSession,
    redis: aioredis.Redis,
    user_id: uuid.UUID,
    jti: str,
    access_token_remaining_ttl: int,
    opaque_refresh_token: Optional[str] = None,
) -> None:
    # Blacklist the access token JTI
    if access_token_remaining_ttl > 0:
        await revoke_access_jti(redis, jti, access_token_remaining_ttl)

    # Revoke the specific refresh token if provided
    if opaque_refresh_token:
        rt = await get_valid_refresh_token(db, opaque_refresh_token)
        if rt:
            rt.revoked = True

    await write_audit_log(db, "LOGOUT", "users", user_id=user_id, entity_id=user_id)


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------

async def confirm_email_verification(
    db: AsyncSession,
    redis: aioredis.Redis,
    email: str,
    otp: str,
) -> User:
    email = email.lower()
    valid = await verify_email_otp(redis, email, otp)
    if not valid:
        raise ValueError("Invalid or expired verification code")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")

    user.is_verified = True
    await write_audit_log(db, "EMAIL_VERIFIED", "users", user_id=user.id, entity_id=user.id)
    return user


async def resend_verification_otp(
    redis: aioredis.Redis, email: str, full_name: str
) -> None:
    email = email.lower()
    otp = await create_verification_otp(redis, email)
    await send_verification_otp(email, full_name, otp)


# ---------------------------------------------------------------------------
# Forgot / reset password
# ---------------------------------------------------------------------------

async def initiate_password_reset(
    db: AsyncSession,
    redis: aioredis.Redis,
    email: str,
) -> None:
    """Always returns silently — never reveals whether email exists."""
    email = email.lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return  # Silently ignore

    token = await create_password_reset_token(redis, str(user.id), email)
    await send_password_reset(email, user.full_name, token)
    await write_audit_log(
        db, "PASSWORD_RESET_REQUEST", "users",
        user_id=user.id, entity_id=user.id,
    )


async def complete_password_reset(
    db: AsyncSession,
    redis: aioredis.Redis,
    token: str,
    new_password: str,
) -> None:
    if is_common_password(new_password):
        raise ValueError("Password is too common. Please choose a more secure password")

    token_data = await consume_password_reset_token(redis, token)
    if not token_data:
        raise ValueError("Invalid or expired reset link")

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(token_data["user_id"]))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")

    user.hashed_password = hash_password(new_password)

    # Revoke all refresh tokens (force re-login on all devices)
    await revoke_all_user_refresh_tokens(db, user.id)

    await write_audit_log(
        db, "PASSWORD_RESET", "users",
        user_id=user.id, entity_id=user.id,
    )
