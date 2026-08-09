from __future__ import annotations

import json
import logging
from typing import Optional

import openai
from langchain_core.tools import tool
from sqlalchemy.orm import Session

from app.core.config import OPENAI_API_KEY, OPENAI_MODEL
from app.models.product import Product
from app.models.routine import SkinProfile, Routine, RoutineStep
from app.services.rag_retrieval import retrieve_single, retrieve_safety_records

logger = logging.getLogger(__name__)

LLM_TIMEOUT_SECS = 30


def _format_single_ingredient(record: dict) -> str:
    meta = record.get("metadata", {})
    name = record.get("canonical_name") or meta.get("ingredient_name") or record.get("id", "?")
    score = meta.get("safety_score", "?")
    risks = json.loads(meta.get("known_risks", "[]")) if meta.get("known_risks") else []
    benefits = json.loads(meta.get("benefits", "[]")) if meta.get("benefits") else []
    irritancy = meta.get("irritancy", "?")
    comedogenicity = meta.get("comedogenicity", "?")
    conf = record.get("confidence", 1.0)
    mtype = record.get("match_type", "?")

    lines = [f"{name} (safety_score={score}/10, match={mtype}, confidence={conf})"]
    if risks:
        lines.append(f"  Risks: {', '.join(risks)}")
    if benefits:
        lines.append(f"  Benefits: {', '.join(benefits)}")
    lines.append(f"  Irritancy: {irritancy}, Comedogenicity: {comedogenicity}")
    return "\n".join(lines)


def _format_multi_ingredients(result: dict) -> str:
    matched = result.get("matched", [])
    not_found = result.get("not_found", [])
    stats = result.get("stats", {})

    if not matched and not not_found:
        return "No ingredients found in the safety database."

    lines = []
    lines.append(f"Found {stats.get('matched', 0)}/{stats.get('total', 0)} ingredients "
                 f"(avg safety score: {stats.get('avg_safety_score', 0)})")

    for m in matched:
        meta = m.get("metadata", {})
        name = m.get("canonical_name") or meta.get("ingredient_name") or m.get("id", "?")
        score = meta.get("safety_score", "?")
        risks = json.loads(meta.get("known_risks", "[]")) if meta.get("known_risks") else []
        benefits = json.loads(meta.get("benefits", "[]")) if meta.get("benefits") else []
        conf = m.get("confidence", 1.0)
        conf_note = "" if conf >= 0.8 else " (approximate match)"
        risk_str = f", risks={risks}" if risks else ""
        benefit_str = f", benefits={benefits}" if benefits else ""
        lines.append(f"- {name}: score={score}{risk_str}{benefit_str} (conf={conf}{conf_note})")

    if not_found:
        lines.append("\nIngredients with no safety data:")
        for nf in not_found:
            lines.append(f"- {nf['raw_text']}")

    return "\n".join(lines)


def create_agent_tools(db: Session, user_id: int) -> list:
    @tool
    def lookup_ingredient_safety(ingredient_text: str) -> str:
        """Look up safety data for cosmetic ingredients from the verified safety database.

        Use this when the user asks about ingredient safety, risks, benefits,
        comedogenicity, irritancy, or wants to analyze a product's ingredient list.
        Accepts a single ingredient name (e.g. "retinol") or a comma/INCI-separated
        list (e.g. "water, glycerin, niacinamide, retinol").

        Returns safety scores (0-10, lower is safer), known risks, benefits,
        irritancy, and comedogenicity ratings for each ingredient found."""
        try:
            text = ingredient_text.strip()
            if not text:
                return "Please provide at least one ingredient to look up."

            parts = [p.strip() for p in text.replace(";", ",").split(",") if p.strip()]

            if len(parts) == 1:
                record = retrieve_single(parts[0])
                if record:
                    return _format_single_ingredient(record)
                return f"Ingredient '{parts[0]}' not found in the safety database."

            result = retrieve_safety_records(text)
            return _format_multi_ingredients(result)

        except Exception as e:
            logger.error("lookup_ingredient_safety failed: %s", e)
            return f"Error looking up ingredients: {e}"

    @tool
    def query_user_products(
        product_type: Optional[str] = None,
        category: Optional[str] = None,
    ) -> str:
        """Query the user's saved products from their shelf.

        Use this when the user asks about their products, wants to see what they own,
        asks about a specific product type (moisturizer, cleanser, serum, etc.),
        or wants products filtered by category (skincare, makeup, haircare).

        Call with no arguments to get all products. Optionally filter by
        product_type or category."""
        try:
            query = db.query(Product).filter(Product.user_id == user_id)

            if product_type:
                query = query.filter(Product.product_type == product_type.lower().strip())
            if category:
                query = query.filter(Product.category == category.lower().strip())

            products = query.order_by(Product.created_at.desc()).all()

            if not products:
                parts = []
                if product_type:
                    parts.append(f"type='{product_type}'")
                if category:
                    parts.append(f"category='{category}'")
                filter_str = f" matching {' and '.join(parts)}" if parts else ""
                return f"No products found{filter_str} in your shelf."

            lines = [f"Found {len(products)} product(s):"]
            for p in products:
                parts_list = []
                if p.product_type:
                    parts_list.append(p.product_type)
                if p.category:
                    parts_list.append(p.category)
                detail = f" ({', '.join(parts_list)})" if parts_list else ""
                brand_str = f" by {p.brand}" if p.brand else ""
                lines.append(f"- {p.id}: {p.name}{brand_str}{detail}")

            return "\n".join(lines)

        except Exception as e:
            logger.error("query_user_products failed: %s", e)
            return f"Error querying products: {e}"

    @tool
    def summarize_safety(
        ingredient_data: str,
        skin_type: Optional[str] = None,
    ) -> str:
        """Generate a personalized, easy-to-understand safety summary for ingredient data.

        Use this AFTER calling lookup_ingredient_safety to turn raw scores and risk
        data into a plain-language assessment. The ingredient_data parameter should
        be the output from lookup_ingredient_safety.

        Optionally provide the user's skin type (dry, oily, combination, sensitive,
        normal) for personalized concerns."""
        if not OPENAI_API_KEY:
            return "LLM not available for summarization. Please review the raw ingredient data directly."

        skin_ctx = f"The user has {skin_type} skin." if skin_type else "The user's skin type is unknown."

        system_prompt = (
            "You are a cosmetic safety expert. Based on the verified ingredient data below, "
            "provide a concise safety summary in plain language:\n"
            "1. Overall safety assessment (2-3 sentences)\n"
            "2. Key concerns for the user's skin type\n"
            "3. Notable benefits\n"
            "4. Any ingredients to watch out for\n\n"
            f"{skin_ctx}\n\n"
            f"Ingredient data:\n{ingredient_data}"
        )

        try:
            client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=LLM_TIMEOUT_SECS)
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "Summarize this ingredient safety data."},
                ],
                temperature=0,
                max_tokens=400,
            )
            content = response.choices[0].message.content
            return content or "No summary generated."

        except Exception as e:
            logger.error("summarize_safety LLM call failed: %s", e)
            return f"Error generating summary: {e}. Here is the raw data to review:\n{ingredient_data}"

    @tool
    def generate_routine(goals: str = "") -> str:
        """Generate a complete skincare routine based on the user's skin profile
        and their existing products. Call this when the user asks you to create,
        build, or generate a routine for them.

        The tool will:
        1. Look up the user's skin profile (type, concerns, goals)
        2. Look up their existing products
        3. Use an AI expert to design a personalized routine
        4. Fill gaps with suggested product types where the user has nothing suitable

        Returns a structured routine with steps ordered correctly for AM/PM,
        with step types (cleanse, tone, treat, moisturize, spf), times of day,
        frequencies, and product assignments where possible."""
        try:
            profile = db.query(SkinProfile).filter(SkinProfile.user_id == user_id).first()
            products = db.query(Product).filter(Product.user_id == user_id).all()

            profile_str = "No skin profile on file."
            if profile:
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
                    lines.append(f"- {p.name} (id={p.id}, type={p.product_type}, category={p.category})")
                products_str = "\n".join(lines)

            system_prompt = (
                "You are a professional esthetician and skincare routine designer. "
                "Given a user's skin profile and their existing products, design a "
                "personalized skincare routine.\n\n"
                "Return ONLY valid JSON with no markdown fencing, no explanation. "
                "The JSON must have this exact structure:\n"
                "{\n"
                '  "name": "Routine name (descriptive)",\n'
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
                "- Order steps correctly (cleanse, tone, treat, moisturize, spf for AM; "
                "cleanse, treat, moisturize for PM)\n"
                "- If the user owns a product matching the step type, set product_id to its id\n"
                "- If they don't own a matching product, set product_id to null and suggest what to look for\n"
                "- Include SPF in AM routine\n"
                "- Cover both AM and PM unless user specifies otherwise\n"
                "- Suit the user's skin type, concerns, and goals\n"
                f"\nUser Profile:\n{profile_str}\n\n{products_str}"
            )

            client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=LLM_TIMEOUT_SECS)
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
            try:
                parsed = json.loads(content)
                steps = parsed.get("steps", [])
                summary = f"**{parsed.get('name', 'Your Personalized Routine')}**\n\n"
                for s in steps:
                    product = ""
                    if s.get("product_id"):
                        product = f" \u2192 {s.get('product_name', '')}"
                    elif s.get("suggested_product_type"):
                        product = f" \u2192 *need: {s['suggested_product_type']}*"
                    summary += (
                        f"{s['time_of_day']} | {s['step_type']}{product} "
                        f"({s['frequency']})\n"
                    )
                summary += f"\n\nRaw data:\n{content}"

                db.query(Routine).filter(
                    Routine.user_id == user_id,
                    Routine.is_active == True,
                ).update({"is_active": False})
                routine = Routine(
                    user_id=user_id,
                    name=parsed.get("name", "AI-Generated Routine"),
                    source="llm_generated",
                    routine_type="skincare",
                    is_active=True,
                )
                db.add(routine)
                db.flush()
                for s in steps:
                    db.add(RoutineStep(
                        routine_id=routine.id,
                        step_order=s["step_order"],
                        product_id=s.get("product_id"),
                        step_type=s["step_type"],
                        time_of_day=s["time_of_day"],
                        frequency=s.get("frequency", "daily"),
                    ))
                db.commit()
                return summary
            except json.JSONDecodeError:
                return f"Generated routine data:\n{content}"

        except Exception as e:
            logger.error("generate_routine failed: %s", e)
            return f"Error generating routine: {e}"

    @tool
    def recommend_products(
        step_type: str,
        skin_type: str = "",
        concerns: str = "",
    ) -> str:
        """Recommend products from the user's shelf for a specific routine step type.

        Use when the user asks what products they have for a step, what to use,
        or wants suggestions based on their skin type/concerns.

        Args:
            step_type: The routine step type (cleanse, tone, treat, moisturize, spf)
            skin_type: Optional skin type context (dry, oily, combination, sensitive)
            concerns: Optional comma-separated concerns (acne, aging, redness, etc.)"""
        try:
            step_to_types = {
                "cleanse": ["cleanser"],
                "tone": ["toner"],
                "treat": ["serum", "exfoliant", "mask", "spot_treatment"],
                "moisturize": ["moisturizer", "oil"],
                "spf": ["spf"],
            }
            product_types = step_to_types.get(step_type, [step_type])

            products = (
                db.query(Product)
                .filter(
                    Product.user_id == user_id,
                    Product.product_type.in_(product_types),
                )
                .all()
            )

            if not products:
                return (
                    f"You don't have any products for the '{step_type}' step. "
                    f"Look for a {', '.join(product_types)} that suits your skin type."
                )

            lines = [f"Products for **{step_type}** step:"]
            for p in products:
                lines.append(f"\n**{p.name}**" + (f" by {p.brand}" if p.brand else ""))
                try:
                    record = retrieve_single(p.name)
                    if record:
                        meta = record.get("metadata", {})
                        risks = json.loads(meta.get("known_risks", "[]")) if meta.get("known_risks") else []
                        benefits = json.loads(meta.get("benefits", "[]")) if meta.get("benefits") else []
                        if benefits:
                            lines.append(f"  Benefits: {', '.join(benefits[:3])}")
                        if risks:
                            lines.append(f"  Note: {', '.join(risks[:2])}")
                except Exception:
                    pass

            if skin_type:
                lines.append(f"\nTip: For {skin_type} skin, choose products "
                             "with soothing ingredients and avoid harsh actives.")

            return "\n".join(lines)

        except Exception as e:
            logger.error("recommend_products failed: %s", e)
            return f"Error recommending products: {e}"

    @tool
    def modify_routine(request: str) -> str:
        """Modify the user's current active routine based on a natural language request.

        Use when the user asks to change, swap, replace, add, or remove a step
        in their routine. Examples: 'swap my moisturizer for something lighter',
        'change my cleanser', 'add a serum to my PM routine', 'remove the toner step'.

        This tool directly updates the database.

        Args:
            request: Natural language description of the desired change"""
        try:
            routine = (
                db.query(Routine)
                .filter(
                    Routine.user_id == user_id,
                    Routine.is_active == True,
                )
                .order_by(Routine.id.desc())
                .first()
            )
            if not routine:
                return "You don't have an active routine. Create one first with generate_routine."

            steps = (
                db.query(RoutineStep)
                .filter(RoutineStep.routine_id == routine.id)
                .order_by(RoutineStep.step_order)
                .all()
            )

            products = db.query(Product).filter(Product.user_id == user_id).all()

            steps_str = "\n".join(
                f"Step {s.step_order}: {s.time_of_day} {s.step_type} "
                f"(step_id={s.id}, product_id={s.product_id}, freq={s.frequency})"
                for s in steps
            )
            products_str = "\n".join(
                f"id={p.id}: {p.name} ({p.product_type})" for p in products
            )

            system_prompt = (
                "You are a routine modification assistant. Given the user's request, "
                "current routine, and their available products, determine what change to make.\n\n"
                f"Current routine '{routine.name}':\n{steps_str}\n\n"
                f"Available products:\n{products_str}\n\n"
                "Return ONLY valid JSON with no markdown:\n"
                "{\n"
                '  "action": "swap|add|remove|replace_step_type",\n'
                '  "step_id": integer or null (must be the exact step_id shown in the routine listing above),\n'
                '  "target_step_type": "cleanse|tone|treat|moisturize|spf" or null,\n'
                '  "time_of_day": "AM|PM" or null,\n'
                '  "product_id": integer or null,\n'
                '  "product_name": "name" or null,\n'
                '  "new_step_type": "step type" or null,\n'
                '  "explanation": "brief description of what changed"\n'
                "}\n"
                "Rules:\n"
                "- For remove, swap, or replace_step_type you MUST set step_id to the "
                "exact integer from the routine listing above.\n"
                "- If the request doesn't clearly identify one step, also set "
                "target_step_type and time_of_day to disambiguate.\n"
                f"User's request: {request}"
            )

            client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=LLM_TIMEOUT_SECS)
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Modify the routine: {request}"},
                ],
                temperature=0,
                max_tokens=500,
            )
            content = response.choices[0].message.content.strip()
            parsed = json.loads(content)
            logger.info("modify_routine parsed request: %s", parsed)
            action = parsed.get("action")

            def _find_step(step_id):
                if step_id is None:
                    return None
                return next(
                    (s for s in steps if s.id == step_id or s.step_order == step_id),
                    None,
                )

            def _find_step_by_type():
                step_type = (parsed.get("target_step_type") or "").strip().lower()
                time_of_day = (parsed.get("time_of_day") or "").strip().upper()
                if not step_type:
                    return None
                matches = [
                    s for s in steps
                    if s.step_type == step_type
                    and (not time_of_day or s.time_of_day == time_of_day)
                ]
                return matches[0] if matches else None

            def _not_found_message():
                if not steps:
                    return "Your routine currently has no steps to modify."
                listed = ", ".join(
                    f"{s.time_of_day} {s.step_type} (step {s.step_order})"
                    for s in steps
                )
                target = parsed.get("target_step_type") or "that step"
                return (
                    f"I couldn't find a {target} step in "
                    f"{(parsed.get('time_of_day') or 'your routine').upper()}. "
                    f"Your routine '{routine.name}' currently has: {listed}."
                )

            if action == "swap" or action == "replace_step_type":
                step_id = parsed.get("step_id")
                product_id = parsed.get("product_id")
                step = _find_step(step_id) or _find_step_by_type()
                if step:
                    if product_id:
                        step.product_id = product_id
                    if parsed.get("new_step_type"):
                        step.step_type = parsed["new_step_type"]
                    if parsed.get("time_of_day"):
                        step.time_of_day = parsed["time_of_day"]
                    db.commit()
                    return f"Done. {parsed.get('explanation', 'Routine updated.')}"
                return _not_found_message()

            elif action == "add":
                new_step = RoutineStep(
                    routine_id=routine.id,
                    step_order=len(steps) + 1,
                    product_id=parsed.get("product_id"),
                    step_type=parsed.get("target_step_type", "other"),
                    time_of_day=parsed.get("time_of_day", "AM"),
                    frequency=parsed.get("frequency", "daily"),
                )
                db.add(new_step)
                db.commit()
                return f"Done. {parsed.get('explanation', 'Step added.')}"

            elif action == "remove":
                step_id = parsed.get("step_id")
                step = _find_step(step_id) or _find_step_by_type()
                if step:
                    db.delete(step)
                    db.commit()
                    return f"Done. {parsed.get('explanation', 'Step removed.')}"
                return _not_found_message()

            return f"Applied change: {parsed.get('explanation', content)}"

        except json.JSONDecodeError:
            return f"Could not parse modification. Raw response: {content}"
        except Exception as e:
            logger.error("modify_routine failed: %s", e)
            return f"Error modifying routine: {e}"

    return [lookup_ingredient_safety, query_user_products, summarize_safety,
            generate_routine, recommend_products, modify_routine]
