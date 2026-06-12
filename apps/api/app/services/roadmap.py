"""
Roadmap generation service — builds a week-by-week 20-week skincare plan
from Claude's phased product list.

Phase 1 (Weeks  1– 4): Basics — cleanser + moisturiser + sunscreen
Phase 2 (Weeks  5–12): Primary treatment — add targeted actives
Phase 3 (Weeks 13–20): Optimise — secondary treatments / boosters
"""

from __future__ import annotations

from typing import Optional

from app.models.questionnaire import EnvironmentProfile
from app.schemas.recommendation import (
    ClaudeProductItem,
    ConditionTimeline,
    RoadmapPhase,
    RoadmapResponse,
    RoadmapWeekEntry,
)

# ---------------------------------------------------------------------------
# Condition → visible improvement timeline
# ---------------------------------------------------------------------------
_CONDITION_TIMELINES: dict[str, dict] = {
    "acne": {
        "improvement_week": 8,
        "improvement_pct": 50,
        "note": "Acne typically reduces 40–50 % by week 8 with consistent BHA use.",
    },
    "dark_spots": {
        "improvement_week": 12,
        "improvement_pct": 35,
        "note": "Dark spots improve 30–40 % by week 12 with Vitamin C + daily sunscreen.",
    },
    "pigmentation": {
        "improvement_week": 16,
        "improvement_pct": 30,
        "note": "Uneven pigmentation requires 12–16 weeks of niacinamide + sunscreen.",
    },
    "dryness": {
        "improvement_week": 4,
        "improvement_pct": 70,
        "note": "Moisture barrier typically repairs within 3–4 weeks with ceramide moisturiser.",
    },
    "pores": {
        "improvement_week": 8,
        "improvement_pct": 25,
        "note": "Pore appearance reduces subtly by week 8 with consistent niacinamide.",
    },
    "wrinkles": {
        "improvement_week": 12,
        "improvement_pct": 20,
        "note": "Fine lines improve after 12 weeks of retinol (start 2x/week, build slowly).",
    },
    "redness": {
        "improvement_week": 4,
        "improvement_pct": 40,
        "note": "Redness calms within 4 weeks once irritants are removed from the routine.",
    },
    "texture": {
        "improvement_week": 6,
        "improvement_pct": 40,
        "note": "Skin texture improves 30–40 % after 6 weeks of gentle consistent exfoliation.",
    },
    "uneven_tone": {
        "improvement_week": 12,
        "improvement_pct": 30,
        "note": "Tone evening requires 10–12 weeks with brightening actives + SPF every day.",
    },
}

# Phase metadata
_PHASE_META = {
    1: {
        "title": "Foundations",
        "weeks_start": 1,
        "weeks_end": 4,
        "goal": "Build a safe, gentle routine. Let your skin barrier strengthen before adding actives.",
    },
    2: {
        "title": "Targeted Treatment",
        "weeks_start": 5,
        "weeks_end": 12,
        "goal": "Introduce one active ingredient to address your primary concern. Patch-test first.",
    },
    3: {
        "title": "Optimise & Boost",
        "weeks_start": 13,
        "weeks_end": 20,
        "goal": "Layer in secondary treatments or boosters once the skin is accustomed to Phase 2.",
    },
}

# Introduction week copy templates
_INTRO_COPY = {
    "cleanser": "Start with {name} only. Use morning and night. Let your skin adjust for the first week.",
    "moisturiser": "Add {name} after cleansing, while skin is still slightly damp.",
    "sunscreen": "Apply {name} every morning as the final step — this is non-negotiable.",
    "serum": "Your skin is ready for {name}. Patch-test on your inner arm for 24 h first.",
    "toner": "After cleansing, apply {name} with clean hands — no cotton pad needed.",
    "treatment": "Introduce {name} 2× per week only. Increase to 3× in Week 15 if no irritation.",
    "mask": "Use {name} once per week on a weekend evening.",
    "default": "Introduce {name} as directed. Monitor for any reaction in the first 3 days.",
}

# Ongoing use copy
_ONGOING_COPY = {
    "cleanser": "Continue {name} morning and night.",
    "moisturiser": "Continue {name} after every cleanse.",
    "sunscreen": "Apply {name} every single morning — reapply if outdoors >2 h.",
    "serum": "Apply {name} after toner, before moisturiser.",
    "treatment": "Use {name} 3× per week, building to daily if tolerated.",
    "default": "Continue {name} as established.",
}


def generate_roadmap(
    products: list[ClaudeProductItem],
    conditions: list[str],
    climate: Optional[EnvironmentProfile],
) -> dict:
    """
    Returns a serialisable dict representation of RoadmapResponse.
    Stored in recommendation.roadmap_json.
    """
    response = _build_roadmap(products, conditions, climate)
    return response.model_dump()


def _build_roadmap(
    products: list[ClaudeProductItem],
    conditions: list[str],
    climate: Optional[EnvironmentProfile],
) -> RoadmapResponse:
    by_phase: dict[int, list[ClaudeProductItem]] = {1: [], 2: [], 3: []}
    for p in products:
        by_phase.setdefault(p.phase, []).append(p)

    week_entries: list[RoadmapWeekEntry] = []
    introduced: set[str] = set()

    for week in range(1, 21):
        phase = _week_to_phase(week)
        phase_products = by_phase.get(phase, [])

        # Products due to be introduced this week
        new_this_week = [p for p in phase_products if p.start_week == week and p.name not in introduced]

        if new_this_week:
            for prod in new_this_week:
                template = _INTRO_COPY.get(prod.category, _INTRO_COPY["default"])
                instruction = template.format(name=prod.name)
                week_entries.append(RoadmapWeekEntry(
                    week=week,
                    phase=phase,
                    action=f"Introduce {prod.name}",
                    product_name=prod.name,
                    instruction=instruction,
                    is_introduction=True,
                ))
                introduced.add(prod.name)
        else:
            # Maintenance week
            active = [p for p in products if p.name in introduced]
            if active:
                names = " + ".join(p.name for p in active[:2])
                week_entries.append(RoadmapWeekEntry(
                    week=week,
                    phase=phase,
                    action="Continue routine",
                    product_name=None,
                    instruction=f"Maintain your routine: {names}. Consistency is key.",
                    is_introduction=False,
                ))
            else:
                week_entries.append(RoadmapWeekEntry(
                    week=week,
                    phase=phase,
                    action="Rest week",
                    product_name=None,
                    instruction="No new products this week. Let your skin stabilise.",
                    is_introduction=False,
                ))

    # Build phase summaries
    phases = [
        RoadmapPhase(
            phase=ph,
            title=meta["title"],
            weeks_start=meta["weeks_start"],
            weeks_end=meta["weeks_end"],
            goal=meta["goal"],
            product_names=[p.name for p in by_phase.get(ph, [])],
        )
        for ph, meta in _PHASE_META.items()
    ]

    # Build condition timelines
    timelines = []
    for cond in conditions:
        data = _CONDITION_TIMELINES.get(cond)
        if data:
            timelines.append(ConditionTimeline(
                condition=cond,
                expected_improvement_week=data["improvement_week"],
                expected_improvement_pct=data["improvement_pct"],
                note=data["note"],
            ))

    # Climate-based tip injected as week 1 note
    if climate and climate.city and week_entries:
        humidity_note = ""
        if climate.avg_humidity_pct and climate.avg_humidity_pct > 70:
            humidity_note = (
                f" Given {climate.city}'s high humidity ({climate.avg_humidity_pct:.0f} %), "
                "choose lightweight, non-comedogenic formulas."
            )
        if humidity_note and week_entries[0].instruction:
            week_entries[0] = week_entries[0].model_copy(
                update={"instruction": week_entries[0].instruction + humidity_note}
            )

    return RoadmapResponse(
        total_weeks=20,
        phases=phases,
        week_entries=week_entries,
        condition_timelines=timelines,
    )


def _week_to_phase(week: int) -> int:
    if week <= 4:
        return 1
    if week <= 12:
        return 2
    return 3
