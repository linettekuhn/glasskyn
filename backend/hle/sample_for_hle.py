"""Sample examples from a dataset for human-level error estimation.

Splits the data into a blind sample (no labels shown) and an answer key,
enforcing separation at the file level so labels are never visible during
the labeling phase.

Supports two input formats:
  - Native: columns id, input, ground_truth_label, model_prediction
  - Manifest: columns code, label, imgid (auto-detected, model predictions
    generated from the trained ResNet-50)
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

CLASSES = ["haircare", "makeup", "skincare"]
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
MODEL_PATH = DATA_DIR / "models" / "resnet50_product_category.pt"

_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


class ImagePathDataset(Dataset):
    def __init__(self, paths):
        self.paths = [Path(p) for p in paths]

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        path = self.paths[idx]
        try:
            img = Image.open(path).convert("RGB")
            return _transform(img), path.name
        except Exception:
            return None, path.name


def load_dataset(path: str) -> pd.DataFrame:
    p = Path(path)
    if p.suffix == ".json":
        return pd.read_json(p)
    return pd.read_csv(p)


def detect_format(df: pd.DataFrame) -> str:
    if {"code", "label", "imgid"}.issubset(df.columns):
        return "manifest"
    if {"id", "input", "ground_truth_label", "model_prediction"}.issubset(df.columns):
        return "native"
    return "unknown"


def normalize_manifest(df: pd.DataFrame, data_dir: Path) -> pd.DataFrame:
    records = []
    for _, row in df.iterrows():
        code = str(row["code"]).strip()
        label = str(row["label"]).strip()
        img_path = data_dir / "raw" / label / f"{code}.jpg"
        records.append({
            "id": code,
            "input": str(img_path),
            "ground_truth_label": label,
            "file_exists": img_path.exists(),
        })
    return pd.DataFrame(records)


@torch.no_grad()
def run_model_inference(df: pd.DataFrame, model_path: Path, batch_size: int = 64) -> pd.DataFrame:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Running model inference on {device}...")

    model = models.resnet50(weights=None)
    model.fc = torch.nn.Linear(2048, len(CLASSES))
    model.load_state_dict(
        torch.load(model_path, map_location=device, weights_only=True)
    )
    model.to(device)
    model.eval()

    paths = df["input"].tolist()
    dataset = ImagePathDataset(paths)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    predictions = {}
    for batch, names in loader:
        valid_idx = [i for i in range(len(batch)) if batch[i] is not None]
        if not valid_idx:
            for name in names:
                predictions[name] = "unknown"
            continue

        images = torch.stack([batch[i] for i in valid_idx]).to(device)
        valid_names = [names[i] for i in valid_idx]

        logits = model(images)
        probs = torch.softmax(logits, dim=1)
        _, preds = probs.max(dim=1)

        for name, pred in zip(valid_names, preds):
            predictions[name] = CLASSES[pred.item()]

        for name in names:
            if name not in predictions:
                predictions[name] = "unknown"

    df["model_prediction"] = df["input"].apply(
        lambda p: predictions.get(Path(p).name, "unknown")
    )
    return df


def main():
    parser = argparse.ArgumentParser(description="Sample examples for HLE labeling")
    parser.add_argument("--input", required=True, help="Path to dataset CSV or JSON")
    parser.add_argument("--output-dir", default="hle_output", help="Output directory")
    parser.add_argument("--n", type=int, default=100, help="Number of examples to sample")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--model-path", type=str, default=str(MODEL_PATH),
                        help="Path to trained model weights")
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    df = load_dataset(args.input)
    fmt = detect_format(df)
    print(f"Detected format: {fmt}")

    if fmt == "unknown":
        print("Error: unrecognised columns.", file=sys.stderr)
        print(f"Expected 'code','label','imgid' or 'id','input','ground_truth_label','model_prediction'.",
              file=sys.stderr)
        print(f"Found columns: {list(df.columns)}", file=sys.stderr)
        sys.exit(1)

    if fmt == "manifest":
        df = normalize_manifest(df, DATA_DIR)
        missing = df[~df["file_exists"]]
        if len(missing) > 0:
            print(f"Warning: {len(missing)} images not found on disk, skipping them.",
                  file=sys.stderr)
        df = df[df["file_exists"]].drop(columns=["file_exists"]).reset_index(drop=True)

        if len(df) < args.n:
            print(
                f"Warning: requested {args.n} samples but only {len(df)} images exist. "
                f"Using all {len(df)} examples.",
                file=sys.stderr,
            )
            args.n = len(df)

        sample = df.sample(n=args.n, random_state=args.seed).reset_index(drop=True)
        sample = run_model_inference(sample, Path(args.model_path), args.batch_size)
    else:
        required = {"id", "input", "ground_truth_label", "model_prediction"}
        missing = required - set(df.columns)
        if missing:
            print(f"Error: input file missing columns: {missing}", file=sys.stderr)
            print(f"Found columns: {list(df.columns)}", file=sys.stderr)
            sys.exit(1)

        if len(df) < args.n:
            print(
                f"Warning: requested {args.n} samples but dataset has only {len(df)}. "
                f"Using all {len(df)} examples.",
                file=sys.stderr,
            )
            args.n = len(df)

        sample = df.sample(n=args.n, random_state=args.seed).reset_index(drop=True)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    blind_path = out_dir / "hle_sample.csv"
    answers_path = out_dir / "hle_sample_answers.csv"

    if blind_path.exists():
        print(f"Error: {blind_path} already exists. Remove it or choose a different --output-dir.",
              file=sys.stderr)
        sys.exit(1)

    blind = sample[["id", "input"]]
    answers = sample[["id", "ground_truth_label", "model_prediction"]]

    blind.to_csv(blind_path, index=False)
    answers.to_csv(answers_path, index=False)

    print(f"\nSampled {len(sample)} examples")
    print(f"  Blind sample:  {blind_path}")
    print(f"  Answer key:    {answers_path}")
    print(f"  Seed:          {args.seed}")

    gt_counts = sample["ground_truth_label"].value_counts()
    print(f"\nGround truth distribution:")
    for label, count in gt_counts.items():
        print(f"  {label}: {count}")

    pred_counts = sample["model_prediction"].value_counts()
    print(f"\nModel prediction distribution:")
    for label, count in pred_counts.items():
        print(f"  {label}: {count}")

    agree = (sample["ground_truth_label"] == sample["model_prediction"]).sum()
    print(f"\nModel accuracy on sample: {agree}/{len(sample)} ({agree/len(sample)*100:.1f}%)")


if __name__ == "__main__":
    main()
