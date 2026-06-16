from io import BytesIO
from pathlib import Path

import httpx
import torch
import torchvision.transforms as T
from PIL import Image
from torchvision import models

CLASSES = ["haircare", "makeup", "skincare"]

_device = None
_model = None
_transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def _get_model():
    global _model, _device
    if _model is None:
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        _model = models.resnet50(weights=None)
        _model.fc = torch.nn.Linear(2048, len(CLASSES))
        model_path = (
            Path(__file__).resolve().parent.parent.parent
            / "data" / "models" / "resnet50_product_category.pt"
        )
        _model.load_state_dict(
            torch.load(model_path, map_location=_device, weights_only=True)
        )
        _model.to(_device)
        _model.eval()
    return _model


def classify_image(image_url: str) -> tuple[str | None, float | None]:
    try:
        resp = httpx.get(image_url, follow_redirects=True, timeout=15)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content)).convert("RGB")
        tensor = _transform(img).unsqueeze(0)
        model = _get_model()
        with torch.no_grad():
            logits = model(tensor.to(_device))
            probs = torch.softmax(logits, dim=1)
            conf, idx = probs.max(1)
        return CLASSES[idx.item()], conf.item()
    except Exception:
        return None, None
