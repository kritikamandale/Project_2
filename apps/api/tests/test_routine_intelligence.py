"""
Routine-intelligence tests — Phase 3 (routine-check + budget optimiser).

Covers (per Phase 3 spec 3.1/3.2):
  - A conflicting pair (retinol + an acid) is detected with a plain reason.
  - A duplicate active (same active in >=2 products) is flagged.
  - A routine missing sunscreen is always flagged (India's high UV — mandatory).
  - AM/PM layering orders sunscreen last and notes the conflict on PM actives.
  - Budget optimiser: greedy pick, swap-to-cheaper under budget, and a
    drop_suggestion when even the cheapest combo can't fit.

The pure-function tests need no DB and always run (mirrors test_products.py's
TestMatchScore style). The endpoint tests follow the existing tolerant style —
they exercise the DB-backed routes when a test DB is available.
"""

import types
import uuid

from app.services import routine_intelligence as ri
from tests.conftest import auth_headers


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_product(**kw):
    """Lightweight stand-in for a Product row (mirrors test_products.make_product)."""
    defaults = dict(
        id=uuid.uuid4(), product_name="Test Product", category="serum",
        price_inr=500.0, mrp_inr=None, key_ingredients=[], key_actives=[],
        targets_conditions=[], skin_types_suitable=[], climate_zones_suitable=[],
        fitzpatrick_suitable=[], is_dermatologist_approved=False, rating_avg=4.0,
        pregnancy_safe=None,
    )
    defaults.update(kw)
    return types.SimpleNamespace(**defaults)


def actives_map(*products) -> dict[str, set[str]]:
    return {p.product_name: set(p.key_actives) for p in products}


# ---------------------------------------------------------------------------
# Conflicts
# ---------------------------------------------------------------------------

class TestConflicts:
    def test_conflicting_pair_detected_with_reason(self):
        retinol = make_product(product_name="Retinol Night Serum", key_actives=["retinol"])
        aha = make_product(product_name="Glycolic Acid Toner", key_actives=["glycolic acid"])
        conflicts = ri.find_conflicts(actives_map(retinol, aha))

        assert len(conflicts) == 1
        pair = conflicts[0]
        assert {pair.active_a, pair.active_b} == {"retinol", "glycolic acid"}
        assert "alternate nights" in pair.reason.lower() or "over-exfoliate" in pair.reason.lower()
        assert pair.products_a == ["Retinol Night Serum"] or pair.products_b == ["Retinol Night Serum"]

    def test_bha_alias_expands_to_salicylic_acid(self):
        # _CONFLICT_MAP keys retinol's conflict list with generic "aha"/"bha" too —
        # confirm the alias expansion still finds concrete salicylic-acid conflicts.
        retinol = make_product(product_name="Retinol Serum", key_actives=["retinol"])
        bha = make_product(product_name="Salicylic Cleanser", key_actives=["salicylic acid"])
        conflicts = ri.find_conflicts(actives_map(retinol, bha))
        assert any({"retinol", "salicylic acid"} == {c.active_a, c.active_b} for c in conflicts)

    def test_no_conflict_for_compatible_actives(self):
        niacinamide = make_product(product_name="Niacinamide Serum", key_actives=["niacinamide"])
        moisturiser = make_product(product_name="Ceramide Cream", key_actives=["ceramide"])
        assert ri.find_conflicts(actives_map(niacinamide, moisturiser)) == []


# ---------------------------------------------------------------------------
# Duplicate actives
# ---------------------------------------------------------------------------

class TestDuplicateActives:
    def test_duplicate_active_flagged(self):
        p1 = make_product(product_name="Niacinamide Serum A", key_actives=["niacinamide"])
        p2 = make_product(product_name="Niacinamide Serum B", key_actives=["niacinamide"])
        p3 = make_product(product_name="Niacinamide Moisturiser", key_actives=["niacinamide", "ceramide"])
        duplicates = ri.find_duplicate_actives(actives_map(p1, p2, p3))

        assert len(duplicates) == 1
        dup = duplicates[0]
        assert dup.active == "niacinamide"
        assert set(dup.product_names) == {"Niacinamide Serum A", "Niacinamide Serum B", "Niacinamide Moisturiser"}
        assert "3 products" in dup.message
        assert "one is enough" in dup.message.lower()

    def test_single_occurrence_not_flagged(self):
        p1 = make_product(product_name="Vitamin C Serum", key_actives=["vitamin c"])
        assert ri.find_duplicate_actives(actives_map(p1)) == []


# ---------------------------------------------------------------------------
# Gaps
# ---------------------------------------------------------------------------

class TestGaps:
    def test_missing_sunscreen_always_flagged(self):
        gaps = ri.find_gaps({"cleanser", "moisturiser"})
        codes = {g.code for g in gaps}
        assert "missing_sunscreen" in codes
        msg = next(g.message for g in gaps if g.code == "missing_sunscreen")
        assert "uv" in msg.lower()

    def test_complete_essentials_no_gaps(self):
        gaps = ri.find_gaps({"cleanser", "moisturiser", "sunscreen", "serum"})
        assert gaps == []

    def test_missing_moisturiser_and_cleanser(self):
        gaps = ri.find_gaps({"sunscreen"})
        codes = {g.code for g in gaps}
        assert codes == {"missing_moisturiser", "missing_cleanser"}


# ---------------------------------------------------------------------------
# Layering
# ---------------------------------------------------------------------------

class TestLayering:
    def test_sunscreen_always_last_am_only(self):
        products = [
            ri.RoutineProduct(id=uuid.uuid4(), name="Cleanser", category="cleanser", actives=set()),
            ri.RoutineProduct(id=uuid.uuid4(), name="Moisturiser", category="moisturiser", actives=set()),
            ri.RoutineProduct(id=uuid.uuid4(), name="SPF 50", category="sunscreen", actives=set()),
        ]
        plan = ri.build_layering(products, conflicts=[])
        assert plan.am[-1].product_name == "SPF 50"
        assert all(s.product_name != "SPF 50" for s in plan.pm)  # never in PM

    def test_conflict_note_on_pm_treatment_step(self):
        products = [
            ri.RoutineProduct(id=uuid.uuid4(), name="Retinol Serum", category="treatment", actives={"retinol"}),
            ri.RoutineProduct(id=uuid.uuid4(), name="Glycolic Toner", category="toner", actives={"glycolic acid"}),
        ]
        conflicts = ri.find_conflicts({"Retinol Serum": {"retinol"}, "Glycolic Toner": {"glycolic acid"}})
        plan = ri.build_layering(products, conflicts)
        retinol_step = next(s for s in plan.pm if s.product_name == "Retinol Serum")
        assert "alternate nights" in retinol_step.note.lower()

    def test_vitamin_c_serum_lands_in_am(self):
        products = [ri.RoutineProduct(id=uuid.uuid4(), name="Vit C Serum", category="serum", actives={"vitamin c"})]
        plan = ri.build_layering(products, conflicts=[])
        assert any(s.product_name == "Vit C Serum" for s in plan.am)
        assert all(s.product_name != "Vit C Serum" for s in plan.pm)


# ---------------------------------------------------------------------------
# Budget optimiser
# ---------------------------------------------------------------------------

class TestOptimiseRoutine:
    def _ctx(self):
        from app.services import product_scoring as scoring
        return scoring.UserContext(skin_type="oily", conditions=["acne"])

    def test_picks_highest_match_score_within_budget(self):
        cheap = make_product(product_name="Basic Cleanser", category="cleanser", price_inr=150.0,
                              skin_types_suitable=["oily"])
        better = make_product(product_name="Derm Cleanser", category="cleanser", price_inr=300.0,
                               skin_types_suitable=["oily"], targets_conditions=["acne"],
                               is_dermatologist_approved=True, rating_avg=4.8)
        candidates = {"cleanser": [cheap, better]}
        steps_def = [{"step_number": 1, "label": "Cleanse", "category": "cleanser"}]
        result = ri.optimise_routine(steps_def, candidates, self._ctx(), budget_inr=1000)
        assert result.chosen["cleanser"].product_name == "Derm Cleanser"
        assert result.drop_suggestion is None

    def test_swaps_to_cheaper_same_active_when_over_budget(self):
        pricey = make_product(product_name="Premium Salicylic Serum", category="serum", price_inr=1200.0,
                               key_actives=["salicylic acid"], skin_types_suitable=["oily"],
                               targets_conditions=["acne"], is_dermatologist_approved=True, rating_avg=4.9)
        cheaper_same_active = make_product(product_name="Budget Salicylic Serum", category="serum",
                                            price_inr=300.0, key_actives=["salicylic acid"],
                                            skin_types_suitable=["oily"])
        candidates = {"serum": [pricey, cheaper_same_active]}
        steps_def = [{"step_number": 1, "label": "Treat (Serum)", "category": "serum"}]
        result = ri.optimise_routine(steps_def, candidates, self._ctx(), budget_inr=500)
        assert result.chosen["serum"].product_name == "Budget Salicylic Serum"
        assert result.total_cost_inr <= 500

    def test_drop_suggestion_when_drop_achieves_budget(self):
        cleanser = make_product(product_name="Cleanser", category="cleanser", price_inr=200.0,
                                 skin_types_suitable=["oily"])
        toner = make_product(product_name="Toner", category="toner", price_inr=400.0,
                              skin_types_suitable=["oily"])
        moisturiser = make_product(product_name="Moisturiser", category="moisturiser", price_inr=200.0,
                                    skin_types_suitable=["oily"])
        sunscreen = make_product(product_name="Sunscreen", category="sunscreen", price_inr=200.0,
                                  skin_types_suitable=["oily"])
        candidates = {
            "cleanser": [cleanser], "toner": [toner],
            "moisturiser": [moisturiser], "sunscreen": [sunscreen],
        }
        # Total is 1000; dropping the 400 toner brings it to 600, which fits an 800 budget.
        result = ri.optimise_routine(ri.STEPS_BY_COMPLEXITY[4], candidates, self._ctx(), budget_inr=800)

        assert result.total_cost_inr <= 800
        assert "toner" not in result.chosen
        assert result.drop_suggestion is not None
        assert "toner" in result.drop_suggestion.lower()
        assert "stay under" in result.drop_suggestion.lower()  # accurate — it really does fit now

    def test_drop_suggestion_is_honest_when_drop_is_not_enough(self):
        # Regression test for the audit finding (A6): with essentials alone far
        # exceeding a very low budget, the optimiser must not claim the routine
        # "stays under" budget after dropping the one optional step, since it demonstrably doesn't.
        cleanser = make_product(product_name="Cleanser", category="cleanser", price_inr=400.0,
                                 skin_types_suitable=["oily"])
        toner = make_product(product_name="Toner", category="toner", price_inr=400.0,
                              skin_types_suitable=["oily"])
        moisturiser = make_product(product_name="Moisturiser", category="moisturiser", price_inr=400.0,
                                    skin_types_suitable=["oily"])
        sunscreen = make_product(product_name="Sunscreen", category="sunscreen", price_inr=400.0,
                                  skin_types_suitable=["oily"])
        candidates = {
            "cleanser": [cleanser], "toner": [toner],
            "moisturiser": [moisturiser], "sunscreen": [sunscreen],
        }
        result = ri.optimise_routine(ri.STEPS_BY_COMPLEXITY[4], candidates, self._ctx(), budget_inr=100)

        assert result.total_cost_inr > 100          # honestly still over budget
        assert "toner" not in result.chosen
        assert result.drop_suggestion is not None
        assert "toner" in result.drop_suggestion.lower()
        assert "stay under" not in result.drop_suggestion.lower()  # must not claim a fit that didn't happen
        assert "over your" in result.drop_suggestion.lower()

    def test_drop_suggestion_honest_when_nothing_droppable(self):
        # 3-step routine has no optional (toner/serum) category at all — if the
        # mandatory essentials alone exceed budget, there's nothing to drop, and
        # the optimiser must still say so honestly rather than staying silent.
        cleanser = make_product(product_name="Cleanser", category="cleanser", price_inr=400.0,
                                 skin_types_suitable=["oily"])
        moisturiser = make_product(product_name="Moisturiser", category="moisturiser", price_inr=400.0,
                                    skin_types_suitable=["oily"])
        sunscreen = make_product(product_name="Sunscreen", category="sunscreen", price_inr=400.0,
                                  skin_types_suitable=["oily"])
        candidates = {"cleanser": [cleanser], "moisturiser": [moisturiser], "sunscreen": [sunscreen]}
        result = ri.optimise_routine(ri.STEPS_BY_COMPLEXITY[3], candidates, self._ctx(), budget_inr=100)

        assert result.total_cost_inr > 100
        assert result.drop_suggestion is not None
        assert "over your" in result.drop_suggestion.lower()

    def test_never_picks_allergen_or_pregnancy_unsafe_product(self):
        from app.services import product_scoring as scoring
        unsafe = make_product(product_name="Fragrance Serum", category="serum", price_inr=100.0,
                               key_ingredients=["fragrance"], skin_types_suitable=["oily"])
        safe = make_product(product_name="Safe Serum", category="serum", price_inr=900.0,
                             skin_types_suitable=["oily"])
        ctx = scoring.UserContext(skin_type="oily", allergens=["fragrance"])
        steps_def = [{"step_number": 1, "label": "Treat (Serum)", "category": "serum"}]
        result = ri.optimise_routine(steps_def, {"serum": [unsafe, safe]}, ctx, budget_inr=50)
        assert result.chosen.get("serum") is None or result.chosen["serum"].product_name == "Safe Serum"


# ---------------------------------------------------------------------------
# Cost
# ---------------------------------------------------------------------------

class TestCost:
    def test_total_and_per_day(self):
        total, per_day = ri.compute_cost([300.0, 450.0, 250.0])
        assert total == 1000.0
        assert per_day == round(1000.0 / 30, 2)

    def test_empty_routine_cost_is_zero(self):
        total, per_day = ri.compute_cost([])
        assert total == 0.0
        assert per_day == 0.0


# ---------------------------------------------------------------------------
# Endpoints (needs test DB — tolerant of an unseeded / unavailable one,
# same convention as tests/test_products.py)
# ---------------------------------------------------------------------------

async def _seed_conflict_routine(db):
    from app.models.product import Product
    rows = [
        Product(id=uuid.uuid4(), brand="minimalist", product_name="Retinol 0.3% Night Serum",
                 category="treatment", price_inr=650.0, key_actives=["retinol"],
                 targets_conditions=["wrinkles"], skin_types_suitable=["oily"], is_active=True),
        Product(id=uuid.uuid4(), brand="minimalist", product_name="Glycolic Acid 7% Toner",
                 category="toner", price_inr=450.0, key_actives=["glycolic acid"],
                 targets_conditions=["texture"], skin_types_suitable=["oily"], is_active=True),
        Product(id=uuid.uuid4(), brand="minimalist", product_name="Niacinamide Serum A",
                 category="serum", price_inr=350.0, key_actives=["niacinamide"],
                 targets_conditions=["oiliness"], skin_types_suitable=["oily"], is_active=True),
        Product(id=uuid.uuid4(), brand="minimalist", product_name="Niacinamide Serum B",
                 category="serum", price_inr=400.0, key_actives=["niacinamide"],
                 targets_conditions=["oiliness"], skin_types_suitable=["oily"], is_active=True),
        Product(id=uuid.uuid4(), brand="minimalist", product_name="Barrier Cream",
                 category="moisturiser", price_inr=300.0, key_actives=["ceramide"],
                 targets_conditions=["dryness"], skin_types_suitable=["oily"], is_active=True),
        # no sunscreen — routine should report a missing_sunscreen gap.
    ]
    for r in rows:
        db.add(r)
    await db.flush()
    return rows


class TestRoutineCheckEndpoint:
    async def test_requires_auth(self, client):
        resp = await client.post("/api/v1/products/routine-check", json={"product_ids": [str(uuid.uuid4())]})
        assert resp.status_code in (401, 403)

    async def test_conflict_duplicate_and_missing_spf_surfaced(self, client, user_token, db_session):
        rows = await _seed_conflict_routine(db_session)
        resp = await client.post(
            "/api/v1/products/routine-check",
            json={"product_ids": [str(r.id) for r in rows]},
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 200
        body = resp.json()

        assert any({"retinol", "glycolic acid"} == {c["active_a"], c["active_b"]} for c in body["conflicts"])
        assert any(d["active"] == "niacinamide" for d in body["duplicate_actives"])
        assert any(g["code"] == "missing_sunscreen" for g in body["gaps"])
        assert body["total_cost_inr"] == sum(r.price_inr for r in rows)
        assert len(body["layering"]["pm"]) > 0


class TestOptimiseRoutineEndpoint:
    async def test_requires_auth(self, client):
        resp = await client.get("/api/v1/products/optimise-routine?budget_inr=500")
        assert resp.status_code in (401, 403)

    async def test_returns_routine_within_budget(self, client, user_token, db_session):
        await _seed_conflict_routine(db_session)
        resp = await client.get(
            "/api/v1/products/optimise-routine?budget_inr=1500&steps=4&skin_type=oily",
            headers=auth_headers(user_token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_cost_inr"] <= 1500
