import random
from collections import Counter
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


def get_test_set_codes():
    classes = sorted([d.name for d in DATA_DIR.iterdir() if d.is_dir()])
    class_to_idx = {c: i for i, c in enumerate(classes)}
    samples = []
    for cls in classes:
        for fname in (DATA_DIR / cls).iterdir():
            if fname.suffix.lower() in (".jpg", ".jpeg", ".png"):
                samples.append((str(fname), class_to_idx[cls]))
    rng = random.Random(42)
    rng.shuffle(samples)
    n = len(samples)
    n_test = int(n * 0.15)
    n_val = int(n * 0.15)
    test_samples = samples[n_val:n_val + n_test]
    code_to_label = {}
    for path, label_idx in test_samples:
        code = Path(path).stem
        code_to_label[code] = classes[label_idx]
    return code_to_label, len(samples)


def get_product_names(test_codes):
    from datasets import load_dataset
    ds = load_dataset("openfoodfacts/product-database", split="beauty", streaming=True)
    result = {}
    remaining = set(test_codes)
    for row in ds:
        code = str(row["code"])
        if code in remaining:
            raw = row.get("product_name")
            if isinstance(raw, list):
                raw = next((e.get("text", "") for e in raw if isinstance(e, dict) and e.get("text")), "")
            result[code] = raw or ""
            remaining.remove(code)
            if not remaining:
                break
    return result


def main():
    print("=== Comparison: ML Classifier vs Keyword Baseline ===\n")
    test_codes, total = get_test_set_codes()
    print(f"Total images: {total} | Test set: {len(test_codes)}\n")
    print("Fetching product names from HuggingFace dataset...")
    code_to_name = get_product_names(test_codes)
    found = sum(1 for v in code_to_name.values() if v)
    print(f"Found product names for {found}/{len(test_codes)} codes\n")

    from app.services.extraction import classify_category
    kw_correct = 0
    kw_total = 0
    per_class_kw = Counter()
    per_class_total = Counter()
    for code, true_label in test_codes.items():
        name = code_to_name.get(code, "")
        if not name:
            continue
        kw_label, _ = classify_category(name)
        per_class_total[true_label] += 1
        if kw_label == true_label:
            kw_correct += 1
            per_class_kw[true_label] += 1
        kw_total += 1

    kw_acc = kw_correct / kw_total * 100 if kw_total > 0 else 0
    print(f"Keyword Baseline Accuracy: {kw_acc:.2f}% ({kw_correct}/{kw_total})\n")
    print(f"{'Class':<12} {'Keyword Acc':<12} {'Count':<8}")
    print("-" * 32)
    for cls in sorted(per_class_total):
        t = per_class_total[cls]
        c = per_class_kw[cls]
        print(f"{cls:<12} {c / t * 100 if t else 0:<12.1f} {t:<8}")
    print()
    print("Fill in ML accuracies from Sections 4 and 6 to complete the comparison.")


if __name__ == "__main__":
    main()
