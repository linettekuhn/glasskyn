import { Gesture } from "react-native-gesture-handler";
import {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 6;

function clamp(value: number, lower: number, upper: number): number {
  "worklet";
  return Math.min(upper, Math.max(lower, value));
}

function clampScale(value: number, maxScale: number): number {
  "worklet";
  return Math.min(maxScale, Math.max(MIN_SCALE, value));
}

export type PhotoTransform = {
  scale: { value: number };
  tx: { value: number };
  ty: { value: number };
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  pinchGesture: ReturnType<typeof Gesture.Pinch>;
  screenToNormalized: (px: number, py: number) => { x: number; y: number };
  normalizedToScreen: (nx: number, ny: number) => { x: number; y: number };
  panStart: () => void;
  applyTranslation: (dx: number, dy: number) => void;
  reset: () => void;
};

export function usePhotoTransform(
  width: number,
  height: number,
  maxScale: number = DEFAULT_MAX_SCALE,
): PhotoTransform {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startFx = useSharedValue(0);
  const startFy = useSharedValue(0);

  const clampPan = (s: number) => {
    "worklet";
    const minTx = -(width * (s - 1));
    const minTy = -(height * (s - 1));
    tx.value = clamp(tx.value, minTx, 0);
    ty.value = clamp(ty.value, minTy, 0);
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      startScale.value = scale.value;
      startTx.value = tx.value;
      startTy.value = ty.value;
      startFx.value = e.focalX;
      startFy.value = e.focalY;
    })
    .onUpdate((e) => {
      const s = clampScale(startScale.value * e.scale, maxScale);
      const qx = (startFx.value - startTx.value) / startScale.value;
      const qy = (startFy.value - startTy.value) / startScale.value;
      tx.value = e.focalX - s * qx;
      ty.value = e.focalY - s * qy;
      scale.value = s;
      clampPan(s);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const screenToNormalized = (px: number, py: number) => {
    const s = scale.value;
    const nx = (px - tx.value) / (s * width);
    const ny = (py - ty.value) / (s * height);
    return {
      x: Math.min(1, Math.max(0, nx)),
      y: Math.min(1, Math.max(0, ny)),
    };
  };

  const normalizedToScreen = (nx: number, ny: number) => {
    const s = scale.value;
    return {
      x: nx * s * width + tx.value,
      y: ny * s * height + ty.value,
    };
  };

  const panStart = () => {
    startTx.value = tx.value;
    startTy.value = ty.value;
  };

  const applyTranslation = (dx: number, dy: number) => {
    tx.value = startTx.value + dx;
    ty.value = startTy.value + dy;
    clampPan(scale.value);
  };

  const reset = () => {
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
  };

  return {
    scale,
    tx,
    ty,
    animatedStyle,
    pinchGesture: pinch,
    screenToNormalized,
    normalizedToScreen,
    panStart,
    applyTranslation,
    reset,
  };
}