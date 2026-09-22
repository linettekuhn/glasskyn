from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.middleware.auth import get_current_user, get_db
from app.models.user import User
from app.schemas.ingredient_analysis import (
    AnalyzeIngredientsRequest,
    IngredientAnalysisResponse,
)
from app.services.ingredient_analysis import (
    analyze_ingredient_text,
    get_user_skin_type,
)

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.post("/analyze", response_model=IngredientAnalysisResponse)
async def analyze_ingredients(
    body: AnalyzeIngredientsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    skin_type = body.skin_type or get_user_skin_type(current_user.id, db)
    return analyze_ingredient_text(body.ingredient_text, skin_type, db)
