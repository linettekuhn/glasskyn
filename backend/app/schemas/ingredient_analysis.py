from __future__ import annotations

from pydantic import BaseModel


class AnalyzeIngredientsRequest(BaseModel):
    ingredient_text: str
    skin_type: str | None = None


class MatchedIngredient(BaseModel):
    ingredient_name: str
    raw_text: str
    safety_score: int
    known_risks: list[str]
    benefits: list[str]
    confidence: float
    match_type: str


class NotFoundIngredient(BaseModel):
    raw_text: str
    confidence: float


class AnalysisStats(BaseModel):
    total: int
    matched: int
    not_found: int
    avg_safety_score: float
    total_known_risks: int


class IngredientAnalysisResponse(BaseModel):
    method: str
    analysis: str | None = None
    matched: list[MatchedIngredient] = []
    not_found: list[NotFoundIngredient] = []
    stats: AnalysisStats
    overall_safety_score: float | None = None
    flags: list[str] = []
    source_attribution: list[str] = []
