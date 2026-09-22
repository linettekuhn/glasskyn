from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.middleware.auth import get_db, get_current_user
from app.models.user import User
from app.models.water_intake import WaterIntake
from app.schemas.water import WaterIntakeIn, WaterIntakeOut

router = APIRouter(prefix="/water", tags=["water"])


def _get_or_create_intake(db: Session, user_id: int, on_date: date) -> WaterIntake:
    intake = (
        db.query(WaterIntake)
        .filter(WaterIntake.user_id == user_id, WaterIntake.date == on_date)
        .first()
    )
    if not intake:
        intake = WaterIntake(user_id=user_id, date=on_date, ml=0)
        db.add(intake)
        db.commit()
        db.refresh(intake)
    return intake


@router.get("/intake", response_model=WaterIntakeOut)
def get_water_intake(
    on_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    on_date = on_date or date.today()
    intake = _get_or_create_intake(db, current_user.id, on_date)
    return intake


@router.post("/intake", response_model=WaterIntakeOut)
def set_water_intake(
    body: WaterIntakeIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    intake = (
        db.query(WaterIntake)
        .filter(WaterIntake.user_id == current_user.id, WaterIntake.date == body.date)
        .first()
    )
    if not intake:
        intake = WaterIntake(user_id=current_user.id, date=body.date, ml=0)
        db.add(intake)
    intake.ml = max(0, body.ml)
    db.commit()
    db.refresh(intake)
    return intake
