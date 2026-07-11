import asyncio
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import selectinload

import sys
import os
sys.path.append(os.path.abspath("."))

from app.core.config import settings
from app.models.recommendation import Recommendation
from app.models.scan import SkinScan, SkinCondition
from app.models.progress import ProgressScan, ProgressMetric

async def backfill():
    print(f"DATABASE_URL: {settings.database_url}")
    engine = create_async_engine(str(settings.database_url))
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with async_session() as db:
        # Fetch all recommendations
        recs = await db.scalars(
            select(Recommendation)
            .options(
                selectinload(Recommendation.scan).selectinload(SkinScan.conditions)
            )
        )
        recs = list(recs.all())
        print(f"Found {len(recs)} recommendations in the database.")
        
        severity_map_local = {"none": 0.0, "mild": 1.0, "moderate": 2.0, "severe": 3.0}
        
        for rec in recs:
            # Check if ProgressScan exists
            p_scan = await db.scalar(
                select(ProgressScan).where(ProgressScan.scan_id == rec.scan_id)
            )
            if p_scan:
                print(f"ProgressScan already exists for recommendation {rec.id} (scan {rec.scan_id})")
                continue
                
            scan = rec.scan
            if not scan:
                print(f"No scan found for recommendation {rec.id}")
                continue
                
            # Count existing scans to determine scan_number
            count_res = await db.execute(
                select(ProgressScan).where(
                    ProgressScan.user_id == rec.user_id
                )
            )
            existing_scans = list(count_res.scalars().all())
            scan_number = len(existing_scans) + 1
            
            # Fetch baseline score
            baseline_score = None
            if scan_number > 1:
                baseline = next((s for s in existing_scans if s.scan_number == 1), None)
                if baseline:
                    baseline_score = baseline.overall_skin_score
                    
            delta = round(rec.skin_score - baseline_score, 2) if baseline_score is not None else 0.0
            
            print(f"Creating ProgressScan for user {rec.user_id}, scan {scan.id}, scan_number {scan_number}")
            progress_scan = ProgressScan(
                id=uuid.uuid4(),
                user_id=rec.user_id,
                recommendation_id=rec.id,
                scan_id=scan.id,
                scan_number=scan_number,
                scanned_at=scan.scan_timestamp,
                overall_skin_score=rec.skin_score,
                delta_from_baseline=delta,
            )
            db.add(progress_scan)
            await db.flush()
            
            # Create metrics
            prev_condition_map = {}
            if scan_number > 1:
                prev_scan = next((s for s in existing_scans if s.scan_number == scan_number - 1), None)
                if prev_scan:
                    # reload metrics
                    m_res = await db.execute(
                        select(ProgressMetric).where(ProgressMetric.progress_scan_id == prev_scan.id)
                    )
                    prev_condition_map = {m.metric_name: m.current_value for m in m_res.scalars().all()}
            
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
        print("Backfill completed successfully.")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(backfill())
