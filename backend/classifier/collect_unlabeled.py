"""Collect images for products that have no matching category tags.

Scans the Open Beauty Facts dataset for products with valid images but
no matching tags in CATEGORY_MAP, and downloads their images to
data/unlabeled/ for later pseudo-labeling.
"""

import re
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx
import pandas as pd
from datasets import load_dataset
from dotenv import load_dotenv
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from classifier.categories import CATEGORY_MAP

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
UNLABELED_DIR = DATA_DIR / "unlabeled"
UNLABELED_DIR.mkdir(parents=True, exist_ok=True)


def has_matching_tag(categories_tags):
    if not categories_tags:
        return False
    tags = set(categories_tags)
    for obf_tags in CATEGORY_MAP.values():
        if tags & obf_tags:
            return True
    return False


def image_url(code, imgid, size=400):
    c = code.strip()
    path = re.sub(r"(...)(...)(...)(.*)", r"\1/\2/\3/\4", c)
    return f"https://world.openbeautyfacts.org/images/products/{path}/{imgid}.{size}.jpg"


def download_image(client, code, imgid, dest):
    if dest.exists():
        return True
    url = image_url(code, imgid)
    try:
        resp = client.get(url, follow_redirects=True, timeout=30)
        resp.raise_for_status()
        if len(resp.content) < 1000:
            return False
        dest.write_bytes(resp.content)
        return True
    except Exception:
        return False


def main():
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    if not os.environ.get("HF_TOKEN"):
        print("Tip: set HF_TOKEN env var for higher download rates from HuggingFace")

    ds = load_dataset("openfoodfacts/product-database", split="beauty", streaming=True)

    unlabeled = []
    for row in tqdm(ds, desc="Scanning for unlabeled products"):
        if has_matching_tag(row["categories_tags"]):
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
        unlabeled.append({
            "code": row["code"],
            "imgid": preferred["imgid"],
        })

    print(f"Found {len(unlabeled):,} unlabeled products with images")

    manifest_path = UNLABELED_DIR / "unlabeled_manifest.csv"
    pd.DataFrame(unlabeled).to_csv(manifest_path, index=False)
    print(f"Manifest saved to {manifest_path}")

    # Parallel downloads
    max_workers = int(os.environ.get("DOWNLOAD_WORKERS", "20"))
    to_download = [
        r for r in unlabeled
        if not (UNLABELED_DIR / f"{r['code']}.jpg").exists()
    ]
    print(f"Downloading {len(to_download):,} images with {max_workers} parallel workers...")

    successful = 0
    with httpx.Client(timeout=30, limits=httpx.Limits(
        max_keepalive_connections=max_workers,
        max_connections=max_workers * 2,
    )) as client:
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = {
                pool.submit(
                    download_image, client, r["code"], r["imgid"],
                    UNLABELED_DIR / f"{r['code']}.jpg"
                ): r
                for r in to_download
            }
            for f in tqdm(as_completed(futures), total=len(to_download),
                          desc="Downloading unlabeled images"):
                if f.result():
                    successful += 1

    print(f"Downloaded {successful}/{len(to_download)} unlabeled images")

    existing = len(list(UNLABELED_DIR.glob("*.jpg")))
    print(f"\nTotal unlabeled images available: {existing}")


if __name__ == "__main__":
    main()
