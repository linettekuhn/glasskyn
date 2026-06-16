import argparse
import json
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import models
from tqdm import tqdm

from dataset import ProductDataset


def train(args):
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {DEVICE}")

    train_ds = ProductDataset(args.data_dir, split="train")
    val_ds   = ProductDataset(args.data_dir, split="val")

    train_loader = DataLoader(
        train_ds, args.batch_size, shuffle=True, num_workers=args.num_workers,
    )
    val_loader = DataLoader(
        val_ds, args.batch_size, shuffle=False, num_workers=args.num_workers,
    )

    print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Classes: {train_ds.classes}")

    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    for param in list(model.parameters())[:-args.unfreeze_layers]:
        param.requires_grad = False
    model.fc = nn.Linear(2048, len(train_ds.classes))
    model.to(DEVICE)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)

    best_acc = 0.0
    history = {"train_loss": [], "val_loss": [], "val_acc": []}
    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    for epoch in range(args.epochs):
        model.train()
        train_loss = 0.0
        for images, labels in tqdm(train_loader, desc=f"Epoch {epoch+1}/{args.epochs}"):
            images, labels = images.to(DEVICE), labels.to(DEVICE)
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
                images, labels = images.to(DEVICE), labels.to(DEVICE)
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
            model_path = models_dir / "resnet50_product_category.pt"
            torch.save(model.state_dict(), model_path)
            print(f"  ✓ Model saved to {model_path}")

    # Save training history
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
