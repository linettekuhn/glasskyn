import hashlib, json, math, os, random, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path

import sys

from dotenv import load_dotenv

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


def image_url(code, imgid, size=400):
    import re
    c = code.strip()
    path = re.sub(r"(...)(...)(...)(.*)", r"\1/\2/\3/\4", c)
    return f"https://world.openbeautyfacts.org/images/products/{path}/{imgid}.{size}.jpg"


def download_image(client, rec, data_dir):
    label_dir = data_dir / rec["label"]
    label_dir.mkdir(exist_ok=True)
    dest = label_dir / f"{rec['code']}.jpg"
    if dest.exists():
        return True
    url = image_url(rec["code"], rec["imgid"])
    try:
        resp = client.get(url, follow_redirects=True, timeout=30)
        resp.raise_for_status()
        # quick content check instead of full PIL verify
        if len(resp.content) < 1000:
            return False
        dest.write_bytes(resp.content)
        return True
    except Exception:
        return False


def main():
    import os

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    if not os.environ.get("HF_TOKEN"):
        print("Tip: set HF_TOKEN env var for higher download rates from HuggingFace")

    ds = load_dataset("openfoodfacts/product-database", split="beauty", streaming=True)

    records = []
    for row in tqdm(ds, desc="Classifying products"):
        label = classify_product(row["categories_tags"])
        if label is None:
            continue
        images = row.get("images") or []
        preferred = None
        for img in images:
            if img["key"].startswith("front") and img.get("imgid") is not None:
                preferred = img
                break
        if preferred is None:
            for img in images:
                if img.get("imgid") is not None:
                    preferred = img
                    break
        if preferred is None:
            continue
        records.append(
            {
                "code": row["code"],
                "label": label,
                "imgid": preferred["imgid"],
            }
        )

    print(f"Classified {len(records):,} products with images")

    manifest_path = DATA_DIR / "manifest.csv"
    pd.DataFrame(records).to_csv(manifest_path, index=False)
    print(f"Manifest saved to {manifest_path}")

    # Parallel downloads
    max_workers = int(os.environ.get("DOWNLOAD_WORKERS", "20"))
    to_download = [r for r in records if not (DATA_DIR / r["label"] / f"{r['code']}.jpg").exists()]
    print(f"Downloading {len(to_download):,} images with {max_workers} parallel workers...")

    successful = 0
    with httpx.Client(timeout=30, limits=httpx.Limits(max_keepalive_connections=max_workers, max_connections=max_workers * 2)) as client:
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = {pool.submit(download_image, client, rec, DATA_DIR): rec for rec in to_download}
            for f in tqdm(as_completed(futures), total=len(to_download), desc="Downloading images"):
                if f.result():
                    successful += 1

    print(f"Downloaded {successful}/{len(to_download)} new images")

    # Print summary
    from collections import Counter

    counts = Counter(r["label"] for r in records)
    print("\nDownload summary:")
    for label, count in counts.most_common():
        print(f"  {label}: {count}")
    print(f"\nTotal: {len(records)} images")


if __name__ == "__main__":
    main()
