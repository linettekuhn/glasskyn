import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  CommonResolutions,
} from "react-native-vision-camera";
import { useIsFocused } from "@react-navigation/native";
import {
  useFaceDetectorOutput,
  type Face,
} from "react-native-vision-camera-face-detector";
import Svg, { Circle } from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import * as Updates from "expo-updates";
import * as Brightness from "expo-brightness";

import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import IconButton from "@/components/ui/icon-button";
import GuideOval, { type OvalMode } from "@/components/skin/guide-oval";
import SkinRingFlash from "@/components/skin/skin-ring-flash";
import { useGuideOval } from "@/hooks/use-guide-oval";
import { useLiveLuma } from "@/hooks/use-live-luma";
import {
  analyzeCapture,
  type CaptureQualityResult,
} from "@/utils/capture-quality";
import { flipPhotoHorizontal } from "@/utils/flip-photo";
import { cropPhotoToScreenAspect } from "@/utils/crop-photo";
import { GATE_CONSTANTS, type GateFace } from "@/utils/face-gating";
import {
  useSkinCapture,
  type SkinLandmarkRefs,
  type SkinPose,
} from "@/contexts/SkinCaptureContext";
import { Colors } from "@/constants/theme";

const HOLD_MS = 1000;
const SHUTTER_SIZE = 84;
const btnColor = Colors["light"].primary[400];
const txtColor = Colors["light"].neutral[100];
const disabledColor = Colors["light"].neutral[300];

function toGateFace(face: Face | undefined): GateFace | null {
  if (
    !face ||
    !Number.isFinite(face.bounds.x) ||
    !Number.isFinite(face.bounds.y) ||
    !Number.isFinite(face.bounds.width) ||
    !Number.isFinite(face.bounds.height)
  ) {
    return null;
  }
  return {
    bounds: {
      x: face.bounds.x,
      y: face.bounds.y,
      width: face.bounds.width,
      height: face.bounds.height,
    },
    pitchAngle: face.pitchAngle,
    rollAngle: face.rollAngle,
    yawAngle: face.yawAngle,
  };
}

function normalizeLandmarks(
  face: Face | undefined,
  width: number,
  height: number,
): SkinLandmarkRefs | null {
  if (!face?.landmarks || width <= 0 || height <= 0) return null;
  const refs: SkinLandmarkRefs = {};
  for (const [key, point] of Object.entries(face.landmarks)) {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      refs[key] = { x: point.x / width, y: point.y / height };
    }
  }
  return refs;
}

export default function SkinCaptureScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const { setDraft } = useSkinCapture();

  const maxPhotoResolution = useMemo(() => {
    if (!device) return null;
    try {
      const sizes = device.getSupportedResolutions("photo");
      let best: { width: number; height: number } | null = null;
      for (const s of sizes) {
        if (!best || s.width * s.height > best.width * best.height) {
          best = s;
        }
      }
      return best;
    } catch {
      return null;
    }
  }, [device]);

  const [ready, setReady] = useState(false);
  const [faces, setFaces] = useState<Face[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"camera" | "preview">("camera");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [ringLight, setRingLight] = useState(false);
  const prevBrightnessRef = useRef<number | null>(null);

  useEffect(() => {
    if (ringLight) {
      Brightness.getBrightnessAsync()
        .then((prev) => {
          prevBrightnessRef.current = prev;
        })
        .then(() => Brightness.setBrightnessAsync(1));
    } else if (prevBrightnessRef.current != null) {
      Brightness.setBrightnessAsync(prevBrightnessRef.current);
      prevBrightnessRef.current = null;
    }
  }, [ringLight]);

  useEffect(() => {
    return () => {
      if (prevBrightnessRef.current == null) return;
      Brightness.setBrightnessAsync(prevBrightnessRef.current);
      prevBrightnessRef.current = null;
    };
  }, []);

  const [capturing, setCapturing] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [quality, setQuality] = useState<CaptureQualityResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [captureInfo, setCaptureInfo] = useState<{
    width: number;
    height: number;
    flipped: boolean;
    error?: string;
  } | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const busyRef = useRef(false);
  const holdStartRef = useRef<number | null>(null);
  const allPassRef = useRef(false);
  const primaryFaceRef = useRef<GateFace | null>(null);
  const landmarkRefsRef = useRef<SkinLandmarkRefs | null>(null);
  const poseRef = useRef<SkinPose | null>(null);

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

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setAppState(next);
    });
    return () => sub.remove();
  }, []);

  const onFacesDetected = useCallback(
    (detected: Face[]) => {
      setFaces(detected);
      const first = detected[0];
      primaryFaceRef.current = toGateFace(first);
      landmarkRefsRef.current = normalizeLandmarks(first, width, height);
      poseRef.current = first
        ? {
            yaw: first.yawAngle,
            pitch: first.pitchAngle,
            roll: first.rollAngle,
          }
        : null;
    },
    [width, height],
  );

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

  const cameraActive =
    ready &&
    device != null &&
    phase === "camera" &&
    isFocused &&
    appState === "active";

  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_4_3,
    containerFormat: "jpeg",
    quality: 0.9,
    qualityPrioritization: "quality",
  });

  const { luma, sampling, frameOutput } = useLiveLuma({
    isActive: cameraActive,
    sampleIntervalMs: 500,
  });

  const primaryGateFace = primaryFaceRef.current ?? toGateFace(faces[0]);

  const { geometry, gates } = useGuideOval({
    width,
    height,
    topInset: insets.top,
    face: primaryGateFace,
    luma,
  });

  const allPass = gates.allPass;
  useEffect(() => {
    allPassRef.current = allPass;
  }, [allPass]);

  const lowLight = luma != null && luma < GATE_CONSTANTS.lumaMin;
  const wasLowLightRef = useRef(false);
  useEffect(() => {
    if (phase !== "camera") return;
    if (lowLight && !wasLowLightRef.current) {
      setRingLight(true);
      if (__DEV__)
        console.log("[skin-capture] low light detected, ring flash on");
    }
    wasLowLightRef.current = lowLight;
  }, [lowLight, phase]);

  const triggerCapture = useCallback(async () => {
    if (busyRef.current || phaseRef.current !== "camera") return;
    busyRef.current = true;
    setCapturing(true);
    try {
      const result = await photoOutput.capturePhotoToFile(
        {
          flashMode: "off",
          enableShutterSound: true,
          enableDistortionCorrection: true,
        },
        {},
      );
      const path = result.filePath;
      const uri = `file://${path}`;
      Vibration.vibrate(40);
      if (__DEV__) {
        console.log(
          `[skin-capture] captured ${path} luma=${luma?.toFixed(1)} pass=${allPassRef.current}`,
        );
      }
      let outUri = uri;
      let outPath = path;
      let photoW = 0;
      let photoH = 0;
      let flipped = false;
      let flipError: string | undefined;
      if (device?.position === "front") {
        const outcome = await flipPhotoHorizontal(uri);
        outUri = outcome.uri;
        outPath = outcome.path;
        photoW = outcome.width;
        photoH = outcome.height;
        flipped = outcome.flipped;
        flipError = outcome.error;
        if (__DEV__) {
          console.log(
            `[skin-capture] ${outcome.flipped ? "mirrored front capture" : "flip fallback"} ` +
              `${outcome.width}x${outcome.height} ${outcome.path}` +
              (outcome.error ? ` (${outcome.error})` : ""),
          );
        }
      }
      if (photoW > 0 && photoH > 0) {
        const crop = await cropPhotoToScreenAspect(outUri, {
          photoWidth: photoW,
          photoHeight: photoH,
          screenWidth: width,
          screenHeight: height,
        });
        outUri = crop.uri;
        outPath = crop.path;
        photoW = crop.width;
        photoH = crop.height;
        if (__DEV__) {
          console.log(
            `[skin-capture] ${crop.cropped ? "cropped to screen aspect" : "crop fallback"} ` +
              `${crop.width}x${crop.height} ${crop.path}` +
              (crop.error ? ` (${crop.error})` : ""),
          );
        }
      }
      setCaptureInfo({
        width: photoW,
        height: photoH,
        flipped,
        error: flipError,
      });
      setPhotoUri(outUri);
      setPhotoPath(outPath);
      setRingLight(false);
      setPhase("preview");
    } catch (e) {
      if (__DEV__) console.log("[skin-capture] capture error:", e);
      Toast.show({
        type: "error",
        text1: "Capture failed",
        text2: e instanceof Error ? e.message : String(e),
        position: "bottom",
      });
    } finally {
      busyRef.current = false;
      setCapturing(false);
    }
  }, [photoOutput, luma, device]);

  const triggerCaptureRef = useRef(triggerCapture);
  triggerCaptureRef.current = triggerCapture;

  useEffect(() => {
    if (!cameraActive) {
      holdStartRef.current = null;
      setHoldProgress(0);
      return;
    }
    const id = setInterval(() => {
      if (busyRef.current || phaseRef.current !== "camera") {
        holdStartRef.current = null;
        setHoldProgress(0);
        return;
      }
      if (!allPassRef.current) {
        holdStartRef.current = null;
        setHoldProgress(0);
        return;
      }
      if (holdStartRef.current == null) {
        holdStartRef.current = Date.now();
      }
      const elapsed = Date.now() - holdStartRef.current;
      setHoldProgress(Math.min(elapsed / HOLD_MS, 1));
      if (elapsed >= HOLD_MS) {
        holdStartRef.current = null;
        triggerCaptureRef.current();
      }
    }, 50);
    return () => clearInterval(id);
  }, [cameraActive]);

  useEffect(() => {
    if (phase !== "preview" || !photoUri) return;
    let cancelled = false;
    setAnalyzing(true);
    (async () => {
      const result = await analyzeCapture(photoUri);
      if (cancelled) return;
      setQuality(result);
      setAnalyzing(false);
      if (__DEV__) {
        console.log(
          `[skin-capture] preview quality luma=${result.luma?.toFixed(1)} ` +
            `blur=${result.variance.toFixed(1)} dark=${result.tooDark} bright=${result.tooBright}`,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, photoUri]);

  const handleRetake = () => {
    setPhotoUri(null);
    setPhotoPath(null);
    setQuality(null);
    setCaptureInfo(null);
    setAnalyzing(false);
    setPhase("camera");
  };

  const handleUsePhoto = () => {
    if (!photoUri || !photoPath) return;
    setDraft({
      photoPath,
      photoUri,
      capturedAt: new Date().toISOString(),
      landmarks: landmarkRefsRef.current,
      pose: poseRef.current,
      frameSize: { width, height },
      luma: quality?.luma ?? null,
      variance: quality?.variance ?? null,
    });
    if (__DEV__) console.log("[skin-capture] draft saved to context");
    router.replace("/(modals)/face-annotation");
  };

  const mode: OvalMode = !primaryGateFace
    ? "gray"
    : allPass
      ? "green"
      : "amber";

  const statusLine = capturing
    ? ""
    : allPass
      ? holdProgress > 0 && holdProgress < 1
        ? "Hold steady…"
        : "Ready! Hold still"
      : "Align your face with the oval";

  const shutterColor = allPass ? btnColor : disabledColor;
  const shutterDisabled = capturing || !allPass;
  const ringRadius = SHUTTER_SIZE / 2 + 8;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <View style={styles.container}>
      <StatusBar style={ringLight ? "dark" : "light"} />
      {ready && device ? (
        <View style={StyleSheet.absoluteFill}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={cameraActive}
            mirrorMode="auto"
            outputs={[faceDetectorOutput, frameOutput, photoOutput]}
            onError={(e) => {
              if (__DEV__)
                console.log("[skin-capture] camera onError:", e?.message ?? e);
              setError(String(e?.message ?? e));
            }}
            onStarted={() => {
              if (__DEV__) console.log("[skin-capture] camera started");
            }}
            onPreviewStarted={() => {
              if (__DEV__) console.log("[skin-capture] preview started");
            }}
          />

          {phase === "camera" ? (
            <>
              <GuideOval
                geometry={geometry}
                gates={gates}
                mode={mode}
                width={width}
                height={height}
              />
              <SkinRingFlash active={ringLight} />
            </>
          ) : (
            photoUri && (
              <Image
                source={{ uri: photoUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            )
          )}

          <View style={[styles.topBar, { top: insets.top + 12 }]}>
            <IconButton
              iconColor={txtColor}
              activeColor={btnColor}
              onPress={phase === "preview" ? handleRetake : () => router.back()}
              IconComponent={MaterialCommunityIcons}
              iconName="close"
            />
            {phase === "camera" && (
              <>
                <View style={{ flex: 1 }} />
                {sampling && (
                  <ActivityIndicator size="small" color={txtColor} />
                )}
                <IconButton
                  active={ringLight}
                  iconColor={txtColor}
                  activeColor={btnColor}
                  onPress={() => setRingLight((p) => !p)}
                  IconComponent={MaterialCommunityIcons}
                  iconName="flashlight"
                />
              </>
            )}
          </View>

          {phase === "camera" ? (
            <View
              style={[styles.bottomSection, { bottom: insets.bottom + 12 }]}
            >
              <View
                style={{ width: SHUTTER_SIZE + 26, height: SHUTTER_SIZE + 24 }}
              >
                <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                  {allPass && !capturing && (
                    <Circle
                      cx={SHUTTER_SIZE / 2 + 12}
                      cy={SHUTTER_SIZE / 2 + 12}
                      r={ringRadius}
                      fill="none"
                      stroke={Colors["light"].secondary[400]}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeDasharray={`${ringCircumference}`}
                      strokeDashoffset={ringCircumference * (1 - holdProgress)}
                      transform={`rotate(-90 ${SHUTTER_SIZE / 2 + 12} ${SHUTTER_SIZE / 2 + 12})`}
                    />
                  )}
                </Svg>
                <TouchableOpacity
                  style={[
                    styles.shutter,
                    { borderColor: shutterColor },
                    shutterDisabled && styles.shutterDisabled,
                  ]}
                  onPress={allPass ? triggerCapture : undefined}
                  activeOpacity={0.85}
                  disabled={shutterDisabled}
                >
                  {capturing ? (
                    <ActivityIndicator size="large" color={btnColor} />
                  ) : (
                    <View
                      style={[
                        styles.shutterInner,
                        {
                          backgroundColor: allPass ? btnColor : disabledColor,
                        },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.previewPanel, { bottom: insets.bottom + 24 }]}>
              {analyzing ? (
                <View style={styles.previewCheck}>
                  <ActivityIndicator size="small" color={txtColor} />
                  <ThemedText style={{ color: txtColor }} type="bodyLarge">
                    Checking photo…
                  </ThemedText>
                </View>
              ) : (
                <>
                  <View style={styles.qualityRow}>
                    <MaterialCommunityIcons
                      name={
                        quality &&
                        (quality.blurry || quality.tooDark || quality.tooBright)
                          ? "alert-circle-outline"
                          : "check-decagram-outline"
                      }
                      size={18}
                      color={
                        quality &&
                        !quality.blurry &&
                        !quality.tooDark &&
                        !quality.tooBright
                          ? btnColor
                          : "#F4B740"
                      }
                    />
                    <ThemedText
                      style={{ color: txtColor }}
                      type="bodyLarge"
                      weight="semiBold"
                    >
                      {quality &&
                      (quality.blurry || quality.tooDark || quality.tooBright)
                        ? "Retake recommended"
                        : "Looks good"}
                    </ThemedText>
                  </View>
                  {quality &&
                    (quality.tooDark ||
                      quality.tooBright ||
                      quality.blurry) && (
                      <ThemedText
                        style={{ color: txtColor, opacity: 0.7 }}
                        type="caption"
                      >
                        {quality.tooDark
                          ? "A bit dark! use more light."
                          : quality.tooBright
                            ? "A bit bright! move out of direct light."
                            : "Looking a little blurry! steady your hand."}
                      </ThemedText>
                    )}
                </>
              )}
              <View style={styles.buttonRow}>
                <ThemedButton
                  text="Retake"
                  color={btnColor}
                  outlined
                  onPress={handleRetake}
                  alignment="stretch"
                  leftIconName="reload"
                  LeftIconComponent={MaterialCommunityIcons}
                />
                <ThemedButton
                  text="Use Photo"
                  color={btnColor}
                  onPress={handleUsePhoto}
                  alignment="stretch"
                  loading={false}
                  leftIconName="check"
                  LeftIconComponent={MaterialCommunityIcons}
                />
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.cameraFallback}>
          <ThemedText style={{ color: txtColor }} type="bodyLarge">
            {!ready
              ? "Camera permission not granted"
              : device == null
                ? "No front camera device found"
                : "Initializing…"}
          </ThemedText>
          {error && (
            <ThemedText
              style={{ color: txtColor, opacity: 0.7 }}
              type="caption"
            >
              {error}
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  cameraFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { flex: 1 },
  bottomSection: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    alignSelf: "center",
    marginTop: 12,
  },
  shutterInner: {
    width: SHUTTER_SIZE - 16,
    height: SHUTTER_SIZE - 16,
    borderRadius: (SHUTTER_SIZE - 16) / 2,
  },
  shutterDisabled: { opacity: 0.6 },
  previewPanel: {
    position: "absolute",
    left: 20,
    right: 20,
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 16,
  },
  previewCheck: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 6,
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    width: "100%",
  },
});
