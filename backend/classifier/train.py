import argparse
import copy
import json
import sys
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import models
from tqdm import tqdm

_backend_dir = str(Path(__file__).resolve().parent.parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from classifier.dataset import ProductDataset


def train_model(train_ds, val_ds, device, epochs=20, batch_size=32,
                lr=1e-4, unfreeze_layers=20, num_workers=4):
    """Train a ResNet-50 classifier. Returns (model, history, best_acc)."""

    class_counts = torch.zeros(len(train_ds.classes))
    for _, label in train_ds.samples:
        class_counts[label] += 1
    sample_weights = [1.0 / class_counts[label].item() for _, label in train_ds.samples]
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)
    train_loader = DataLoader(
        train_ds, batch_size, sampler=sampler, shuffle=False, num_workers=num_workers,
    )
    val_loader = DataLoader(
        val_ds, batch_size, shuffle=False, num_workers=num_workers,
    )

    print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Classes: {train_ds.classes}")

    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    for param in list(model.parameters())[:-unfreeze_layers]:
        param.requires_grad = False
    model.fc = nn.Linear(2048, len(train_ds.classes))
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)

    best_acc = 0.0
    best_state = None
    history = {"train_loss": [], "val_loss": [], "val_acc": []}

    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for images, labels in tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}"):
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        avg_train_loss = train_loss / len(train_loader)

        model.eval()
        correct = total = 0
        val_loss = 0.0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item()
                _, predicted = torch.max(outputs, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        acc = 100.0 * correct / total
        avg_val_loss = val_loss / len(val_loader)

        scheduler.step(avg_val_loss)
        current_lr = optimizer.param_groups[0]["lr"]

        print(
            f"  Loss: {avg_train_loss:.4f} / {avg_val_loss:.4f} | "
            f"Val Acc: {acc:.2f}% | LR: {current_lr:.2e}"
        )

        history["train_loss"].append(avg_train_loss)
        history["val_loss"].append(avg_val_loss)
        history["val_acc"].append(acc)

        if acc > best_acc:
            best_acc = acc
            best_state = copy.deepcopy(model.state_dict())

    if best_state is not None:
        model.load_state_dict(best_state)
    model.to(device)

    return model, history, best_acc


def train(args):
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {DEVICE}")

    train_ds = ProductDataset(args.data_dir, split="train")
    val_ds   = ProductDataset(args.data_dir, split="val")

    model, history, best_acc = train_model(
        train_ds, val_ds, DEVICE,
        epochs=args.epochs, batch_size=args.batch_size,
        lr=args.lr, unfreeze_layers=args.unfreeze_layers,
        num_workers=args.num_workers,
    )

    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / "resnet50_product_category.pt"
    torch.save(model.state_dict(), model_path)
    print(f"Model saved to {model_path}")

    history_path = models_dir / "training_history.json"
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    print(f"Training history saved to {history_path}")
    print(f"Best validation accuracy: {best_acc:.2f}%")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=str,
                        default=str(Path(__file__).resolve().parent.parent / "data" / "raw"))
    parser.add_argument("--models-dir", type=str,
                        default=str(Path(__file__).resolve().parent.parent / "data" / "models"))
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--unfreeze-layers", type=int, default=20,
                        help="Number of final layers to unfreeze (negative = freeze all)")
    parser.add_argument("--num-workers", type=int, default=4)
    args = parser.parse_args()
    train(args)
