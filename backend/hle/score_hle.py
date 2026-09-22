"""Score human-level error estimation results.

Merges your labels with the answer key and computes disagreement rates.
"""
import argparse
import sys
from pathlib import Path

import pandas as pd


def main():
    parser = argparse.ArgumentParser(description="Score HLE results")
    parser.add_argument("--labels-csv", required=True, help="Path to hle_my_labels.csv")
    parser.add_argument("--answers-csv", required=True, help="Path to hle_sample_answers.csv")
    args = parser.parse_args()

    labels_path = Path(args.labels_csv)
    answers_path = Path(args.answers_csv)

    if not labels_path.exists():
        print(f"Error: {labels_path} not found", file=sys.stderr)
        sys.exit(1)
    if not answers_path.exists():
        print(f"Error: {answers_path} not found", file=sys.stderr)
        sys.exit(1)

    labels_df = pd.read_csv(labels_path)
    answers_df = pd.read_csv(answers_path)

    merged = labels_df.merge(answers_df, on="id", how="inner")

    if len(merged) == 0:
        print("Error: no matching IDs found between labels and answers", file=sys.stderr)
        sys.exit(1)

    n_total = len(merged)

    # Human error: disagreement with ground truth
    merged["disagree_gt"] = merged["my_label"] != merged["ground_truth_label"]
    n_disagree_gt = merged["disagree_gt"].sum()
    human_error = 100.0 * n_disagree_gt / n_total

    # Human-model agreement
    merged["agree_model"] = merged["my_label"] == merged["model_prediction"]
    n_agree_model = merged["agree_model"].sum()
    model_agreement = 100.0 * n_agree_model / n_total

    # Model accuracy vs ground truth (for context)
    merged["model_correct"] = merged["model_prediction"] == merged["ground_truth_label"]
    n_model_correct = merged["model_correct"].sum()
    model_accuracy = 100.0 * n_model_correct / n_total

    print("=" * 60)
    print("HUMAN-LEVEL ERROR ESTIMATION RESULTS")
    print("=" * 60)
    print(f"  Total examples:        {n_total}")
    print(f"  Labeled by you:        {n_total}")
    print(f"  Unlabeled (skipped):   {len(labels_df) - n_total}")
    print()
    print(f"  Human error (vs GT):   {human_error:.1f}%  ({n_disagree_gt}/{n_total})")
    print(f"  Model error (vs GT):   {100 - model_accuracy:.1f}%  ({n_total - n_model_correct}/{n_total})")
    print(f"  Human-model agreement: {model_agreement:.1f}%  ({n_agree_model}/{n_total})")
    print()

    # Per-class breakdown
    classes = sorted(merged["ground_truth_label"].unique())
    if len(classes) <= 20:
        print("-" * 60)
        print("PER-CLASS BREAKDOWN")
        print("-" * 60)
        print(f"  {'Class':<20} {'Count':>6} {'Human Err':>10} {'Model Err':>10}")
        print(f"  {'-----':<20} {'-----':>6} {'----------':>10} {'----------':>10}")
        for cls in classes:
            subset = merged[merged["ground_truth_label"] == cls]
            n_cls = len(subset)
            h_err = 100.0 * subset["disagree_gt"].sum() / n_cls
            m_err = 100.0 * (~subset["model_correct"]).sum() / n_cls
            print(f"  {cls:<20} {n_cls:>6} {h_err:>9.1f}% {m_err:>9.1f}%")
        print()

    # Disagreement details
    disagreed = merged[merged["disagree_gt"]].sort_values("id")
    if len(disagreed) > 0:
        print("-" * 60)
        print(f"EXAMPLES WHERE YOU DISAGREED WITH GROUND TRUTH ({len(disagreed)})")
        print("-" * 60)
        print(f"  {'ID':<20} {'Your Label':<15} {'Ground Truth':<15} {'Model Pred':<15}")
        print(f"  {'--':<20} {'----------':<15} {'------------':<15} {'----------':<15}")
        for _, row in disagreed.iterrows():
            print(
                f"  {str(row['id']):<20} "
                f"{str(row['my_label']):<15} "
                f"{str(row['ground_truth_label']):<15} "
                f"{str(row['model_prediction']):<15}"
            )
        print()
        print("  Review these for ambiguous cases or labeling errors.")

    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
