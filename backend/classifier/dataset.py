import random
from pathlib import Path

from PIL import Image
import torch
from torch.utils.data import Dataset
from torchvision import transforms


class ProductDataset(Dataset):
    def __init__(self, root_dir, split="train", val_pct=0.15, test_pct=0.15):
        self.root = Path(root_dir)
        self.classes = sorted([d.name for d in self.root.iterdir() if d.is_dir()])
        self.class_to_idx = {c: i for i, c in enumerate(self.classes)}

        samples = []
        for cls in self.classes:
            cls_dir = self.root / cls
            for fname in cls_dir.iterdir():
                if fname.suffix.lower() in (".jpg", ".jpeg", ".png"):
                    samples.append((str(fname), self.class_to_idx[cls]))

        rng = random.Random(42)
        rng.shuffle(samples)
        n = len(samples)
        n_val = int(n * val_pct)
        n_test = int(n * test_pct)

        if split == "train":
            samples = samples[n_val + n_test:]
        elif split == "val":
            samples = samples[:n_val]
        elif split == "test":
            samples = samples[n_val:n_val + n_test]
        else:
            raise ValueError(f"Unknown split: {split}")

        self.samples = samples

        if split == "train":
            self.transform = transforms.Compose([
                transforms.Resize((256, 256)),
                transforms.RandomAffine(degrees=15, translate=(0.15, 0.15), scale=(0.85, 1.15)),
                transforms.RandomPerspective(distortion_scale=0.1, p=0.3),
                transforms.RandomCrop(224),
                transforms.RandomHorizontalFlip(),
                transforms.RandomRotation(10),
                transforms.ColorJitter(0.1, 0.1, 0.1, 0.05),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406],
                                     [0.229, 0.224, 0.225]),
            ])
        else:
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406],
                                     [0.229, 0.224, 0.225]),
            ])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        img = self.transform(img)
        return img, label
