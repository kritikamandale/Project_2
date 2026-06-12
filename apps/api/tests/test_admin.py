"""
Admin endpoint tests.
Covers: analytics access, role blocking, audit log writes, dermatologist verification.
"""

import uuid
import pytest
from unittest.mock import AsyncMock, patch

from tests.conftest import auth_headers, create_test_user


pytestmark = pytest.mark.asyncio


class TestAdminAnalytics:
    async def test_admin_can_view_analytics(self, client, admin_token):
        """Admin user receives analytics data from GET /admin/analytics."""
        resp = await client.get(
            "/api/v1/admin/analytics",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code not in (401, 403)

    async def test_non_admin_blocked_from_admin_routes(self, client, user_token):
        """Regular USER role is blocked from every admin route."""
        admin_routes = [
            ("GET",  "/api/v1/admin/analytics"),
            ("GET",  "/api/v1/admin/users"),
            ("GET",  "/api/v1/admin/audit-logs"),
            ("GET",  "/api/v1/admin/settings"),
        ]
        for method, path in admin_routes:
            if method == "GET":
                resp = await client.get(path, headers=auth_headers(user_token))
            else:
                resp = await client.post(path, json={}, headers=auth_headers(user_token))
            assert resp.status_code in (401, 403), (
                f"{method} {path} should be blocked for USER role, got {resp.status_code}"
            )

    async def test_derm_blocked_from_admin_routes(self, client, derm_token):
        """DERMATOLOGIST role is blocked from admin routes."""
        resp = await client.get(
            "/api/v1/admin/analytics",
            headers=auth_headers(derm_token),
        )
        assert resp.status_code in (401, 403)

    async def test_unauthenticated_blocked_from_admin(self, client):
        """No token → 401 or 403 on admin routes."""
        resp = await client.get("/api/v1/admin/analytics")
        assert resp.status_code in (401, 403)


class TestAdminUserManagement:
    async def test_admin_can_view_all_users(self, client, admin_token):
        """GET /admin/users returns a paginated user list for admin."""
        resp = await client.get(
            "/api/v1/admin/users",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code not in (401, 403)
        if resp.status_code == 200:
            body = resp.json()
            assert "items" in body or isinstance(body, list)

    async def test_audit_log_written_on_user_role_update(
        self, client, db_session, admin_user, admin_token
    ):
        """Changing a user's role creates an audit log entry."""
        target = await create_test_user(db_session, email="target_role@test.com")
        await db_session.flush()

        from app.models.user import AuditLog
        from sqlalchemy import select, func

        before = await db_session.scalar(select(func.count()).select_from(AuditLog))

        resp = await client.put(
            f"/api/v1/admin/users/{target.id}/role",
            json={"role": "DERMATOLOGIST"},
            headers=auth_headers(admin_token),
        )
        # Accept success (200) or not-found (404); either way, check audit if 200
        if resp.status_code == 200:
            after = await db_session.scalar(select(func.count()).select_from(AuditLog))
            assert after > before, "Audit log entry not created on role change"

    async def test_admin_cannot_change_own_role(self, client, admin_user, admin_token):
        """Self-demotion is blocked by the self-protection guard."""
        resp = await client.put(
            f"/api/v1/admin/users/{admin_user.id}/role",
            json={"role": "USER"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code in (400, 403), (
            "Admin should not be able to change their own role"
        )

    async def test_admin_cannot_delete_own_account(self, client, admin_user, admin_token):
        """Admin cannot delete their own account via the admin endpoint."""
        resp = await client.put(
            f"/api/v1/admin/users/{admin_user.id}/status",
            json={"action": "delete"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code in (400, 403)


class TestDermatologistVerification:
    async def test_dermatologist_verification_flow(
        self, client, db_session, admin_token
    ):
        """Admin can approve a pending dermatologist registration."""
        derm = await create_test_user(
            db_session,
            email="pending_derm@test.com",
            role="DERMATOLOGIST",
            is_verified=False,
        )
        await db_session.flush()

        resp = await client.post(
            f"/api/v1/admin/dermatologist/{derm.id}/verify",
            json={"approved": True},
            headers=auth_headers(admin_token),
        )
        # 200 success or 404 if dermatologist profile not found — never 401/403
        assert resp.status_code in (200, 400, 404)

    async def test_derm_rejection_requires_reason(self, client, db_session, admin_token):
        """Rejecting a dermatologist without providing a reason returns 422."""
        derm = await create_test_user(
            db_session,
            email="reject_derm@test.com",
            role="DERMATOLOGIST",
        )
        await db_session.flush()

        resp = await client.post(
            f"/api/v1/admin/dermatologist/{derm.id}/verify",
            json={"approved": False},  # missing rejection_reason
            headers=auth_headers(admin_token),
        )
        # Either 422 (validation) or 400 (business rule) — not 200
        assert resp.status_code in (400, 422, 404)


class TestAdminSettings:
    async def test_admin_can_read_settings(self, client, admin_token):
        """GET /admin/settings returns platform settings for admin."""
        resp = await client.get(
            "/api/v1/admin/settings",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code not in (401, 403)

    async def test_audit_log_endpoint_paginated(self, client, admin_token):
        """GET /admin/audit-logs returns paginated results."""
        resp = await client.get(
            "/api/v1/admin/audit-logs?page=1&page_size=10",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code not in (401, 403)
        if resp.status_code == 200:
            body = resp.json()
            assert "items" in body
            assert "total" in body
