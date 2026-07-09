import json
import os
from pathlib import Path
from sqlalchemy.orm import Session
from app.models.routine import RoutineTemplate, RoutineTemplateStep


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TEMPLATES_FILE = DATA_DIR / "templates.json"


def seed_templates(db: Session) -> int:
    if not TEMPLATES_FILE.exists():
        return 0

    with open(TEMPLATES_FILE) as f:
        templates_data = json.load(f)

    json_names = {entry["name"] for entry in templates_data}

    stale = db.query(RoutineTemplate).filter(
        ~RoutineTemplate.name.in_(json_names)
    ).all()
    for t in stale:
        db.query(RoutineTemplateStep).filter(
            RoutineTemplateStep.template_id == t.id
        ).delete()
        db.delete(t)

    inserted = 0
    for entry in templates_data:
        version = entry.get("seed_version", 1)
        name = entry["name"]

        existing = db.query(RoutineTemplate).filter(
            RoutineTemplate.name == name
        ).first()

        if existing:
            if existing.seed_version >= version:
                continue
            db.query(RoutineTemplateStep).filter(
                RoutineTemplateStep.template_id == existing.id
            ).delete()
            existing.seed_version = version
            existing.description = entry.get("description")
            existing.skin_type_tags = entry.get("skin_type_tags", [])
            existing.concern_tags = entry.get("concern_tags", [])
            template = existing
        else:
            template = RoutineTemplate(
                name=name,
                description=entry.get("description"),
                routine_type=entry.get("routine_type", "skincare"),
                skin_type_tags=entry.get("skin_type_tags", []),
                concern_tags=entry.get("concern_tags", []),
                seed_version=version,
            )
            db.add(template)

        db.flush()

        for step_data in entry.get("steps", []):
            step = RoutineTemplateStep(
                template_id=template.id,
                step_order=step_data["step_order"],
                step_type=step_data["step_type"],
                time_of_day=step_data["time_of_day"],
                frequency=step_data.get("frequency", "daily"),
                suggested_product_category=step_data.get("suggested_product_category"),
            )
            db.add(step)

        inserted += 1

    db.commit()
    return inserted
