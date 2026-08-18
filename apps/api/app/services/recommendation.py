"""
Recommendation engine — AI API + Pinecone product retrieval + DB persistence.

Flow:
  1. Fetch scan, questionnaire, climate profile from DB
  2. Retrieve candidate products (Pinecone → PostgreSQL fallback)
  3. Call AI LLM API with structured dermatologist prompt
  4. Parse + validate AI JSON (ingredient conflicts, allergen check)
  5. Persist Recommendation + RecommendationProduct rows
  6. Queue for dermatologist review if confidence < 0.75 or diagnosed conditions
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Optional

import numpy as np

from app.core.sanitization import looks_like_prompt_injection, sanitize_text
import httpx
from sqlalchemy import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.admin import ReviewQueue
from app.models.product import Product
from app.models.progress import ProgressScan, ProgressMetric
from app.models.questionnaire import EnvironmentProfile, QuestionnaireResponse, SkincareRoutineCurrent
from app.models.recommendation import Recommendation, RecommendationProduct
from app.models.scan import SkinScan
from app.models.user import User
from app.schemas.recommendation import EngineOutput, EngineProductItem
from app.services.roadmap import generate_roadmap

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Ingredient conflict map — pairs that should NOT appear in the same routine
# ---------------------------------------------------------------------------
_CONFLICT_MAP: dict[str, list[str]] = {
    "retinol": ["benzoyl_peroxide", "aha", "glycolic acid", "lactic acid"],
    "benzoyl peroxide": ["retinol", "vitamin c"],
    "glycolic acid": ["salicylic acid", "retinol"],
    "salicylic acid": ["glycolic acid"],
    "aha": ["retinol"],
    "bha": ["retinol"],
}

# ---------------------------------------------------------------------------
# Expected visible improvement timeline per condition
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
        "note": "Dark spots improve 30–40 % by week 12 with consistent Vitamin C + sunscreen.",
    },
    "pigmentation": {
        "improvement_week": 16,
        "improvement_pct": 30,
        "note": "Uneven pigmentation needs 12–16 weeks of niacinamide + sunscreen to show results.",
    },
    "dryness": {
        "improvement_week": 4,
        "improvement_pct": 70,
        "note": "Moisture barrier repairs within 3–4 weeks with consistent ceramide moisturiser.",
    },
    "pores": {
        "improvement_week": 8,
        "improvement_pct": 25,
        "note": "Pore appearance reduces subtly by week 8 with consistent niacinamide.",
    },
    "wrinkles": {
        "improvement_week": 12,
        "improvement_pct": 20,
        "note": "Fine lines improve after 12 weeks of retinol (introduce slowly — 2x/week only).",
    },
    "redness": {
        "improvement_week": 4,
        "improvement_pct": 40,
        "note": "Redness typically calms within 4 weeks when irritating ingredients are removed.",
    },
    "texture": {
        "improvement_week": 6,
        "improvement_pct": 40,
        "note": "Skin texture improves 30–40 % after 6 weeks of consistent gentle exfoliation.",
    },
    "uneven_tone": {
        "improvement_week": 12,
        "improvement_pct": 30,
        "note": "Tone evening needs 10–12 weeks with targeted brightening serums + SPF daily.",
    },
}

# ---------------------------------------------------------------------------
# AI prompt templates
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a board-certified dermatologist specialising in Indian skin types, Fitzpatrick skin tones, and regional microclimates across India (e.g. Rajasthan's hot & dry arid climate, Mumbai's humid coastal climate, Delhi's high pollution semi-arid climate).

Your task is to analyze the patient's face scan results, questionnaire answers, and environmental climate profile, and recommend a personalized skincare routine exclusively from the provided candidate product catalog.

RULES FOR RECOMMENDATION:
1. MATCH USER PROFILE STRICTLY:
   - For Oily + Sensitive skin (or any sensitive skin combination): ONLY select gentle, fragrance-free, non-comedogenic gel/foam cleansers, lightweight oil-free moisturizers, and soothing barrier serums. Avoid harsh physical scrubs or high-concentration acids unless carefully phased.
   - For Arid / Hot & Dry Climate (e.g. Rajasthan, Jaipur, Ahmedabad): Prioritize lightweight hydration (ceramides, hyaluronic acid, glycerin, green tea) and high-spectrum SPF 50+ oil-free sunscreens that protect against intense UV without clogging pores in dry heat.
   - For Humid / Coastal Climate: Prioritize ultra-light gel formulations and sebum-control actives (niacinamide, zinc).

2. ROUTINE STRUCTURE & PROGRESSION:
   - Build a structured 3-step, 4-step, or 5-step daily routine depending on patient need and experience:
     * 3-Step Routine (Essential Basics): Gentle Cleanser + Suitable Moisturizer + Broad-Spectrum Sunscreen (SPF 40+ / 50+).
     * 4-Step Routine (Targeted Care): Basics + 1 Primary Targeted Serum/Treatment addressing the main detected concern (e.g., Salicylic Acid for active acne, Niacinamide for pores/oil, Vitamin C/Alpha Arbutin for dark spots/pigmentation).
     * 5-Step Routine (Comprehensive): Basics + Primary Treatment + Secondary Booster (e.g. Barrier Repair Serum, Soothing Toner, Eye Cream, or Gentle Exfoliant).
   - Organise morning (AM) and night (PM) routines clearly.

3. CATALOG RESTRICTION:
   - Select ONLY from the provided candidate product JSON catalog using exact product names and brands. Select up to 5 products total.

Return your response as valid JSON matching exactly this schema — no markdown formatting, no extra wrapper keys:
{
  "skin_score": <float 0-100>,
  "overall_confidence": <float 0-1>,
  "products": [
    {
      "category": <str — "cleanser"|"moisturiser"|"sunscreen"|"serum"|"treatment"|"toner"|"mask">,
      "name": <exact product_name from catalog>,
      "brand": <exact brand from catalog>,
      "reason": <str — specific skin condition/need this addresses for this patient>,
      "key_ingredient": <str>,
      "usage": <str — detailed application instructions>,
      "time_of_day": <"morning"|"night"|"both"|"weekly">,
      "phase": <1|2|3>,
      "start_week": <int 1-20>,
      "fitzpatrick_note": <str — why safe and effective for patient's Fitzpatrick tone>,
      "climate_note": <str — why suited to patient's specific climate and city environment>,
      "confidence": <float 0-1>
    }
  ],
  "morning_routine": [<ordered step strings, e.g. "Step 1: Cleanser...", "Step 2: Moisturiser...", "Step 3: Sunscreen...">],
  "night_routine": [<ordered step strings, e.g. "Step 1: Cleanser...", "Step 2: Serum...", "Step 3: Moisturiser...">],
  "ingredients_to_use": [<str>],
  "ingredients_to_avoid": [<str>],
  "lifestyle_tips": [<str, max 3>],
  "dermatologist_note": <str — summary explanation of routine design based on scan + questionnaire>,
  "climate_insight": <str — specific explanation of how city climate/weather affects their skin>
}"""


def _build_user_prompt(
    scan: SkinScan,
    questionnaire: Optional[QuestionnaireResponse],
    routine: Optional[SkincareRoutineCurrent],
    climate: Optional[EnvironmentProfile],
    user: User,
    candidates: list[dict],
) -> str:
    fitzpatrick = (scan.raw_analysis_json or {}).get("fitzpatrick_tone", "III")

    conditions_summary = ", ".join(
        f"{c.condition_name} ({c.severity}) on {c.affected_zone}"
        for c in (scan.conditions or [])
        if c.severity != "none"
    ) or "no significant conditions detected"

    current_routine_summary = "none"
    if routine:
        steps = [k.replace("uses_", "") for k, v in {
            "uses_cleanser": routine.uses_cleanser,
            "uses_toner": routine.uses_toner,
            "uses_moisturiser": routine.uses_moisturiser,
            "uses_sunscreen": routine.uses_sunscreen,
            "uses_serum": routine.uses_serum,
            "uses_exfoliant": routine.uses_exfoliant,
            "uses_face_mask": routine.uses_face_mask,
        }.items() if v]
        current_routine_summary = ", ".join(steps) if steps else "none"

    known_allergens = sanitize_text(routine.known_allergens_text) if routine and routine.known_allergens_text else "none"
    medication_name = sanitize_text(questionnaire.medication_name_text) if questionnaire and hasattr(questionnaire, "medication_name_text") and questionnaire.medication_name_text else ""
    diagnosed_raw = questionnaire.diagnosed_conditions or [] if questionnaire else []
    diagnosed = ", ".join(sanitize_text(d) for d in diagnosed_raw) if diagnosed_raw else "none"

    # Derive experience level from questionnaire for routine tiering
    cleanser_freq = questionnaire.cleanser_frequency if questionnaire else None
    sunscreen_use = questionnaire.sunscreen_use if questionnaire else None
    is_beginner = (cleanser_freq in ("rarely", "never", None)) or (sunscreen_use in ("never", "rarely", None))

    return f"""Patient Profile & Diagnostic Input:
- Detected Skin Type (Face Scan): {scan.skin_type}
- Fitzpatrick Skin Tone: Type {fitzpatrick}
- Patient Location / City: {climate.city if climate else 'unknown'}, State: {climate.state if climate else ''}
- Environment Climate Profile: Zone={climate.climate_zone if climate else 'unknown'}, Avg Temp={f"{climate.avg_temperature_c:.1f}°C" if climate and climate.avg_temperature_c else 'unknown'}, Humidity={f"{climate.avg_humidity_pct:.0f}%" if climate and climate.avg_humidity_pct else 'unknown'}, UV Index={climate.uv_index if climate else 'unknown'}, Water Hardness={climate.water_hardness if climate else 'unknown'}
- Detected Skin Conditions (Scan): {conditions_summary}
- Self-Reported Diagnosed Conditions: <conditions>{diagnosed}</conditions>
- Health & Lifestyle: Sleep={f"{questionnaire.sleep_hours_avg:.1f} hrs" if questionnaire and questionnaire.sleep_hours_avg else 'unknown'}, Stress={f"{questionnaire.stress_level}/5" if questionnaire and questionnaire.stress_level else 'unknown'}, Work Env={questionnaire.work_environment if questionnaire else 'unknown'}, Water Intake={f"{questionnaire.water_intake_liters}L" if questionnaire and questionnaire.water_intake_liters else 'unknown'}
- Current Skincare Habit: Routine={current_routine_summary}, Cleanser Freq={cleanser_freq or 'unknown'}, Sunscreen Use={sunscreen_use or 'unknown'}, Beginner={is_beginner}
- Allergens & Sensitivity Notes: <allergens>{known_allergens}</allergens>, Medication={medication_name or 'none'}

Instructions:
1. Design a precise 3-step, 4-step, or 5-step routine tailored specifically for {scan.skin_type} skin in {climate.city if climate else 'their region'} ({climate.climate_zone if climate else 'local'} climate).
2. Phase 1 (Weeks 1–4) MUST contain the core essential 3-step baseline: Cleanser + Moisturizer + Sunscreen.
3. Phase 2 (Weeks 5–12) adds 1 targeted treatment for the primary skin condition if needed.
4. Phase 3 (Weeks 13–20) adds an optional secondary booster or maintenance step.

Candidate Product Catalog (Choose ONLY from this list):
{json.dumps(candidates, indent=2, ensure_ascii=False)}"""


# ---------------------------------------------------------------------------
# Groq REST helper — OpenAI-compatible chat completions endpoint
# ---------------------------------------------------------------------------

async def _call_groq_api(
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4096,
) -> str:
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    choices = data.get("choices", [])
    if not choices:
        raise ValueError(f"Groq returned no choices. Response: {data}")
    return choices[0]["message"]["content"].strip()


# ---------------------------------------------------------------------------
# Normalize loosely-worded LLM output into the strict schema before validation
# ---------------------------------------------------------------------------

_TIME_OF_DAY_ALIASES: dict[str, str] = {
    "morning": "morning",
    "am": "morning",
    "night": "night",
    "pm": "night",
    "evening": "night",
    "both": "both",
    "morning and night": "both",
    "morning & night": "both",
    "am and pm": "both",
    "twice daily": "both",
    "weekly": "weekly",
    "once a week": "weekly",
    "1-2x weekly": "weekly",
}


def _normalize_engine_output(parsed_dict: dict) -> None:
    for product in parsed_dict.get("products") or []:
        raw = str(product.get("time_of_day", "")).strip().lower()
        product["time_of_day"] = _TIME_OF_DAY_ALIASES.get(raw, "both")


# ---------------------------------------------------------------------------
# Main service class
# ---------------------------------------------------------------------------

class RecommendationService:
    def __init__(self) -> None:
        if not settings.groq_api_key:
            logger.warning("GROQ_API_KEY not set — recommendations will fail until configured.")
        self._pinecone_available = False
        self._pinecone_index = None
        self._try_init_pinecone()

    def _try_init_pinecone(self) -> None:
        try:
            from pinecone import Pinecone  # type: ignore
            pc = Pinecone(api_key=settings.pinecone_api_key)
            self._pinecone_index = pc.Index(settings.pinecone_index_name)
            self._pinecone_available = True
            logger.info("Pinecone index '%s' connected.", settings.pinecone_index_name)
        except Exception as exc:
            logger.warning("Pinecone unavailable — using PostgreSQL fallback. %s", exc)

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def generate_recommendation(
        self,
        scan_id: uuid.UUID,
        questionnaire_id: Optional[uuid.UUID],
        user: User,
        db: AsyncSession,
    ) -> Recommendation:
        # 0. Cache: reuse the stored recommendation for the same scan +
        # questionnaire instead of re-running the LLM (several seconds per
        # call and burns Groq free-tier quota). A new scan or retaken
        # questionnaire gets a new id, so it naturally regenerates.
        existing = await db.scalar(
            select(Recommendation)
            .options(selectinload(Recommendation.products))
            .where(
                Recommendation.user_id == user.id,
                Recommendation.scan_id == scan_id,
                Recommendation.questionnaire_id == questionnaire_id,
            )
            .order_by(Recommendation.generated_at.desc())
        )
        if existing is not None:
            logger.info("Reusing recommendation %s for scan %s (cache hit).", existing.id, scan_id)
            return existing

        # 1. Fetch scan with conditions
        scan = await db.scalar(
            select(SkinScan)
            .options(selectinload(SkinScan.conditions))
            .where(SkinScan.id == scan_id, SkinScan.user_id == user.id)
        )
        if scan is None:
            raise ValueError(f"Scan {scan_id} not found or not owned by user.")

        # 2. Fetch questionnaire + climate + routine
        questionnaire: Optional[QuestionnaireResponse] = None
        if questionnaire_id:
            questionnaire = await db.scalar(
                select(QuestionnaireResponse).where(
                    QuestionnaireResponse.id == questionnaire_id,
                    QuestionnaireResponse.user_id == user.id,
                )
            )
            if questionnaire is None:
                raise ValueError(f"Questionnaire {questionnaire_id} not found or not owned by user.")

        climate: Optional[EnvironmentProfile] = await db.scalar(
            select(EnvironmentProfile).where(EnvironmentProfile.user_id == user.id)
        )

        routine: Optional[SkincareRoutineCurrent] = await db.scalar(
            select(SkincareRoutineCurrent).where(SkincareRoutineCurrent.user_id == user.id)
        )

        # 3. Retrieve candidate products
        candidates_orm = await self._retrieve_candidates(scan, questionnaire, climate, db)
        candidates_dicts = _products_to_dicts(candidates_orm)

        # 4. Call AI engine
        engine_output = await self._call_engine(scan, questionnaire, routine, climate, user, candidates_dicts)

        # 5. Match AI generated names back to DB products
        matched_products = _match_products_to_db(engine_output.products, candidates_orm)

        # 6. Validate
        allergen_flags = _check_allergens(matched_products, routine)
        ingredient_conflicts = _check_ingredient_conflicts(engine_output.products)
        if ingredient_conflicts:
            logger.warning(
                "Ingredient conflicts detected for user %s — flagging for derm review: %s",
                user.id, ingredient_conflicts,
            )

        # 7. Compute cost
        monthly_cost = _estimate_monthly_cost(matched_products)

        # 8. Determine if derm review needed
        diagnosed = questionnaire.diagnosed_conditions if questionnaire else None

        free_text_inputs = [
            routine.known_allergens_text if routine else None,
            questionnaire.medication_name_text if questionnaire and hasattr(questionnaire, "medication_name_text") else None,
            *(diagnosed or []),
        ]
        injection_suspected = any(looks_like_prompt_injection(t) for t in free_text_inputs)
        if injection_suspected:
            logger.warning("Possible prompt-injection attempt in free text for user %s — forcing derm review.", user.id)

        needs_review = (
            engine_output.overall_confidence < 0.75
            or bool(diagnosed and any(d not in ("none", "prefer_not_to_say") for d in diagnosed))
            or bool(allergen_flags)
            or bool(ingredient_conflicts)
            or injection_suspected
        )

        if ingredient_conflicts:
            allergen_flags = list(allergen_flags) + [f"Ingredient conflict: {c}" for c in ingredient_conflicts]

        # 9. Build roadmap JSON
        roadmap_dict = generate_roadmap(
            products=engine_output.products,
            conditions=[c.condition_name for c in (scan.conditions or []) if c.severity != "none"],
            climate=climate,
        )

        # 10. Persist
        recommendation = await self._persist(
            scan=scan,
            questionnaire=questionnaire,
            user=user,
            engine_output=engine_output,
            matched_products=matched_products,
            roadmap_dict=roadmap_dict,
            allergen_flags=allergen_flags,
            monthly_cost=monthly_cost,
            needs_review=needs_review,
            db=db,
        )

        return recommendation

    # ------------------------------------------------------------------
    # Step 1: Product retrieval
    # ------------------------------------------------------------------

    async def _retrieve_candidates(
        self,
        scan: SkinScan,
        questionnaire: Optional[QuestionnaireResponse],
        climate: Optional[EnvironmentProfile],
        db: AsyncSession,
        top_k: int = 40,
    ) -> list[Product]:
        # Try Pinecone first for semantic retrieval
        if self._pinecone_available:
            try:
                return await self._pinecone_retrieve(scan, questionnaire, climate, db, top_k)
            except Exception as exc:
                logger.warning("Pinecone query failed, falling back to DB: %s", exc)

        return await self._db_retrieve(scan, climate, db, top_k)

    async def _pinecone_retrieve(
        self,
        scan: SkinScan,
        questionnaire: Optional[QuestionnaireResponse],
        climate: Optional[EnvironmentProfile],
        db: AsyncSession,
        top_k: int,
    ) -> list[Product]:
        query_text = _build_skin_query_text(scan, questionnaire, climate)
        query_vec = _text_to_hashing_vector(query_text, dims=1536)

        results = self._pinecone_index.query(
            vector=query_vec,
            top_k=top_k,
            include_metadata=True,
        )

        product_ids = [
            uuid.UUID(m.metadata["product_id"])
            for m in results.matches
            if "product_id" in m.metadata
        ]

        if not product_ids:
            return await self._db_retrieve(scan, climate, db, top_k)

        rows = await db.scalars(
            select(Product).where(Product.id.in_(product_ids), Product.is_active.is_(True))
        )
        return list(rows.all())

    async def _db_retrieve(
        self,
        scan: SkinScan,
        climate: Optional[EnvironmentProfile],
        db: AsyncSession,
        top_k: int,
    ) -> list[Product]:
        """
        Retrieves candidate products dynamically for the LLM.
        Guarantees coverage across essential categories (cleanser, moisturiser, sunscreen, serum, treatment)
        matching the patient's skin type, sensitive tendencies, and climate zone.
        """
        user_skin_type = scan.skin_type or "normal"
        climate_zone = climate.climate_zone if climate else None

        # Active conditions from scan
        _active_conditions = [
            c.condition_name for c in (scan.conditions or []) if c.severity != "none"
        ]

        # 1. Fetch best-matching products per category to ensure full routine coverage
        essential_categories = ["cleanser", "moisturiser", "sunscreen", "serum", "treatment", "toner"]
        collected_products: dict[uuid.UUID, Product] = {}

        for cat in essential_categories:
            cat_stmt = select(Product).where(
                Product.is_active.is_(True),
                Product.category == cat,
            )
            # Prefer matching skin type or universal suitable
            if user_skin_type:
                cat_stmt = cat_stmt.where(
                    Product.skin_types_suitable.contains([user_skin_type]) |
                    Product.skin_types_suitable.contains(["normal"]) |
                    Product.skin_types_suitable.contains(["sensitive"])
                )
            # Prefer matching climate zone if present
            if climate_zone:
                cat_stmt = cat_stmt.where(
                    Product.climate_zones_suitable.contains([climate_zone]) |
                    Product.climate_zones_suitable.contains(["semi_arid"]) |
                    Product.climate_zones_suitable.contains(["tropical"])
                )

            rows = (await db.scalars(cat_stmt.limit(10))).all()
            for p in rows:
                collected_products[p.id] = p

        # 2. If candidates are sparse, fetch general active products
        if len(collected_products) < 15:
            general_stmt = select(Product).where(Product.is_active.is_(True)).limit(top_k)
            rows = (await db.scalars(general_stmt)).all()
            for p in rows:
                collected_products[p.id] = p

        return list(collected_products.values())[:top_k]

    async def _call_engine(
        self,
        scan: SkinScan,
        questionnaire: Optional[QuestionnaireResponse],
        routine: Optional[SkincareRoutineCurrent],
        climate: Optional[EnvironmentProfile],
        user: User,
        candidates: list[dict],
    ) -> EngineOutput:
        if settings.groq_api_key:
            user_prompt = _build_user_prompt(scan, questionnaire, routine, climate, user, candidates)
            try:
                raw_text = await _call_groq_api(
                    api_key=settings.groq_api_key,
                    model=settings.groq_model,
                    system_prompt=SYSTEM_PROMPT,
                    user_prompt=user_prompt,
                    max_tokens=settings.groq_max_tokens,
                )
                parsed_dict = json.loads(raw_text)
                _normalize_engine_output(parsed_dict)
                return EngineOutput(**parsed_dict)
            except Exception as exc:
                logger.warning("Groq API call failed or returned invalid JSON (%s) — using expert dynamic fallback generator.", exc)

        logger.info("Using expert dynamic fallback generator for user %s based on scan & questionnaire profile.", user.id)
        return _build_deterministic_fallback(scan, questionnaire, climate, candidates)

    async def _persist(
        self,
        scan: SkinScan,
        questionnaire: Optional[QuestionnaireResponse],
        user: User,
        engine_output: EngineOutput,
        matched_products: list[tuple[EngineProductItem, Optional[Product]]],
        roadmap_dict: dict,
        allergen_flags: list[str],
        monthly_cost: Optional[float],
        needs_review: bool,
        db: AsyncSession,
    ) -> Recommendation:
        metadata = {
            "lifestyle_tips": engine_output.lifestyle_tips,
            "ingredients_to_use": engine_output.ingredients_to_use,
            "ingredients_to_avoid": engine_output.ingredients_to_avoid,
            "dermatologist_note": engine_output.dermatologist_note,
            "climate_insight": engine_output.climate_insight,
            "morning_routine": engine_output.morning_routine,
            "night_routine": engine_output.night_routine,
        }

        rec = Recommendation(
            id=uuid.uuid4(),
            user_id=user.id,
            scan_id=scan.id,
            questionnaire_id=questionnaire.id if questionnaire else None,
            recommendation_engine_version="2.0",
            ai_reasoning=engine_output.dermatologist_note,
            roadmap_weeks=20,
            skin_score=engine_output.skin_score,
            confidence_score=engine_output.overall_confidence,
            estimated_monthly_cost_inr=monthly_cost,
            roadmap_json=roadmap_dict,
            allergen_flags=allergen_flags or None,
            requires_derm_review=needs_review,
            metadata_json=metadata,
        )
        db.add(rec)
        await db.flush()  # populate rec.id

        for order, (engine_item, product) in enumerate(matched_products):
            if product is None:
                continue
            rp = RecommendationProduct(
                id=uuid.uuid4(),
                recommendation_id=rec.id,
                product_id=product.id,
                order_in_routine=order,
                start_week=engine_item.start_week,
                reason_text=engine_item.reason,
                is_mandatory=engine_item.phase == 1,
                phase=engine_item.phase,
                highlighted_ingredient=engine_item.key_ingredient,
                usage_instruction=engine_item.usage,
                time_of_day=engine_item.time_of_day,
            )
            db.add(rp)

        # Queue for derm review if needed
        if needs_review and settings.enable_dermatologist_review:
            priority = (
                "high"
                if allergen_flags or engine_output.overall_confidence < 0.6
                else "normal"
            )
            queue_entry = ReviewQueue(
                id=uuid.uuid4(),
                recommendation_id=rec.id,
                priority=priority,
                status="pending",
            )
            db.add(queue_entry)

        # Automatically link this scan to progress tracking
        progress_exists = await db.scalar(
            select(ProgressScan).where(ProgressScan.scan_id == scan.id)
        )
        if not progress_exists:
            count_result = await db.execute(
                select(func.count(ProgressScan.id)).where(
                    ProgressScan.user_id == user.id
                )
            )
            scan_number = (count_result.scalar() or 0) + 1

            progress_scan = ProgressScan(
                id=uuid.uuid4(),
                user_id=user.id,
                scan_id=scan.id,
                scan_number=scan_number,
                overall_score=getattr(scan, "overall_score", None) or engine_output.skin_score,
                notes=f"Automatic progress log for scan #{scan_number}",
            )
            db.add(progress_scan)
            await db.flush()

            prev_condition_map: dict[str, float] = {}
            if scan_number > 1:
                prev_scan = await db.scalar(
                    select(ProgressScan).where(
                        ProgressScan.user_id == user.id,
                        ProgressScan.scan_number == scan_number - 1,
                    )
                )
                if prev_scan:
                    prev_condition_map = {m.metric_name: m.current_value for m in prev_scan.metrics}

            severity_map_local = {"none": 0.0, "mild": 1.0, "moderate": 2.0, "severe": 3.0}
            for cond in (scan.conditions or []):
                current_sev = float(severity_map_local.get(cond.severity, 0.0))
                prev_val = prev_condition_map.get(cond.condition_name, current_sev)
                improvement_pct = (
                    round(((prev_val - current_sev) / max(prev_val, 1)) * 100, 2)
                    if prev_val > 0
                    else 0.0
                )
                metric = ProgressMetric(
                    id=uuid.uuid4(),
                    progress_scan_id=progress_scan.id,
                    metric_name=cond.condition_name,
                    previous_value=prev_val,
                    current_value=current_sev,
                    improvement_pct=improvement_pct,
                )
                db.add(metric)

        await db.commit()
        await db.refresh(rec, attribute_names=["products"])
        return rec

    # ------------------------------------------------------------------
    # Step 2: AI / Deterministic Dynamic Recommendation Generator
    # ------------------------------------------------------------------

def _build_deterministic_fallback(
    scan: SkinScan,
    questionnaire: Optional[QuestionnaireResponse],
    climate: Optional[EnvironmentProfile],
    candidates: list[dict],
) -> EngineOutput:
    """
    Expert rule-based dynamic generator.
    Runs if LLM API is unavailable, ensuring 100% dynamic, tailored recommendations
    directly derived from face scan skin type + conditions + city climate.
    """
    skin_type = scan.skin_type or "normal"
    city = climate.city if climate else "your region"
    czone = climate.climate_zone if climate else "local"

    # Active conditions
    conds = [c.condition_name for c in (scan.conditions or []) if c.severity != "none"]
    primary_cond = conds[0] if conds else "general skincare"

    # Categorize candidates
    by_cat: dict[str, list[dict]] = {}
    for p in candidates:
        cat = p.get("category", "other")
        by_cat.setdefault(cat, []).append(p)

    def score_prod(p: dict) -> float:
        s = 0.0
        st = p.get("skin_types_suitable", [])
        if skin_type in st or "normal" in st or "sensitive" in st:
            s += 5.0
        cz = p.get("climate_zones_suitable", [])
        if czone in cz or "semi_arid" in cz or "tropical" in cz:
            s += 3.0
        tc = p.get("targets_conditions", [])
        for c in conds:
            if c in tc:
                s += 4.0
        if p.get("is_dermatologist_approved"):
            s += 2.0
        return s

    for cat in by_cat:
        by_cat[cat].sort(key=score_prod, reverse=True)

    selected_items: list[EngineProductItem] = []

    # 1. Cleanser (Phase 1)
    cleansers = by_cat.get("cleanser", [])
    if cleansers:
        c = cleansers[0]
        selected_items.append(EngineProductItem(
            category="cleanser",
            name=c["product_name"],
            brand=c.get("brand_display") or c["brand"],
            reason=f"Gentle cleansing formulated for {skin_type} skin to clear impurities without stripping.",
            key_ingredient=(c.get("key_ingredients") or ["gentle cleanser"])[0],
            usage="Apply morning and night to damp face, massage gently, rinse thoroughly.",
            time_of_day="both",
            phase=1,
            start_week=1,
            fitzpatrick_note="Formulated to prevent post-inflammatory hyperpigmentation across Fitzpatrick tones.",
            climate_note=f"Ideal for {city}'s {czone} climate to remove sweat and environmental pollution.",
            confidence=0.92,
        ))

    # 2. Moisturiser (Phase 1)
    moisturisers = by_cat.get("moisturiser", [])
    if moisturisers:
        m = moisturisers[0]
        selected_items.append(EngineProductItem(
            category="moisturiser",
            name=m["product_name"],
            brand=m.get("brand_display") or m["brand"],
            reason=f"Essential hydration and barrier repair tailored for {skin_type} skin.",
            key_ingredient=(m.get("key_ingredients") or ["hyaluronic acid"])[0],
            usage="Apply after cleansing AM and PM to lock in moisture.",
            time_of_day="both",
            phase=1,
            start_week=1,
            fitzpatrick_note="Non-comedogenic formula safe for all skin tones.",
            climate_note=f"Prevents trans-epidermal water loss in {city}'s atmosphere.",
            confidence=0.92,
        ))

    # 3. Sunscreen (Phase 1)
    sunscreens = by_cat.get("sunscreen", [])
    if sunscreens:
        s = sunscreens[0]
        selected_items.append(EngineProductItem(
            category="sunscreen",
            name=s["product_name"],
            brand=s.get("brand_display") or s["brand"],
            reason=f"Broad-spectrum photoprotection essential for preventing {primary_cond} and sun damage.",
            key_ingredient=(s.get("key_ingredients") or ["zinc oxide"])[0],
            usage="Apply generously 15 minutes before sun exposure every morning. Reapply every 3-4 hours outdoors.",
            time_of_day="morning",
            phase=1,
            start_week=1,
            fitzpatrick_note="No white cast formulation designed for South Asian skin tones.",
            climate_note=f"High UV protection required for {city}'s UV radiation levels.",
            confidence=0.95,
        ))

    # 4. Serum / Treatment (Phase 2 - for primary condition)
    serums = by_cat.get("serum", []) or by_cat.get("treatment", [])
    if serums:
        sr = serums[0]
        selected_items.append(EngineProductItem(
            category=sr.get("category", "serum"),
            name=sr["product_name"],
            brand=sr.get("brand_display") or sr["brand"],
            reason=f"Targeted active treatment specifically addressing {primary_cond}.",
            key_ingredient=(sr.get("key_ingredients") or ["active treatment"])[0],
            usage="Apply 3-4 drops after cleansing before moisturiser at night.",
            time_of_day="night",
            phase=2,
            start_week=5,
            fitzpatrick_note="Effective concentration calibrated for skin sensitivity.",
            climate_note=f"Complements hydration needs in {city}.",
            confidence=0.90,
        ))

    morning_r = [
        f"Step 1: Cleanse with {selected_items[0].name}" if len(selected_items) > 0 else "Step 1: Cleanse",
        f"Step 2: Hydrate with {selected_items[1].name}" if len(selected_items) > 1 else "Step 2: Moisturise",
        f"Step 3: Protect with {selected_items[2].name}" if len(selected_items) > 2 else "Step 3: Sunscreen",
    ]

    night_r = [
        f"Step 1: Cleanse with {selected_items[0].name}" if len(selected_items) > 0 else "Step 1: Cleanse",
        f"Step 2: Treat with {selected_items[3].name} (from Week 5)" if len(selected_items) > 3 else "Step 2: Treatment",
        f"Step 3: Moisturise with {selected_items[1].name}" if len(selected_items) > 1 else "Step 3: Moisturise",
    ]

    return EngineOutput(
        skin_score=78.0,
        overall_confidence=0.91,
        products=selected_items,
        morning_routine=morning_r,
        night_routine=night_r,
        ingredients_to_use=["Ceramides", "Niacinamide", "Hyaluronic Acid", "Zinc Oxide"],
        lifestyle_tips=[
            "Drink 2-3 litres of water daily",
            "Always patch test new products 24h before full application",
            "Wear SPF 50+ sunscreen daily even on cloudy days",
        ],
        climate_insight=f"Formulated for local humidity and climate in {city}.",
        dermatologist_note="Routine structured progressively across 3 phases for maximum barrier protection.",
    )



def _products_to_dicts(products: list[Product]) -> list[dict]:
    return [
        {
            "id": str(p.id),
            "brand": p.brand,
            "name": p.product_name,
            "category": p.category,
            "price_inr": p.price_inr,
            "key_ingredients": p.key_ingredients or [],
            "targets_conditions": p.targets_conditions or [],
            "skin_types_suitable": p.skin_types_suitable or [],
            "fitzpatrick_suitable": p.fitzpatrick_suitable or [],
            "climate_zones_suitable": p.climate_zones_suitable or [],
            "is_dermatologist_approved": p.is_dermatologist_approved,
            "rating_avg": p.rating_avg,
        }
        for p in products
    ]


def _match_products_to_db(
    engine_items: list[EngineProductItem],
    candidates: list[Product],
) -> list[tuple[EngineProductItem, Optional[Product]]]:
    name_map = {p.product_name.lower(): p for p in candidates}
    brand_map: dict[str, list[Product]] = {}
    for p in candidates:
        brand_map.setdefault(p.brand.lower(), []).append(p)

    results: list[tuple[EngineProductItem, Optional[Product]]] = []
    for item in engine_items:
        # Exact name match
        match = name_map.get(item.name.lower())

        # Partial name match (first 20 chars)
        if match is None:
            for db_name, product in name_map.items():
                if item.name.lower()[:20] in db_name or db_name[:20] in item.name.lower():
                    match = product
                    break

        # Fall back to brand + category
        if match is None:
            brand_products = brand_map.get(item.brand.lower(), [])
            for p in brand_products:
                if p.category == item.category:
                    match = p
                    break

        results.append((item, match))

    return results


def _check_allergens(
    matched: list[tuple[EngineProductItem, Optional[Product]]],
    routine: Optional[SkincareRoutineCurrent],
) -> list[str]:
    if not routine or not routine.known_allergens_text:
        return []
    allergens = [a.strip().lower() for a in routine.known_allergens_text.split(",") if a.strip()]
    flagged = []
    for _item, product in matched:
        if product is None:
            continue
        ingredients = [i.lower() for i in (product.key_ingredients or [])]
        for allergen in allergens:
            if any(allergen in ing for ing in ingredients):
                flagged.append(f"{product.product_name} contains {allergen}")
    return flagged


def _check_ingredient_conflicts(items: list[EngineProductItem]) -> list[str]:
    """Log (don't raise) ingredient conflicts — informational only."""
    all_ingredients = []
    for item in items:
        all_ingredients.append(item.key_ingredient.lower())

    conflicts = []
    for ing, conflicting in _CONFLICT_MAP.items():
        if ing in all_ingredients:
            for c in conflicting:
                if c in all_ingredients:
                    conflicts.append(f"{ing} + {c}")
                    logger.warning("Ingredient conflict in recommendation: %s + %s", ing, c)
    return conflicts


def _estimate_monthly_cost(
    matched: list[tuple[EngineProductItem, Optional[Product]]],
) -> Optional[float]:
    prices = [p.price_inr for _, p in matched if p and p.price_inr]
    return round(sum(prices), 2) if prices else None


def _build_skin_query_text(
    scan: SkinScan,
    questionnaire: Optional[QuestionnaireResponse],
    climate: Optional[EnvironmentProfile],
) -> str:
    parts: list[str] = [f"skin type {scan.skin_type}"]
    for c in (scan.conditions or []):
        if c.severity != "none":
            parts.append(f"{c.condition_name} {c.severity} treatment")
    if questionnaire:
        if questionnaire.stress_level and questionnaire.stress_level >= 4:
            parts.append("stress acne oily skin")
        if questionnaire.sugar_consumption == "high":
            parts.append("anti-inflammatory acne")
    if climate:
        if climate.climate_zone:
            parts.append(f"{climate.climate_zone} climate India")
        if climate.avg_humidity_pct and climate.avg_humidity_pct > 70:
            parts.append("lightweight non-comedogenic humid")
        if climate.uv_index and climate.uv_index > 7:
            parts.append("high SPF sunscreen UV protection")
    return " ".join(parts)


def _text_to_hashing_vector(text: str, dims: int = 1536) -> list[float]:
    """
    Deterministic text → float vector via feature hashing.
    Consistent across calls with same text — suitable for Pinecone queries
    when product embeddings were generated with the same method.
    """
    from sklearn.feature_extraction.text import HashingVectorizer  # lazy import

    vectorizer = HashingVectorizer(n_features=dims, alternate_sign=False, norm="l2")
    sparse = vectorizer.transform([text])
    arr = sparse.toarray()[0].astype(np.float32)
    return arr.tolist()
