from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.middleware.auth import get_db, get_current_user
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.spf_application import SpfApplication
from app.routers.preferences import get_or_create_preferences
from app.schemas.spf import SpfApplyIn, SpfUndoIn, SpfStatusOut

router = APIRouter(prefix="/spf", tags=["spf"])

RECENT_LIMIT = 100


def _status(
    db: Session, prefs: UserPreference, user_id: int
) -> SpfStatusOut:
    rows = (
        db.query(SpfApplication)
        .filter(SpfApplication.user_id == user_id)
        .order_by(SpfApplication.applied_at.desc())
        .limit(RECENT_LIMIT)
        .all()
    )
    return SpfStatusOut(
        last_applied_at=prefs.spf_last_applied_at,
        recent_applied_at=[row.applied_at for row in rows],
    )


@router.get("/status", response_model=SpfStatusOut)
def get_spf_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = get_or_create_preferences(db, current_user.id)
    return _status(db, prefs, current_user.id)


@router.post("/apply", response_model=SpfStatusOut)
def apply_spf(
    body: SpfApplyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = get_or_create_preferences(db, current_user.id)
    prefs.spf_last_applied_at = body.applied_at
    # Logging an application clears "staying in today".
    prefs.spf_indoors_date = None
    db.add(SpfApplication(user_id=current_user.id, applied_at=body.applied_at))
    db.commit()
    db.refresh(prefs)
    return _status(db, prefs, current_user.id)


@router.post("/undo", response_model=SpfStatusOut)
def undo_spf(
    body: SpfUndoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = get_or_create_preferences(db, current_user.id)
    if body.remove_log_at is not None:
        (
            db.query(SpfApplication)
            .filter(
                SpfApplication.user_id == current_user.id,
                SpfApplication.applied_at == body.remove_log_at,
            )
            .delete(synchronize_session=False)
        )
    if body.clear_log_after is not None:
        (
            db.query(SpfApplication)
            .filter(
                SpfApplication.user_id == current_user.id,
                SpfApplication.applied_at >= body.clear_log_after,
            )
            .delete(synchronize_session=False)
        )
    for applied_at in body.restore_rows:
        db.add(
            SpfApplication(user_id=current_user.id, applied_at=applied_at)
        )
    prefs.spf_last_applied_at = body.restore_at
    db.commit()
    db.refresh(prefs)
    return _status(db, prefs, current_user.id)
