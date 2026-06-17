"""
Async email service — sends OTP verification and password-reset emails via SMTP.
Uses aiosmtplib so it never blocks the FastAPI event loop.
"""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _send(to_email: str, subject: str, html_body: str) -> None:
    """Build and dispatch a single email. Swallows errors in dev to avoid blocks."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.email_from_name} <{settings.email_from}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=True,
        )
        logger.info("Email sent to %s: %s", to_email, subject)
    except Exception as exc:
        # Log but never crash the request — email delivery is best-effort
        logger.error("Failed to send email to %s: %s", to_email, exc)
        if settings.is_development:
            # Print OTP/link to console so dev can test without real SMTP
            logger.warning("DEV MODE — email body:\n%s", html_body)


# ---------------------------------------------------------------------------
# OTP verification email
# ---------------------------------------------------------------------------

async def send_verification_otp(to_email: str, full_name: str, otp: str) -> None:
    subject = "Verify your SkinAI account"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">Welcome to SkinAI 👋</h2>
        <p style="color: #555;">Hi {full_name},</p>
        <p style="color: #555;">Use the code below to verify your email address.
           It expires in <strong>{settings.otp_expire_minutes} minutes</strong>.</p>
        <div style="text-align: center; margin: 32px 0;">
          <span style="font-size: 40px; font-weight: 700; letter-spacing: 12px;
                       color: #6C63FF; background: #f0efff; padding: 16px 24px;
                       border-radius: 8px;">{otp}</span>
        </div>
        <p style="color: #888; font-size: 13px;">
          If you didn't create a SkinAI account, you can safely ignore this email.
          Never share this code with anyone.
        </p>
      </div>
    </body>
    </html>
    """
    await _send(to_email, subject, html)


# ---------------------------------------------------------------------------
# Password reset email
# ---------------------------------------------------------------------------

async def send_password_reset(to_email: str, full_name: str, reset_token: str) -> None:
    reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"
    subject = "Reset your SkinAI password"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
        <h2 style="color: #1a1a2e;">Reset your password</h2>
        <p style="color: #555;">Hi {full_name},</p>
        <p style="color: #555;">We received a request to reset your password.
           Click the button below — the link expires in
           <strong>{settings.password_reset_expire_minutes} minutes</strong>.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{reset_url}"
             style="background: #6C63FF; color: #fff; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none; font-weight: 600;
                    font-size: 16px;">Reset Password</a>
        </div>
        <p style="color: #888; font-size: 13px;">
          If you didn't request a password reset, you can safely ignore this email.
          This link can only be used once.
        </p>
        <p style="color: #bbb; font-size: 11px; word-break: break-all;">
          Or copy this link: {reset_url}
        </p>
      </div>
    </body>
    </html>
    """
    await _send(to_email, subject, html)


# ---------------------------------------------------------------------------
# Dermatologist pending verification notification
# ---------------------------------------------------------------------------

async def send_derm_pending_notification(to_email: str, full_name: str) -> None:
    subject = "Your SkinAI dermatologist application is under review"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
        <h2 style="color: #1a1a2e;">Application received ✅</h2>
        <p style="color: #555;">Dear Dr. {full_name},</p>
        <p style="color: #555;">
          Thank you for applying as a dermatologist reviewer on SkinAI.
          Our team will verify your medical license and credentials within
          <strong>2–3 business days</strong>.
        </p>
        <p style="color: #555;">
          You will receive an email once your account is activated.
          Until then, you can log in to view your pending status.
        </p>
        <p style="color: #888; font-size: 13px;">
          Questions? Reply to this email or contact support@skinai.in.
        </p>
      </div>
    </body>
    </html>
    """
    await _send(to_email, subject, html)


# ---------------------------------------------------------------------------
# Dermatologist approved notification
# ---------------------------------------------------------------------------

async def send_derm_approved_notification(to_email: str, full_name: str) -> None:
    subject = "Your SkinAI dermatologist account is now active"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
      <div style="max-width: 480px; margin: auto; background: #fff;
                  border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
        <h2 style="color: #1a1a2e;">Account activated 🎉</h2>
        <p style="color: #555;">Dear Dr. {full_name},</p>
        <p style="color: #555;">
          Your dermatologist account on SkinAI has been verified and activated.
          You can now log in and start reviewing patient recommendations.
        </p>
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
    await _send(to_email, subject, html)
