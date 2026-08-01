from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import OPENAI_API_KEY, BACKEND_DIR
from app.services.vector_store import (
    get_collection,
    upsert_all,
    upsert_ingredient,
    reset_collection,
)

DATASET_PATH = BACKEND_DIR / "data" / "ingredients" / "dataset.json"


def load_dataset() -> list[dict]:
    if not DATASET_PATH.exists():
        print(f"Error: dataset not found at {DATASET_PATH}")
        sys.exit(1)
    with open(DATASET_PATH, encoding="utf-8") as f:
        return json.load(f)


def find_record(dataset: list[dict], ingredient_id: str) -> dict | None:
    for record in dataset:
        if record["id"] == ingredient_id:
            return record
    return None


def cmd_embed_all(reset: bool = False) -> None:
    if reset:
        print("Resetting collection...")
        reset_collection()

    print("Embedding all ingredients...")
    count = upsert_all()
    collection = get_collection()
    total = collection.count()
    print(f"Done. Embedded {count} ingredients (collection total: {total})")


def cmd_dry_run() -> None:
    dataset = load_dataset()
    print(f"Would embed {len(dataset)} ingredients:")
    for record in dataset:
        risks = len(record.get("known_risks", []))
        score = record.get("safety_score", "?")
        print(f"  {record['id']:40s}  score={score}  risks={risks}")
    print(f"\nTotal: {len(dataset)} ingredients")


def main() -> None:
    parser = argparse.ArgumentParser(description="Embed ingredient safety data into ChromaDB")
    parser.add_argument("--reset", action="store_true", help="Delete collection and re-embed from scratch")
    parser.add_argument("--ingredient", type=str, help="Embed/update a single ingredient by ID")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be embedded without calling OpenAI")
    args = parser.parse_args()

    if args.dry_run:
        cmd_dry_run()
        return

    if args.ingredient:
        dataset = load_dataset()
        record = find_record(dataset, args.ingredient)
        if not record:
            available = [r["id"] for r in dataset]
            print(f"Error: ingredient '{args.ingredient}' not found in dataset.")
            print(f"Available IDs: {', '.join(sorted(available))}")
            sys.exit(1)

    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set. Add it to backend/.env")
        sys.exit(1)

    if args.ingredient:
        print(f"Embedding: {record['ingredient_name']} ({record['id']})")
        upsert_ingredient(record)
        collection = get_collection()
        print(f"Done. Collection total: {collection.count()}")
    else:
        cmd_embed_all(reset=args.reset)


if __name__ == "__main__":
    main()
