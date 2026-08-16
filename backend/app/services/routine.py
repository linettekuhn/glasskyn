from sqlalchemy.orm import Session
from app.models.routine import Routine, RoutineStep, RoutineTemplate, RoutineTemplateStep
from app.models.product import Product
from typing import Dict, List, Optional

STEP_TO_PRODUCT_TYPES: Dict[str, List[str]] = {
    "cleanse":    ["cleanser"],
    "tone":       ["toner"],
    "treat":      ["serum", "exfoliant", "mask", "spot_treatment"],
    "moisturize": ["moisturizer", "oil"],
    "spf":        ["spf"],
    "other":      ["other"],
}


def match_products_to_step(
    db: Session,
    user_id: int,
    step_type: str,
    routine_type: str,
) -> Optional[int]:
    allowed_types = STEP_TO_PRODUCT_TYPES.get(step_type, [])
    if not allowed_types:
        return None

    product = (
        db.query(Product)
        .filter(
            Product.user_id == user_id,
            Product.product_type.in_(allowed_types),
            Product.category == routine_type,
        )
        .first()
    )
    return product.id if product else None


def set_main_routine(db: Session, routine: Routine) -> None:
    """Make this the user's single main routine, deactivating the others."""
    db.query(Routine).filter(
        Routine.user_id == routine.user_id,
        Routine.routine_type == routine.routine_type,
        Routine.is_main_routine == True,
    ).update({"is_main_routine": False})
    routine.is_main_routine = True
    db.flush()


def promote_main_routine(
    db: Session,
    user_id: int,
    routine_type: str = "skincare",
) -> None:
    """Make the newest remaining routine the main one (used after deleting main)."""
    next_routine = (
        db.query(Routine)
        .filter(
            Routine.user_id == user_id,
            Routine.routine_type == routine_type,
        )
        .order_by(Routine.created_at.desc())
        .first()
    )
    if next_routine:
        next_routine.is_main_routine = True
        db.flush()


def clone_template_to_routine(
    db: Session,
    user_id: int,
    template: RoutineTemplate,
    name: Optional[str] = None,
) -> Routine:
    routine = Routine(
        user_id=user_id,
        name=name or template.name,
        source="template",
        routine_type=template.routine_type,
    )
    db.add(routine)
    db.flush()
    set_main_routine(db, routine)

    template_steps = (
        db.query(RoutineTemplateStep)
        .filter(RoutineTemplateStep.template_id == template.id)
        .order_by(RoutineTemplateStep.step_order)
        .all()
    )

    for ts in template_steps:
        product_id = match_products_to_step(db, user_id, ts.step_type, template.routine_type)
        step = RoutineStep(
            routine_id=routine.id,
            step_order=ts.step_order,
            product_id=product_id,
            step_type=ts.step_type,
            time_of_day=ts.time_of_day,
            frequency=ts.frequency,
        )
        db.add(step)

    db.commit()
    db.refresh(routine)
    return routine
