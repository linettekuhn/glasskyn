import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.middleware.auth import get_db, get_current_user
from app.models.skin import SkinConcern, SkinSession
from app.models.user import User
from app.schemas.skin import (
    CheckInRequest,
    CheckInResponse,
    ConcernOut,
    DeleteSkinDataResponse,
    SessionOut,
)
from app.services import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skin", tags=["skin"])


def _get_user_sessions(db: Session, user_id: int) -> list[SkinSession]:
    return (
        db.query(SkinSession)
        .filter(SkinSession.user_id == user_id)
        .order_by(SkinSession.timestamp.desc(), SkinSession.id.desc())
        .all()
    )


def _get_session_concerns(db: Session, session_id: int) -> list[SkinConcern]:
    return (
        db.query(SkinConcern)
        .filter(SkinConcern.created_session_id == session_id)
        .order_by(SkinConcern.id.asc())
        .all()
    )


def _assert_owned_file_key(file_key: str, user_id: int) -> None:
    if not file_key.startswith(f"skin/{user_id}/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid image file key",
        )


@router.post("/check-in", response_model=CheckInResponse, status_code=201)
def submit_check_in(
    body: CheckInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_owned_file_key(body.image_file_key, current_user.id)

    session_kwargs = {
        "user_id": current_user.id,
        "image_url": body.image_file_key,
        "face_landmarks": body.face_landmarks.model_dump()
        if body.face_landmarks is not None
        else None,
    }
    if body.captured_at is not None:
        session_kwargs["timestamp"] = body.captured_at
    session = SkinSession(**session_kwargs)
    db.add(session)
    db.flush()

    concerns = []
    for c in body.concerns:
        coords = {"x": c.x, "y": c.y}
        concern = SkinConcern(
            uuid=c.uuid,
            user_id=current_user.id,
            label=c.concern_id,
            status=c.status,
            created_session_id=session.id,
            anchor={"coords": coords},
            history=[
                {
                    "session_id": session.id,
                    "coords": coords,
                    "size_estimate": None,
                }
            ],
        )
        db.add(concern)
        concerns.append(concern)

    db.commit()
    db.refresh(session)
    for concern in concerns:
        db.refresh(concern)

    logger.info(
        "Check-in: user=%s session=%s concerns=%d",
        current_user.id,
        session.id,
        len(concerns),
    )

    return CheckInResponse(
        session_id=session.id,
        concerns=[ConcernOut.model_validate(c, from_attributes=True) for c in concerns],
    )


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = _get_user_sessions(db, current_user.id)
    for s in sessions:
        s.concerns = _get_session_concerns(db, s.id)  # type: ignore[attr-defined]
    return sessions


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(SkinSession)
        .filter(
            SkinSession.id == session_id,
            SkinSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    session.concerns = _get_session_concerns(db, session.id)  # type: ignore[attr-defined]
    return session


@router.delete("/data", response_model=DeleteSkinDataResponse)
def delete_skin_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = _get_user_sessions(db, current_user.id)

    deleted_concerns = (
        db.query(SkinConcern)
        .filter(SkinConcern.user_id == current_user.id)
        .delete(synchronize_session=False)
    )

    for s in sessions:
        try:
            storage.delete_file(s.image_url)
        except Exception as e:
            logger.warning("Failed to delete S3 object %s: %s", s.image_url, e)

    deleted_sessions = (
        db.query(SkinSession)
        .filter(SkinSession.user_id == current_user.id)
        .delete(synchronize_session=False)
    )

    db.commit()

    logger.info(
        "Deleted skin data: user=%s sessions=%d concerns=%d",
        current_user.id,
        deleted_sessions,
        deleted_concerns,
    )

    return DeleteSkinDataResponse(
        deleted_sessions=deleted_sessions,
        deleted_concerns=deleted_concerns,
    )