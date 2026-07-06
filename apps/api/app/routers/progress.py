"""
Progress router — Phase 7 progress tracking & monthly re-scan system.

Endpoints:
  POST   /progress/scan               — Link new scan, compute delta metrics
  GET    /progress/timeline           — All scans with scores for chart
  GET    /progress/conditions         — Per-condition improvement over time
  POST   /progress/routine-checkin    — Log daily routine adherence
  GET    /progress/adherence          — Adherence heatmap (last 90 days)
  POST   /progress/product-feedback   — Rate product effectiveness
  GET    /progress/summary            — Full dashboard summary
  GET    /progress/notifications      — In-app notification bell
  PATCH  /progress/notifications/{id}/read — Mark notification read
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional

import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_verified_user
from app.models.progress import (
    InAppNotification,
    ProductFeedback,
    ProgressMetric,
    ProgressScan,
    RoutineCheckin,
)
from app.models.recommendation import Recommendation, RecommendationProduct
from app.schemas.progress import (
    AdherenceHeatmapResponse,
    AlertItem,
    ConditionProgressItem,
    ConditionsProgressResponse,
    HeatmapDay,
    InAppNotificationResponse,
    ProductEffectivenessItem,
    ProductFeedbackCreate,
    ProductFeedbackResponse,
    ProgressMetricResponse,
    ProgressScanCreate,
    ProgressScanResponse,
    ProgressSummaryResponse,
    RoutineCheckinCreate,
    RoutineCheckinResponse,
    TimelinePoint,
    TimelineResponse,
)

router = APIRouter()

SEVERITY_MAP = {"none": 0, "mild": 1, "moderate": 2, "severe": 3}
HEALTHY_BASELINE = 80.0   # score target for improvement % calculation


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_streak(checkins_by_date: dict[date, str]) -> int:
    """Count consecutive days (from today) with yes or mostly adherence."""
    streak = 0
    check = date.today()
    while True:
        level = checkins_by_date.get(check)
        if level in ("yes", "mostly"):
            streak += 1
            check -= timedelta(days=1)
        else:
            break
    return streak


def _compute_longest_streak(checkins_by_date: dict[date, str]) -> int:
    if not checkins_by_date:
        return 0
    all_dates = sorted(checkins_by_date.keys())
    longest = current = 0
    prev: Optional[date] = None
    for d in all_dates:
        level = checkins_by_date[d]
        if level not in ("yes", "mostly"):
            current = 0
            prev = d
            continue
        if prev is not None and (d - prev).days == 1:
            current += 1
        else:
            current = 1
        longest = max(longest, current)
        prev = d
    return longest


def _days_until_rescan(last_scan_at: Optional[datetime]) -> tuple[Optional[int], bool]:
    """Returns (days_remaining, is_overdue). 30-day re-scan cadence."""
    if last_scan_at is None:
        return None, False
    now = datetime.now(timezone.utc)
    if last_scan_at.tzinfo is None:
        last_scan_at = last_scan_at.replace(tzinfo=timezone.utc)
    next_scan = last_scan_at + timedelta(days=30)
    delta = (next_scan - now).days
    if delta <= 0:
        return None, True
    return delta, False


# ---------------------------------------------------------------------------
# POST /scan
# ---------------------------------------------------------------------------

@router.post("/scan", response_model=ProgressScanResponse, status_code=status.HTTP_201_CREATED)
async def create_progress_scan(
    body: ProgressScanCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Link a new scan result to an existing recommendation and compute delta metrics."""
    # Validate recommendation ownership
    rec_result = await db.execute(
        select(Recommendation).where(
            Recommendation.id == body.recommendation_id,
            Recommendation.user_id == current_user.id,
        )
    )
    recommendation = rec_result.scalar_one_or_none()
    if recommendation is None:
        raise HTTPException(status_code=404, detail="Recommendation not found.")

    # Count existing scans to assign scan_number
    count_result = await db.execute(
        select(func.count(ProgressScan.id)).where(
            ProgressScan.user_id == current_user.id,
            ProgressScan.recommendation_id == body.recommendation_id,
        )
    )
    scan_number = (count_result.scalar() or 0) + 1

    # Fetch baseline (scan_number=1) for delta
    baseline_result = await db.execute(
        select(ProgressScan).where(
            ProgressScan.user_id == current_user.id,
            ProgressScan.recommendation_id == body.recommendation_id,
            ProgressScan.scan_number == 1,
        )
    )
    baseline = baseline_result.scalar_one_or_none()
    baseline_score = baseline.overall_skin_score if baseline else body.overall_skin_score
    delta = round(body.overall_skin_score - baseline_score, 2) if baseline else 0.0

    # Build ProgressScan
    progress_scan = ProgressScan(
        user_id=current_user.id,
        recommendation_id=body.recommendation_id,
        scan_id=body.scan_id,
        scan_number=scan_number,
        overall_skin_score=body.overall_skin_score,
        delta_from_baseline=delta,
        notes=body.notes,
    )
    db.add(progress_scan)
    await db.flush()  # get progress_scan.id

    # Build ProgressMetrics from condition_scores
    # Compare to previous scan's condition scores where available
    prev_condition_map: dict[str, float] = {}
    if baseline and scan_number > 1:
        prev_scan_result = await db.execute(
            select(ProgressScan)
            .options(selectinload(ProgressScan.metrics))
            .where(
                ProgressScan.user_id == current_user.id,
                ProgressScan.recommendation_id == body.recommendation_id,
                ProgressScan.scan_number == scan_number - 1,
            )
        )
        prev_scan = prev_scan_result.scalar_one_or_none()
        if prev_scan:
            prev_condition_map = {m.metric_name: m.current_value for m in prev_scan.metrics}

    for cs in body.condition_scores:
        prev_val = prev_condition_map.get(cs.condition, cs.severity)
        improvement_pct = (
            round(((prev_val - cs.severity) / max(prev_val, 1)) * 100, 2)
            if prev_val > 0
            else 0.0
        )
        metric = ProgressMetric(
            progress_scan_id=progress_scan.id,
            metric_name=cs.condition,
            previous_value=prev_val,
            current_value=float(cs.severity),
            improvement_pct=improvement_pct,
        )
        db.add(metric)

    await db.commit()
    await db.refresh(progress_scan)
    # Reload metrics
    loaded = await db.execute(
        select(ProgressScan)
        .options(selectinload(ProgressScan.metrics))
        .where(ProgressScan.id == progress_scan.id)
    )
    progress_scan = loaded.scalar_one()

    # Celebration / slow-progress flags
    celebration = delta >= 20.0
    weeks_elapsed = (datetime.now(timezone.utc) - (
        baseline.scanned_at if baseline else datetime.now(timezone.utc)
    )).days // 7
    slow_progress = (
        scan_number >= 2
        and weeks_elapsed >= 8
        and abs(delta) < (baseline_score * 0.05 if baseline_score else 5)
    )

    metrics_out = [
        ProgressMetricResponse(
            id=m.id,
            metric_name=m.metric_name,
            previous_value=m.previous_value,
            current_value=m.current_value,
            improvement_pct=m.improvement_pct,
        )
        for m in progress_scan.metrics
    ]

    return ProgressScanResponse(
        id=progress_scan.id,
        user_id=progress_scan.user_id,
        recommendation_id=progress_scan.recommendation_id,
        scan_id=progress_scan.scan_id,
        scan_number=progress_scan.scan_number,
        scanned_at=progress_scan.scanned_at,
        overall_skin_score=progress_scan.overall_skin_score,
        delta_from_baseline=progress_scan.delta_from_baseline,
        notes=progress_scan.notes,
        metrics=metrics_out,
        celebration_threshold_met=celebration,
        slow_progress_flag=slow_progress,
    )


# ---------------------------------------------------------------------------
# GET /timeline
# ---------------------------------------------------------------------------

@router.get("/timeline", response_model=TimelineResponse)
async def get_timeline(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """All progress scans with scores, for the skin score LineChart."""
    result = await db.execute(
        select(ProgressScan)
        .where(ProgressScan.user_id == current_user.id)
        .order_by(ProgressScan.scanned_at.asc())
    )
    scans = result.scalars().all()

    if not scans:
        return TimelineResponse(user_id=current_user.id, total_scans=0)

    baseline_score = scans[0].overall_skin_score
    latest_score = scans[-1].overall_skin_score
    total_improvement = (
        round(latest_score - baseline_score, 2)
        if latest_score is not None and baseline_score is not None
        else None
    )
    # % progress toward healthy baseline (80)
    improvement_pct = None
    if baseline_score is not None and latest_score is not None and baseline_score < HEALTHY_BASELINE:
        gap = HEALTHY_BASELINE - baseline_score
        improvement_pct = round(min((latest_score - baseline_score) / gap * 100, 100), 1) if gap > 0 else 100.0

    points = [
        TimelinePoint(
            id=s.id,
            scan_number=s.scan_number,
            scanned_at=s.scanned_at,
            overall_skin_score=s.overall_skin_score,
            delta_from_baseline=s.delta_from_baseline,
        )
        for s in scans
    ]

    return TimelineResponse(
        user_id=current_user.id,
        total_scans=len(scans),
        baseline_score=baseline_score,
        latest_score=latest_score,
        total_improvement=total_improvement,
        improvement_pct=improvement_pct,
        points=points,
    )


# ---------------------------------------------------------------------------
# GET /conditions
# ---------------------------------------------------------------------------

@router.get("/conditions", response_model=ConditionsProgressResponse)
async def get_conditions_progress(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Per-condition improvement over time, for condition cards."""
    result = await db.execute(
        select(ProgressScan)
        .options(selectinload(ProgressScan.metrics))
        .where(ProgressScan.user_id == current_user.id)
        .order_by(ProgressScan.scan_number.asc())
    )
    scans = result.scalars().all()

    # Aggregate metrics per condition across all scans
    condition_data: dict[str, dict] = {}
    for scan in scans:
        for m in scan.metrics:
            name = m.metric_name
            if name not in condition_data:
                condition_data[name] = {
                    "baseline": m.previous_value,
                    "latest": m.current_value,
                    "history": [m.current_value],
                }
            else:
                condition_data[name]["latest"] = m.current_value
                if m.current_value is not None:
                    condition_data[name]["history"].append(m.current_value)

    conditions = []
    for cname, data in condition_data.items():
        baseline_sev = data["baseline"]
        latest_sev = data["latest"]
        improvement_pct = None
        status = "unchanged"
        if baseline_sev is not None and latest_sev is not None:
            diff = baseline_sev - latest_sev   # positive = severity went down = improved
            if baseline_sev > 0:
                improvement_pct = round(diff / baseline_sev * 100, 1)
            if diff > 0.5:
                status = "improved"
            elif diff < -0.5:
                status = "worsened"
        conditions.append(
            ConditionProgressItem(
                condition=cname,
                baseline_severity=baseline_sev,
                latest_severity=latest_sev,
                improvement_pct=improvement_pct,
                status=status,
                scan_history=data["history"],
            )
        )

    return ConditionsProgressResponse(user_id=current_user.id, conditions=conditions)


# ---------------------------------------------------------------------------
# POST /routine-checkin
# ---------------------------------------------------------------------------

@router.post("/routine-checkin", response_model=RoutineCheckinResponse, status_code=status.HTTP_201_CREATED)
async def create_routine_checkin(
    body: RoutineCheckinCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Log (or update) today's routine adherence."""
    checkin_date = body.checkin_date or date.today()

    # Upsert: check if entry already exists for this date
    existing_result = await db.execute(
        select(RoutineCheckin).where(
            RoutineCheckin.user_id == current_user.id,
            RoutineCheckin.checkin_date == checkin_date,
        )
    )
    checkin = existing_result.scalar_one_or_none()

    if checkin:
        checkin.adherence = body.adherence
        checkin.notes = body.notes
    else:
        checkin = RoutineCheckin(
            user_id=current_user.id,
            checkin_date=checkin_date,
            adherence=body.adherence,
            notes=body.notes,
        )
        db.add(checkin)

    await db.commit()
    await db.refresh(checkin)

    # Compute streak
    from_date = date.today() - timedelta(days=89)
    all_result = await db.execute(
        select(RoutineCheckin).where(
            RoutineCheckin.user_id == current_user.id,
            RoutineCheckin.checkin_date >= from_date,
        )
    )
    checkins_by_date = {c.checkin_date: c.adherence for c in all_result.scalars().all()}
    streak = _compute_streak(checkins_by_date)

    return RoutineCheckinResponse(
        id=checkin.id,
        checkin_date=checkin.checkin_date,
        adherence=checkin.adherence,
        notes=checkin.notes,
        current_streak=streak,
    )


# ---------------------------------------------------------------------------
# GET /adherence
# ---------------------------------------------------------------------------

@router.get("/adherence", response_model=AdherenceHeatmapResponse)
async def get_adherence_heatmap(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Adherence heatmap data for last 90 days (GitHub-style calendar)."""
    from_date = date.today() - timedelta(days=89)

    result = await db.execute(
        select(RoutineCheckin).where(
            RoutineCheckin.user_id == current_user.id,
            RoutineCheckin.checkin_date >= from_date,
        ).order_by(RoutineCheckin.checkin_date.asc())
    )
    checkins = result.scalars().all()
    checkins_by_date = {c.checkin_date: c.adherence for c in checkins}

    # Build full 90-day array (nulls for missing days)
    days = [
        HeatmapDay(
            date=from_date + timedelta(days=i),
            adherence=checkins_by_date.get(from_date + timedelta(days=i)),
        )
        for i in range(90)
    ]

    streak = _compute_streak(checkins_by_date)
    longest = _compute_longest_streak(checkins_by_date)

    return AdherenceHeatmapResponse(
        user_id=current_user.id,
        days=days,
        current_streak=streak,
        longest_streak=longest,
        total_checkins=len(checkins),
    )


# ---------------------------------------------------------------------------
# POST /product-feedback
# ---------------------------------------------------------------------------

@router.post("/product-feedback", response_model=ProductFeedbackResponse, status_code=status.HTTP_201_CREATED)
async def rate_product(
    body: ProductFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Rate a recommended product (upsert by user+product)."""
    existing_result = await db.execute(
        select(ProductFeedback).where(
            ProductFeedback.user_id == current_user.id,
            ProductFeedback.product_id == body.product_id,
        )
    )
    feedback = existing_result.scalar_one_or_none()

    if feedback:
        feedback.rating = body.rating
        feedback.notes = body.notes
        if body.recommendation_product_id:
            feedback.recommendation_product_id = body.recommendation_product_id
    else:
        feedback = ProductFeedback(
            user_id=current_user.id,
            product_id=body.product_id,
            recommendation_product_id=body.recommendation_product_id,
            rating=body.rating,
            notes=body.notes,
        )
        db.add(feedback)

    await db.commit()
    await db.refresh(feedback)
    return ProductFeedbackResponse(
        id=feedback.id,
        product_id=feedback.product_id,
        rating=feedback.rating,
        notes=feedback.notes,
    )


# ---------------------------------------------------------------------------
# GET /summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=ProgressSummaryResponse)
async def get_progress_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Aggregated dashboard summary — powers the full progress page."""

    # ── Timeline ──────────────────────────────────────────────────────────
    scans_result = await db.execute(
        select(ProgressScan)
        .options(selectinload(ProgressScan.metrics))
        .where(ProgressScan.user_id == current_user.id)
        .order_by(ProgressScan.scanned_at.asc())
    )
    all_scans = scans_result.scalars().all()

    baseline_score = all_scans[0].overall_skin_score if all_scans else None
    latest_score = all_scans[-1].overall_skin_score if all_scans else None
    total_improvement = (
        round(latest_score - baseline_score, 2)
        if latest_score is not None and baseline_score is not None
        else None
    )
    improvement_pct = None
    if baseline_score is not None and latest_score is not None and baseline_score < HEALTHY_BASELINE:
        gap = HEALTHY_BASELINE - baseline_score
        improvement_pct = round(
            min((latest_score - baseline_score) / gap * 100, 100), 1
        ) if gap > 0 else 100.0

    timeline_points = [
        TimelinePoint(
            id=s.id,
            scan_number=s.scan_number,
            scanned_at=s.scanned_at,
            overall_skin_score=s.overall_skin_score,
            delta_from_baseline=s.delta_from_baseline,
        )
        for s in all_scans[-8:]   # last 8 for chart
    ]

    # ── Conditions ────────────────────────────────────────────────────────
    condition_data: dict[str, dict] = {}
    for scan in all_scans:
        for m in scan.metrics:
            name = m.metric_name
            if name not in condition_data:
                condition_data[name] = {"baseline": m.previous_value, "latest": m.current_value, "history": [m.current_value]}
            else:
                condition_data[name]["latest"] = m.current_value
                if m.current_value is not None:
                    condition_data[name]["history"].append(m.current_value)

    conditions = []
    alerts: list[AlertItem] = []
    for cname, data in condition_data.items():
        b, l = data["baseline"], data["latest"]
        imp_pct = None
        cstatus = "unchanged"
        if b is not None and l is not None:
            diff = b - l
            imp_pct = round(diff / b * 100, 1) if b > 0 else None
            if diff > 0.5:
                cstatus = "improved"
            elif diff < -0.5:
                cstatus = "worsened"
                alerts.append(AlertItem(
                    type="worsened_condition",
                    condition=cname,
                    message=(
                        f"Your {cname.replace('_', ' ')} has worsened. This may be due to "
                        "seasonal changes or new products. Consider reviewing your routine."
                    ),
                ))
        conditions.append(ConditionProgressItem(
            condition=cname,
            baseline_severity=b,
            latest_severity=l,
            improvement_pct=imp_pct,
            status=cstatus,
            scan_history=data["history"],
        ))

    # Slow progress alert
    if (
        len(all_scans) >= 2
        and baseline_score is not None
        and latest_score is not None
    ):
        weeks_elapsed = (all_scans[-1].scanned_at - all_scans[0].scanned_at).days // 7
        if weeks_elapsed >= 8 and (total_improvement or 0) < baseline_score * 0.05:
            alerts.append(AlertItem(
                type="slow_progress",
                message="Your progress has been slower than expected. Our dermatologist team will review your routine.",
            ))

    # ── Adherence ─────────────────────────────────────────────────────────
    from_7 = date.today() - timedelta(days=6)
    adherence_result = await db.execute(
        select(RoutineCheckin).where(
            RoutineCheckin.user_id == current_user.id,
            RoutineCheckin.checkin_date >= date.today() - timedelta(days=89),
        ).order_by(RoutineCheckin.checkin_date.asc())
    )
    all_checkins = adherence_result.scalars().all()
    checkins_by_date = {c.checkin_date: c.adherence for c in all_checkins}
    streak = _compute_streak(checkins_by_date)
    last_7 = [
        HeatmapDay(date=from_7 + timedelta(days=i), adherence=checkins_by_date.get(from_7 + timedelta(days=i)))
        for i in range(7)
    ]

    # ── Product Effectiveness ─────────────────────────────────────────────
    # Fetch latest recommendation's products + user's existing feedback
    latest_rec_result = await db.execute(
        select(Recommendation)
        .options(selectinload(Recommendation.products).selectinload(RecommendationProduct.product))
        .where(Recommendation.user_id == current_user.id)
        .order_by(Recommendation.generated_at.desc())
        .limit(1)
    )
    latest_rec = latest_rec_result.scalar_one_or_none()

    feedback_result = await db.execute(
        select(ProductFeedback).where(ProductFeedback.user_id == current_user.id)
    )
    feedback_map = {pf.product_id: pf.rating for pf in feedback_result.scalars().all()}

    product_effectiveness = []
    if latest_rec:
        for rp in latest_rec.products:
            prod = rp.product
            # Find the metric whose condition matches the product's targets
            target_cond = prod.targets_conditions[0] if prod.targets_conditions else None
            cond_data = condition_data.get(target_cond) if target_cond else None
            imp = None
            if cond_data and cond_data["baseline"] is not None and cond_data["latest"] is not None and cond_data["baseline"] > 0:
                imp = round((cond_data["baseline"] - cond_data["latest"]) / cond_data["baseline"] * 100, 1)
            # Weeks since recommendation was generated
            weeks = max(1, (datetime.now(timezone.utc) - (
                latest_rec.generated_at if latest_rec.generated_at.tzinfo else latest_rec.generated_at.replace(tzinfo=timezone.utc)
            )).days // 7)
            product_effectiveness.append(ProductEffectivenessItem(
                product_id=prod.id,
                product_name=prod.product_name,
                brand=prod.brand,
                targets_condition=target_cond,
                highlighted_ingredient=rp.highlighted_ingredient,
                weeks_used=weeks,
                condition_improvement_pct=imp,
                user_rating=feedback_map.get(prod.id),
            ))

    # ── Re-scan CTA ───────────────────────────────────────────────────────
    last_scan_dt = all_scans[-1].scanned_at if all_scans else None
    days_until, is_overdue = _days_until_rescan(last_scan_dt)
    if is_overdue:
        alerts.append(AlertItem(
            type="overdue_scan",
            message="Your 30-day skin scan is overdue. Re-scan now to track your progress.",
        ))

    # ── Unread notifications ──────────────────────────────────────────────
    unread_result = await db.execute(
        select(func.count(InAppNotification.id)).where(
            InAppNotification.user_id == current_user.id,
            InAppNotification.is_read == False,  # noqa: E712
        )
    )
    unread_count = unread_result.scalar() or 0

    return ProgressSummaryResponse(
        user_id=current_user.id,
        baseline_score=baseline_score,
        latest_score=latest_score,
        total_improvement=total_improvement,
        improvement_pct_toward_healthy=improvement_pct,
        timeline=timeline_points,
        conditions=conditions,
        current_streak=streak,
        last_7_days=last_7,
        product_effectiveness=product_effectiveness,
        last_scan_date=last_scan_dt,
        days_until_rescan=days_until,
        is_rescan_overdue=is_overdue,
        alerts=alerts,
        unread_notification_count=unread_count,
    )


# ---------------------------------------------------------------------------
# GET /notifications
# ---------------------------------------------------------------------------

@router.get("/notifications", response_model=list[InAppNotificationResponse])
async def get_notifications(
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Fetch in-app notifications for the current user."""
    query = (
        select(InAppNotification)
        .where(InAppNotification.user_id == current_user.id)
        .order_by(InAppNotification.created_at.desc())
        .limit(50)
    )
    if unread_only:
        query = query.where(InAppNotification.is_read == False)  # noqa: E712

    result = await db.execute(query)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# PATCH /notifications/{notification_id}/read
# ---------------------------------------------------------------------------

@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_verified_user),
):
    """Mark a single in-app notification as read."""
    result = await db.execute(
        select(InAppNotification).where(
            InAppNotification.id == notification_id,
            InAppNotification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.is_read = True
    await db.commit()
    return {"ok": True}
