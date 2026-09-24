"""Landmark-relative anchoring for skin concerns.

Mirrors the client-side algorithms in frontend/src/utils/landmark-zones.ts and
frontend/src/utils/anchor.ts so the anchor persisted at check-in (region plus
nearest-landmark refs) can be re-projected onto the next capture session.

Landmark keys are the MLKit FaceDetector keys emitted by
react-native-vision-camera-face-detector (all uppercase).
"""
from __future__ import annotations

import math
from typing import Any, Sequence

LANDMARK_KEYS: tuple[str, ...] = (
    "LEFT_CHEEK",
    "RIGHT_CHEEK",
    "NOSE_BASE",
    "MOUTH_LEFT",
    "MOUTH_RIGHT",
    "MOUTH_BOTTOM",
    "LEFT_EYE",
    "RIGHT_EYE",
    "LEFT_EAR",
    "RIGHT_EAR",
)

MAX_REF_DIST = 0.4
MAX_REFS = 3


def finite_landmarks(landmarks: Any) -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    for key, value in (landmarks or {}).items():
        if not isinstance(value, dict):
            continue
        try:
            x = float(value.get("x"))
            y = float(value.get("y"))
        except (TypeError, ValueError):
            continue
        if math.isfinite(x) and math.isfinite(y):
            out[key] = (x, y)
    return out


def classify_region(
    point: dict[str, float] | Sequence[float],
    landmarks: Any,
) -> str:
    if isinstance(point, dict):
        x = point.get("x")
        y = point.get("y")
    elif len(point) >= 2:
        x, y = point[0], point[1]
    else:
        return "unknown"
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return "unknown"
    if not math.isfinite(x) or not math.isfinite(y):
        return "unknown"

    lm = finite_landmarks(landmarks)
    left_eye = lm.get("LEFT_EYE")
    right_eye = lm.get("RIGHT_EYE")
    nose = lm.get("NOSE_BASE")
    mouth_l = lm.get("MOUTH_LEFT")
    mouth_r = lm.get("MOUTH_RIGHT")
    mouth_b = lm.get("MOUTH_BOTTOM")

    if not left_eye or not right_eye or not nose:
        return "unknown"

    eye_y = (left_eye[1] + right_eye[1]) / 2.0
    eye_spacing = abs(right_eye[0] - left_eye[0])
    mouth_ys = [m[1] for m in (mouth_b, mouth_l, mouth_r) if m is not None]
    if mouth_ys:
        mouth_y = sum(mouth_ys) / len(mouth_ys)
    else:
        mouth_y = eye_y + max(eye_spacing, 0.05)
    nose_x = nose[0]
    mouth_x = (mouth_l[0] + mouth_r[0]) / 2.0 if mouth_l and mouth_r else nose_x
    tol = max(eye_spacing * 0.35, 0.03)

    if y < eye_y:
        return "forehead"
    if y <= mouth_y:
        band = eye_y + (mouth_y - eye_y) * 0.3
        if x < nose_x - tol:
            return "under_eye_left" if y < band else "left_cheek"
        if x > nose_x + tol:
            return "under_eye_right" if y < band else "right_cheek"
        return "nose"
    half_span = max(eye_spacing * 0.5, 0.06)
    if x < mouth_x - half_span:
        return "jawline_left"
    if x > mouth_x + half_span:
        return "jawline_right"
    return "chin"


def compute_anchor(
    point: dict[str, float],
    landmarks: Any,
    max_refs: int = MAX_REFS,
    max_dist: float = MAX_REF_DIST,
) -> dict[str, Any]:
    lm = finite_landmarks(landmarks)
    px = float(point["x"])
    py = float(point["y"])

    ordered: list[tuple[float, str, float, float]] = []
    for key, (lx, ly) in lm.items():
        dist = math.hypot(px - lx, py - ly)
        ordered.append((dist, key, lx, ly))
    ordered.sort(key=lambda item: item[0])

    refs: list[dict[str, Any]] = []
    for dist, key, lx, ly in ordered[:max_refs]:
        if dist > max_dist:
            break
        refs.append(
            {
                "key": key,
                "ox": round(px - lx, 6),
                "oy": round(py - ly, 6),
                "dist": round(dist, 6),
            }
        )

    return {
        "point": {"x": round(px, 6), "y": round(py, 6)},
        "region": classify_region((px, py), lm),
        "refs": refs,
    }