from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.middleware.auth import get_db, get_current_user
from app.models.user import User
from app.models.user_preference import UserPreference
from app.schemas.preference import PreferenceOut, PreferenceUpdate

router = APIRouter(tags=["preferences"])


def get_or_create_preferences(db: Session, user_id: int) -> UserPreference:
    prefs = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == user_id)
        .first()
    )
    if not prefs:
        prefs = UserPreference(user_id=user_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


@router.get("/preferences", response_model=PreferenceOut)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_or_create_preferences(db, current_user.id)


@router.put("/preferences", response_model=PreferenceOut)
def update_preferences(
    body: PreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = get_or_create_preferences(db, current_user.id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return prefs
