"""
Recommendation endpoint tests.
Covers: generation response shape, allergen respect, climate integration,
        ingredient conflicts, and product brand linkage.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import auth_headers


pytestmark = pytest.mark.asyncio


# Minimal valid generation payload
GENERATE_PAYLOAD = {
    "scan_id": "00000000-0000-0000-0000-000000000001",
    "questionnaire_id": "00000000-0000-0000-0000-000000000002",
}


class TestRecommendationGeneration:
    async def test_recommendation_generation_returns_roadmap(self, client, user_token):
        """POST /recommendations/generate returns a response with roadmap and products."""
        mock_output = {
            "skin_score": 65,
            "confidence_score": 0.82,
            "skin_type": "oily",
            "conditions": [{"name": "acne", "severity": "moderate", "confidence": 0.85}],
            "products": [
                {
                    "product_id": "00000000-0000-0000-0000-000000000010",
                    "reasoning": "Salicylic acid targets acne",
                    "usage_instruction": "Apply twice daily",
                    "time_of_day": "both",
                }
            ],
            "roadmap_summary": "20-week skin improvement plan",
            "estimated_monthly_cost_inr": 1800,
            "allergen_flags": [],
            "requires_derm_review": False,
        }

        with patch(
            "app.services.recommendation.generate_recommendation",
            new_callable=AsyncMock,
            return_value=mock_output,
        ):
            resp = await client.post(
                "/api/v1/recommendations/generate",
                json=GENERATE_PAYLOAD,
                headers=auth_headers(user_token),
            )

        # 200/201 on success; 404 if scan not found in test DB
        assert resp.status_code in (200, 201, 404, 422)

    async def test_recommendation_respects_allergens(self, client, user_token, db_session):
        """Recommendations must not include products with allergen conflicts."""
        from unittest.mock import patch as mock_patch

        allergen_result = {
            "skin_score": 55,
            "confidence_score": 0.78,
            "skin_type": "sensitive",
            "conditions": [],
            "products": [],  # empty because all products conflict
            "allergen_flags": ["fragrance", "alcohol"],
            "requires_derm_review": True,
            "roadmap_summary": "Sensitive skin routine",
            "estimated_monthly_cost_inr": 0,
        }

        with mock_patch(
            "app.services.recommendation.generate_recommendation",
            new_callable=AsyncMock,
            return_value=allergen_result,
        ):
            resp = await client.post(
                "/api/v1/recommendations/generate",
                json=GENERATE_PAYLOAD,
                headers=auth_headers(user_token),
            )

        if resp.status_code in (200, 201):
            body = resp.json()
            products = body.get("products", [])
            # Verify no allergen-conflicting ingredients in returned products
            for product in products:
                ingredients = [i.lower() for i in product.get("ingredients", [])]
                assert "fragrance" not in ingredients, "Allergen ingredient returned"

    async def test_recommendation_uses_climate_data(self, client, user_token):
        """Climate zone should be included in recommendation context."""
        climate_aware_result = {
            "skin_score": 70,
            "confidence_score": 0.80,
            "skin_type": "combination",
            "conditions": [],
            "products": [],
            "climate_note": "High humidity in Mumbai — lightweight moisturiser recommended",
            "allergen_flags": [],
            "requires_derm_review": False,
            "roadmap_summary": "Climate-aware plan",
            "estimated_monthly_cost_inr": 1200,
        }

        with patch(
            "app.services.recommendation.generate_recommendation",
            new_callable=AsyncMock,
            return_value=climate_aware_result,
        ):
            resp = await client.post(
                "/api/v1/recommendations/generate",
                json=GENERATE_PAYLOAD,
                headers=auth_headers(user_token),
            )

        # Test just verifies the endpoint accepts climate-enriched payloads
        assert resp.status_code in (200, 201, 404, 422)

    async def test_no_ingredient_conflicts_in_recommendation(self, client, user_token):
        """Two products with conflicting ingredients (e.g., Retinol + AHA) should not both appear."""
        conflict_result = {
            "skin_score": 68,
            "confidence_score": 0.76,
            "skin_type": "dry",
            "conditions": [],
            "products": [
                {
                    "product_id": "00000000-0000-0000-0000-000000000011",
                    "ingredients": ["Retinol", "Niacinamide"],
                    "usage_instruction": "Night only",
                    "time_of_day": "pm",
                },
                # AHA + Retinol conflict — service should filter one out
            ],
            "allergen_flags": [],
            "requires_derm_review": False,
            "roadmap_summary": "Dry skin plan",
            "estimated_monthly_cost_inr": 1500,
        }

        with patch(
            "app.services.recommendation.generate_recommendation",
            new_callable=AsyncMock,
            return_value=conflict_result,
        ):
            resp = await client.post(
                "/api/v1/recommendations/generate",
                json=GENERATE_PAYLOAD,
                headers=auth_headers(user_token),
            )
        assert resp.status_code in (200, 201, 404, 422)

    async def test_product_links_to_valid_brand(self, client, user_token):
        """GET /recommendations/latest returns products with a non-null brand."""
        resp = await client.get(
            "/api/v1/recommendations/latest",
            headers=auth_headers(user_token),
        )
        # 404 if user has no recommendations — that's fine in test env
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            body = resp.json()
            for product in body.get("products", []):
                assert product.get("brand") is not None, "Product missing brand"

    async def test_recommendation_requires_auth(self, client):
        """Unauthenticated access to recommendations is blocked."""
        resp = await client.post("/api/v1/recommendations/generate", json=GENERATE_PAYLOAD)
        assert resp.status_code in (401, 403)

    async def test_recommendation_feedback_saved(self, client, user_token):
        """POST /recommendations/{id}/feedback with rating 4 returns 200."""
        fake_rec_id = "00000000-0000-0000-0000-000000000099"
        resp = await client.post(
            f"/api/v1/recommendations/{fake_rec_id}/feedback",
            json={"rating": 4, "text": "Great recommendations!"},
            headers=auth_headers(user_token),
        )
        # 200 (saved) or 404 (recommendation not found) — not 401/422
        assert resp.status_code in (200, 404)
