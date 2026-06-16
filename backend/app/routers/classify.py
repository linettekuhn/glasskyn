import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.classifier.model import classify_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/classify", tags=["classify"])


class ClassifyRequest(BaseModel):
    image_url: str


class ClassifyResponse(BaseModel):
    category: str | None = None
    confidence: float | None = None
    error: str | None = None


@router.post("/", response_model=ClassifyResponse)
def classify(request: ClassifyRequest):
    category, confidence = classify_image(request.image_url)
    if category is None:
        return ClassifyResponse(error="Classification failed")
    return ClassifyResponse(category=category, confidence=confidence)
