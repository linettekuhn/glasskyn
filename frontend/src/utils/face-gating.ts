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

export interface GateResult {
  centered: boolean;
  distance: boolean;
  pose: boolean;
  brightness: boolean;
  allPass: boolean;
  fails: GateName[];
  tips: string[];
  metrics: GateMetrics;
}

export const GATE_CONSTANTS = {
  centerToleranceX: 0.18,
  centerToleranceY: 0.2,
  faceWidthMin: 0.5,
  faceWidthMax: 1.0,
  pitchMax: 15,
  rollMax: 10,
  yawMax: 22,
  lumaMin: 42,
  lumaMax: 230,
} as const;

const TIP_MAP: Record<GateName, string> = {
  centered: "Move your face into the oval",
  distance: "Adjust your distance to fit inside the oval",
  pose: "Face the camera and keep your head level",
  brightness: "Not enough light — try the ring light",
};

export function evaluateGates(
  face: GateFace | null,
  inner: GuideRect,
  luma: number | null,
): GateResult {
  const tips: string[] = [];
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
    brightness = luma >= GATE_CONSTANTS.lumaMin && luma <= GATE_CONSTANTS.lumaMax;
  }

  if (!centered) fails.push("centered");
  if (!distance) fails.push("distance");
  if (!pose) fails.push("pose");
  if (!brightness) fails.push("brightness");

  for (const name of fails) {
    const tip = diffTip(faceMissing, name, metrics, luma);
    if (tip) tips.push(tip);
  }

  return {
    centered,
    distance,
    pose,
    brightness,
    allPass: fails.length === 0,
    fails,
    tips,
    metrics,
  };
}

function diffTip(
  faceMissing: boolean,
  name: GateName,
  metrics: GateMetrics,
  luma: number | null,
): string | null {
  if (name === "distance" && !faceMissing) {
    if (metrics.faceWidthRatio < GATE_CONSTANTS.faceWidthMin) {
      return "Too far — move a little closer";
    }
    if (metrics.faceWidthRatio > GATE_CONSTANTS.faceWidthMax) {
      return "Too close — pull back a little";
    }
    return TIP_MAP.distance;
  }
  if (name === "brightness" && luma != null) {
    if (luma > GATE_CONSTANTS.lumaMax) {
      return "Too bright — move out of direct light";
    }
  }
  return TIP_MAP[name];
}

function isFiniteRect(b: GateFace["bounds"]): boolean {
  return [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0;
}