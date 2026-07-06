"""
Product endpoint + scoring tests.

Covers (per Phase 1 spec 1.7):
  - Match Score: skin-type/condition boosts, empty-context => no score.
  - Allergen product excluded (score clamped) + flagged when user lists it.
  - Comedogenic flag fires for oily-skin user; NOT for dry skin.
  - Discount + combo computation; store links never emit "#".
  - Endpoint: filters compose (budget + brand + rating); personalised call
    orders by match_score.

The scorer tests need no DB and always run. The endpoint tests follow the
existing test_recommendations.py style (tolerant of the test DB not being
seeded), seeding their own rows via db_session when available.
"""

import types
import uuid

import pytest

from app.services import product_scoring as ps
from tests.conftest import auth_headers

# asyncio_mode=auto (pytest.ini) auto-detects the async endpoint tests; the
# scorer tests below are plain sync functions and need no DB.


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_product(**kw):
    """Lightweight stand-in for a Product row (score_product uses getattr)."""
    defaults = dict(
        product_name="Test Serum", product_url=None, store_links=[], brand_display=None,
        key_ingredients=[], key_actives=[], targets_conditions=[],
        skin_types_suitable=[], climate_zones_suitable=[], fitzpatrick_suitable=[],
        is_dermatologist_approved=False, rating_avg=4.0, pregnancy_safe=None,
    )
    defaults.update(kw)
    return types.SimpleNamespace(**defaults)


# ---------------------------------------------------------------------------
# Match Score (no DB)
# ---------------------------------------------------------------------------

class TestMatchScore:
    def test_skin_and_condition_boost_and_reason(self):
        p = make_product(
            skin_types_suitable=["oily"], targets_conditions=["acne", "pores"],
            climate_zones_suitable=["tropical"], fitzpatrick_suitable=["IV"],
            key_actives=["salicylic acid"], is_dermatologist_approved=True, rating_avg=4.5,
        )
        ctx = ps.UserContext(skin_type="oily", conditions=["acne"], climate_zone="tropical", fitzpatrick="IV")
        r = ps.score_product(p, ctx)
        # +25 skin +15 cond +15 climate +10 fitz +10 derm +9 rating = 84
        assert r.match_score == 84
        assert "salicylic acid" in r.match_reason
        assert "acne" in r.match_reason

    def test_empty_context_yields_no_score(self):
        r = ps.score_product(make_product(skin_types_suitable=["oily"]), ps.UserContext())
        assert r.match_score is None
        assert r.match_reason is None

    def test_condition_hits_capped_at_30(self):
        p = make_product(skin_types_suitable=["oily"], targets_conditions=["acne", "pores", "pigmentation"])
        ctx = ps.UserContext(skin_type="oily", conditions=["acne", "pores", "pigmentation"])
        r = ps.score_product(p, ctx)
        # +25 skin + min(3*15,30)=30 + rating factor — condition part must not exceed 30
        assert r.match_score <= 25 + 30 + 10 + 10

    def test_allergen_flags_and_clamps_score(self):
        p = make_product(
            skin_types_suitable=["oily"], targets_conditions=["acne"],
            key_ingredients=["niacinamide", "fragrance"], rating_avg=5.0, is_dermatologist_approved=True,
        )
        ctx = ps.UserContext(skin_type="oily", conditions=["acne"], allergens=["fragrance"])
        r = ps.score_product(p, ctx)
        assert any(f["code"] == "contains_allergen" for f in r.flags)
        assert r.match_score == 0  # -100 penalty clamps to 0 → effectively excluded

    def test_comedogenic_flag_on_oily_skin(self):
        p = make_product(skin_types_suitable=["oily"], key_ingredients=["coconut oil"], targets_conditions=["dryness"])
        ctx = ps.UserContext(skin_type="oily", conditions=["acne"])
        r = ps.score_product(p, ctx)
        assert any(f["code"] == "comedogenic" for f in r.flags)

    def test_comedogenic_not_flagged_on_dry_skin(self):
        p = make_product(skin_types_suitable=["dry"], key_ingredients=["coconut oil"])
        ctx = ps.UserContext(skin_type="dry", conditions=["dryness"])
        r = ps.score_product(p, ctx)
        assert not any(f["code"] == "comedogenic" for f in r.flags)

    def test_pregnancy_unsafe_flag_only_when_pregnant(self):
        p = make_product(skin_types_suitable=["oily"], pregnancy_safe=False, key_actives=["retinol"])
        not_flagged = ps.score_product(p, ps.UserContext(skin_type="oily"))
        flagged = ps.score_product(p, ps.UserContext(skin_type="oily", is_pregnant=True))
        assert not any(f["code"] == "pregnancy_unsafe" for f in not_flagged.flags)
        assert any(f["code"] == "pregnancy_unsafe" for f in flagged.flags)

    def test_fragrance_flag_informational(self):
        p = make_product(skin_types_suitable=["dry"], key_ingredients=["parfum", "glycerin"])
        r = ps.score_product(p, ps.UserContext(skin_type="dry"))
        assert any(f["code"] == "fragrance" for f in r.flags)


# ---------------------------------------------------------------------------
# Discount + store links (no DB)
# ---------------------------------------------------------------------------

class TestDiscountAndLinks:
    def test_discount_pct(self):
        assert ps.compute_discount_pct(800, 1000) == 20
        assert ps.compute_discount_pct(1000, 1000) is None   # no discount
        assert ps.compute_discount_pct(1200, 1000) is None   # price above MRP
        assert ps.compute_discount_pct(None, 1000) is None

    def test_store_links_direct_first_and_never_hash(self):
        links = ps.build_store_links("Salicylic Serum", product_url="https://www.nykaa.com/x/p/1")
        assert links[0]["store"] == "Nykaa"                       # verified direct URL first
        assert all(l["url"] and l["url"] != "#" for l in links)   # never "#"
        assert any(l["store"] == "Amazon" for l in links)         # marketplace fallbacks added

    def test_store_links_always_resolvable_without_url(self):
        links = ps.build_store_links("Some Product")
        assert links and all(l["url"].startswith("http") for l in links)

    def test_store_links_dedupe_by_store(self):
        links = ps.build_store_links("X", product_url="https://www.amazon.in/s?k=x")
        stores = [l["store"] for l in links]
        assert len(stores) == len(set(stores))


class TestUrlSchemeValidation:
    """Regression tests for MED-4: product_url / StoreLink.url must be http(s) only."""

    def test_store_link_rejects_javascript_scheme(self):
        from pydantic import ValidationError
        from app.schemas.product import StoreLink

        with pytest.raises(ValidationError):
            StoreLink(store="Evil", url="javascript:alert(1)")

    def test_store_link_rejects_data_scheme(self):
        from pydantic import ValidationError
        from app.schemas.product import StoreLink

        with pytest.raises(ValidationError):
            StoreLink(store="Evil", url="data:text/html,<script>alert(1)</script>")

    def test_store_link_accepts_https(self):
        from app.schemas.product import StoreLink

        link = StoreLink(store="Nykaa", url="https://www.nykaa.com/x/p/1")
        assert link.url == "https://www.nykaa.com/x/p/1"

    def test_product_create_rejects_javascript_product_url(self):
        from pydantic import ValidationError
        from app.schemas.product import ProductCreate

        with pytest.raises(ValidationError):
            ProductCreate(
                brand="others", product_name="X", category="serum",
                product_url="javascript:alert(1)",
            )


# ---------------------------------------------------------------------------
# Endpoint (needs test DB — tolerant of an unseeded / unavailable one)
# ---------------------------------------------------------------------------

async def _seed_min_products(db):
    """Insert a small, deterministic catalogue for filter tests."""
    from app.models.product import Product
    rows = [
        Product(id=uuid.uuid4(), brand="minimalist", product_name="Salicylic Acid 2% Test",
                category="serum", price_inr=599.0, mrp_inr=699.0, pack_size=1,
                key_ingredients=["salicylic acid 2%"], key_actives=["salicylic acid"],
                targets_conditions=["acne", "pores"], skin_types_suitable=["oily", "combination"],
                fitzpatrick_suitable=["III", "IV"], climate_zones_suitable=["tropical"],
                is_dermatologist_approved=True, rating_avg=4.6, review_count=100, is_active=True),
        Product(id=uuid.uuid4(), brand="others", brand_display="CeraVe",
                product_name="CeraVe Combo Test", category="cleanser", price_inr=1450.0, mrp_inr=2050.0,
                pack_size=2, key_ingredients=["ceramides"], key_actives=["ceramide"],
                targets_conditions=["dryness"], skin_types_suitable=["dry"],
                fitzpatrick_suitable=["II"], climate_zones_suitable=["arid"],
                is_dermatologist_approved=True, rating_avg=4.7, review_count=50, is_active=True),
    ]
    for r in rows:
        db.add(r)
    await db.flush()


class TestProductsEndpoint:
    async def test_requires_auth(self, client):
        resp = await client.get("/api/v1/products")
        assert resp.status_code in (401, 403)

    async def test_filters_compose_budget_brand_rating(self, client, user_token, db_session):
        await _seed_min_products(db_session)
        resp = await client.get(
            "/api/v1/products?max_price=700&brand=minimalist&min_rating=4.5&sort=match_score",
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 200
        body = resp.json()
        for it in body["items"]:
            assert it["price_inr"] <= 700
            assert it["rating_avg"] >= 4.5

    async def test_combo_filter_returns_pack_rows(self, client, user_token, db_session):
        await _seed_min_products(db_session)
        resp = await client.get("/api/v1/products?is_combo=true", headers=auth_headers(user_token))
        assert resp.status_code == 200
        for it in resp.json()["items"]:
            assert it["pack_size"] > 1

    async def test_personalised_orders_by_match_score(self, client, user_token, db_session):
        await _seed_min_products(db_session)
        resp = await client.get(
            "/api/v1/products?skin_type=oily&condition=acne&sort=match_score",
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 200
        scores = [it["match_score"] for it in resp.json()["items"] if it["match_score"] is not None]
        assert scores == sorted(scores, reverse=True)  # descending

    async def test_response_has_no_hash_links(self, client, user_token, db_session):
        await _seed_min_products(db_session)
        resp = await client.get("/api/v1/products", headers=auth_headers(user_token))
        assert resp.status_code == 200
        for it in resp.json()["items"]:
            for link in it["store_links"]:
                assert link["url"] and link["url"] != "#"
