"""
Async email service — sends transactional emails via Resend.

Free-tier note: onboarding@resend.dev can only deliver to the Resend account-owner email.
In development the OTP/reset link is ALWAYS printed to the terminal so any test account works.
"""

import asyncio
import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal send helper
# ---------------------------------------------------------------------------

async def _send(to_email: str, subject: str, html_body: str, plain_body: str = "") -> None:
    if settings.resend_api_key:
        resend.api_key = settings.resend_api_key
        params: resend.Emails.SendParams = {
            "from": f"{settings.email_from_name} <{settings.email_from}>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
        try:
            result = await asyncio.to_thread(resend.Emails.send, params)
            logger.info("Email sent via Resend to %s — id=%s", to_email, result.get("id"))
            return
        except Exception as exc:
            logger.warning("Resend could not deliver to %s: %s", to_email, exc)

    # Dev fallback — always print so any test email address works locally
    logger.warning(
        "\n========== DEV EMAIL (not delivered) ==========\n"
        "To: %s\nSubject: %s\n%s\n"
        "================================================",
        to_email, subject, plain_body or html_body,
    )


# ---------------------------------------------------------------------------
# OTP verification email
# ---------------------------------------------------------------------------

async def send_verification_otp(to_email: str, full_name: str, otp: str) -> None:
    subject = "Verify your Skinest account"
    plain = f"Hi {full_name},\n\nYour Skinest verification OTP is: {otp}\n\nExpires in {settings.otp_expire_minutes} minutes. Never share this code."
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">Welcome to Skinest</h2>
        <p style="color: #555;">Hi {full_name},</p>
        <p style="color: #555;">Use the code below to verify your email address.
           It expires in <strong>{settings.otp_expire_minutes} minutes</strong>.</p>
        <div style="text-align: center; margin: 32px 0;">
          <span style="font-size: 40px; font-weight: 700; letter-spacing: 12px;
                       color: #6C63FF; background: #f0efff; padding: 16px 24px;
                       border-radius: 8px;">{otp}</span>
        </div>
        <p style="color: #888; font-size: 13px;">
          If you didn't create a Skinest account, you can safely ignore this email.
          Never share this code with anyone.
        </p>
      </div>
    </body>
    </html>
    """
    await _send(to_email, subject, html, plain)


# ---------------------------------------------------------------------------
# Password reset email
# ---------------------------------------------------------------------------

async def send_password_reset(to_email: str, full_name: str, reset_token: str) -> None:
    reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"
    subject = "Reset your Skinest password"
    plain = f"Hi {full_name},\n\nReset your password: {reset_url}\n\nExpires in {settings.password_reset_expire_minutes} minutes."
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
        <h2 style="color: #1a1a2e;">Reset your password</h2>
        <p style="color: #555;">Hi {full_name},</p>
        <p style="color: #555;">Click the button below — the link expires in
           <strong>{settings.password_reset_expire_minutes} minutes</strong>.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{reset_url}"
             style="background: #6C63FF; color: #fff; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none; font-weight: 600;
                    font-size: 16px;">Reset Password</a>
        </div>
        <p style="color: #bbb; font-size: 11px; word-break: break-all;">
          Or copy this link: {reset_url}
        </p>
      </div>
    </body>
    </html>
    """
    await _send(to_email, subject, html, plain)


# ---------------------------------------------------------------------------
# Dermatologist notifications
# ---------------------------------------------------------------------------

async def send_derm_pending_notification(to_email: str, full_name: str) -> None:
    subject = "Your Skinest dermatologist application is under review"
    plain = f"Dear Dr. {full_name},\n\nYour application is under review. We'll email you within 2-3 business days."
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
        <h2 style="color: #1a1a2e;">Application received</h2>
        <p style="color: #555;">Dear Dr. {full_name},</p>
        <p style="color: #555;">
          Thank you for applying as a dermatologist reviewer on Skinest.
          Our team will verify your credentials within <strong>2-3 business days</strong>.
        </p>
        <p style="color: #888; font-size: 13px;">Questions? Contact support@skinest.in</p>
      </div>
    </body>
    </html>
    """
    await _send(to_email, subject, html, plain)


async def send_derm_approved_notification(to_email: str, full_name: str) -> None:
    subject = "Your Skinest dermatologist account is now active"
    plain = f"Dear Dr. {full_name},\n\nYour account is now active. Log in at {settings.frontend_url}/login"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
        <h2 style="color: #1a1a2e;">Account activated</h2>
        <p style="color: #555;">Dear Dr. {full_name},</p>
        <p style="color: #555;">Your dermatologist account has been verified and activated.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{settings.frontend_url}/login"
             style="background: #6C63FF; color: #fff; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none; font-weight: 600;">
            Log In Now
          </a>
        </div>
      </div>
    </body>
    </html>
    """
    await _send(to_email, subject, html, plain)
