import logging
import httpx
from google.cloud import vision
from google.cloud.vision import ImageAnnotatorClient
from app.core.config import GOOGLE_APPLICATION_CREDENTIALS

logger = logging.getLogger(__name__)

_client: ImageAnnotatorClient | None = None


def _get_client() -> ImageAnnotatorClient:
    global _client
    if _client is None:
        logger.info("Initializing Google Vision client with credentials: %s", GOOGLE_APPLICATION_CREDENTIALS)
        _client = ImageAnnotatorClient.from_service_account_json(GOOGLE_APPLICATION_CREDENTIALS)
    return _client


def detect_text(image_url: str) -> dict:
    client = _get_client()

    logger.info("Downloading image from: %s", image_url)
    response = httpx.get(image_url, follow_redirects=True, timeout=30)
    response.raise_for_status()
    content = response.content
    logger.info("Downloaded %d bytes", len(content))

    image = vision.Image(content=content)
    result = client.text_detection(image=image)

    if result.error.message:
        raise RuntimeError(f"Vision API error: {result.error.message}")

    raw_text = ""
    annotations = []
    if result.text_annotations:
        raw_text = result.text_annotations[0].description
        for ann in result.text_annotations:
            vertices = [(v.x, v.y) for v in ann.bounding_poly.vertices]
            annotations.append({
                "text": ann.description,
                "confidence": ann.confidence if hasattr(ann, 'confidence') and ann.confidence else None,
                "bounding_box": vertices,
            })

    logger.info("OCR extracted %d characters", len(raw_text))
    return {
        "raw_text": raw_text,
        "annotations": annotations,
    }
