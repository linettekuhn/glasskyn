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
    ConcernPositionUpdate,
    DeleteSessionResponse,
    DeleteSkinDataResponse,
    SessionOut,
)
from app.services import storage
from app.services.skin_anchor import compute_anchor, finite_landmarks

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

    face_landmarks_dict = (
        {k: v.model_dump() for k, v in body.face_landmarks.items()}
        if body.face_landmarks is not None
        else None
    )

    notes = body.notes.strip() if body.notes and body.notes.strip() else None
    session_kwargs = {
        "user_id": current_user.id,
        "image_url": body.image_file_key,
        "face_landmarks": face_landmarks_dict,
        "moisture_rating": body.moisture_rating,
        "texture_rating": body.texture_rating,
        "tone_rating": body.tone_rating,
        "notes": notes,
    }
    if body.captured_at is not None:
        session_kwargs["timestamp"] = body.captured_at
    session = SkinSession(**session_kwargs)
    db.add(session)
    db.flush()

    concerns = []
    carried_count = 0
    for c in body.concerns:
        coords = {"x": c.x, "y": c.y}
        if c.carried_uuid:
            existing = (
                db.query(SkinConcern)
                .filter(
                    SkinConcern.user_id == current_user.id,
                    SkinConcern.uuid == c.carried_uuid,
                )
                .first()
            )
            if existing is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Carried concern {c.carried_uuid} not found",
                )
            # Reassign a NEW list: the column has no MutableList wrapper, so
            # an in-place append would not be flagged as a change.
            history = list(existing.history or [])
            history.append(
                {"session_id": session.id, "coords": coords, "size_estimate": None}
            )
            existing.history = history
            if c.resolved:
                existing.resolved_session_id = session.id
            concerns.append(existing)
            carried_count += 1
            continue

        anchor = compute_anchor(coords, face_landmarks_dict)
        concern = SkinConcern(
            uuid=c.uuid,
            user_id=current_user.id,
            label=c.concern_id,
            status=c.status,
            created_session_id=session.id,
            anchor=anchor,
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
        "Check-in: user=%s session=%s concerns=%d new=%d carried=%d landmarks=%s",
        current_user.id,
        session.id,
        len(concerns),
        len(concerns) - carried_count,
        carried_count,
        "yes" if face_landmarks_dict else "no",
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


@router.delete("/sessions/{session_id}", response_model=DeleteSessionResponse)
def delete_session(
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
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    image_url = session.image_url

    # 1. Concerns that originated in this session die with it. A concern is only
    #    ever listed under the session that created it, so keeping them would
    #    strand them away from the journal entirely.
    origin_concerns = (
        db.query(SkinConcern)
        .filter(
            SkinConcern.user_id == current_user.id,
            SkinConcern.created_session_id == session.id,
        )
        .all()
    )
    for concern in origin_concerns:
        db.delete(concern)
    deleted_concerns = len(origin_concerns)
    doomed_ids = {c.id for c in origin_concerns}

    # 2. Concerns that merely passed through this session: drop the now-dangling
    #    history entry and unpoint any resolution recorded here. Entries for
    #    other sessions stay valid and keep rendering on their own days.
    updated_concerns = 0
    for concern in db.query(SkinConcern).filter(
        SkinConcern.user_id == current_user.id
    ):
        if concern.id in doomed_ids:
            continue
        touched = False
        if concern.resolved_session_id == session.id:
            concern.resolved_session_id = None
            touched = True
        history = concern.history or []
        trimmed = [h for h in history if h.get("session_id") != session.id]
        if len(trimmed) != len(history):
            # Reassign a new list: the column has no MutableList wrapper, so an
            # in-place mutation would not be flagged as a change.
            concern.history = trimmed
            touched = True
        if touched:
            updated_concerns += 1

    # 3. Best-effort object cleanup; a failure here must not block the delete.
    try:
        storage.delete_file(image_url)
    except Exception as e:
        logger.warning("Failed to delete S3 object %s: %s", image_url, e)

    # Flush the concern changes first: the bulk DELETE below runs immediately,
    # while these ORM mutations would otherwise still be pending, leaving rows
    # that reference this session and tripping the foreign keys.
    db.flush()

    db.query(SkinSession).filter(SkinSession.id == session.id).delete(
        synchronize_session=False
    )
    db.commit()

    logger.info(
        "Deleted skin session: user=%s session=%s deleted_concerns=%d updated_concerns=%d",
        current_user.id,
        session.id,
        deleted_concerns,
        updated_concerns,
    )

    return DeleteSessionResponse(
        session_id=session.id,
        deleted_concerns=deleted_concerns,
        updated_concerns=updated_concerns,
    )


@router.patch(
    "/concerns/{concern_uuid}/sessions/{session_id}",
    response_model=ConcernOut,
)
def update_concern_position(
    concern_uuid: str,
    session_id: int,
    body: ConcernPositionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a user-dragged correction for one session appearance.

    Always rewrites that history entry's coords and flags it
    `user_corrected`. Recomputes the concern-level `anchor` from the
    corrected coords ONLY when the corrected session is the most recent
    appearance and that session has finite landmarks; otherwise the anchor
    is left alone (an older photo must not poison earlier frames).
    Later sessions already stored keep their old carried coords — the fix
    helps future captures only. No migration: history is JSONB.
    """
    if not (0 <= body.x <= 1 and 0 <= body.y <= 1):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Coordinates must be in [0, 1]",
        )
    concern = (
        db.query(SkinConcern)
        .filter(
            SkinConcern.user_id == current_user.id,
            SkinConcern.uuid == concern_uuid,
        )
        .first()
    )
    if concern is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Concern not found",
        )
    session = (
        db.query(SkinSession)
        .filter(
            SkinSession.id == session_id,
            SkinSession.user_id == current_user.id,
        )
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    history = list(concern.history or [])
    idx = next(
        (i for i, h in enumerate(history) if h.get("session_id") == session_id),
        None,
    )
    if idx is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Concern not marked in this session",
        )
    corrected = {"x": body.x, "y": body.y}
    updated = dict(history[idx])
    updated["coords"] = corrected
    updated["user_corrected"] = True
    history[idx] = updated
    # Reassign a NEW list: the column has no MutableList wrapper, so an
    # in-place mutation would not be flagged as a change.
    concern.history = history

    is_latest = all(
        (h.get("session_id") or 0) <= session_id for h in history
    )
    if is_latest and finite_landmarks(session.face_landmarks or {}):
        concern.anchor = compute_anchor(corrected, session.face_landmarks)

    db.commit()
    db.refresh(concern)
    logger.info(
        "Corrected concern position: user=%s uuid=%s session=%s latest=%s",
        current_user.id,
        concern_uuid,
        session_id,
        is_latest,
    )
    return concern


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