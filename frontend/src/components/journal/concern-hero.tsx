import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  cropDotPosition,
  cropImageLayout,
  getConcernCropRect,
} from "@/utils/concern-crop";

interface ConcernHeroProps {
  uri: string | undefined;
  aspect: number | undefined;
  coords: { x: number; y: number } | null;
  /** 'crop' = zoomed fixed-geometry crop; 'full' = gap/low-confidence photo. */
  mode: "crop" | "full";
  size: number;
  showCircle: boolean;
  reduceMotion: boolean;
  /** Adjust mode: drag moves the dot, reported in normalized coords. */
  adjusting?: boolean;
  adjustValue?: { x: number; y: number } | null;
  onAdjustMove?: (coords: { x: number; y: number }) => void;
  onPhotoLoad?: (uri: string, w: number, h: number) => void;
}

const FADE_MS = 175;
const DOT_DIAM_RATIO = 0.11;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Square hero crop. Full photo is scaled/translated inside a clipped
 * container (no new image files). Previous frame stays visible until the
 * next decodes, then short cross-fade (skipped under reduce-motion).
 */
export default function ConcernHero({
  uri,
  aspect,
  coords,
  mode,
  size,
  showCircle,
  reduceMotion,
  adjusting = false,
  adjustValue = null,
  onAdjustMove,
  onPhotoLoad,
}: ConcernHeroProps) {
  const [displayed, setDisplayed] = useState(uri);
  const [incoming, setIncoming] = useState<string | null>(null);
  const fade = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  useEffect(() => {
    setDisplayed((prev) => prev ?? uri);
  }, [uri]);

  useEffect(() => {
    if (uri && uri !== displayed && uri !== incoming) {
      if (reduceMotion || !displayed) {
        setDisplayed(uri);
      } else {
        setIncoming(uri);
      }
    }
  }, [uri, displayed, incoming, reduceMotion]);

  const commitIncoming = (next: string) => {
    setDisplayed(next);
    setIncoming(null);
    fade.value = 0;
  };

  const center = coords ?? { x: 0.5, y: 0.5 };
  const rect =
    mode === "crop"
      ? getConcernCropRect(center, aspect)
      : { x0: 0, y0: 0, rw: 1, rh: 1 };
  const layout = cropImageLayout(size, rect);
  const dot =
    coords != null ? cropDotPosition(size, rect, coords) : null;
  const dotDiam = Math.max(28, size * DOT_DIAM_RATIO);

  const dragGesture = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      if (!adjusting) return;
      // e coordinates are relative to the gesture container (the square).
      const nx = clamp01(e.x / size);
      const ny = clamp01(e.y / size);
      onAdjustMove?.({ x: nx, y: ny });
    });

  const shownDot = adjusting ? (adjustValue ?? coords) : coords;
  const shownDotPos =
    shownDot != null
      ? mode === "crop"
        ? cropDotPosition(size, rect, shownDot)
        : { x: shownDot.x * size, y: shownDot.y * size }
      : null;

  const body = (
    <View style={[styles.clip, { width: size, height: size }]}>
      {displayed ? (
        <Image
          source={{ uri: displayed }}
          style={{
            position: "absolute",
            width: layout.width,
            height: layout.height,
            left: layout.left,
            top: layout.top,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={displayed}
          priority="high"
          onLoad={(e) =>
            onPhotoLoad?.(displayed, e.source.width, e.source.height)
          }
        />
      ) : (
        <View style={styles.fallback} />
      )}
      {incoming ? (
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
          <Image
            source={{ uri: incoming }}
            style={{
              position: "absolute",
              width: layout.width,
              height: layout.height,
              left: layout.left,
              top: layout.top,
            }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={incoming}
            priority="high"
            onLoad={() => {
              if (reduceMotion) {
                commitIncoming(incoming);
              } else {
                fade.value = withTiming(
                  1,
                  { duration: FADE_MS },
                  (finished) => {
                    if (finished) runOnJS(commitIncoming)(incoming);
                  },
                );
              }
            }}
          />
        </Animated.View>
      ) : null}
      {showCircle && !adjusting && dot != null && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: dot.x - dotDiam / 2,
            top: dot.y - dotDiam / 2,
            width: dotDiam,
            height: dotDiam,
            borderRadius: dotDiam / 2,
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
            backgroundColor: "transparent",
          }}
        />
      )}
      {adjusting && shownDotPos != null && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: shownDotPos.x - dotDiam / 2,
            top: shownDotPos.y - dotDiam / 2,
            width: dotDiam,
            height: dotDiam,
            borderRadius: dotDiam / 2,
            borderWidth: 2,
            borderColor: "#FFD9A0",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        />
      )}
    </View>
  );

  if (adjusting) {
    return <GestureDetector gesture={dragGesture}>{body}</GestureDetector>;
  }
  return body;
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
