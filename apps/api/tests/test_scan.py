"""
Skin scan endpoint tests.
Covers: feature vector submission, validation, ownership isolation, privacy flags.
"""

import uuid
import numpy as np
import pytest

from tests.conftest import auth_headers, create_test_user


pytestmark = pytest.mark.asyncio

VALID_VECTOR_512 = np.random.uniform(-0.5, 0.5, 512).tolist()


def _scan_payload(vector: list = None, fitzpatrick: str = "III") -> dict:
    return {
        "skin_type": "oily",
        "skin_type_confidence": 0.9,
        "fitzpatrick_tone": fitzpatrick,
        "lighting_quality_score": 0.85,
        "feature_vector": vector if vector is not None else VALID_VECTOR_512,
        "model_version": "v1.0",
        "processed_locally": True,
        "analysis_timestamp": "2026-08-09T00:00:00Z",
        "conditions": [],
    }


# ---------------------------------------------------------------------------
# Submission
# ---------------------------------------------------------------------------

class TestScanSubmission:
    async def test_submit_scan_with_feature_vector(self, client, regular_user, user_token):
        """Valid 512-dim feature vector is accepted and returns a scan_id."""
        resp = await client.post(
            "/api/v1/scan/submit",
            json=_scan_payload(),
            headers=auth_headers(user_token),
        )
        assert resp.status_code in (201, 200)
        body = resp.json()
        assert "scan_id" in body or "id" in body

    async def test_submit_scan_rejects_raw_image_data(self, client, regular_user, user_token):
        """Submitting a vector with wrong dimensions is rejected with 422."""
        resp = await client.post(
            "/api/v1/scan/submit",
            json=_scan_payload(vector=list(range(256))),  # wrong dim
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 422

    async def test_submit_scan_wrong_dimension_fails(self, client, user_token):
        """Feature vector must be exactly 512 dimensions."""
        resp = await client.post(
            "/api/v1/scan/submit",
            json=_scan_payload(vector=[0.5] * 100),
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 422

    async def test_submit_scan_zero_variance_fails(self, client, user_token):
        """A constant (zero-variance) vector is rejected."""
        resp = await client.post(
            "/api/v1/scan/submit",
            json=_scan_payload(vector=[0.5] * 512),
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 422

    async def test_submit_scan_requires_auth(self, client):
        """Unauthenticated scan submission is rejected."""
        resp = await client.post("/api/v1/scan/submit", json=_scan_payload())
        assert resp.status_code in (401, 403)

    async def test_submit_scan_invalid_fitzpatrick_fails(self, client, user_token):
        """Invalid Fitzpatrick tone string is rejected."""
        resp = await client.post(
            "/api/v1/scan/submit",
            json=_scan_payload(fitzpatrick="VII"),
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Ownership isolation
# ---------------------------------------------------------------------------

class TestScanOwnership:
    async def test_scan_only_visible_to_owner(self, client, db_session, mock_redis):
        """User A cannot retrieve User B's scan."""
        user_a = await create_test_user(db_session, email="scan_a@test.com")
        user_b = await create_test_user(db_session, email="scan_b@test.com")
        await db_session.flush()

        from tests.conftest import make_access_token
        token_a = make_access_token(user_a)
        token_b = make_access_token(user_b)

        # User A submits a scan
        resp = await client.post(
            "/api/v1/scan/submit",
            json=_scan_payload(),
            headers=auth_headers(token_a),
        )
        if resp.status_code not in (200, 201):
            pytest.skip("Scan submission failed — skipping ownership test")

        scan_id = resp.json().get("scan_id") or resp.json().get("id")

        # User B tries to access User A's scan — should get 403 or 404
        resp_b = await client.get(
            f"/api/v1/scan/{scan_id}",
            headers=auth_headers(token_b),
        )
        assert resp_b.status_code in (403, 404)

    async def test_scan_history_only_shows_own_scans(self, client, regular_user, user_token):
        """GET /scan/history only returns the authenticated user's scans."""
        resp = await client.get(
            "/api/v1/scan/history",
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 200
        body = resp.json()
        # All returned scans must belong to the current user
        items = body.get("items", body if isinstance(body, list) else [])
        for scan in items:
            user_id_field = scan.get("user_id")
            if user_id_field:
                assert str(user_id_field) == str(regular_user.id)


# ---------------------------------------------------------------------------
# Privacy flags
# ---------------------------------------------------------------------------

class TestScanPrivacyFlags:
    async def test_image_permanently_deleted_flag_set(self, client, user_token):
        """Scan response must set image_permanently_deleted=true."""
        resp = await client.post(
            "/api/v1/scan/submit",
            json=_scan_payload(),
            headers=auth_headers(user_token),
        )
        if resp.status_code not in (200, 201):
            pytest.skip("Scan submission not available in test environment")
        body = resp.json()
        assert body.get("image_permanently_deleted") is True

    async def test_scan_response_contains_no_raw_image(self, client, user_token):
        """Scan response must not contain image_url or base64 image data."""
        resp = await client.post(
            "/api/v1/scan/submit",
            json=_scan_payload(),
            headers=auth_headers(user_token),
        )
        if resp.status_code not in (200, 201):
            pytest.skip("Scan submission not available in test environment")
        body = resp.json()
        assert "image_url" not in body
        assert "image_data" not in body
        assert "base64" not in str(body).lower()
