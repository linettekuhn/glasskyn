import logging

from app.classifier.model import classify_image as _classify_image

logger = logging.getLogger(__name__)

CLASSIFIER_CONFIDENCE_THRESHOLD = 0.7


def classify_image(image_url: str) -> tuple[str | None, str | None]:
    category, confidence = _classify_image(image_url)
    if category and confidence and confidence >= CLASSIFIER_CONFIDENCE_THRESHOLD:
        logger.info(
            "ML classifier: %s (confidence=%.3f)", category, confidence
        )
        return category, "ml_classifier"
    if category:
        logger.info(
            "ML classifier below threshold: %s (confidence=%.3f)",
            category, confidence,
        )
    return None, None
