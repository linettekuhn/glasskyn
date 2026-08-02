import logging
from datetime import date, datetime, time, timedelta

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
from app.services.push import send_push_notifications

logger = logging.getLogger(__name__)


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

            tokens = [
                row[0]
                for row in db.query(DeviceToken.token)
                .filter(DeviceToken.user_id == product.user_id)
                .all()
            ]
            send_push_notifications(
                tokens,
                title,
                body,
                data={"type": "expiry", "product_id": product.id},
            )
        db.commit()
    except Exception:
        logger.exception("Error in check_expiring_products")
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
    return scheduler


scheduler = build_scheduler()
