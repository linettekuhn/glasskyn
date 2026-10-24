export interface GateFace {
  bounds: { x: number; y: number; width: number; height: number };
  pitchAngle: number;
  rollAngle: number;
  yawAngle: number;
}

export interface GuideRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OvalGeometry {
  inner: GuideRect;
  oval: { cx: number; cy: number; rx: number; ry: number };
}

export type GateName = "centered" | "distance" | "pose" | "brightness";

export interface GateMetrics {
  centerDx: number;
  centerDy: number;
  faceWidthRatio: number;
  yaw: number;
  pitch: number;
  roll: number;
  luma: number | null;
}

export type TipCategory = "face" | "position" | "distance" | "light";

export const CATEGORY_PRIORITY: TipCategory[] = [
  "face",
  "position",
  "distance",
  "light",
];

export interface TipOutput {
  category: TipCategory;
  message: string;
  /** Full set of currently-failing categories, regardless of which is shown. */
  failing: TipCategory[];
}

export interface TipSelectorInput {
  faceDetected: boolean;
  centered: boolean;
  pose: boolean;
  distance: boolean;
  brightness: boolean;
  faceWidthRatio: number;
  luma: number | null;
}

export interface GateResult {
  centered: boolean;
  distance: boolean;
  pose: boolean;
  brightness: boolean;
  allPass: boolean;
  fails: GateName[];
  tip: TipOutput | null;
  metrics: GateMetrics;
}

export const GATE_CONSTANTS = {
  centerToleranceX: 0.18,
  centerToleranceY: 0.2,
  faceWidthMin: 0.9,
  faceWidthMax: 1.0,
  pitchMax: 15,
  rollMax: 10,
  yawMax: 22,
  lumaMin: 100,
  lumaMax: 230,
} as const;

export function selectTip(input: TipSelectorInput): TipOutput | null {
  const { faceDetected, centered, pose, distance, brightness } = input;
  const failing: TipCategory[] = [];
  if (!faceDetected) {
    failing.push("face");
  } else {
    if (!centered || !pose) failing.push("position");
    if (!distance) failing.push("distance");
    if (!brightness) failing.push("light");
  }
  if (failing.length === 0) {
    // Luma unknown (live sampler hasn't delivered yet): stay non-blocking so
    // a sampler hiccup can't brick capture, but surface it instead of fake
    // success so a dead sampler is visible immediately.
    if (input.luma == null || !Number.isFinite(input.luma)) {
      return { category: "light", message: "Checking light…", failing };
    }
    return null;
  }

  for (const category of CATEGORY_PRIORITY) {
    if (!failing.includes(category)) continue;
    return { category, message: messageForCategory(input, category), failing };
  }
  return null;
}

function messageForCategory(
  input: TipSelectorInput,
  category: TipCategory,
): string {
  const { centered, faceWidthRatio, luma } = input;
  switch (category) {
    case "face":
      return "Move your face into the oval";
    case "position":
      return centered
        ? "Face the camera and keep your head level"
        : "Move your face into the oval";
    case "distance":
      if (faceWidthRatio < GATE_CONSTANTS.faceWidthMin) {
        return "Too far! Move a little closer";
      }
      if (faceWidthRatio > GATE_CONSTANTS.faceWidthMax) {
        return "Too close! Pull back a little";
      }
      return "Adjust your distance to fit inside the oval";
    case "light":
      if (luma != null && luma > GATE_CONSTANTS.lumaMax) {
        return "Too bright! Move out of direct light";
      }
      return "Not enough light. Try the ring light";
  }
}

export function evaluateGates(
  face: GateFace | null,
  inner: GuideRect,
  luma: number | null,
): GateResult {
  const fails: GateName[] = [];

  const faceMissing = !face || !isFiniteRect(face.bounds);

  const centerX = inner.left + inner.width / 2;
  const centerY = inner.top + inner.height / 2;

  let centered = false;
  let distance = false;
  let pose = false;
  let brightness = false;

  let metrics: GateMetrics = {
    centerDx: 0,
    centerDy: 0,
    faceWidthRatio: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    luma,
  };

  if (!faceMissing) {
    const b = face.bounds;
    const faceCenterX = b.x + b.width / 2;
    const faceCenterY = b.y + b.height / 2;

    metrics = {
      centerDx: (faceCenterX - centerX) / (inner.width / 2),
      centerDy: (faceCenterY - centerY) / (inner.height / 2),
      faceWidthRatio: b.width / inner.width,
      yaw: face.yawAngle,
      pitch: face.pitchAngle,
      roll: face.rollAngle,
      luma,
    };

    centered =
      Math.abs(metrics.centerDx) <= GATE_CONSTANTS.centerToleranceX &&
      Math.abs(metrics.centerDy) <= GATE_CONSTANTS.centerToleranceY;

    distance =
      metrics.faceWidthRatio >= GATE_CONSTANTS.faceWidthMin &&
      metrics.faceWidthRatio <= GATE_CONSTANTS.faceWidthMax;

    pose =
      Math.abs(face.yawAngle) <= GATE_CONSTANTS.yawMax &&
      Math.abs(face.pitchAngle) <= GATE_CONSTANTS.pitchMax &&
      Math.abs(face.rollAngle) <= GATE_CONSTANTS.rollMax;
  }

  if (luma == null || !Number.isFinite(luma)) {
    brightness = true;
  } else {
    brightness =
      luma >= GATE_CONSTANTS.lumaMin && luma <= GATE_CONSTANTS.lumaMax;
  }

  if (!centered) fails.push("centered");
  if (!distance) fails.push("distance");
  if (!pose) fails.push("pose");
  if (!brightness) fails.push("brightness");

  const tip = selectTip({
    faceDetected: !faceMissing,
    centered,
    pose,
    distance,
    brightness,
    faceWidthRatio: metrics.faceWidthRatio,
    luma,
  });

  return {
    centered,
    distance,
    pose,
    brightness,
    allPass: fails.length === 0,
    fails,
    tip,
    metrics,
  };
}

function isFiniteRect(b: GateFace["bounds"]): boolean {
  return (
    [b.x, b.y, b.width, b.height].every(Number.isFinite) &&
    b.width > 0 &&
    b.height > 0
  );
}
