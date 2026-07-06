"""
Pure schema-validation tests for the admin router's new request models
(INFO-1: admin router was wired up from a previously-unmounted service).
No DB needed.
"""

import pytest
from pydantic import ValidationError

from app.schemas.admin import AdminProductCreate, DermVerificationRequest, PlatformSettingsUpdate


class TestDermVerificationRequest:
    def test_rejection_requires_a_reason_even_when_omitted(self):
        # Regression: a field_validator on rejection_reason alone would not
        # fire when the field is omitted entirely (pydantic skips validators
        # on unset defaults) — must be a model-level validator.
        with pytest.raises(ValidationError):
            DermVerificationRequest(approved=False)

    def test_rejection_with_reason_is_accepted(self):
        req = DermVerificationRequest(approved=False, rejection_reason="incomplete license docs")
        assert req.rejection_reason == "incomplete license docs"

    def test_approval_needs_no_reason(self):
        req = DermVerificationRequest(approved=True)
        assert req.rejection_reason is None


class TestPlatformSettingsUpdate:
    def test_unknown_key_rejected(self):
        with pytest.raises(ValidationError):
            PlatformSettingsUpdate(updates={"totally_made_up_key": 1})

    def test_known_key_accepted(self):
        upd = PlatformSettingsUpdate(updates={"enable_waitlist": True})
        assert upd.updates == {"enable_waitlist": True}


class TestAdminProductCreateUrlValidation:
    def test_rejects_javascript_scheme(self):
        with pytest.raises(ValidationError):
            AdminProductCreate(
                brand="others", product_name="X", category="serum",
                product_url="javascript:alert(1)",
            )

    def test_accepts_https(self):
        p = AdminProductCreate(
            brand="others", product_name="X", category="serum",
            product_url="https://example.com/p/1",
        )
        assert p.product_url == "https://example.com/p/1"
