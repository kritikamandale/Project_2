"""Questionnaire router — lifestyle context for skin analysis recommendations."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_verified_user
from app.core.limiter import limiter
from app.models.questionnaire import (
    EnvironmentProfile,
    QuestionnaireResponse,
    SkincareRoutineCurrent,
)
from app.schemas.questionnaire import (
    ClimateEnrichRequest,
    ClimateProfileResponse,
    QuestionnaireDetailResponse,
    QuestionnaireSubmitRequest,
    QuestionnaireSubmitResponse,
    QuestionnaireUpdateRequest,
    RoutineDetail,
)
from app.services import climate_service, onboarding_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_routine_flags(steps: list[str]) -> dict:
    return {
        "uses_cleanser":    "cleanser"    in steps,
        "uses_toner":       "toner"       in steps,
        "uses_moisturiser": "moisturiser" in steps,
        "uses_sunscreen":   "sunscreen"   in steps,
        "uses_serum":       "serum"       in steps,
        "uses_exfoliant":   "exfoliant"   in steps,
        "uses_face_mask":   "face_mask"   in steps,
        "uses_nothing":     "nothing"     in steps,
    }


async def _upsert_environment_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
    city: str,
    water_hardness: str,
) -> dict | None:
    """Fetch climate data and upsert EnvironmentProfile. Returns the raw data dict or None."""
    climate_data = await climate_service.fetch_climate_data(city)
    if climate_data is None:
        return None

    climate_data["water_hardness"] = water_hardness

    result = await db.execute(
        select(EnvironmentProfile).where(EnvironmentProfile.user_id == user_id)
    )
    env = result.scalar_one_or_none()

    if env is None:
        env = EnvironmentProfile(user_id=user_id)
        db.add(env)

    env.city = climate_data["city"]
    env.state = climate_data["state"]
    env.avg_temperature_c = climate_data["avg_temperature_c"]
    env.avg_humidity_pct = climate_data["avg_humidity_pct"]
    env.uv_index = climate_data["uv_index"]
    env.climate_zone = climate_data["climate_zone"]
    env.water_hardness = water_hardness
    env.last_updated = datetime.now(timezone.utc)

    return climate_data


# ---------------------------------------------------------------------------
# POST /submit
# ---------------------------------------------------------------------------

@router.post("/submit", response_model=QuestionnaireSubmitResponse, status_code=status.HTTP_201_CREATED)
async def submit_questionnaire(
    body: QuestionnaireSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """
    Save the full 7-section lifestyle questionnaire, trigger climate enrichment,
    and return the questionnaire_id plus the populated climate profile card.
    """
    q = QuestionnaireResponse(
        user_id=current_user.id,
        # S1
        sleep_hours_avg=body.sleep_hours_avg,
        sleep_quality=body.sleep_quality,
        sleep_consistency=body.sleep_consistency,
        # S2
        water_intake_liters=body.water_intake_liters,
        diet_type=body.diet_type,
        sugar_consumption=body.sugar_consumption,
        dairy_consumption=body.dairy_consumption,
        # S3
        stress_level=body.stress_level,
        stress_source=body.stress_source,
        exercise_frequency=body.exercise_frequency,
        # S4
        screen_time_hours=body.screen_time_hours,
        work_environment=body.work_environment,
        pollution_exposure=body.pollution_exposure,
        # S6 details
        cleanser_frequency=body.cleanser_frequency,
        sunscreen_use=body.sunscreen_use,
        # S7
        diagnosed_conditions=body.diagnosed_conditions,
        medication_affects_skin=body.medication_affects_skin,
        medication_name_text=body.medication_name_text if body.medication_affects_skin else None,
        # S8 — stored as JSONB so new fields can be added without migrations
        extra_lifestyle={k: v for k, v in {
            "spicy_food_frequency":  body.spicy_food_frequency,
            "junk_food_frequency":   body.junk_food_frequency,
            "fruits_veggies_per_day": body.fruits_veggies_per_day,
            "bedtime":               body.bedtime,
            "phone_before_bed":      body.phone_before_bed,
            "sleep_environment":     body.sleep_environment,
            "daily_sun_exposure":    body.daily_sun_exposure,
            "smoking_status":        body.smoking_status,
            "alcohol_consumption":   body.alcohol_consumption,
        }.items() if v is not None} or None,
        questionnaire_version=2,
    )
    db.add(q)

    # Upsert skincare routine
    result = await db.execute(
        select(SkincareRoutineCurrent).where(SkincareRoutineCurrent.user_id == current_user.id)
    )
    routine = result.scalar_one_or_none()
    if routine is None:
        routine = SkincareRoutineCurrent(user_id=current_user.id)
        db.add(routine)

    flags = _build_routine_flags(body.routine_steps)
    for attr, val in flags.items():
        setattr(routine, attr, val)
    routine.known_allergens_text = body.known_allergens_text
    if body.products_currently_using:
        routine.products_currently_using = {"text": body.products_currently_using}

    # Climate enrichment
    climate_data = await _upsert_environment_profile(
        db, current_user.id, body.city, body.water_hardness
    )

    # Step 1 of onboarding complete — advance the gate (advance-only, USER role only).
    onboarding_service.advance_onboarding(current_user, "questionnaire_done")

    await db.flush()
    await db.commit()
    await db.refresh(q)

    climate_profile = ClimateProfileResponse(**climate_data) if climate_data else None

    return QuestionnaireSubmitResponse(
        questionnaire_id=str(q.id),
        message="Questionnaire saved. Your personalised analysis is ready.",
        climate_profile=climate_profile,
    )


# ---------------------------------------------------------------------------
# POST /climate-enrich
# ---------------------------------------------------------------------------

@router.post("/climate-enrich", response_model=ClimateProfileResponse)
@limiter.limit("20/minute")
async def climate_enrich(
    request: Request,
    body: ClimateEnrichRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """
    Fetch current climate data for a city and preview the climate profile card.
    Does NOT save permanently — use /submit to persist.
    """
    data = await climate_service.fetch_climate_data(body.city)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Climate data unavailable for '{body.city}'. Check the city name and try again.",
        )
    return ClimateProfileResponse(**data)


# ---------------------------------------------------------------------------
# GET /latest
# ---------------------------------------------------------------------------

@router.get("/latest", response_model=QuestionnaireDetailResponse)
async def get_latest_questionnaire(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Return the most recent questionnaire response for the authenticated user."""
    result = await db.execute(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.user_id == current_user.id)
        .order_by(QuestionnaireResponse.submitted_at.desc())
        .limit(1)
    )
    q = result.scalar_one_or_none()
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No questionnaire found. Please complete the lifestyle questionnaire first.",
        )

    env_result = await db.execute(
        select(EnvironmentProfile).where(EnvironmentProfile.user_id == current_user.id)
    )
    env = env_result.scalar_one_or_none()

    routine_result = await db.execute(
        select(SkincareRoutineCurrent).where(SkincareRoutineCurrent.user_id == current_user.id)
    )
    routine = routine_result.scalar_one_or_none()

    climate_profile = None
    if env and env.avg_temperature_c is not None:
        climate_profile = ClimateProfileResponse(
            city=env.city or "",
            state=env.state or "",
            avg_temperature_c=env.avg_temperature_c,
            avg_humidity_pct=env.avg_humidity_pct or 0,
            uv_index=env.uv_index or 0,
            water_hardness=env.water_hardness,
            climate_zone=env.climate_zone or "semi_arid",
        )

    return QuestionnaireDetailResponse(
        id=q.id,
        submitted_at=q.submitted_at,
        questionnaire_version=q.questionnaire_version or 2,
        sleep_hours_avg=q.sleep_hours_avg,
        sleep_quality=q.sleep_quality,
        sleep_consistency=q.sleep_consistency,
        water_intake_liters=q.water_intake_liters,
        diet_type=q.diet_type,
        sugar_consumption=q.sugar_consumption,
        dairy_consumption=q.dairy_consumption,
        stress_level=q.stress_level,
        stress_source=q.stress_source,
        exercise_frequency=q.exercise_frequency,
        screen_time_hours=q.screen_time_hours,
        work_environment=q.work_environment,
        pollution_exposure=q.pollution_exposure,
        cleanser_frequency=q.cleanser_frequency,
        sunscreen_use=q.sunscreen_use,
        diagnosed_conditions=q.diagnosed_conditions,
        medication_affects_skin=q.medication_affects_skin,
        climate_profile=climate_profile,
        routine=RoutineDetail.model_validate(routine) if routine else None,
    )


# ---------------------------------------------------------------------------
# GET /history — paginated questionnaire submissions, newest first
# ---------------------------------------------------------------------------

class QuestionnaireHistoryItem(BaseModel):
    id: uuid.UUID
    submitted_at: datetime
    # Nullable in the DB (default is applied ORM-side, not as a server default)
    questionnaire_version: Optional[int] = None
    # Lightweight lifestyle summary for the history card
    sleep_hours_avg: Optional[float] = None
    stress_level: Optional[int] = None
    water_intake_liters: Optional[float] = None
    diet_type: Optional[str] = None
    screen_time_hours: Optional[float] = None
    sunscreen_use: Optional[str] = None
    exercise_frequency: Optional[str] = None

    model_config = {"from_attributes": True}


class PaginatedQuestionnaires(BaseModel):
    items: list[QuestionnaireHistoryItem]
    total: int
    page: int
    per_page: int
    has_more: bool


@router.get("/history", response_model=PaginatedQuestionnaires)
async def questionnaire_history(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Return paginated questionnaire history for the authenticated user, newest first."""
    offset = (page - 1) * per_page

    total = (
        await db.execute(
            select(func.count(QuestionnaireResponse.id)).where(
                QuestionnaireResponse.user_id == current_user.id
            )
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(QuestionnaireResponse)
            .where(QuestionnaireResponse.user_id == current_user.id)
            .order_by(QuestionnaireResponse.submitted_at.desc())
            .offset(offset)
            .limit(per_page)
        )
    ).scalars().all()

    return PaginatedQuestionnaires(
        items=[QuestionnaireHistoryItem.model_validate(q) for q in rows],
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + per_page) < total,
    )


# ---------------------------------------------------------------------------
# PUT /{questionnaire_id}
# ---------------------------------------------------------------------------

@router.put("/{questionnaire_id}", response_model=QuestionnaireDetailResponse)
async def update_questionnaire(
    questionnaire_id: uuid.UUID,
    body: QuestionnaireUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """
    Partial update of a questionnaire (re-assessment after 30 days).
    Only the submitting user may update their own record.
    """
    result = await db.execute(
        select(QuestionnaireResponse).where(
            QuestionnaireResponse.id == questionnaire_id,
            QuestionnaireResponse.user_id == current_user.id,
        )
    )
    q = result.scalar_one_or_none()
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found.",
        )

    updates = body.model_dump(exclude_unset=True)
    city_changed = "city" in updates

    for field, value in updates.items():
        if hasattr(q, field):
            setattr(q, field, value)

    new_city = updates.get("city") or q.__dict__.get("_city")
    new_hardness = updates.get("water_hardness")

    if city_changed and new_city:
        await _upsert_environment_profile(
            db,
            current_user.id,
            new_city,
            new_hardness or "moderate",
        )

    await db.commit()
    await db.refresh(q)

    # Re-use GET /latest logic to build response
    env_result = await db.execute(
        select(EnvironmentProfile).where(EnvironmentProfile.user_id == current_user.id)
    )
    env = env_result.scalar_one_or_none()

    routine_result = await db.execute(
        select(SkincareRoutineCurrent).where(SkincareRoutineCurrent.user_id == current_user.id)
    )
    routine = routine_result.scalar_one_or_none()

    climate_profile = None
    if env and env.avg_temperature_c is not None:
        climate_profile = ClimateProfileResponse(
            city=env.city or "",
            state=env.state or "",
            avg_temperature_c=env.avg_temperature_c,
            avg_humidity_pct=env.avg_humidity_pct or 0,
            uv_index=env.uv_index or 0,
            water_hardness=env.water_hardness,
            climate_zone=env.climate_zone or "semi_arid",
        )

    return QuestionnaireDetailResponse(
        id=q.id,
        submitted_at=q.submitted_at,
        questionnaire_version=q.questionnaire_version or 2,
        sleep_hours_avg=q.sleep_hours_avg,
        sleep_quality=q.sleep_quality,
        sleep_consistency=q.sleep_consistency,
        water_intake_liters=q.water_intake_liters,
        diet_type=q.diet_type,
        sugar_consumption=q.sugar_consumption,
        dairy_consumption=q.dairy_consumption,
        stress_level=q.stress_level,
        stress_source=q.stress_source,
        exercise_frequency=q.exercise_frequency,
        screen_time_hours=q.screen_time_hours,
        work_environment=q.work_environment,
        pollution_exposure=q.pollution_exposure,
        cleanser_frequency=q.cleanser_frequency,
        sunscreen_use=q.sunscreen_use,
        diagnosed_conditions=q.diagnosed_conditions,
        medication_affects_skin=q.medication_affects_skin,
        climate_profile=climate_profile,
        routine=RoutineDetail.model_validate(routine) if routine else None,
    )


# ---------------------------------------------------------------------------
# GET /cities  (autocomplete helper)
# ---------------------------------------------------------------------------

@router.get("/cities", response_model=list[str])
async def list_cities():
    """Return sorted list of supported Indian cities for autocomplete."""
    return climate_service.list_cities()
