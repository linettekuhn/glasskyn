import logging

import boto3

from app.core import config

logger = logging.getLogger(__name__)


def send_password_reset_code(to_email: str, code: str) -> bool:
    """Send a password reset code to an email address via AWS SES.

    Returns True on success. If SES is not configured (no EMAIL_FROM), the
    code is logged server-side as a dev fallback so the flow can be tested
    locally without a verified SES identity.
    """
    if not config.EMAIL_FROM:
        logger.warning(
            "EMAIL_FROM is not set - falling back to logging the reset code. "
            "Password reset code for %s: %s",
            to_email,
            code,
        )
        return False

    try:
        client = boto3.client("ses", region_name=config.SES_REGION)
        response = client.send_email(
            Source=config.EMAIL_FROM,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": "Your glasskyn password reset code"},
                "Body": {
                    "Html": {
                        "Data": (
                            f"<p>We received a request to reset your glasskyn "
                            f"password.</p>"
                            f"<p>Your reset code is:</p>"
                            f"<p style=\"font-size: 24px; font-weight: bold;\">"
                            f"{code}</p>"
                            f"<p>This code expires in "
                            f"{config.PASSWORD_RESET_CODE_EXPIRE_MINUTES} "
                            f"minutes. If you didn't request this, you can "
                            f"safely ignore this email.</p>"
                        )
                    },
                    "Text": {
                        "Data": (
                            "We received a request to reset your glasskyn "
                            "password. Your reset code is:\n\n"
                            f"{code}\n\n"
                            f"This code expires in "
                            f"{config.PASSWORD_RESET_CODE_EXPIRE_MINUTES} "
                            "minutes. If you didn't request this, you can "
                            "safely ignore this email."
                        )
                    },
                },
            },
        )
        logger.info(
            "Sent password reset code to %s (SES message id %s)",
            to_email,
            response.get("MessageId"),
        )
        return True
    except Exception:
        logger.exception("Failed to send password reset code to %s", to_email)
        if not config.IS_PRODUCTION:
            logger.warning(
                "Dev fallback - password reset code for %s: %s",
                to_email,
                code,
            )
        return False
