"""
Routine-level reasoning — Phase 3.

Where product_scoring.py reasons about one product at a time, this module
reasons about the *routine as a system*: cost, ingredient conflicts, duplicate
actives, missing essentials, and AM/PM layering order. Deterministic and
reuses the existing conflict knowledge in recommendation._CONFLICT_MAP — no
new "AI" call, no redefinition of which actives clash.

All functions here are pure (no DB access) so they're cheap to unit test with
plain Product-like objects (see tests/test_routine_intelligence.py), mirroring
the make_product() pattern already used in tests/test_products.py. The router
does the DB I/O and hands these functions plain lists/dicts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.schemas.routine import (
    ConflictPair,
    DuplicateActive,
    LayeringPlan,
    LayerStep,
    RoutineGap,
)
from app.services import product_scoring as scoring
from app.services.recommendation import _CONFLICT_MAP

# ---------------------------------------------------------------------------
# Routine-depth step structure — Python mirror of the frontend's
# STEPS_BY_COMPLEXITY (routine-selector.tsx) so the budget optimiser reasons
# over the same steps the user sees.
# ---------------------------------------------------------------------------

STEPS_BY_COMPLEXITY: dict[int, list[dict]] = {
    3: [
        {"step_number": 1, "label": "Cleanse", "category": "cleanser"},
        {"step_number": 2, "label": "Moisturize", "category": "moisturiser"},
        {"step_number": 3, "label": "Sun Protection", "category": "sunscreen"},
    ],
    4: [
        {"step_number": 1, "label": "Cleanse", "category": "cleanser"},
        {"step_number": 2, "label": "Tone", "category": "toner"},
        {"step_number": 3, "label": "Moisturize", "category": "moisturiser"},
        {"step_number": 4, "label": "Sun Protection", "category": "sunscreen"},
    ],
    5: [
        {"step_number": 1, "label": "Cleanse", "category": "cleanser"},
        {"step_number": 2, "label": "Tone", "category": "toner"},
        {"step_number": 3, "label": "Treat (Serum)", "category": "serum"},
        {"step_number": 4, "label": "Moisturize", "category": "moisturiser"},
        {"step_number": 5, "label": "Sun Protection", "category": "sunscreen"},
    ],
}

# Steps that can be dropped to fit a budget, in the order they should be
# dropped (most-optional first). Cleanser/moisturiser/sunscreen are never
# dropped — Appendix A treats them as mandatory essentials.
_OPTIONAL_DROP_ORDER = ["toner", "serum"]


# ---------------------------------------------------------------------------
# Conflicts — reuse _CONFLICT_MAP (single source of truth, shared with the
# AI Engine recommendation flow). "aha"/"bha" are generic category tokens inside
# that map; expand them to the concrete actives our catalogue actually stores.
# ---------------------------------------------------------------------------

_CATEGORY_ALIASES: dict[str, set[str]] = {
    "aha": {"glycolic acid", "lactic acid"},
    "bha": {"salicylic acid"},
}

_PAIR_REASONS: dict[frozenset, str] = {
    frozenset({"retinol", "benzoyl peroxide"}):
        "Retinol and benzoyl peroxide deactivate each other and compound irritation — use on alternate nights.",
    frozenset({"retinol", "glycolic acid"}):
        "Retinol layered with an AHA over-exfoliates and stresses the skin barrier — alternate nights instead.",
    frozenset({"retinol", "lactic acid"}):
        "Retinol layered with an AHA over-exfoliates and stresses the skin barrier — alternate nights instead.",
    frozenset({"retinol", "salicylic acid"}):
        "Retinol layered with a BHA over-exfoliates and stresses the skin barrier — alternate nights instead.",
    frozenset({"benzoyl peroxide", "vitamin c"}):
        "Benzoyl peroxide oxidises vitamin C, cancelling out its brightening effect — use at different times of day.",
    frozenset({"glycolic acid", "salicylic acid"}):
        "Two exfoliating acids together over-exfoliate — alternate nights instead of stacking both.",
}
_DEFAULT_CONFLICT_REASON = (
    "These actives can irritate skin or cancel each other out when layered together — space them out."
)


def _expand(token: str) -> set[str]:
    return _CATEGORY_ALIASES.get(token, {token})


def find_conflicts(actives_by_product: dict[str, set[str]]) -> list[ConflictPair]:
    """actives_by_product: product_name -> set of normalised active names."""
    all_actives: set[str] = set()
    for actives in actives_by_product.values():
        all_actives |= actives

    seen_pairs: set[frozenset] = set()
    conflicts: list[ConflictPair] = []
    for key, conflicting_list in _CONFLICT_MAP.items():
        keys_present = _expand(key) & all_actives
        if not keys_present:
            continue
        for other in conflicting_list:
            others_present = _expand(other) & all_actives
            for a in keys_present:
                for b in others_present:
                    if a == b:
                        continue
                    pair = frozenset({a, b})
                    if pair in seen_pairs:
                        continue
                    seen_pairs.add(pair)
                    a_sorted, b_sorted = sorted((a, b))
                    conflicts.append(ConflictPair(
                        active_a=a_sorted,
                        active_b=b_sorted,
                        reason=_PAIR_REASONS.get(pair, _DEFAULT_CONFLICT_REASON),
                        products_a=sorted(n for n, acts in actives_by_product.items() if a_sorted in acts),
                        products_b=sorted(n for n, acts in actives_by_product.items() if b_sorted in acts),
                    ))
    return conflicts


# ---------------------------------------------------------------------------
# Duplicate actives
# ---------------------------------------------------------------------------

def find_duplicate_actives(actives_by_product: dict[str, set[str]]) -> list[DuplicateActive]:
    active_to_products: dict[str, list[str]] = {}
    for name, actives in actives_by_product.items():
        for a in actives:
            active_to_products.setdefault(a, []).append(name)

    duplicates = [
        DuplicateActive(
            active=active,
            product_names=sorted(names),
            message=f"{active.title()} in {len(names)} products — one is enough.",
        )
        for active, names in active_to_products.items()
        if len(names) >= 2
    ]
    return sorted(duplicates, key=lambda d: d.active)


# ---------------------------------------------------------------------------
# Gaps — missing essentials. Sunscreen is always flagged when absent
# regardless of skin type (Appendix A: "SPF is mandatory", India's high UV).
# ---------------------------------------------------------------------------

_ESSENTIAL_GAP_MESSAGES: dict[str, str] = {
    "sunscreen": "No sunscreen in your routine — add one; India's UV is high year-round.",
    "moisturiser": "No moisturiser in your routine — even oily skin needs one to maintain the barrier.",
    "cleanser": "No cleanser in your routine — a gentle cleanser is the foundation of any routine.",
}


def find_gaps(categories_present: set[str]) -> list[RoutineGap]:
    return [
        RoutineGap(code=f"missing_{cat}", message=_ESSENTIAL_GAP_MESSAGES[cat])
        for cat in ("sunscreen", "moisturiser", "cleanser")
        if cat not in categories_present
    ]


# ---------------------------------------------------------------------------
# Layering — AM/PM ordered sequences (Appendix D).
#   AM: cleanser -> toner -> water-based serum (niacinamide/vit C) -> moisturiser -> SPF last.
#   PM: cleanser -> toner -> treatment/active (retinol or an acid, not both) -> moisturiser.
# ---------------------------------------------------------------------------

_PM_ONLY_ACTIVES = {
    "retinol", "retinoid", "glycolic acid", "lactic acid", "salicylic acid", "benzoyl peroxide",
}
_AM_PREFERRED_ACTIVES = {"vitamin c", "ascorbic acid", "niacinamide"}

_STEP_LABELS: dict[str, str] = {
    "cleanser": "Cleanse", "toner": "Tone", "serum": "Treat", "treatment": "Treat",
    "moisturiser": "Moisturize", "sunscreen": "Sun Protection", "mask": "Mask (weekly)",
}


@dataclass
class RoutineProduct:
    """Minimal shape build_layering()/find_conflicts() need from a Product row."""
    id: object
    name: str
    category: str
    actives: set[str] = field(default_factory=set)


def _active_step_time(category: str, actives: set[str]) -> str:
    """Which time of day a serum/treatment product belongs in."""
    if category == "treatment":
        return "pm"
    if actives & _PM_ONLY_ACTIVES:
        return "pm"
    return "am"  # water-based / antioxidant serums default to AM


def _step_note(category: str, *, time_of_day: str, has_conflict: bool) -> str:
    if category == "cleanser":
        if time_of_day == "pm":
            return "Double-cleanse first if you wore sunscreen or makeup during the day."
        return "Start with a gentle cleanser."
    if category == "toner":
        return "Pat in with a cotton pad or your palms; wait ~1 minute before the next step."
    if category in ("serum", "treatment"):
        note = "Apply to slightly damp skin; wait 1–2 minutes before moisturiser."
        if has_conflict:
            note += " Don't mix with your other treatment/acid the same night — alternate nights instead."
        return note
    if category == "moisturiser":
        return "Seal everything in — a richer formula works well at night." if time_of_day == "pm" else "A lightweight layer before sunscreen."
    if category == "sunscreen":
        return "Always the last AM step — reapply every 2–3 hours if you're outdoors."
    return ""


def build_layering(products: list[RoutineProduct], conflicts: list[ConflictPair]) -> LayeringPlan:
    conflict_product_names: set[str] = set()
    for c in conflicts:
        conflict_product_names.update(c.products_a)
        conflict_product_names.update(c.products_b)

    by_category: dict[str, list[RoutineProduct]] = {}
    for p in products:
        by_category.setdefault(p.category, []).append(p)

    def make_step(p: RoutineProduct, time_of_day: str) -> LayerStep:
        is_active_step = p.category in ("serum", "treatment")
        has_conflict = is_active_step and p.name in conflict_product_names
        wait = 2 if is_active_step else (1 if p.category == "toner" else 0)
        return LayerStep(
            order=0,  # renumbered below
            product_id=p.id,
            product_name=p.name,
            step_label=_STEP_LABELS.get(p.category, p.category.title()),
            wait_minutes=wait,
            note=_step_note(p.category, time_of_day=time_of_day, has_conflict=has_conflict),
        )

    am_steps: list[LayerStep] = []
    pm_steps: list[LayerStep] = []

    for cat in ("cleanser", "toner"):
        for p in by_category.get(cat, []):
            am_steps.append(make_step(p, "am"))
            pm_steps.append(make_step(p, "pm"))

    for p in by_category.get("serum", []) + by_category.get("treatment", []):
        slot = _active_step_time(p.category, p.actives)
        (am_steps if slot == "am" else pm_steps).append(make_step(p, slot))

    for p in by_category.get("moisturiser", []):
        am_steps.append(make_step(p, "am"))
        pm_steps.append(make_step(p, "pm"))

    for p in by_category.get("sunscreen", []):
        am_steps.append(make_step(p, "am"))  # AM only, always last

    for i, s in enumerate(am_steps, start=1):
        s.order = i
    for i, s in enumerate(pm_steps, start=1):
        s.order = i

    return LayeringPlan(am=am_steps, pm=pm_steps)


# ---------------------------------------------------------------------------
# Cost
# ---------------------------------------------------------------------------

def compute_cost(prices: list[float]) -> tuple[float, float]:
    total = round(sum(prices), 2)
    return total, round(total / 30, 2)


# ---------------------------------------------------------------------------
# Budget optimiser — pure function over already-fetched candidates so it's
# unit-testable without a DB (router does the fetching).
# ---------------------------------------------------------------------------

@dataclass
class OptimiseResult:
    chosen: dict[str, object]  # category -> Product-like row
    total_cost_inr: float
    cost_per_day_inr: float
    drop_suggestion: Optional[str] = None


def optimise_routine(
    steps_def: list[dict],
    candidates_by_category: dict[str, list],
    ctx: scoring.UserContext,
    budget_inr: float,
) -> OptimiseResult:
    """
    Greedily pick the highest match_score product per step, then — if the
    running total exceeds budget_inr — swap the priciest steps for the
    cheapest same-active alternative, and finally drop the most optional
    step still present if that isn't enough.
    """
    scored_by_category: dict[str, list[tuple[int, object]]] = {}
    for step in steps_def:
        cat = step["category"]
        scored: list[tuple[int, object]] = []
        for p in candidates_by_category.get(cat, []):
            if getattr(p, "price_inr", None) is None:
                continue
            result = scoring.score_product(p, ctx)
            flag_codes = {f["code"] for f in result.flags}
            if "contains_allergen" in flag_codes or "pregnancy_unsafe" in flag_codes:
                continue  # never recommend unsafe products, even off-budget
            scored.append((result.match_score or 0, p))
        scored.sort(key=lambda t: -t[0])
        scored_by_category[cat] = scored

    chosen: dict[str, object] = {}
    for step in steps_def:
        cat = step["category"]
        if scored_by_category.get(cat):
            chosen[cat] = scored_by_category[cat][0][1]

    total = round(sum(p.price_inr for p in chosen.values()), 2)
    drop_suggestion: Optional[str] = None

    if total > budget_inr:
        # Swap priciest steps first for the cheapest alternative that shares
        # an active with the current pick (falls back to cheapest overall).
        by_price_desc = sorted(chosen.items(), key=lambda kv: -kv[1].price_inr)
        for cat, product in by_price_desc:
            if total <= budget_inr:
                break
            current_actives = set(scoring._actives_for(product))
            pool = [p for _score, p in scored_by_category[cat]]
            shared = [p for p in pool if set(scoring._actives_for(p)) & current_actives]
            candidates = shared or pool
            cheapest = min(candidates, key=lambda p: p.price_inr)
            if cheapest.id != product.id and cheapest.price_inr < product.price_inr:
                total = round(total - product.price_inr + cheapest.price_inr, 2)
                chosen[cat] = cheapest

    dropped_cat: Optional[str] = None
    if total > budget_inr:
        for optional_cat in _OPTIONAL_DROP_ORDER:
            if optional_cat in chosen:
                total = round(total - chosen[optional_cat].price_inr, 2)
                del chosen[optional_cat]
                dropped_cat = optional_cat
                break

    # Be honest about whether the drop (if any) actually got under budget —
    # never claim a fit that didn't happen (essentials alone can exceed a
    # very low budget, in which case dropping the one optional step isn't enough).
    if total > budget_inr:
        if dropped_cat:
            drop_suggestion = (
                f"Even without the {dropped_cat}, this routine costs ₹{int(total)} — "
                f"over your ₹{int(budget_inr)} budget. Try raising your budget."
            )
        else:
            drop_suggestion = (
                f"Your essentials alone cost ₹{int(total)} — over your ₹{int(budget_inr)} "
                f"budget. Try raising your budget."
            )
    elif dropped_cat:
        drop_suggestion = (
            f"Skip the {dropped_cat} to stay under "
            f"₹{int(budget_inr)} — optional for your skin type."
        )

    total_cost, cost_per_day = compute_cost([p.price_inr for p in chosen.values()])
    return OptimiseResult(
        chosen=chosen,
        total_cost_inr=total_cost,
        cost_per_day_inr=cost_per_day,
        drop_suggestion=drop_suggestion,
    )
