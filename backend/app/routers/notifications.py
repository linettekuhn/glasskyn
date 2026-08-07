from typing import Optional, List, Literal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.middleware.auth import get_db, get_current_user
from app.models.user import User
from app.models.device_token import DeviceToken
from app.models.alert import Alert
from app.core.config import IS_PRODUCTION
from app.services.push import send_push_notifications
from app.services.scheduler import (
    check_expiring_products,
    send_routine_digests,
    send_water_reminders,
)

router = APIRouter(tags=["notifications"])


class PushTokenIn(BaseModel):
    token: str
    platform: Optional[str] = None


class PushTokenOut(BaseModel):
    id: int
    token: str
    platform: Optional[str] = None

    model_config = {"from_attributes": True}


class AlertOut(BaseModel):
    id: int
    alert_type: str
    title: Optional[str] = None
    body: Optional[str] = None
    product_id: Optional[int] = None
    scheduled_for: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    is_read: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


@router.post("/push-token", response_model=PushTokenOut, status_code=201)
def register_push_token(
    body: PushTokenIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token = (
        db.query(DeviceToken)
        .filter(DeviceToken.token == body.token)
        .first()
    )
    if token:
        token.user_id = current_user.id
        if body.platform is not None:
            token.platform = body.platform
    else:
        token = DeviceToken(
            user_id=current_user.id,
            token=body.token,
            platform=body.platform,
        )
        db.add(token)
    db.commit()
    db.refresh(token)
    return token


class PushTokenDelete(BaseModel):
    token: str


@router.delete("/push-token", status_code=204)
def unregister_push_token(
    body: PushTokenDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token = (
        db.query(DeviceToken)
        .filter(DeviceToken.token == body.token)
        .first()
    )
    if token:
        db.delete(token)
        db.commit()
    return None


@router.get("/alerts", response_model=List[AlertOut])
def list_alerts(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Alert).filter(Alert.user_id == current_user.id)
    if unread_only:
        query = query.filter(Alert.is_read == False)
    alerts = query.order_by(Alert.created_at.desc()).all()
    return alerts


@router.patch("/alerts/{alert_id}/read", response_model=AlertOut)
def mark_alert_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = (
        db.query(Alert)
        .filter(Alert.id == alert_id, Alert.user_id == current_user.id)
        .first()
    )
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found"
        )
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert


class DevTestPushIn(BaseModel):
    type: Literal["direct", "expiry", "routine", "water", "all"] = "direct"


@router.post("/dev/test-push", status_code=200)
def dev_test_push(
    body: DevTestPushIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if IS_PRODUCTION:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not found"
        )

    triggered: List[str] = []

    if body.type == "direct":
        tokens = [
            row[0]
            for row in db.query(DeviceToken.token)
            .filter(DeviceToken.user_id == current_user.id)
            .all()
        ]
        send_push_notifications(
            tokens,
            "Test notification",
            "Push notifications are working!",
            {"type": "test"},
        )
        triggered.append("direct")

    if body.type in ("expiry", "all"):
        check_expiring_products()
        triggered.append("expiry")
    if body.type in ("routine", "all"):
        send_routine_digests()
        triggered.append("routine")
    if body.type in ("water", "all"):
        send_water_reminders()
        triggered.append("water")

    return {"ok": True, "triggered": triggered}
