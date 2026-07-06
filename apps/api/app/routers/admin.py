"""
Admin router — analytics, user management, dermatologist verification,
product catalogue management, platform settings, audit logs, admin TOTP.

Every route here is gated by require_admin (ADMIN role only). This surface
was previously built in admin_service.py but never mounted to the app —
wiring it up now, so every mutating action here is new attack surface that
needs the same scrutiny as anything else: role guard on every route,
explicit allow-list request schemas (no raw dict → ORM mass assignment),
and admin-on-self protections (already enforced in admin_service.py).
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_client_ip, require_admin
from app.services import admin_service
from app.schemas.admin import (
    AdminProductCreate,
    AdminProductUpdate,
    AnalyticsOverviewResponse,
    BiasReportResponse,
    ChangeUserStatusRequest,
    ChartsDataResponse,
    DermVerificationItem,
    DermVerificationRequest,
    PaginatedAdminProducts,
    PaginatedAdminUsers,
    PaginatedAuditLogs,
    PlatformSettingsUpdate,
    TOTPSetupResponse,
    TOTPVerifyRequest,
)
from app.schemas.user import ChangeRoleRequest

router = APIRouter()


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/analytics", response_model=AnalyticsOverviewResponse)
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.get_analytics_overview(db)


@router.get("/charts", response_model=ChartsDataResponse)
async def charts_data(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.get_charts_data(db)


@router.get("/bias-report", response_model=BiasReportResponse)
async def bias_report(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.get_bias_report(db)


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get("/users", response_model=PaginatedAdminUsers)
async def list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.get_admin_users(
        db, search=search, role=role, is_active=is_active, page=page, page_size=page_size,
    )


@router.put("/users/{target_user_id}/role", status_code=status.HTTP_200_OK)
async def update_user_role(
    target_user_id: uuid.UUID,
    body: ChangeRoleRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    await admin_service.change_user_role(
        db, target_user_id=target_user_id, new_role=body.role,
        admin_id=current_user.id, ip=get_client_ip(request),
    )
    return {"message": "Role updated."}


@router.put("/users/{target_user_id}/status", status_code=status.HTTP_200_OK)
async def update_user_status(
    target_user_id: uuid.UUID,
    body: ChangeUserStatusRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    await admin_service.change_user_status(
        db, target_user_id=target_user_id, action=body.action,
        admin_id=current_user.id, ip=get_client_ip(request), reason=body.reason,
    )
    return {"message": f"User {body.action}d."}


# ---------------------------------------------------------------------------
# Dermatologist verification
# ---------------------------------------------------------------------------

@router.get("/dermatologist/queue", response_model=list[DermVerificationItem])
async def dermatologist_queue(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.get_derm_verification_queue(db)


@router.post("/dermatologist/{target_user_id}/verify", status_code=status.HTTP_200_OK)
async def verify_dermatologist(
    target_user_id: uuid.UUID,
    body: DermVerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    await admin_service.verify_dermatologist(
        db, target_user_id=target_user_id,
        action="approve" if body.approved else "reject",
        rejection_reason=body.rejection_reason,
        admin_id=current_user.id, ip=get_client_ip(request),
    )
    return {"message": "Verification recorded."}


# ---------------------------------------------------------------------------
# Product management
# ---------------------------------------------------------------------------

@router.get("/products", response_model=PaginatedAdminProducts)
async def list_admin_products(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|inactive)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.get_admin_products(
        db, search=search, status=status_filter, page=page, page_size=page_size,
    )


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_admin_product(
    body: AdminProductCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    product = await admin_service.create_product(
        db, data=body, admin_id=current_user.id, ip=get_client_ip(request),
    )
    return {"id": str(product.id), "message": "Product created."}


@router.patch("/products/{product_id}", status_code=status.HTTP_200_OK)
async def update_admin_product(
    product_id: uuid.UUID,
    body: AdminProductUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    await admin_service.update_product(
        db, product_id=product_id, data=body, admin_id=current_user.id, ip=get_client_ip(request),
    )
    return {"message": "Product updated."}


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_product(
    product_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    await admin_service.soft_delete_product(
        db, product_id=product_id, admin_id=current_user.id, ip=get_client_ip(request),
    )


@router.post("/products/{product_id}/regenerate-embedding")
async def regenerate_embedding(
    product_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.regenerate_product_embedding(
        db, product_id=product_id, admin_id=current_user.id, ip=get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# Platform settings
# ---------------------------------------------------------------------------

@router.get("/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.get_platform_settings(db)


@router.put("/settings")
async def update_settings(
    body: PlatformSettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.update_platform_settings(
        db, updates=body.updates, admin_id=current_user.id, ip=get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get("/audit-logs", response_model=PaginatedAuditLogs)
async def audit_logs(
    user_id: Optional[uuid.UUID] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.get_audit_logs(
        db, user_id=user_id, action=action, entity_type=entity_type,
        date_from=date_from, date_to=date_to, page=page, page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Admin TOTP (2FA) — setup/verify/disable for the calling admin's own account
# ---------------------------------------------------------------------------

@router.post("/totp/setup", response_model=TOTPSetupResponse)
async def totp_setup(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await admin_service.setup_totp(db, current_user)


@router.post("/totp/verify")
async def totp_verify(
    body: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    ok = await admin_service.verify_and_enable_totp(db, current_user, body.code)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid TOTP code.")
    return {"message": "TOTP enabled."}


@router.post("/totp/disable")
async def totp_disable(
    body: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    ok = await admin_service.disable_totp(db, current_user, body.code)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid TOTP code.")
    return {"message": "TOTP disabled."}
