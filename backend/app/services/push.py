import logging
from typing import Sequence

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push_notifications(
    tokens: Sequence[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """Send push notifications to Expo push tokens. Returns True on success."""
    tokens = [t for t in tokens if t]
    if not tokens:
        logger.info("No push tokens to send to")
        return False

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": data or {},
        }
        for token in tokens
    ]

    try:
        response = httpx.post(EXPO_PUSH_URL, json=messages, timeout=15)
        response.raise_for_status()
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        logger.info(
            "Expo push response for %d message(s): %s",
            len(messages),
            payload,
        )
        failed = [
            receipt
            for receipt in payload.get("data", [])
            if receipt.get("status") != "ok"
        ]
        if failed:
            logger.warning("Expo push reported %d failed receipt(s): %s", len(failed), failed)
        return True
    except httpx.HTTPError as exc:
        logger.warning("Failed to send push notifications: %s", exc)
        return False
