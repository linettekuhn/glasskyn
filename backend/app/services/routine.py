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
        is_active=True,
    )
    db.add(routine)
    db.flush()

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
