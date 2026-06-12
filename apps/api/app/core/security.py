"""
JWT creation/verification (RS256 with HS256 fallback) and password utilities.

RS256 is used when jwt_private_key / jwt_public_key env vars are set (production).
Development falls back to HS256 with jwt_secret_key for local ease.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt cost factor 12 per spec
pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12, deprecated="auto")


# ---------------------------------------------------------------------------
# Common passwords — top representative set; load from file in production
# ---------------------------------------------------------------------------
_COMMON_PASSWORDS: frozenset[str] = frozenset({
    "password", "password1", "password12", "password123", "password1234",
    "Password1", "Password1!", "Password@1", "P@ssword1", "P@ssw0rd",
    "123456789", "1234567890", "12345678", "123456789a",
    "qwerty123", "qwertyuiop", "qwerty1234",
    "iloveyou", "iloveyou1", "welcome1", "welcome@1", "Welcome@1",
    "sunshine1", "princess1", "letmein1", "letmein!", "batman123",
    "dragon123", "monkey123", "shadow123", "michael1", "jessica1",
    "football1", "baseball1", "superman1", "trustno1", "abc12345",
    "passw0rd", "Passw0rd1", "passw0rd1", "admin123", "admin@123",
    "Admin@123", "Admin1234", "admin1234", "master123",
    "Summer2024", "Winter2024", "Spring2024", "Autumn2024",
    "India@123", "India@1234", "India1234",
    "Test@1234", "test@1234", "Test1234!", "User@1234",
    "Hello@123", "hello123", "Hello1234",
    "skinai123", "Skinai@1", "skin1234",
})

# Lowercase lookup set for case-insensitive check
_COMMON_LOWER: frozenset[str] = frozenset(p.lower() for p in _COMMON_PASSWORDS)


# ---------------------------------------------------------------------------
# Disposable email domains
# ---------------------------------------------------------------------------
_DISPOSABLE_DOMAINS: frozenset[str] = frozenset({
    "mailinator.com", "guerrillamail.com", "tempmail.com", "throwam.com",
    "trashmail.com", "trashmail.me", "yopmail.com", "maildrop.cc",
    "sharklasers.com", "guerrillamail.info", "spam4.me", "grr.la",
    "10minutemail.com", "10minutemail.net", "dispostable.com",
    "fakeinbox.com", "mintemail.com", "tempinbox.com", "mailnull.com",
    "spamgourmet.com", "discardmail.com", "wegwerfmail.de",
    "burnermail.io", "throwaway.email", "emailfake.com",
    "getairmail.com", "guerrillamailblock.com", "spamherr.at",
    "mailnesia.com", "trashmail.at", "tempail.com", "tnef.org",
    "mytemp.email", "tempr.email", "nwytg.com", "moakt.com",
})


# ---------------------------------------------------------------------------
# Password utilities
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def is_common_password(password: str) -> bool:
    return password in _COMMON_PASSWORDS or password.lower() in _COMMON_LOWER


def is_disposable_email(email: str) -> bool:
    domain = email.lower().split("@")[-1]
    return domain in _DISPOSABLE_DOMAINS


# ---------------------------------------------------------------------------
# Token hashing (for opaque tokens stored in DB)
# ---------------------------------------------------------------------------

def hash_token(token: str) -> str:
    """SHA-256 hex digest — used to store refresh/reset tokens safely."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# RSA key resolution (RS256 production / HS256 development)
# ---------------------------------------------------------------------------

def _signing_key() -> str:
    """Private key PEM for encoding, or HS256 secret."""
    if settings.jwt_private_key:
        return settings.jwt_private_key.replace("\\n", "\n")
    return settings.jwt_secret_key


def _verification_key() -> str:
    """Public key PEM for decoding, or HS256 secret."""
    if settings.jwt_public_key:
        return settings.jwt_public_key.replace("\\n", "\n")
    return settings.jwt_secret_key


def _jwt_algorithm() -> str:
    return "RS256" if settings.jwt_private_key else "HS256"


# ---------------------------------------------------------------------------
# Access token
# ---------------------------------------------------------------------------

def create_access_token(user_id: str | Any, role: str, email: str) -> tuple[str, str]:
    """Returns (encoded_jwt, jti). jti is stored in Redis for revocation."""
    jti = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "type": "access",
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    token = jwt.encode(payload, _signing_key(), algorithm=_jwt_algorithm())
    return token, jti


def decode_access_token(token: str) -> dict:
    """Raises JWTError if the token is invalid, expired, or wrong type."""
    payload = jwt.decode(token, _verification_key(), algorithms=[_jwt_algorithm()])
    if payload.get("type") != "access":
        raise JWTError("Wrong token type")
    return payload


# ---------------------------------------------------------------------------
# Refresh token (opaque, stored hashed in DB)
# ---------------------------------------------------------------------------

def generate_refresh_token() -> str:
    """48-byte URL-safe opaque string. Hash with hash_token() before persisting."""
    return secrets.token_urlsafe(48)


# ---------------------------------------------------------------------------
# OTP (email verification / 2FA)
# ---------------------------------------------------------------------------

def generate_otp() -> str:
    """6-digit numeric OTP, zero-padded."""
    return str(secrets.randbelow(1_000_000)).zfill(6)


# ---------------------------------------------------------------------------
# Password reset token (single-use, stored hashed in Redis)
# ---------------------------------------------------------------------------

def generate_reset_token() -> str:
    """64-byte URL-safe token for password reset links."""
    return secrets.token_urlsafe(64)
