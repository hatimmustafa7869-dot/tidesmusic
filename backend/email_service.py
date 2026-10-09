import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional
from backend.config import settings

logger = logging.getLogger("tides.email")

def send_password_reset_email(to_email: str, code: str) -> Dict[str, Any]:
    """
    Sends a 6-digit verification code to the user's email using Hostinger SMTP (smtp.hostinger.com).
    Returns a dict with 'success': bool, 'message': str, and optional 'devCode' if SMTP is not configured.
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM_EMAIL or smtp_user or "noreply@tidesmusic.com"
    from_name = settings.SMTP_FROM_NAME or "Tides Music"

    # If SMTP is not yet configured in .env, provide seamless dev/test fallback
    if not smtp_user or not smtp_pass:
        logger.warning(
            f"[SMTP NOT CONFIGURED] Password reset requested for {to_email}. "
            f"Verification Code: {code}. Configure SMTP_USER and SMTP_PASSWORD in .env for production emails."
        )
        return {
            "success": True,
            "message": "Reset code generated. (SMTP credentials not configured in .env, code shown for testing)",
            "devCode": code
        }

    # Prepare HTML Email
    subject = f"{code} is your Tides Music password reset code"
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your Password</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #080b12;
      color: #ffffff;
      margin: 0;
      padding: 40px 20px;
    }}
    .container {{
      max-width: 520px;
      margin: 0 auto;
      background: #0f1422;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 36px 32px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }}
    .logo {{
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin-bottom: 24px;
      text-align: center;
    }}
    .logo span {{
      color: #1ed760;
    }}
    .title {{
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
      text-align: center;
    }}
    .text {{
      font-size: 14px;
      line-height: 1.6;
      color: #a1a1aa;
      text-align: center;
      margin-bottom: 28px;
    }}
    .code-box {{
      background: #07090e;
      border: 2px solid #1ed760;
      border-radius: 16px;
      padding: 18px 24px;
      text-align: center;
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 10px;
      color: #1ed760;
      margin: 0 auto 28px auto;
      max-width: 280px;
    }}
    .footer {{
      font-size: 12px;
      color: #71717a;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 20px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Tides <span>Music</span></div>
    <div class="title">Reset Your Password</div>
    <div class="text">
      We received a request to reset your password. Use the verification code below to complete the reset. This code is valid for <strong>15 minutes</strong>.
    </div>
    <div class="code-box">{code}</div>
    <div class="text" style="font-size: 13px;">
      If you did not request this password reset, you can safely ignore this email. Your account remains secure.
    </div>
    <div class="footer">
      &copy; 2026 Tides Music. High-fidelity audio streaming.
    </div>
  </div>
</body>
</html>"""

    plain_content = f"Your Tides Music verification code is: {code}\n\nThis code expires in 15 minutes. If you did not request this, please ignore."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(plain_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if settings.SMTP_USE_SSL or smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [to_email], msg.as_string())

        logger.info(f"Password reset email sent successfully to {to_email}")
        return {
            "success": True,
            "message": "Password reset code sent to your email address."
        }
    except Exception as e:
        logger.error(f"Failed to send email via Hostinger SMTP ({smtp_host}:{smtp_port}): {e}")
        # Return fallback with code if email delivery fails, so user is never locked out
        return {
            "success": True,
            "message": f"Could not reach SMTP server ({e}). Reset code provided for recovery:",
            "devCode": code
        }
