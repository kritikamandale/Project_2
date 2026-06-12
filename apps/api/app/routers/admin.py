"""
Admin router — platform management, analytics, user/product/settings CRUD.

Security layers:
  1. require_admin  — JWT with role=ADMIN
  2. IP allowlist   — checked against platform_settings['admin_ip_allowlist']
  3. TOTP guard     — X-TOTP-Code header required if admin.totp_enabled
  4. Self-protection — cannot delete or demote own account
  5. Audit log      — every mutating action writes to audit_logs
"""

import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_client_ip, get_redis, require_admin
from app.models.admin import PlatformSetting
from app.schemas.admin import (
    AdminProductCreate,
    AdminProductUpdate,
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
    AnalyticsOverviewResponse,
    AuditLogItem,
    BiasReportResponse,
    ChartsDataResponse,
    DermVerificationAction,
    FeatureFlagsUpdate,
    PaginatedAdminProducts,
    PaginatedAdminUsers,
    PaginatedAuditLogs,
    ProductEmbeddingRegenerateResponse,
    TOTPSetupResponse,
    TOTPStatusResponse,
    TOTPVerifyRequest,
)
from app.services import admin_service

router = APIRouter()

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Dependency: IP allowlist check
# ---------------------------------------------------------------------------

async def check_ip_allowlist(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Reads admin_ip_allowlist from platform_settings; rejects if IP not in list."""
    setting = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == "admin_ip_allowlist")
    )).scalar_one_or_none()

    if not setting or not setting.value:
        return  # No allowlist configured → allow all

    allowlist: list = setting.value if isinstance(setting.value, list) else []
    if "*" in allowlist or not allowlist:
        return  # Wildcard → allow all

    client_ip = get_client_ip(request)
    if client_ip not in allowlist:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IP address not in admin allowlist",
        )


# ---------------------------------------------------------------------------
# Dependency: TOTP guard
# ---------------------------------------------------------------------------

async def require_totp(
    current_admin=Depends(require_admin),
    x_totp_code: Optional[str] = Header(default=None, alias="X-TOTP-Code"),
) -> None:
    """If admin has TOTP enabled, validates the X-TOTP-Code header."""
    if current_admin.totp_enabled:
        if not x_totp_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="TOTP code required (X-TOTP-Code header)",
            )
        if not current_admin.totp_secret:
            raise HTTPException(status_code=500, detail="TOTP secret missing — re-configure 2FA")
        if not admin_service.check_totp_code(current_admin.totp_secret, x_totp_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired TOTP code",
            )


# Compound guard used on sensitive endpoints
AdminGuard = [Depends(check_ip_allowlist), Depends(require_totp)]


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get(
    "/analytics",
    response_model=AnalyticsOverviewResponse,
    dependencies=[Depends(require_admin), Depends(check_ip_allowlist)],
    summary="Platform analytics overview",
)
async def get_analytics_overview(db: AsyncSession = Depends(get_db)):
    return await admin_service.get_analytics_overview(db)


@router.get(
    "/analytics/charts",
    response_model=ChartsDataResponse,
    dependencies=[Depends(require_admin), Depends(check_ip_allowlist)],
    summary="Chart datasets: registration trend, skin types, cities, Fitzpatrick, conditions",
)
async def get_charts_data(db: AsyncSession = Depends(get_db)):
    return await admin_service.get_charts_data(db)


@router.get(
    "/bias-report",
    response_model=BiasReportResponse,
    dependencies=[Depends(require_admin), Depends(check_ip_allowlist)],
    summary="Fitzpatrick tone distribution + per-tone confidence averages",
)
async def get_bias_report(db: AsyncSession = Depends(get_db)):
    return await admin_service.get_bias_report(db)


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------

@router.get(
    "/users",
    response_model=PaginatedAdminUsers,
    dependencies=[Depends(require_admin), Depends(check_ip_allowlist)],
    summary="Paginated user list with filters",
)
async def list_users(
    search: Optional[str] = Query(None, max_length=200),
    role: Optional[str] = Query(None, pattern="^(USER|DERMATOLOGIST|ADMIN)$"),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.get_admin_users(db, search, role, is_active, page, page_size)


@router.put(
    "/users/{user_id}/role",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=AdminGuard,
    summary="Change user role",
)
async def change_user_role(
    user_id: uuid.UUID,
    body: AdminUserRoleUpdate,
    request: Request,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await admin_service.change_user_role(
        db, user_id, body.role, current_admin.id, get_client_ip(request)
    )


@router.put(
    "/users/{user_id}/status",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=AdminGuard,
    summary="Suspend / activate / GDPR-delete user",
)
async def change_user_status(
    user_id: uuid.UUID,
    body: AdminUserStatusUpdate,
    request: Request,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await admin_service.change_user_status(
        db, user_id, body.action, current_admin.id, get_client_ip(request), body.reason
    )


# ---------------------------------------------------------------------------
# Dermatologist Verification
# ---------------------------------------------------------------------------

@router.get(
    "/dermatologists/pending",
    dependencies=[Depends(require_admin), Depends(check_ip_allowlist)],
    summary="Pending dermatologist verification queue",
)
async def get_derm_verification_queue(db: AsyncSession = Depends(get_db)):
    return await admin_service.get_derm_verification_queue(db)


@router.post(
    "/dermatologist/{user_id}/verify",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=AdminGuard,
    summary="Approve or reject dermatologist registration",
)
async def verify_dermatologist(
    user_id: uuid.UUID,
    body: DermVerificationAction,
    request: Request,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await admin_service.verify_dermatologist(
        db, user_id, body.action, body.rejection_reason, current_admin.id, get_client_ip(request)
    )


# ---------------------------------------------------------------------------
# Product Catalog Management
# ---------------------------------------------------------------------------

@router.get(
    "/products",
    response_model=PaginatedAdminProducts,
    dependencies=[Depends(require_admin), Depends(check_ip_allowlist)],
    summary="Admin view of all products with recommendation counts",
)
async def list_products(
    search: Optional[str] = Query(None, max_length=200),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|inactive)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.get_admin_products(db, search, status_filter, page, page_size)


@router.post(
    "/products",
    status_code=status.HTTP_201_CREATED,
    dependencies=AdminGuard,
    summary="Create new product",
)
async def create_product(
    body: AdminProductCreate,
    request: Request,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    product = await admin_service.create_product(db, body, current_admin.id, get_client_ip(request))
    from app.schemas.product import ProductResponse
    return ProductResponse.model_validate(product)


@router.put(
    "/products/{product_id}",
    dependencies=AdminGuard,
    summary="Update product",
)
async def update_product(
    product_id: uuid.UUID,
    body: AdminProductUpdate,
    request: Request,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    product = await admin_service.update_product(db, product_id, body, current_admin.id, get_client_ip(request))
    from app.schemas.product import ProductResponse
    return ProductResponse.model_validate(product)


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=AdminGuard,
    summary="Soft-delete product (existing recommendations unaffected)",
)
async def soft_delete_product(
    product_id: uuid.UUID,
    request: Request,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await admin_service.soft_delete_product(db, product_id, current_admin.id, get_client_ip(request))


@router.post(
    "/products/{product_id}/regenerate-embedding",
    response_model=ProductEmbeddingRegenerateResponse,
    dependencies=AdminGuard,
    summary="Trigger Pinecone re-embedding for a product",
)
async def regenerate_product_embedding(
    product_id: uuid.UUID,
    request: Request,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.regenerate_product_embedding(
        db, product_id, current_admin.id, get_client_ip(request)
    )


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------

@router.get(
    "/audit-logs",
    response_model=PaginatedAuditLogs,
    dependencies=[Depends(require_admin), Depends(check_ip_allowlist)],
    summary="Paginated audit log with filters",
)
async def get_audit_logs(
    user_id: Optional[uuid.UUID] = Query(None),
    action: Optional[str] = Query(None, max_length=100),
    entity_type: Optional[str] = Query(None, max_length=100),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.get_audit_logs(
        db, user_id, action, entity_type, date_from, date_to, page, page_size
    )


# ---------------------------------------------------------------------------
# Platform Settings
# ---------------------------------------------------------------------------

@router.get(
    "/settings",
    dependencies=[Depends(require_admin), Depends(check_ip_allowlist)],
    summary="Get all platform settings and feature flags",
)
async def get_settings(db: AsyncSession = Depends(get_db)):
    return await admin_service.get_platform_settings(db)


@router.put(
    "/settings",
    dependencies=AdminGuard,
    summary="Update one or more platform settings / feature flags",
)
async def update_settings(
    body: FeatureFlagsUpdate,
    request: Request,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    return await admin_service.update_platform_settings(
        db, updates, current_admin.id, get_client_ip(request)
    )


# ---------------------------------------------------------------------------
# TOTP / Admin 2FA
# ---------------------------------------------------------------------------

@router.get(
    "/totp/setup",
    response_model=TOTPSetupResponse,
    dependencies=[Depends(require_admin)],
    summary="Generate TOTP secret + OTP URI for authenticator app",
)
async def setup_totp(
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if current_admin.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP already enabled. Disable first to re-configure.",
        )
    return await admin_service.setup_totp(db, current_admin)


@router.post(
    "/totp/verify",
    response_model=TOTPStatusResponse,
    dependencies=[Depends(require_admin)],
    summary="Verify TOTP code and activate 2FA",
)
async def verify_totp(
    body: TOTPVerifyRequest,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    ok = await admin_service.verify_and_enable_totp(db, current_admin, body.code)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code",
        )
    return TOTPStatusResponse(enabled=True)


@router.post(
    "/totp/disable",
    response_model=TOTPStatusResponse,
    dependencies=[Depends(require_admin)],
    summary="Disable 2FA (requires current valid code)",
)
async def disable_totp(
    body: TOTPVerifyRequest,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    ok = await admin_service.disable_totp(db, current_admin, body.code)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code or 2FA not enabled",
        )
    return TOTPStatusResponse(enabled=False)
