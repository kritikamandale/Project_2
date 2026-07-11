"""
Recommendation engine — Claude API + Pinecone product retrieval + DB persistence.

Flow:
  1. Fetch scan, questionnaire, climate profile from DB
  2. Retrieve candidate products (Pinecone → PostgreSQL fallback)
  3. Call Claude API with structured dermatologist prompt
  4. Parse + validate Claude JSON (ingredient conflicts, allergen check)
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
from app.schemas.recommendation import ClaudeOutput, ClaudeProductItem
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
# Claude prompt templates
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a board-certified dermatologist specialising in Indian skin types and Indian climate conditions.
You recommend only from the provided product catalog (Nykaa, Minimalist, Dermaco brands).
Every recommendation must include:
1. The specific skin condition or need it addresses
2. The key ingredient that makes it effective
3. Why it is suitable for the user's skin tone (Fitzpatrick scale) and climate
4. When in the 3–5 month roadmap to introduce it (start_week, phase 1/2/3)
5. How to use it (morning/night/frequency)

Never recommend more than 5 products total. Prioritise the most impactful interventions first.
Return your response as valid JSON matching exactly this schema — no markdown, no extra keys:
{
  "skin_score": <float 0-100>,
  "overall_confidence": <float 0-1>,
  "products": [
    {
      "category": <str>,
      "name": <exact product name from catalog>,
      "brand": <str>,
      "reason": <str — condition this addresses>,
      "key_ingredient": <str>,
      "usage": <str — how to use>,
      "time_of_day": <"morning"|"night"|"both"|"weekly">,
      "phase": <1|2|3>,
      "start_week": <int 1-20>,
      "fitzpatrick_note": <str — why safe for this tone>,
      "climate_note": <str — why suited to this climate>,
      "confidence": <float 0-1>
    }
  ],
  "morning_routine": [<ordered step strings>],
  "night_routine": [<ordered step strings>],
  "ingredients_to_use": [<str>],
  "ingredients_to_avoid": [<str>],
  "lifestyle_tips": [<str, max 3>],
  "dermatologist_note": <str>,
  "climate_insight": <str — one sentence about city climate impact>
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

    # Sanitize all free-text fields before inserting into the Claude prompt
    # to prevent prompt injection attacks.
    known_allergens = sanitize_text(routine.known_allergens_text) if routine and routine.known_allergens_text else "none"
    medication_name = sanitize_text(questionnaire.medication_name_text) if questionnaire and hasattr(questionnaire, "medication_name_text") and questionnaire.medication_name_text else ""
    diagnosed_raw = questionnaire.diagnosed_conditions or [] if questionnaire else []
    diagnosed = ", ".join(sanitize_text(d) for d in diagnosed_raw) if diagnosed_raw else "none"

    return f"""Patient Profile:
- Skin type: {scan.skin_type}, Fitzpatrick tone: {fitzpatrick}
- City: {climate.city if climate else 'unknown'}, Humidity: {f"{climate.avg_humidity_pct:.0f}%" if climate and climate.avg_humidity_pct else 'unknown'}, UV index: {climate.uv_index if climate else 'unknown'}
- Climate zone: {climate.climate_zone if climate else 'unknown'}, Water hardness: {climate.water_hardness if climate else 'unknown'}
- Top skin conditions: {conditions_summary}
- Sleep: {f"{questionnaire.sleep_hours_avg:.1f} hrs" if questionnaire and questionnaire.sleep_hours_avg else 'unknown'}, Stress: {f"{questionnaire.stress_level}/5" if questionnaire and questionnaire.stress_level else 'unknown'}
- Diet: {questionnaire.diet_type if questionnaire else 'unknown'}, Sugar: {questionnaire.sugar_consumption if questionnaire else 'unknown'}, Dairy: {questionnaire.dairy_consumption if questionnaire else 'unknown'}
- Current routine: {current_routine_summary}
- Known allergies: <allergens>{known_allergens}</allergens>
- Diagnosed conditions: <conditions>{diagnosed}</conditions>
- Medication affecting skin: {questionnaire.medication_affects_skin if questionnaire else 'unknown'}{f' ({medication_name})' if medication_name else ''}

Available products to choose from:
{json.dumps(candidates, indent=2, ensure_ascii=False)}

Generate a 20-week skincare roadmap phased as follows:
- Phase 1 (Weeks 1–4): Basics only — gentle cleanser + moisturiser + sunscreen
- Phase 2 (Weeks 5–12): Address primary concern — add 1 targeted treatment
- Phase 3 (Weeks 13–20): Optimise — add secondary treatment or booster (optional)

Select at most 5 products total. Prioritise patient safety — if diagnosed conditions exist, be conservative."""


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


def _normalize_claude_output(parsed_dict: dict) -> None:
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

        # 4. Call Claude
        claude_output = await self._call_claude(scan, questionnaire, routine, climate, user, candidates_dicts)

        # 5. Match Claude names back to DB products
        matched_products = _match_products_to_db(claude_output.products, candidates_orm)

        # 6. Validate
        allergen_flags = _check_allergens(matched_products, routine)
        ingredient_conflicts = _check_ingredient_conflicts(claude_output.products)
        if ingredient_conflicts:
            logger.warning(
                "Ingredient conflicts detected for user %s — flagging for derm review: %s",
                user.id, ingredient_conflicts,
            )

        # 7. Compute cost
        monthly_cost = _estimate_monthly_cost(matched_products)

        # 8. Determine if derm review needed
        diagnosed = questionnaire.diagnosed_conditions if questionnaire else None

        # Free text that goes straight into the LLM prompt — if any of it reads
        # like an attempt to override the system prompt, don't trust the
        # model's own self-reported confidence for this request; force review.
        free_text_inputs = [
            routine.known_allergens_text if routine else None,
            questionnaire.medication_name_text if questionnaire and hasattr(questionnaire, "medication_name_text") else None,
            *(diagnosed or []),
        ]
        injection_suspected = any(looks_like_prompt_injection(t) for t in free_text_inputs)
        if injection_suspected:
            logger.warning("Possible prompt-injection attempt in free text for user %s — forcing derm review.", user.id)

        needs_review = (
            claude_output.overall_confidence < 0.75
            or bool(diagnosed and any(d not in ("none", "prefer_not_to_say") for d in diagnosed))
            or bool(allergen_flags)
            or bool(ingredient_conflicts)  # unsafe combos always require derm review
            or injection_suspected
        )

        # Merge conflict info into allergen_flags so the UI surfaces them
        if ingredient_conflicts:
            allergen_flags = list(allergen_flags) + [f"Ingredient conflict: {c}" for c in ingredient_conflicts]

        # 9. Build roadmap JSON
        roadmap_dict = generate_roadmap(
            products=claude_output.products,
            conditions=[c.condition_name for c in (scan.conditions or []) if c.severity != "none"],
            climate=climate,
        )

        # 10. Persist
        recommendation = await self._persist(
            scan=scan,
            questionnaire=questionnaire,
            user=user,
            claude_output=claude_output,
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
        stmt = select(Product).where(Product.is_active.is_(True))

        # Filter by climate zone if available
        if climate and climate.climate_zone:
            stmt = stmt.where(
                Product.climate_zones_suitable.contains([climate.climate_zone])
            )

        # Filter by skin type
        if scan.skin_type:
            stmt = stmt.where(
                Product.skin_types_suitable.contains([scan.skin_type])
            )

        # Match on the user's *issue*, not just skin type + climate: keep only
        # products that target at least one of the scan's active conditions.
        # Additive and relaxable — the fallback below rescues an empty result.
        active_conditions = [
            c.condition_name for c in (scan.conditions or []) if c.severity != "none"
        ]
        if active_conditions:
            stmt = stmt.where(
                Product.targets_conditions.overlap(active_conditions)
            )

        stmt = stmt.limit(top_k)
        rows = await db.scalars(stmt)
        products = list(rows.all())

        # If strict filtering returned too few, relax the condition filter first
        # (keep skin type + climate), then fall back to all active products.
        if len(products) < 10 and active_conditions:
            relaxed = select(Product).where(Product.is_active.is_(True))
            if climate and climate.climate_zone:
                relaxed = relaxed.where(
                    Product.climate_zones_suitable.contains([climate.climate_zone])
                )
            if scan.skin_type:
                relaxed = relaxed.where(
                    Product.skin_types_suitable.contains([scan.skin_type])
                )
            products = list((await db.scalars(relaxed.limit(top_k))).all())

        if len(products) < 10:
            rows = await db.scalars(
                select(Product).where(Product.is_active.is_(True)).limit(top_k)
            )
            products = list(rows.all())

        return products

    # ------------------------------------------------------------------
    # Step 2: Claude API call
    # ------------------------------------------------------------------

    async def _call_claude(
        self,
        scan: SkinScan,
        questionnaire: Optional[QuestionnaireResponse],
        routine: Optional[SkincareRoutineCurrent],
        climate: Optional[EnvironmentProfile],
        user: User,
        candidates: list[dict],
    ) -> ClaudeOutput:
        if not settings.groq_api_key:
            raise ValueError(
                "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys "
                "and add it to apps/api/.env"
            )

        user_prompt = _build_user_prompt(scan, questionnaire, routine, climate, user, candidates)
        raw_text = await _call_groq_api(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=settings.groq_max_tokens,
        )

        try:
            parsed_dict = json.loads(raw_text)
            _normalize_claude_output(parsed_dict)
            return ClaudeOutput(**parsed_dict)
        except Exception as exc:
            logger.error("Groq JSON parse failed: %s\nRaw: %s", exc, raw_text[:500])
            raise ValueError(f"AI model returned invalid JSON: {exc}") from exc

    # ------------------------------------------------------------------
    # Step 3: Persist to DB
    # ------------------------------------------------------------------

    async def _persist(
        self,
        scan: SkinScan,
        questionnaire: Optional[QuestionnaireResponse],
        user: User,
        claude_output: ClaudeOutput,
        matched_products: list[tuple[ClaudeProductItem, Optional[Product]]],
        roadmap_dict: dict,
        allergen_flags: list[str],
        monthly_cost: Optional[float],
        needs_review: bool,
        db: AsyncSession,
    ) -> Recommendation:
        metadata = {
            "lifestyle_tips": claude_output.lifestyle_tips,
            "ingredients_to_use": claude_output.ingredients_to_use,
            "ingredients_to_avoid": claude_output.ingredients_to_avoid,
            "dermatologist_note": claude_output.dermatologist_note,
            "climate_insight": claude_output.climate_insight,
            "morning_routine": claude_output.morning_routine,
            "night_routine": claude_output.night_routine,
        }

        rec = Recommendation(
            id=uuid.uuid4(),
            user_id=user.id,
            scan_id=scan.id,
            questionnaire_id=questionnaire.id if questionnaire else None,
            recommendation_engine_version="2.0",
            ai_reasoning=claude_output.dermatologist_note,
            roadmap_weeks=20,
            skin_score=claude_output.skin_score,
            confidence_score=claude_output.overall_confidence,
            estimated_monthly_cost_inr=monthly_cost,
            roadmap_json=roadmap_dict,
            allergen_flags=allergen_flags or None,
            requires_derm_review=needs_review,
            metadata_json=metadata,
        )
        db.add(rec)
        await db.flush()  # populate rec.id

        for order, (claude_item, product) in enumerate(matched_products):
            if product is None:
                continue
            rp = RecommendationProduct(
                id=uuid.uuid4(),
                recommendation_id=rec.id,
                product_id=product.id,
                order_in_routine=order,
                start_week=claude_item.start_week,
                reason_text=claude_item.reason,
                is_mandatory=claude_item.phase == 1,
                phase=claude_item.phase,
                highlighted_ingredient=claude_item.key_ingredient,
                usage_instruction=claude_item.usage,
                time_of_day=claude_item.time_of_day,
            )
            db.add(rp)

        # Queue for derm review if needed
        if needs_review and settings.enable_dermatologist_review:
            priority = (
                "high"
                if allergen_flags or claude_output.overall_confidence < 0.6
                else "normal"
            )
            queue_entry = ReviewQueue(
                id=uuid.uuid4(),
                recommendation_id=rec.id,
                priority=priority,
                status="pending",
            )
            db.add(queue_entry)

        # Automatically link this scan to progress tracking (ProgressScan & ProgressMetric)
        # Check if a ProgressScan already exists for this scan to prevent duplicates
        progress_exists = await db.scalar(
            select(ProgressScan).where(ProgressScan.scan_id == scan.id)
        )
        if not progress_exists:
            # Count existing progress scans for the user to determine the scan number
            count_result = await db.execute(
                select(func.count(ProgressScan.id)).where(
                    ProgressScan.user_id == user.id
                )
            )
            scan_number = (count_result.scalar() or 0) + 1

            # Fetch baseline for delta calculation
            baseline_score = None
            if scan_number > 1:
                baseline = await db.scalar(
                    select(ProgressScan).where(
                        ProgressScan.user_id == user.id,
                        ProgressScan.scan_number == 1,
                    )
                )
                if baseline:
                    baseline_score = baseline.overall_skin_score
            
            delta = round(claude_output.skin_score - baseline_score, 2) if baseline_score is not None else 0.0

            progress_scan = ProgressScan(
                id=uuid.uuid4(),
                user_id=user.id,
                recommendation_id=rec.id,
                scan_id=scan.id,
                scan_number=scan_number,
                scanned_at=scan.scan_timestamp,
                overall_skin_score=claude_output.skin_score,
                delta_from_baseline=delta,
            )
            db.add(progress_scan)
            await db.flush()

            # Create ProgressMetric rows from the scan's conditions
            # Compare to previous scan's condition scores where available
            prev_condition_map: dict[str, float] = {}
            if scan_number > 1:
                prev_scan = await db.scalar(
                    select(ProgressScan)
                    .options(selectinload(ProgressScan.metrics))
                    .where(
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
    claude_items: list[ClaudeProductItem],
    candidates: list[Product],
) -> list[tuple[ClaudeProductItem, Optional[Product]]]:
    name_map = {p.product_name.lower(): p for p in candidates}
    brand_map: dict[str, list[Product]] = {}
    for p in candidates:
        brand_map.setdefault(p.brand.lower(), []).append(p)

    results: list[tuple[ClaudeProductItem, Optional[Product]]] = []
    for item in claude_items:
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
    matched: list[tuple[ClaudeProductItem, Optional[Product]]],
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


def _check_ingredient_conflicts(items: list[ClaudeProductItem]) -> list[str]:
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
    matched: list[tuple[ClaudeProductItem, Optional[Product]]],
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
