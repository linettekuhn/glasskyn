import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  useFaceDetectorOutput,
  type Face,
} from "react-native-vision-camera-face-detector";
import Svg, { Rect, Circle, type NumberProp } from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ui/themed-text";
import IconButton from "@/components/ui/icon-button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

const LANDMARK_COLOR = "#00E5A0";
const BOUNDS_COLOR = "#FFD166";

function toSafePoint(p?: { x: number; y: number }) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return p;
}

export default function SkinFaceTestScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [faces, setFaces] = useState<Face[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const granted = hasPermission || (await requestPermission());
        if (mounted) setReady(Boolean(granted));
      } catch (e) {
        if (mounted) setError(String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [hasPermission, requestPermission]);

  const onFacesDetected = useCallback((detected: Face[]) => {
    setFaces(detected);
    if (__DEV__ && detected.length > 0) {
      const f = detected[0];
      const lm = f.landmarks ?? {};
      const norm = Object.fromEntries(
        Object.entries(lm)
          .filter(([, v]) => v && Number.isFinite(v.x) && Number.isFinite(v.y))
          .map(([k, v]) => [k, { x: v!.x / f.frameWidth, y: v!.y / f.frameHeight }]),
      );
      console.log(
        `[SFT] face bounds=(${f.bounds.x},${f.bounds.y},${f.bounds.width},${f.bounds.height}) ` +
          `frame=${f.frameWidth}x${f.frameHeight} pose=(p${f.pitchAngle.toFixed(1)} r${f.rollAngle.toFixed(1)} y${f.yawAngle.toFixed(1)}) ` +
          `safe_refs_norm=${JSON.stringify(norm)}`,
      );
    }
  }, []);

  const faceDetectorOutput = useFaceDetectorOutput(
    useMemo(
      () => ({
        performanceMode: "fast" as const,
        runLandmarks: true,
        runClassifications: true,
        autoMode: true,
        windowWidth: width,
        windowHeight: height,
        outputResolution: "preview" as const,
        onFacesDetected,
        onError: (e: Error) => setError(String(e?.message ?? e)),
      }),
      [width, height, onFacesDetected],
    ),
  );

  const primary = faces[0];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {ready && device ? (
        <View style={StyleSheet.absoluteFill}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            outputs={[faceDetectorOutput]}
          />
          <Svg
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {primary &&
              (() => {
                const b = primary.bounds;
                const safe = [b.x, b.y, b.width, b.height].every(Number.isFinite);
                return (
                  <>
                    {safe && (
                      <Rect
                        x={b.x as NumberProp}
                        y={b.y as NumberProp}
                        width={b.width as NumberProp}
                        height={b.height as NumberProp}
                        fill="none"
                        stroke={BOUNDS_COLOR}
                        strokeWidth={3}
                      />
                    )}
                    {primary.landmarks &&
                      Object.entries(primary.landmarks).map(([key, p]) => {
                        const pt = toSafePoint(p);
                        if (!pt) return null;
                        return (
                          <Circle
                            key={key}
                            cx={pt.x as NumberProp}
                            cy={pt.y as NumberProp}
                            r={6}
                            fill={LANDMARK_COLOR}
                            stroke="#041414"
                            strokeWidth={1.5}
                          />
                        );
                      })}
                  </>
                );
              })()}
          </Svg>
        </View>
      ) : (
        <View style={styles.cameraFallback}>
          <ThemedText style={{ color: "#fff" }} type="bodyLarge">
            {!ready
              ? "Camera permission not granted"
              : device == null
                ? "No front camera device found"
                : "Initializing…"}
          </ThemedText>
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <IconButton
          iconColor="#fff"
          onPress={() => router.back()}
          IconComponent={MaterialCommunityIcons}
          iconName="close"
        />
        <ThemedText style={[styles.title, { color: "#fff" }]} type="bodyLarge" weight="bold">
          Skin Face Detection Test
        </ThemedText>
      </View>

      <View style={[styles.logPanel, { bottom: insets.bottom + 12 }]}>
        <View style={styles.logRow}>
          <ThemedText style={{ color: "#fff" }} type="caption" weight="semiBold">
            Faces: {faces.length}
          </ThemedText>
          {primary && (
            <ThemedText style={{ color: "#fff" }} type="caption">
              frame {primary.frameWidth}×{primary.frameHeight} · roll{" "}
              {primary.rollAngle.toFixed(1)}° · yaw {primary.yawAngle.toFixed(1)}° ·
              pitch {primary.pitchAngle.toFixed(1)}°
            </ThemedText>
          )}
        </View>
        <ScrollView style={styles.logScroller} nestedScrollEnabled>
          <ThemedText style={{ color: "#B8FEEF" }} type="caption">
            {error ? `error: ${error}` : "Frame-normalized landmark refs are logged to the console (debug builds only)."}
          </ThemedText>
          {primary?.landmarks ? (
            <ThemedText style={{ color: "#fff", opacity: 0.85 }} type="caption">
              {Object.keys(primary.landmarks).join(" · ") || "no landmarks"}
            </ThemedText>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  cameraFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: { flex: 1 },
  logPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(4,20,20,0.72)",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    maxHeight: 150,
  },
  logRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  logScroller: { flexGrow: 0 },
});