"""CLI labeling interface for human-level error estimation.

Presents examples one at a time, prompts for labels, and saves
progress incrementally so work is never lost on interruption.
"""
import argparse
import csv
import os
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd


def load_labeled(path: Path) -> set:
    if not path.exists():
        return set()
    df = pd.read_csv(path)
    return set(df["id"].tolist())


def save_label(path: Path, row_id: str, label: str):
    file_exists = path.exists() and path.stat().st_size > 0
    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["id", "my_label"])
        writer.writerow([row_id, label])


def find_irfanview() -> str | None:
    candidates = [
        Path(os.environ.get("ProgramFiles", "")) / "IrfanView" / "i_view64.exe",
        Path(os.environ.get("ProgramFiles(x86)", "")) / "IrfanView" / "i_view64.exe",
        Path(os.environ.get("LocalAppData", "")) / "Programs" / "IrfanView" / "i_view64.exe",
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return None


IRFANVIEW_PATH = find_irfanview()
VIEWER_DEFAULT = "irfanview" if IRFANVIEW_PATH else "photos"


def open_image(path: str, viewer: str = VIEWER_DEFAULT):
    if viewer == "none":
        return
    try:
        if viewer == "irfanview":
            if IRFANVIEW_PATH:
                subprocess.Popen([IRFANVIEW_PATH, path, "/one"])
            else:
                print(f"  (IrfanView not found, falling back to Photos)")
                os.startfile(path)
        else:
            os.startfile(path)
    except OSError:
        print(f"  (could not open {path})")


def is_image_path(value: str) -> bool:
    p = Path(value)
    return p.exists() and p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp")


def main():
    parser = argparse.ArgumentParser(description="Label examples for HLE")
    parser.add_argument("--sample-csv", required=True, help="Path to hle_sample.csv")
    parser.add_argument("--labels", nargs="+", required=True, help="Allowed label classes")
    parser.add_argument("--output-csv", default=None, help="Output CSV (default: hle_my_labels.csv in same dir)")
    parser.add_argument("--viewer", choices=["irfanview", "photos", "none"], default=VIEWER_DEFAULT,
                        help="How to open images: irfanview (default, single window), photos, or none")
    args = parser.parse_args()

    sample_path = Path(args.sample_csv)
    if not sample_path.exists():
        print(f"Error: {sample_path} not found", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.output_csv) if args.output_csv else sample_path.parent / "hle_my_labels.csv"

    df = pd.read_csv(sample_path)
    labeled_ids = load_labeled(out_path)
    remaining = df[~df["id"].isin(labeled_ids)].reset_index(drop=True)

    if len(remaining) == 0:
        print(f"All {len(df)} examples already labeled. Output: {out_path}")
        return

    print(f"Total: {len(df)} | Already labeled: {len(labeled_ids)} | Remaining: {len(remaining)}")

    # Randomize order each run using timestamp as seed
    seed = int(time.time() * 1000) % (2**31)
    remaining = remaining.sample(frac=1, random_state=seed).reset_index(drop=True)

    shortcuts = {str(i): label for i, label in enumerate(args.labels, start=1)}
    shortcut_hint = ", ".join(f"{k}={v}" for k, v in shortcuts.items())
    print(f"Labels: [{shortcut_hint}]")
    print(f"Type 'q' to quit (progress saved). Type 's' to skip.\n")

    for i, row in remaining.iterrows():
        row_id = str(row["id"])
        inp = str(row["input"])

        print(f"--- [{i + 1}/{len(remaining)}] ID: {row_id} ---")

        if is_image_path(inp):
            print(f"  Opening image: {inp}")
            open_image(inp, args.viewer)
        else:
            print(f"  Input: {inp}")

        while True:
            try:
                answer = input(f"  Label [{shortcut_hint}] (q=quit, s=skip): ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nSaving and exiting...")
                return

            if answer.lower() == "q":
                print("Saving and exiting...")
                return
            if answer.lower() == "s":
                print("  Skipped.")
                break

            resolved = shortcuts.get(answer, answer)
            if resolved in args.labels:
                save_label(out_path, row_id, resolved)
                print(f"  Saved: {row_id} -> {resolved}\n")
                break
            else:
                valid = ", ".join(f"{k}={v}" for k, v in shortcuts.items())
                print(f"  Invalid. Enter {valid}, 's' to skip, or 'q' to quit.")

    print(f"\nDone! All {len(remaining)} examples labeled.")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
