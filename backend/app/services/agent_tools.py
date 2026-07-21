from __future__ import annotations

import json
import logging
from typing import Optional

import openai
from langchain_core.tools import tool
from sqlalchemy.orm import Session

from app.core.config import OPENAI_API_KEY, OPENAI_MODEL
from app.models.product import Product
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

    return [lookup_ingredient_safety, query_user_products, summarize_safety]
