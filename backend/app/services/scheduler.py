import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import (
    EXPIRY_ALERT_WINDOW_DAYS,
    EXPIRY_CHECK_HOUR,
    EXPIRY_CHECK_MINUTE,
)
from app.db.session import SessionLocal
from app.models.alert import Alert
from app.models.device_token import DeviceToken
from app.models.product import Product
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.routine import Routine, RoutineStep
from app.services.push import send_push_notifications

logger = logging.getLogger(__name__)


def _alert_exists(db, user_id: int, alert_type: str, day: date) -> bool:
    start = datetime.combine(day, time.min)
    end = datetime.combine(day, time.max)
    return (
        db.query(Alert.id)
        .filter(
            Alert.user_id == user_id,
            Alert.alert_type == alert_type,
            Alert.scheduled_for >= start,
            Alert.scheduled_for <= end,
        )
        .first()
        is not None
    )


def _is_due(prefs_time: str | None, now: datetime, tolerance_minutes: int = 2) -> bool:
    """True when prefs_time falls within the current poll window.

    Polls land on :00/:05/... boundaries (plus a few seconds of drift), so an
    exact HH:MM string match would silently skip reminders. Compare within a
    small tolerance instead.
    """
    if not prefs_time:
        return False
    try:
        hour, minute = (int(part) for part in prefs_time.split(":"))
    except (ValueError, TypeError):
        return False
    target_minutes = hour * 60 + minute
    current_minutes = now.hour * 60 + now.minute
    return abs(current_minutes - target_minutes) <= tolerance_minutes


def _local_now(timezone_str: str | None) -> datetime:
    """Naive local datetime for a user's IANA timezone.

    Falls back to the server's local time when the timezone is missing or
    invalid so existing users keep working after schema changes.
    """
    if timezone_str:
        try:
            return datetime.now(ZoneInfo(timezone_str)).replace(tzinfo=None)
        except Exception:
            logger.debug("Invalid timezone %r, using server local", timezone_str)
    return datetime.now()


def _push_to_user(db, user_id: int, title: str, body: str, data: dict) -> None:
    tokens = [
        row[0]
        for row in db.query(DeviceToken.token)
        .filter(DeviceToken.user_id == user_id)
        .all()
    ]
    logger.info(
        "Sending push to user %s (%d token(s)): %s - %s",
        user_id,
        len(tokens),
        title,
        body,
    )
    send_push_notifications(tokens, title, body, data)


def check_expiring_products() -> None:
    """Daily job: alert users about products expiring within the window."""
    db = SessionLocal()
    try:
        today = date.today()
        window_end = today + timedelta(days=EXPIRY_ALERT_WINDOW_DAYS)
        products = (
            db.query(Product)
            .filter(Product.expiry_date.isnot(None))
            .filter(Product.expiry_date <= window_end)
            .all()
        )
        for product in products:
            already_alerted = (
                db.query(Alert)
                .filter(
                    Alert.product_id == product.id,
                    Alert.alert_type == "expiry",
                )
                .first()
            )
            if already_alerted:
                continue

            days_left = (product.expiry_date - today).days
            if days_left >= 0:
                title = "Product expiring soon"
                body = f'"{product.name}" expires in {days_left} day(s).'
            else:
                title = "Product expired"
                body = f'"{product.name}" expired {-days_left} day(s) ago.'

            db.add(
                Alert(
                    user_id=product.user_id,
                    product_id=product.id,
                    alert_type="expiry",
                    title=title,
                    body=body,
                    scheduled_for=datetime.combine(product.expiry_date, time.min),
                    sent_at=datetime.utcnow(),
                    is_read=False,
                )
            )
            db.flush()

            _push_to_user(
                db,
                product.user_id,
                title,
                body,
                {"type": "expiry", "product_id": product.id},
            )
        db.commit()
    except Exception:
        logger.exception("Error in check_expiring_products")
        db.rollback()
    finally:
        db.close()


def send_routine_digests() -> None:
    """Polling job: fire AM/PM routine reminders at each user's chosen time."""
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True).all()
        for user in users:
            prefs = (
                db.query(UserPreference)
                .filter(UserPreference.user_id == user.id)
                .first()
            )
            if prefs is None:
                continue
            now = _local_now(prefs.timezone)
            time_of_day = "AM" if now.hour < 12 else "PM"
            today = now.date()
            alert_type = f"routine_reminder_{time_of_day.lower()}"
            prefs_time = (
                prefs.routine_digest_am_time
                if time_of_day == "AM"
                else prefs.routine_digest_pm_time
            )
            if not _is_due(prefs_time, now):
                continue
            if _alert_exists(db, user.id, alert_type, today):
                continue

            routine = (
                db.query(Routine)
                .filter(
                    Routine.user_id == user.id,
                    Routine.routine_type == "skincare",
                    Routine.is_main_routine == True,
                )
                .order_by(Routine.created_at.desc())
                .first()
            )
            if not routine:
                logger.info(
                    "Routine digest due for user %s but no active skincare routine",
                    user.id,
                )
                continue

            step_count = (
                db.query(RoutineStep.id)
                .filter(
                    RoutineStep.routine_id == routine.id,
                    RoutineStep.time_of_day == time_of_day,
                    RoutineStep.frequency == "daily",
                )
                .count()
            )
            if step_count == 0:
                logger.info(
                    "Routine digest due for user %s but no %s daily steps",
                    user.id,
                    time_of_day,
                )
                continue

            label = "morning" if time_of_day == "AM" else "evening"
            title = "Skincare time"
            body = (
                f"Good {label}! Your {time_of_day} routine has "
                f"{step_count} step(s) to complete."
            )

            db.add(
                Alert(
                    user_id=user.id,
                    alert_type=alert_type,
                    title=title,
                    body=body,
                    scheduled_for=datetime.combine(today, time.min),
                    sent_at=datetime.utcnow(),
                )
            )
            db.flush()
            _push_to_user(
                db,
                user.id,
                title,
                body,
                {"type": "routine_reminder", "time_of_day": time_of_day},
            )
        db.commit()
    except Exception:
        logger.exception("Error in send_routine_digests")
        db.rollback()
    finally:
        db.close()


def send_water_reminders() -> None:
    """Polling job: fire water reminders for users whose time has arrived."""
    db = SessionLocal()
    try:
        prefs_rows = (
            db.query(UserPreference)
            .filter(UserPreference.water_reminder_enabled == True)
            .all()
        )
        for prefs in prefs_rows:
            now = _local_now(prefs.timezone)
            today = now.date()
            if not _is_due(prefs.water_reminder_time, now):
                continue
            if _alert_exists(db, prefs.user_id, "water", today):
                logger.info(
                    "Water reminder due for user %s at %s but already sent today",
                    prefs.user_id,
                    prefs.water_reminder_time,
                )
                continue

            title = "Hydration reminder"
            body = "Time for a glass of water!"
            db.add(
                Alert(
                    user_id=prefs.user_id,
                    alert_type="water",
                    title=title,
                    body=body,
                    scheduled_for=datetime.combine(today, time.min),
                    sent_at=datetime.utcnow(),
                )
            )
            db.flush()
            _push_to_user(
                db,
                prefs.user_id,
                title,
                body,
                {"type": "water"},
            )
        db.commit()
    except Exception:
        logger.exception("Error in send_water_reminders")
        db.rollback()
    finally:
        db.close()


def build_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        check_expiring_products,
        CronTrigger(hour=EXPIRY_CHECK_HOUR, minute=EXPIRY_CHECK_MINUTE),
        id="expiry_check",
        replace_existing=True,
    )
    scheduler.add_job(
        send_routine_digests,
        CronTrigger(minute="*/5"),
        id="routine_digests",
        replace_existing=True,
    )
    scheduler.add_job(
        send_water_reminders,
        CronTrigger(minute="*/5"),
        id="water_reminders",
        replace_existing=True,
    )
    return scheduler


scheduler = build_scheduler()
