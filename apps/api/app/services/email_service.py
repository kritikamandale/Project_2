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
# Internal send helpers (SMTP & Resend)
# ---------------------------------------------------------------------------

async def _send_smtp(to_email: str, subject: str, html_body: str, plain_body: str = "") -> bool:
    if not settings.smtp_host:
        return False

    def sync_send() -> None:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        smtp_user = (settings.smtp_user or settings.email_from).strip()
        smtp_pass = settings.smtp_password.replace(" ", "").strip()
        smtp_host = settings.smtp_host.strip()
        port = settings.smtp_port or 587

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.email_from_name} <{smtp_user}>"
        msg["To"] = to_email

        if plain_body:
            msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        if port == 465:
            with smtplib.SMTP_SSL(smtp_host, port, timeout=12) as server:
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to_email], msg.as_string())
        elif settings.smtp_use_tls or port == 587:
            with smtplib.SMTP(smtp_host, port, timeout=12) as server:
                server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, port, timeout=12) as server:
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to_email], msg.as_string())

    try:
        await asyncio.to_thread(sync_send)
        logger.info("Email sent via SMTP (%s) to %s", settings.smtp_host, to_email)
        return True
    except Exception as exc:
        logger.error("SMTP delivery to %s failed via %s:%s — Error: %s", to_email, settings.smtp_host, settings.smtp_port, exc)
        return False


async def _send(to_email: str, subject: str, html_body: str, plain_body: str = "") -> None:
    sent = False

    # 1. Try SMTP if configured (e.g., Gmail SMTP sends to ANY address for free)
    if settings.smtp_host:
        sent = await _send_smtp(to_email, subject, html_body, plain_body)

    # 2. Fallback to Resend if SMTP is not set or failed
    if not sent and settings.resend_api_key:
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
            sent = True
        except Exception as exc:
            logger.warning("Resend could not deliver to %s: %s", to_email, exc)

    # In development or if no remote provider succeeded, log to stdout/terminal
    if not sent or settings.is_development:
        msg = (
            f"\n========== DEV EMAIL LOG ==========\n"
            f"To: {to_email}\nSubject: {subject}\n\n{plain_body or html_body}\n"
            f"===================================="
        )
        print(msg, flush=True)
        logger.warning(msg)


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
    reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}&email={to_email}"
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
