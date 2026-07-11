"""
Notification service — transactional email via Resend + in-app notifications.

Phase 7 additions:
  - send_rescan_reminder()     — day-28 email to prompt monthly re-scan
  - send_weekly_routine_tip()  — Gemini-powered personalised weekly tip email
  - create_in_app_notification() — persist in-app bell notification to DB
"""

import logging
import uuid
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.progress import InAppNotification

logger = logging.getLogger(__name__)


class NotificationService:

    # ------------------------------------------------------------------
    # Original methods
    # ------------------------------------------------------------------

    async def send_otp(self, to_email: str, otp: str) -> None:
        """Sends password-reset OTP email."""
        subject = "Your Skinest verification code"
        body = f"Your OTP is: {otp}\n\nThis code expires in 10 minutes. Do not share it."
        await self._send(to_email, subject, body)

    async def send_recommendation_ready(self, to_email: str, scan_id: str) -> None:
        """Notifies user that their skincare recommendation is ready."""
        subject = "Your Skinest results are ready"
        body = (
            f"Hi,\n\nYour personalised skincare recommendation is ready.\n"
            f"View it at: {settings.frontend_url}/results/{scan_id}\n\n"
            "– The Skinest Team"
        )
        await self._send(to_email, subject, body)

    async def send_derm_review_complete(self, to_email: str, scan_id: str, status: str) -> None:
        """Notifies user after dermatologist reviews their case."""
        subject = f"Dermatologist review: {status}"
        body = (
            f"A dermatologist has reviewed your skin analysis.\n"
            f"Status: {status}\n\n"
            f"View your updated recommendation at: {settings.frontend_url}/results/{scan_id}"
        )
        await self._send(to_email, subject, body)

    # ------------------------------------------------------------------
    # Phase 7: Re-scan reminder
    # ------------------------------------------------------------------

    async def send_rescan_reminder(
        self,
        to_email: str,
        user_name: str,
        days_since_scan: int,
        last_scan_score: Optional[float] = None,
    ) -> None:
        """Day-28 email prompting user to complete their monthly re-scan."""
        score_line = (
            f"Your last skin score was {last_scan_score:.0f}/100. "
            "A re-scan will show how much you've improved.\n\n"
            if last_scan_score is not None
            else ""
        )
        subject = "Time for your monthly skin check-in"
        body = (
            f"Hi {user_name},\n\n"
            f"It's been {days_since_scan} days since your last scan — your 30-day check-in is ready!\n\n"
            f"{score_line}"
            "Regular check-ins help you see exactly how your skin is responding to your routine.\n\n"
            f"Re-scan now: {settings.frontend_url}/scan\n\n"
            "– The Skinest Team"
        )
        await self._send(to_email, subject, body)

    # ------------------------------------------------------------------
    # Phase 7: Gemini-powered weekly routine tip
    # ------------------------------------------------------------------

    async def generate_weekly_tip(
        self, skin_conditions: list[str], skin_score: float
    ) -> str:
        """Use Gemini to generate a personalised weekly skincare tip."""
        if not settings.gemini_api_key:
            logger.warning("GEMINI_API_KEY not set — using static fallback tip")
            return (
                "Stay consistent with your routine and always wear SPF 30+ sunscreen daily. "
                "Consistency is the biggest predictor of skin improvement."
            )

        conditions_text = ", ".join(skin_conditions) if skin_conditions else "general skin health"
        prompt = (
            f"Generate a single, actionable weekly skincare tip for someone with:\n"
            f"- Skin score: {skin_score:.0f}/100\n"
            f"- Current conditions to address: {conditions_text}\n\n"
            "Keep it to 2-3 sentences. Be warm, specific, and encouraging. "
            "Focus on one concrete action they can take this week. "
            "Do not use emojis or markdown."
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 200},
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, params={"key": settings.gemini_api_key}, json=payload)
            resp.raise_for_status()
            data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return "Stay consistent with your routine and always wear SPF 30+ sunscreen daily."
        return candidates[0]["content"]["parts"][0]["text"].strip()

    async def send_weekly_routine_tip(
        self,
        to_email: str,
        user_name: str,
        skin_conditions: list[str],
        skin_score: float,
    ) -> None:
        """Send Gemini-generated personalised weekly tip email."""
        tip = await self.generate_weekly_tip(skin_conditions, skin_score)
        subject = "Your weekly skin tip from Skinest"
        body = (
            f"Hi {user_name},\n\n"
            f"Here is your personalised skin tip for this week:\n\n"
            f"{tip}\n\n"
            "Consistency is the biggest predictor of skin improvement — keep it up!\n\n"
            f"View your progress: {settings.frontend_url}/progress\n\n"
            "– The Skinest Team"
        )
        await self._send(to_email, subject, body)

    # ------------------------------------------------------------------
    # Phase 7: In-app notifications
    # ------------------------------------------------------------------

    async def create_in_app_notification(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        notif_type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
    ) -> InAppNotification:
        """Persist an in-app notification to the database."""
        notif = InAppNotification(
            user_id=user_id,
            type=notif_type,
            title=title,
            message=message,
            action_url=action_url,
        )
        db.add(notif)
        await db.commit()
        await db.refresh(notif)
        return notif

    async def notify_scan_reminder(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> InAppNotification:
        return await self.create_in_app_notification(
            db=db,
            user_id=user_id,
            notif_type="scan_reminder",
            title="Time for your monthly re-scan",
            message="30 days have passed since your last scan. Re-scan now to track your skin progress.",
            action_url=f"{settings.frontend_url}/scan",
        )

    async def notify_derm_review_complete(
        self, db: AsyncSession, user_id: uuid.UUID, recommendation_id: str
    ) -> InAppNotification:
        return await self.create_in_app_notification(
            db=db,
            user_id=user_id,
            notif_type="derm_review_complete",
            title="Dermatologist review complete",
            message="A dermatologist has reviewed your skin analysis and updated your recommendations.",
            action_url=f"{settings.frontend_url}/results/{recommendation_id}",
        )

    async def notify_new_product_suggestion(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> InAppNotification:
        return await self.create_in_app_notification(
            db=db,
            user_id=user_id,
            notif_type="new_product_suggestion",
            title="New product suggestion available",
            message="Based on your latest scan, we have a new product suggestion for your routine.",
            action_url=f"{settings.frontend_url}/results",
        )

    # ------------------------------------------------------------------
    # Internal sender — routes through the Resend email service
    # ------------------------------------------------------------------

    async def _send(self, to: str, subject: str, body: str) -> None:
        from app.services.email_service import _send as resend_send
        html = "<br>".join(line for line in body.splitlines())
        await resend_send(to, subject, f"<div style='font-family:Arial,sans-serif;line-height:1.6'>{html}</div>")
