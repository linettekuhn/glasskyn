import hashlib, json, math, os, random, time
from io import BytesIO
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
import pandas as pd
from datasets import load_dataset
from PIL import Image
from tqdm import tqdm

from classifier.categories import CATEGORY_MAP

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def classify_product(categories_tags):
    if not categories_tags:
        return None
    tags = set(categories_tags)
    for label, obf_tags in CATEGORY_MAP.items():
        if tags & obf_tags:
            return label
    return None


def image_url(code, key, size=400):
    c = code.strip()
    parts = [c[i : i + 3] for i in range(0, len(c), 3)]
    path = "/".join(parts)
    return f"https://images.openfoodfacts.org/images/products/{path}/{key}_{size}.jpg"


def download_image(url, dest, timeout=15):
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=timeout)
        resp.raise_for_status()
        Image.open(BytesIO(resp.content)).verify()
        dest.write_bytes(resp.content)
        return True
    except Exception:
        return False


def main():
    ds = load_dataset("openfoodfacts/product-database", split="beauty", streaming=True)

    records = []
    for row in tqdm(ds, desc="Classifying products"):
        label = classify_product(row["categories_tags"])
        if label is None:
            continue
        images = row.get("images") or []
        keys = [img["key"] for img in images]
        preferred = [k for k in keys if k.startswith("front")]
        key = preferred[0] if preferred else (keys[0] if keys else None)
        if key is None:
            continue
        records.append(
            {
                "code": row["code"],
                "label": label,
                "image_key": key,
            }
        )

    print(f"Classified {len(records):,} products with images")

    manifest_path = DATA_DIR / "manifest.csv"
    pd.DataFrame(records).to_csv(manifest_path, index=False)
    print(f"Manifest saved to {manifest_path}")

    for rec in tqdm(records, desc="Downloading images"):
        label_dir = DATA_DIR / rec["label"]
        label_dir.mkdir(exist_ok=True)
        dest = label_dir / f"{rec['code']}.jpg"
        if dest.exists():
            continue
        url = image_url(rec["code"], rec["image_key"])
        download_image(url, dest)

    # Print summary
    from collections import Counter

    counts = Counter(r["label"] for r in records)
    print("\nDownload summary:")
    for label, count in counts.most_common():
        print(f"  {label}: {count}")
    print(f"\nTotal: {len(records)} images")


if __name__ == "__main__":
    main()
