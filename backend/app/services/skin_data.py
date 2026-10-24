from sqlalchemy.orm import Session

from app.models.skin import SkinConcern, SkinSession


def purge_skin_data(db: Session, user_id: int) -> tuple[int, int, list[str]]:
    """Delete every journal session + concern for a user.

    Does not commit — the caller owns the transaction. Returns
    ``(deleted_sessions, deleted_concerns, image_keys)`` so the caller can run
    the best-effort S3 cleanup after committing.

    Concerns go first: their session FKs have no cascade, so deleting sessions
    while concerns still point at them would trip the foreign keys. Skin nudges
    reference sessions with ON DELETE CASCADE and go with them.
    """
    image_keys = [
        key
        for (key,) in db.query(SkinSession.image_url)
        .filter(SkinSession.user_id == user_id)
        .all()
        if key
    ]
    deleted_concerns = (
        db.query(SkinConcern)
        .filter(SkinConcern.user_id == user_id)
        .delete(synchronize_session=False)
    )
    deleted_sessions = (
        db.query(SkinSession)
        .filter(SkinSession.user_id == user_id)
        .delete(synchronize_session=False)
    )
    return deleted_sessions, deleted_concerns, image_keys
