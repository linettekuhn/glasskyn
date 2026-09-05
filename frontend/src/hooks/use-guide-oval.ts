import { useMemo } from "react";
import {
  evaluateGates,
  type GateFace,
  type GateResult,
  type OvalGeometry,
} from "../utils/face-gating";

export interface GuideOvalOptions {
  width: number;
  height: number;
  topInset: number;
  face: GateFace | null;
  luma: number | null;
}

export function computeOvalGeometry(
  width: number,
  height: number,
  topInset: number,
): OvalGeometry {
  const innerWidth = Math.min(width * 0.6, 360);
  const innerHeight = innerWidth * 1.4;
  const centerX = width / 2;
  const centerY = height * 0.46 + topInset * 0.1;

  return {
    inner: {
      left: centerX - innerWidth / 2,
      top: centerY - innerHeight / 2,
      width: innerWidth,
      height: innerHeight,
    },
    oval: {
      cx: centerX,
      cy: centerY,
      rx: innerWidth * 0.62,
      ry: innerHeight * 0.54,
    },
  };
}

export function useGuideOval({
  width,
  height,
  topInset,
  face,
  luma,
}: GuideOvalOptions): { geometry: OvalGeometry; gates: GateResult } {
  const geometry = useMemo(
    () => computeOvalGeometry(width, height, topInset),
    [width, height, topInset],
  );

  const gates = useMemo(
    () => evaluateGates(face, geometry.inner, luma),
    [face, geometry.inner, luma],
  );

  return { geometry, gates };
}