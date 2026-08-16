from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.middleware.auth import get_db, get_current_user
from app.models.user import User
from app.models.routine import SkinProfile, Routine, RoutineStep, RoutineTemplate, RoutineTemplateStep
from app.models.routine_step_completion import RoutineStepCompletion
from app.schemas.routine import (
    SkinProfileCreate, SkinProfileUpdate, SkinProfileOut,
    RoutineCreate, RoutineUpdate, RoutineOut, RoutineStepOut, RoutineStepUpdate,
    RoutineTemplateOut, TemplateCloneRequest, StepCompleteIn, CalendarDayOut,
    MainRoutineSet,
)
import json

from datetime import date, datetime, timedelta
from collections import Counter

import openai
from app.core.config import OPENAI_API_KEY, OPENAI_MODEL
from app.models.product import Product
from app.services.routine import clone_template_to_routine, set_main_routine, promote_main_routine
from typing import List, Optional

router = APIRouter(prefix="/routines", tags=["routines"])


def _attach_completed_today(db: Session, user_id: int, steps, on_date: date) -> None:
    """Set step.completed_today for each step based on completion rows on on_date."""
    if not steps:
        return
    step_ids = [s.id for s in steps]
    done = set(
        row[0]
        for row in db.query(RoutineStepCompletion.step_id)
        .filter(
            RoutineStepCompletion.user_id == user_id,
            RoutineStepCompletion.step_id.in_(step_ids),
            RoutineStepCompletion.completed_on == on_date,
        )
        .all()
    )
    for s in steps:
        s.completed_today = s.id in done


# --- Skin Profile (static paths, no {routine_id} conflict) ---

@router.get("/skin-profile", response_model=SkinProfileOut)
def get_skin_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(SkinProfile).filter(SkinProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No skin profile found")
    return profile


@router.put("/skin-profile", response_model=SkinProfileOut)
def upsert_skin_profile(
    body: SkinProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(SkinProfile).filter(SkinProfile.user_id == current_user.id).first()
    if profile:
        updates = body.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(profile, field, value)
    else:
        profile = SkinProfile(user_id=current_user.id, **body.model_dump(exclude_unset=True))
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


# --- Templates (static paths before {routine_id}) ---

@router.get("/templates", response_model=List[RoutineTemplateOut])
def list_templates(
    routine_type: str = "skincare",
    skin_type: str = None,
    concern: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(RoutineTemplate).filter(RoutineTemplate.routine_type == routine_type, RoutineTemplate.is_active == True)

    if skin_type:
        query = query.filter(RoutineTemplate.skin_type_tags.contains([skin_type]))
    if concern:
        query = query.filter(RoutineTemplate.concern_tags.contains([concern]))

    templates = query.all()
    for t in templates:
        t.steps = (
            db.query(RoutineTemplateStep)
            .filter(RoutineTemplateStep.template_id == t.id)
            .order_by(RoutineTemplateStep.step_order)
            .all()
        )
    return templates


@router.get("/templates/{template_id}", response_model=RoutineTemplateOut)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = db.query(RoutineTemplate).filter(RoutineTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    template.steps = (
        db.query(RoutineTemplateStep)
        .filter(RoutineTemplateStep.template_id == template.id)
        .order_by(RoutineTemplateStep.step_order)
        .all()
    )
    return template


@router.post("/clone", response_model=RoutineOut, status_code=201)
def clone_template(
    body: TemplateCloneRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = db.query(RoutineTemplate).filter(RoutineTemplate.id == body.template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    routine = clone_template_to_routine(db, current_user.id, template, name=body.name)
    routine.steps = db.query(RoutineStep).filter(RoutineStep.routine_id == routine.id).order_by(RoutineStep.step_order).all()
    return routine


@router.post("/generate", response_model=RoutineOut, status_code=201)
def generate_routine(
    goals: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a skincare routine using AI based on the user's skin profile
    and existing products, then save it."""
    profile = db.query(SkinProfile).filter(SkinProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete your skin profile first before generating a routine.",
        )

    products = db.query(Product).filter(Product.user_id == current_user.id).all()

    concerns = ", ".join(profile.concerns or [])
    goals_list = ", ".join(profile.goals or [])
    profile_str = (
        f"Skin type: {profile.skin_type or 'unknown'}\n"
        f"Sensitive: {'yes' if profile.is_sensitive else 'no'}\n"
        f"Concerns: {concerns or 'none'}\n"
        f"Goals: {goals_list or 'none'}"
    )
    if goals:
        profile_str += f"\nUser's additional goals: {goals}"

    products_str = "No products saved yet."
    if products:
        lines = [f"User owns {len(products)} product(s):"]
        for p in products:
            lines.append(f"- id={p.id}, name={p.name}, type={p.product_type}, category={p.category}")
        products_str = "\n".join(lines)

    system_prompt = (
        "You are a professional esthetician and skincare routine designer. "
        "Given a user's skin profile and their existing products, design a "
        "personalized skincare routine.\n\n"
        "Return ONLY valid JSON with no markdown fencing, no explanation. "
        "The JSON must have this exact structure:\n"
        "{\n"
        '  "name": "Descriptive routine name",\n'
        '  "steps": [\n'
        "    {\n"
        '      "step_order": 1,\n'
        '      "step_type": "cleanse|tone|treat|moisturize|spf|other",\n'
        '      "time_of_day": "AM|PM",\n'
        '      "frequency": "daily|every_other_day|weekly",\n'
        '      "product_id": null or integer,\n'
        '      "product_name": "exact product name if matched, else null",\n'
        '      "suggested_product_type": null or "product type to look for"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Correct step order for AM: cleanse, tone, treat, moisturize, spf\n"
        "- Correct step order for PM: (double) cleanse, tone, treat, moisturize\n"
        "- If user owns a matching product, set product_id to its id\n"
        "- If no matching product, set product_id to null and suggest what to look for\n"
        "- Include SPF in AM routine\n"
        "- Cover both AM and PM unless user specifies otherwise\n"
        "- Suit the skin type, concerns, and goals\n"
        f"\nUser Profile:\n{profile_str}\n\n{products_str}"
    )

    try:
        client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=30)
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Design a skincare routine for me."},
            ],
            temperature=0.3,
            max_tokens=1000,
        )
        content = response.choices[0].message.content.strip()
        parsed = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse generated routine",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI generation failed: {e}",
        )

    routine = Routine(
        user_id=current_user.id,
        name=parsed.get("name", "AI-Generated Routine"),
        source="llm_generated",
        routine_type="skincare",
    )
    db.add(routine)
    db.flush()
    set_main_routine(db, routine)

    for s in parsed.get("steps", []):
        step = RoutineStep(
            routine_id=routine.id,
            step_order=s["step_order"],
            product_id=s.get("product_id"),
            step_type=s["step_type"],
            time_of_day=s["time_of_day"],
            frequency=s.get("frequency", "daily"),
        )
        db.add(step)

    db.commit()
    db.refresh(routine)
    routine.steps = (
        db.query(RoutineStep)
        .filter(RoutineStep.routine_id == routine.id)
        .order_by(RoutineStep.step_order)
        .all()
    )
    return routine


@router.get("/suggested", response_model=List[RoutineTemplateOut])
def get_suggested_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(SkinProfile).filter(SkinProfile.user_id == current_user.id).first()
    if not profile:
        return []

    tags = []
    if profile.skin_type:
        tags.append(profile.skin_type)
    if profile.concerns:
        tags.extend(profile.concerns)

    query = db.query(RoutineTemplate).filter(RoutineTemplate.routine_type == "skincare", RoutineTemplate.is_active == True)

    if tags:
        tag_filters = [RoutineTemplate.skin_type_tags.contains([t]) for t in tags]
        tag_filters += [RoutineTemplate.concern_tags.contains([t]) for t in tags]
        query = query.filter(or_(*tag_filters))

    templates = query.limit(3).all()
    for t in templates:
        t.steps = (
            db.query(RoutineTemplateStep)
            .filter(RoutineTemplateStep.template_id == t.id)
            .order_by(RoutineTemplateStep.step_order)
            .all()
        )
    return templates


# --- Routines (contains {routine_id} dynamic segment, must come after static paths) ---

@router.post("", response_model=RoutineOut, status_code=201)
def create_routine(
    body: RoutineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = Routine(
        user_id=current_user.id,
        name=body.name,
        source=body.source,
        routine_type=body.routine_type,
    )
    db.add(routine)
    db.flush()
    set_main_routine(db, routine)

    if body.steps:
        for s in body.steps:
            step = RoutineStep(
                routine_id=routine.id,
                step_order=s.step_order,
                product_id=s.product_id,
                step_type=s.step_type,
                time_of_day=s.time_of_day,
                frequency=s.frequency,
            )
            db.add(step)

    db.commit()
    db.refresh(routine)
    routine.steps = db.query(RoutineStep).filter(RoutineStep.routine_id == routine.id).order_by(RoutineStep.step_order).all()
    return routine


@router.get("", response_model=List[RoutineOut])
def list_routines(
    routine_type: str = "skincare",
    on_date: Optional[date] = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    on_date = on_date or date.today()
    routines = (
        db.query(Routine)
        .filter(Routine.user_id == current_user.id, Routine.routine_type == routine_type)
        .order_by(Routine.created_at.desc())
        .all()
    )
    for r in routines:
        r.steps = db.query(RoutineStep).filter(RoutineStep.routine_id == r.id).order_by(RoutineStep.step_order).all()
        _attach_completed_today(db, current_user.id, r.steps, on_date)
    return routines


@router.get("/main", response_model=RoutineOut)
def get_main_routine(
    routine_type: str = "skincare",
    on_date: Optional[date] = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    on_date = on_date or date.today()
    routine = (
        db.query(Routine)
        .filter(
            Routine.user_id == current_user.id,
            Routine.is_main_routine == True,
            Routine.routine_type == routine_type,
        )
        .order_by(Routine.created_at.desc())
        .first()
    )
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No main routine found")
    routine.steps = db.query(RoutineStep).filter(RoutineStep.routine_id == routine.id).order_by(RoutineStep.step_order).all()
    _attach_completed_today(db, current_user.id, routine.steps, on_date)
    return routine


@router.put("/main", response_model=RoutineOut)
def set_main_routine_endpoint(
    body: MainRoutineSet,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine_type = "skincare"
    if body.routine_id is not None:
        routine = (
            db.query(Routine)
            .filter(
                Routine.id == body.routine_id,
                Routine.user_id == current_user.id,
                Routine.routine_type == routine_type,
            )
            .first()
        )
        if not routine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")
    else:
        routine = (
            db.query(Routine)
            .filter(
                Routine.user_id == current_user.id,
                Routine.routine_type == routine_type,
            )
            .order_by(Routine.created_at.desc())
            .first()
        )
        if not routine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No routines found")

    set_main_routine(db, routine)
    db.commit()
    db.refresh(routine)
    routine.steps = db.query(RoutineStep).filter(RoutineStep.routine_id == routine.id).order_by(RoutineStep.step_order).all()
    return routine


@router.get("/calendar", response_model=List[CalendarDayOut])
def get_routine_calendar(
    routine_id: int,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id, Routine.user_id == current_user.id)
        .first()
    )
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    today = date.today()
    month = month or today.month
    year = year or today.year
    first_day = date(year, month, 1)
    next_month = first_day.replace(day=28) + timedelta(days=4)
    last_day = next_month.replace(day=1) - timedelta(days=1)

    steps = (
        db.query(RoutineStep)
        .filter(RoutineStep.routine_id == routine.id)
        .all()
    )
    daily_step_ids = [s.id for s in steps if s.frequency == "daily"]
    daily_count = len(daily_step_ids)

    completed_days: Counter = Counter()
    if daily_step_ids:
        rows = (
            db.query(RoutineStepCompletion.completed_on)
            .filter(
                RoutineStepCompletion.user_id == current_user.id,
                RoutineStepCompletion.routine_id == routine.id,
                RoutineStepCompletion.step_id.in_(daily_step_ids),
                RoutineStepCompletion.completed_on >= first_day,
                RoutineStepCompletion.completed_on <= last_day,
            )
            .all()
        )
        completed_days.update(day for (day,) in rows)

    days = []
    cursor = first_day
    while cursor <= last_day:
        days.append(
            CalendarDayOut(
                date=cursor,
                completed=daily_count > 0 and completed_days[cursor] == daily_count,
            )
        )
        cursor += timedelta(days=1)
    return days


@router.get("/{routine_id}", response_model=RoutineOut)
def get_routine(
    routine_id: int,
    on_date: Optional[date] = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    on_date = on_date or date.today()
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id, Routine.user_id == current_user.id)
        .first()
    )
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")
    routine.steps = db.query(RoutineStep).filter(RoutineStep.routine_id == routine.id).order_by(RoutineStep.step_order).all()
    _attach_completed_today(db, current_user.id, routine.steps, on_date)
    return routine


@router.patch("/{routine_id}", response_model=RoutineOut)
def update_routine(
    routine_id: int,
    body: RoutineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id, Routine.user_id == current_user.id)
        .first()
    )
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    updates = body.model_dump(exclude_unset=True, exclude={"steps"})
    for field, value in updates.items():
        setattr(routine, field, value)

    if body.is_main_routine is True:
        set_main_routine(db, routine)

    if body.steps is not None:
        db.query(RoutineStep).filter(RoutineStep.routine_id == routine.id).delete()
        for s in body.steps:
            step = RoutineStep(
                routine_id=routine.id,
                step_order=s.step_order,
                product_id=s.product_id,
                step_type=s.step_type,
                time_of_day=s.time_of_day,
                frequency=s.frequency,
            )
            db.add(step)

    db.commit()
    db.refresh(routine)
    routine.steps = db.query(RoutineStep).filter(RoutineStep.routine_id == routine.id).order_by(RoutineStep.step_order).all()
    return routine


@router.delete("/{routine_id}", status_code=204)
def delete_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id, Routine.user_id == current_user.id)
        .first()
    )
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")
    was_main = routine.is_main_routine
    routine_type = routine.routine_type
    db.delete(routine)
    db.commit()
    if was_main:
        promote_main_routine(db, current_user.id, routine_type)
        db.commit()
    return None


@router.patch("/{routine_id}/steps/{step_id}", response_model=RoutineStepOut)
def update_routine_step(
    routine_id: int,
    step_id: int,
    body: RoutineStepUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id, Routine.user_id == current_user.id)
        .first()
    )
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    step = (
        db.query(RoutineStep)
        .filter(RoutineStep.id == step_id, RoutineStep.routine_id == routine_id)
        .first()
    )
    if not step:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Step not found")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(step, field, value)
    db.commit()
    db.refresh(step)
    return step


@router.patch("/{routine_id}/steps/{step_id}/complete", response_model=RoutineStepOut)
def mark_step_complete(
    routine_id: int,
    step_id: int,
    body: StepCompleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id, Routine.user_id == current_user.id)
        .first()
    )
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found")

    step = (
        db.query(RoutineStep)
        .filter(RoutineStep.id == step_id, RoutineStep.routine_id == routine_id)
        .first()
    )
    if not step:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Step not found")

    completed_on = body.date or date.today()

    existing = (
        db.query(RoutineStepCompletion)
        .filter(
            RoutineStepCompletion.user_id == current_user.id,
            RoutineStepCompletion.step_id == step_id,
            RoutineStepCompletion.completed_on == completed_on,
        )
        .first()
    )

    if body.completed:
        if not existing:
            db.add(
                RoutineStepCompletion(
                    user_id=current_user.id,
                    routine_id=routine.id,
                    step_id=step.id,
                    completed_on=completed_on,
                )
            )
    else:
        if existing:
            db.delete(existing)

    db.commit()
    db.refresh(step)
    step.completed_today = body.completed
    return step
