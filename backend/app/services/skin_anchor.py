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

# Fallback geometry for classify_region when the ideal trio
# (LEFT_EYE + RIGHT_EYE + NOSE_BASE) is incomplete. The on-device detector
# often emits cheeks/ears/mouth without NOSE_BASE, which used to force every
# such concern to "unknown". Offsets are in normalized (0..1) coords, y down.
_DEFAULT_SPACING = 0.12
_CHEEK_TO_EYE_DY = 0.07
_NOSE_TO_EYE_DY = 0.06
_MOUTH_TO_EYE_DY = 0.12
_CHEEK_TO_MOUTH_DY = 0.05


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
    # Need at least 2 landmarks for any meaningful face geometry; a single
    # point plus defaults would classify against invented axes.
    if len(lm) < 2:
        return "unknown"
    left_eye = lm.get("LEFT_EYE")
    right_eye = lm.get("RIGHT_EYE")
    nose = lm.get("NOSE_BASE")
    mouth_l = lm.get("MOUTH_LEFT")
    mouth_r = lm.get("MOUTH_RIGHT")
    mouth_b = lm.get("MOUTH_BOTTOM")
    cheek_l = lm.get("LEFT_CHEEK")
    cheek_r = lm.get("RIGHT_CHEEK")
    ear_l = lm.get("LEFT_EAR")
    ear_r = lm.get("RIGHT_EAR")

    def mean_y(pts: list[tuple[float, float] | None]) -> float | None:
        ys = [p[1] for p in pts if p is not None]
        return sum(ys) / len(ys) if ys else None

    def mean_x(pts: list[tuple[float, float] | None]) -> float | None:
        xs = [p[0] for p in pts if p is not None]
        return sum(xs) / len(xs) if xs else None

    # Vertical eye line: exact when eyes exist, estimated otherwise.
    # Identical to the old behavior when both eyes are present.
    if left_eye and right_eye:
        eye_y = (left_eye[1] + right_eye[1]) / 2.0
    elif left_eye:
        eye_y = left_eye[1]
    elif right_eye:
        eye_y = right_eye[1]
    elif (cheek_y := mean_y([cheek_l, cheek_r])) is not None:
        eye_y = cheek_y - _CHEEK_TO_EYE_DY
    elif (ear_y := mean_y([ear_l, ear_r])) is not None:
        eye_y = ear_y
    elif nose is not None:
        eye_y = nose[1] - _NOSE_TO_EYE_DY
    elif (mouth_y0 := mean_y([mouth_l, mouth_r, mouth_b])) is not None:
        eye_y = mouth_y0 - _MOUTH_TO_EYE_DY
    else:
        return "unknown"

    # Horizontal scale: exact eye spacing when possible, else proportional
    # estimates from cheek / ear span or mouth width, else a generic default.
    if left_eye and right_eye:
        eye_spacing = abs(right_eye[0] - left_eye[0])
    elif cheek_l and cheek_r:
        eye_spacing = abs(cheek_r[0] - cheek_l[0]) * 0.55
    elif ear_l and ear_r:
        eye_spacing = abs(ear_r[0] - ear_l[0]) * 0.4
    elif mouth_l and mouth_r:
        eye_spacing = abs(mouth_r[0] - mouth_l[0]) * 1.6
    else:
        eye_spacing = _DEFAULT_SPACING
    if not math.isfinite(eye_spacing) or eye_spacing <= 0:
        eye_spacing = _DEFAULT_SPACING

    # Face center x: nose when present, else symmetric pair midpoints, else
    # singletons corrected toward the midline (a lone cheek/ear/eye sits
    # lateral to the center, so using its x directly would make every nearby
    # point look "central"). Side-aware offsets use the resolved spacing.
    if nose is not None:
        nose_x = nose[0]
    elif mouth_l and mouth_r:
        nose_x = (mouth_l[0] + mouth_r[0]) / 2.0
    elif mouth_b is not None:
        nose_x = mouth_b[0]
    elif cheek_l and cheek_r:
        nose_x = (cheek_l[0] + cheek_r[0]) / 2.0
    elif left_eye and right_eye:
        nose_x = (left_eye[0] + right_eye[0]) / 2.0
    elif ear_l and ear_r:
        nose_x = (ear_l[0] + ear_r[0]) / 2.0
    elif left_eye is not None:
        nose_x = left_eye[0] + eye_spacing * 0.5
    elif right_eye is not None:
        nose_x = right_eye[0] - eye_spacing * 0.5
    elif mouth_l is not None:
        nose_x = mouth_l[0] + eye_spacing * 0.3
    elif mouth_r is not None:
        nose_x = mouth_r[0] - eye_spacing * 0.3
    elif cheek_l is not None:
        nose_x = cheek_l[0] + eye_spacing * 0.8
    elif cheek_r is not None:
        nose_x = cheek_r[0] - eye_spacing * 0.8
    elif ear_l is not None:
        nose_x = ear_l[0] + eye_spacing * 1.2
    elif ear_r is not None:
        nose_x = ear_r[0] - eye_spacing * 1.2
    else:
        nose_x = None
    if nose_x is None or not math.isfinite(nose_x):
        return "unknown"

    mouth_ys = [m[1] for m in (mouth_b, mouth_l, mouth_r) if m is not None]
    if mouth_ys:
        mouth_y = sum(mouth_ys) / len(mouth_ys)
    elif (cheek_y2 := mean_y([cheek_l, cheek_r])) is not None:
        mouth_y = cheek_y2 + _CHEEK_TO_MOUTH_DY
    else:
        mouth_y = eye_y + max(eye_spacing, 0.05)
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
        # Pass the raw landmarks: classify_region runs finite_landmarks()
        # itself, and passing the already-converted `lm` (tuples) would be
        # silently dropped to {} and force every region to "unknown".
        "region": classify_region((px, py), landmarks),
        "refs": refs,
    }