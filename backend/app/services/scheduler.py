import logging
from datetime import date, datetime, time, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import (
    EXPIRY_ALERT_WINDOW_DAYS,
    EXPIRY_CHECK_HOUR,
    EXPIRY_CHECK_MINUTE,
    REMINDER_AM_TIME,
    REMINDER_PM_TIME,
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


def _push_to_user(db, user_id: int, title: str, body: str, data: dict) -> None:
    tokens = [
        row[0]
        for row in db.query(DeviceToken.token)
        .filter(DeviceToken.user_id == user_id)
        .all()
    ]
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


def send_routine_digests(time_of_day: str) -> None:
    """AM/PM job: remind users to complete their daily skincare steps."""
    alert_type = f"routine_reminder_{time_of_day.lower()}"
    db = SessionLocal()
    try:
        today = date.today()
        users = db.query(User).filter(User.is_active == True).all()
        for user in users:
            prefs = (
                db.query(UserPreference)
                .filter(UserPreference.user_id == user.id)
                .first()
            )
            if prefs is not None and not prefs.routine_digest_enabled:
                continue
            if _alert_exists(db, user.id, alert_type, today):
                continue

            routine = (
                db.query(Routine)
                .filter(
                    Routine.user_id == user.id,
                    Routine.routine_type == "skincare",
                    Routine.is_active == True,
                )
                .order_by(Routine.updated_at.desc())
                .first()
            )
            if not routine:
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
    """Interval job: fire water reminders for users whose time has arrived."""
    db = SessionLocal()
    try:
        now = datetime.now()
        today = now.date()
        current_time = now.strftime("%H:%M")

        prefs_rows = (
            db.query(UserPreference)
            .filter(UserPreference.water_reminder_enabled == True)
            .all()
        )
        for prefs in prefs_rows:
            if not prefs.water_reminder_time:
                continue
            if prefs.water_reminder_time != current_time:
                continue
            if _alert_exists(db, prefs.user_id, "water", today):
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


def _parse_time(value: str) -> tuple:
    try:
        hour, minute = map(int, value.split(":"))
        return hour, minute
    except (ValueError, AttributeError):
        return 8, 0


def build_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        check_expiring_products,
        CronTrigger(hour=EXPIRY_CHECK_HOUR, minute=EXPIRY_CHECK_MINUTE),
        id="expiry_check",
        replace_existing=True,
    )
    am_hour, am_minute = _parse_time(REMINDER_AM_TIME)
    scheduler.add_job(
        lambda: send_routine_digests("AM"),
        CronTrigger(hour=am_hour, minute=am_minute),
        id="am_digest",
        replace_existing=True,
    )
    pm_hour, pm_minute = _parse_time(REMINDER_PM_TIME)
    scheduler.add_job(
        lambda: send_routine_digests("PM"),
        CronTrigger(hour=pm_hour, minute=pm_minute),
        id="pm_digest",
        replace_existing=True,
    )
    scheduler.add_job(
        send_water_reminders,
        IntervalTrigger(minutes=5),
        id="water_reminders",
        replace_existing=True,
    )
    return scheduler


scheduler = build_scheduler()
