"""Pseudo-label unlabeled images using a trained classifier.

Usage:
    python pseudo_label.py [--threshold 0.95] [--unlabeled-dir ...]

Scans images in data/unlabeled/, runs inference with the trained model,
and copies high-confidence predictions to the appropriate class directory
under data/raw/ for retraining.
"""

import argparse
import shutil
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

CLASSES = ["haircare", "makeup", "skincare"]

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
UNLABELED_DIR = DATA_DIR / "unlabeled"
MODEL_PATH = DATA_DIR / "models" / "resnet50_product_category.pt"

_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


class UnlabeledDataset(Dataset):
    def __init__(self, image_dir):
        self.paths = sorted(
            p for p in Path(image_dir).glob("*.jpg")
            if p.stat().st_size > 0
        )

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        path = self.paths[idx]
        img = Image.open(path).convert("RGB")
        img = _transform(img)
        return img, path.name


@torch.no_grad()
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=0.95,
                        help="Confidence threshold (default: 0.95)")
    parser.add_argument("--unlabeled-dir", type=str, default=str(UNLABELED_DIR))
    parser.add_argument("--model-path", type=str, default=str(MODEL_PATH))
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--num-workers", type=int, default=4)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Load model
    model = models.resnet50(weights=None)
    model.fc = torch.nn.Linear(2048, len(CLASSES))
    model.load_state_dict(
        torch.load(args.model_path, map_location=device, weights_only=True)
    )
    model.to(device)
    model.eval()
    print(f"Loaded model from {args.model_path}")

    # Load unlabeled images
    dataset = UnlabeledDataset(args.unlabeled_dir)
    if len(dataset) == 0:
        print("No unlabeled images found. Run collect_unlabeled.py first.")
        return

    loader = DataLoader(
        dataset, batch_size=args.batch_size,
        shuffle=False, num_workers=args.num_workers,
    )
    print(f"Found {len(dataset):,} unlabeled images")

    # Run inference
    pseudo_labels = {c: [] for c in CLASSES}
    confidences = []

    for images, filenames in loader:
        images = images.to(device)
        logits = model(images)
        probs = torch.softmax(logits, dim=1)
        max_probs, preds = probs.max(dim=1)

        for i in range(len(filenames)):
            conf = max_probs[i].item()
            pred = CLASSES[preds[i].item()]
            fname = filenames[i]

            if conf >= args.threshold:
                pseudo_labels[pred].append((fname, conf))
                confidences.append(conf)

    # Report
    total_pseudo = sum(len(v) for v in pseudo_labels.values())
    print(f"\nPseudo-labels above threshold ({args.threshold}): {total_pseudo}")
    for cls in CLASSES:
        print(f"  {cls}: {len(pseudo_labels[cls])}")

    if confidences:
        print(f"\nConfidence stats:")
        print(f"  Mean: {np.mean(confidences):.4f}")
        print(f"  Min:  {np.min(confidences):.4f}")
        print(f"  Max:  {np.max(confidences):.4f}")

    if total_pseudo == 0:
        print("No pseudo-labels above threshold. Try lowering --threshold.")
        return

    # Create class directories if needed
    for cls in CLASSES:
        (RAW_DIR / cls).mkdir(parents=True, exist_ok=True)

    # Copy pseudo-labeled images to class dirs
    unlabeled_dir = Path(args.unlabeled_dir)
    copied = 0
    for cls, items in pseudo_labels.items():
        dest_dir = RAW_DIR / cls
        for fname, _ in items:
            src = unlabeled_dir / fname
            if src.exists():
                shutil.copy2(src, dest_dir / fname)
                copied += 1

    print(f"\nCopied {copied} pseudo-labeled images to {RAW_DIR}")

    # Summary
    print(f"\nDataset size now:")
    total = 0
    for cls in CLASSES:
        cls_dir = RAW_DIR / cls
        count = sum(1 for p in cls_dir.glob("*.jpg") if p.stat().st_size > 0) if cls_dir.exists() else 0
        total += count
        print(f"  {cls}: {count}")
    print(f"  Total: {total}")
    print(f"  (includes {copied} newly added pseudo-labels)")


if __name__ == "__main__":
    main()
