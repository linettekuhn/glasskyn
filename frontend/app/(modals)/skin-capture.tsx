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
import { getSkinPhotoUrl } from "@/api/skin";
import { useSkinSessions } from "@/contexts/SkinSessionsContext";
import { Colors } from "@/constants/theme";

const HOLD_MS = 2000;
const CAPTURE_TIMEOUT_MS = 8000;
// First still pays the native init cost (session/photo-output warmup,
// distortion/exposure settle) — give it longer before timing out.
const FIRST_CAPTURE_TIMEOUT_MS = 12000;
const POST_TIMEOUT_MS = 5000;
// Warmup gate: shutter stays disabled with a visible "Getting ready" state
// until the native session can actually deliver a still.
const WARMUP_MIN_MS = 1500;
const WARMUP_LUMA_SAMPLES = 3;
// Fallback so a dead sampler or missing started-callback can never brick the
// shutter forever — after this long we trust live face freshness instead.
const WARMUP_FALLBACK_MS = 5000;
// Ring-light settle: no shutter while the screen-brightness change is still
// re-metering exposure.
const RING_SETTLE_MS = 1000;
// Hysteresis band for the auto ring-light trigger. ON below the brightness
// gate, debounce reset above OFF so luma hovering at the threshold can't
// flicker the tip. Once on it latches for the session (baseline lighting
// must stay consistent across captures); the user can still toggle manually.
const RING_ON_LUMA = GATE_CONSTANTS.lumaMin;
const RING_OFF_LUMA = GATE_CONSTANTS.lumaMin + 10;
const LOW_LIGHT_DEBOUNCE_MS = 800;
// Manual shutter follows the same readiness rules as auto-hold: gates must
// hold continuously this long before a tap is accepted.
const MANUAL_STABLE_MS = 500;
// Delay before the single soft auto-retry so a leaked native capture can
// settle instead of colliding with the retry.
const RETRY_DELAY_MS = 1200;
const SHUTTER_SIZE = 84;
const GHOST_MIN_OPACITY = 0.15;
const GHOST_MAX_OPACITY = 0.6;
const GHOST_STEP = 0.1;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTimeoutError(e: unknown): boolean {
  return e instanceof Error && e.message.includes("timed out after");
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default function SkinCaptureScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const { setDraft } = useSkinCapture();

  // NOTE: capture resolution is intentionally fixed at UHD_4_3 below (4:3
  // must match the ghost overlay, crop geometry and landmark reprojection of
  // every existing session). Do not pick per-device "best" resolution here.

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
  const [retrying, setRetrying] = useState(false);
  const [warmedUp, setWarmedUp] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [quality, setQuality] = useState<CaptureQualityResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [ghostUri, setGhostUri] = useState<string | null>(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.3);
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
  const capturedLandmarksRef = useRef<SkinLandmarkRefs | null>(null);
  const capturedPoseRef = useRef<SkinPose | null>(null);
  // Auto-hold starts armed on mount; an explicit Retake disarms it for the
  // rest of the session (manual shutter only from then on).
  const autoHoldRef = useRef(true);
  // Freshness timestamps so the hold loop can never accumulate on stale
  // perception (e.g. a frozen passing face after a shutter cycle).
  const lastFaceAtRef = useRef<number | null>(null);
  const lastLumaAtRef = useRef<number | null>(null);
  // Warmup tracking: mount time, native started callbacks, luma sample
  // count, ring-light settle, and continuous-pass time for the manual
  // shutter stability rule.
  const mountedAtRef = useRef(Date.now());
  const cameraStartedRef = useRef(false);
  const previewStartedRef = useRef(false);
  const lumaCountRef = useRef(0);
  const ringChangedAtRef = useRef<number | null>(null);
  const passSinceRef = useRef<number | null>(null);
  const lowSinceRef = useRef<number | null>(null);
  const hasCapturedRef = useRef(false);
  const warmedUpRef = useRef(false);

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

  const { sessions: skinSessions, refresh: refreshSkinSessions } =
    useSkinSessions();

  useEffect(() => {
    refreshSkinSessions().catch(() => {});
  }, [refreshSkinSessions]);

  // Ghost overlay resolves from the shared store: if the latest session is
  // deleted elsewhere the overlay clears instead of going stale.
  const latestSession = skinSessions[0] ?? null;
  useEffect(() => {
    if (!latestSession) {
      setGhostUri(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = await getSkinPhotoUrl(latestSession.image_url);
        if (cancelled) return;
        setGhostUri(url);
        if (__DEV__)
          console.log(
            "[skin-capture] ghost reference loaded from previous session",
          );
      } catch (e) {
        if (__DEV__)
          console.log("[skin-capture] ghost reference load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latestSession]);

  const incGhostOpacity = () =>
    setGhostOpacity((o) =>
      Math.min(GHOST_MAX_OPACITY, +(o + GHOST_STEP).toFixed(2)),
    );
  const decGhostOpacity = () =>
    setGhostOpacity((o) =>
      Math.max(GHOST_MIN_OPACITY, +(o - GHOST_STEP).toFixed(2)),
    );

  const onFacesDetected = useCallback(
    (detected: Face[]) => {
      // Freeze perception while the shutter pipeline is in-flight so a face
      // move can't re-render/reconfigure the camera mid-capture or corrupt
      // the shutter-time snapshot used for the draft.
      if (busyRef.current || phaseRef.current !== "camera") return;
      setFaces(detected);
      lastFaceAtRef.current = Date.now();
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
    // "balanced" keeps UHD detail for comedones/milia while avoiding the
    // worst-case still latency of "quality" on the first cold capture.
    // Keep fixed for all sessions so baselines stay comparable.
    qualityPrioritization: "balanced",
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

  useEffect(() => {
    if (luma != null) {
      lastLumaAtRef.current = Date.now();
      lumaCountRef.current += 1;
    }
  }, [luma]);

  // Track ring-light changes so the warmup gate can wait out the exposure
  // settle instead of enabling the shutter mid re-meter.
  useEffect(() => {
    ringChangedAtRef.current = Date.now();
  }, [ringLight]);

  // Track how long the gates have held continuously — the manual shutter
  // follows the same readiness rules as auto-hold (shorter hold).
  useEffect(() => {
    if (allPass) {
      if (passSinceRef.current == null) passSinceRef.current = Date.now();
    } else {
      passSinceRef.current = null;
    }
  }, [allPass]);

  useEffect(() => {
    if (phase !== "camera") return;
    // Freeze auto lighting while a shutter is in-flight, holding, or
    // retrying — brightness must not change mid-shot.
    if (busyRef.current || holdStartRef.current != null) return;
    if (ringLight) return; // latched for the session (see constants)
    if (luma == null) return;
    const now = Date.now();
    if (luma < RING_ON_LUMA) {
      if (lowSinceRef.current == null) lowSinceRef.current = now;
      if (now - lowSinceRef.current >= LOW_LIGHT_DEBOUNCE_MS) {
        setRingLight(true);
        lowSinceRef.current = null;
        if (__DEV__)
          console.log("[skin-capture] low light detected, ring flash on");
      }
    } else if (luma > RING_OFF_LUMA) {
      // Well above the band — cancel a pending trigger so threshold hover
      // can't flicker the light/tip. Inside the band: change nothing.
      lowSinceRef.current = null;
    }
  }, [luma, phase, ringLight, capturing, retrying]);

  // Stable JS-thread copy of luma for logging inside the shutter pipeline
  // without recreating triggerCapture (and re-rendering) on every sample.
  const lumaRef = useRef<number | null>(null);
  lumaRef.current = luma;

  // Warmup gate: poll readiness so the shutter can't fire before the native
  // session can deliver a still (cold-start race = first-tap timeout).
  // Falls back after WARMUP_FALLBACK_MS so a dead sampler or missing
  // started-callback can never brick the shutter.
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== "camera") {
        if (warmedUpRef.current) {
          warmedUpRef.current = false;
          setWarmedUp(false);
        }
        return;
      }
      const now = Date.now();
      const elapsed = now - mountedAtRef.current;
      const sessionReady =
        (cameraStartedRef.current && previewStartedRef.current) ||
        elapsed >= WARMUP_FALLBACK_MS;
      const sampled = lumaCountRef.current >= WARMUP_LUMA_SAMPLES;
      const samplerDead =
        lumaRef.current == null && elapsed >= WARMUP_FALLBACK_MS;
      const faceOk =
        lastFaceAtRef.current != null && now - lastFaceAtRef.current < 1500;
      const lumaFresh =
        lumaRef.current != null &&
        lastLumaAtRef.current != null &&
        now - lastLumaAtRef.current < 1500;
      const signalsOk = faceOk && ((sampled && lumaFresh) || samplerDead);
      const ringOk =
        ringChangedAtRef.current == null ||
        now - ringChangedAtRef.current >= RING_SETTLE_MS;
      const ready =
        elapsed >= WARMUP_MIN_MS &&
        sessionReady &&
        signalsOk &&
        ringOk;
      if (ready !== warmedUpRef.current) {
        warmedUpRef.current = ready;
        setWarmedUp(ready);
        if (__DEV__ && ready)
          console.log("[skin-capture] warmed up, shutter ready");
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Memoized so face/luma re-renders don't reconfigure the native pipeline
  // while a capture is in-flight (which previously hung capturePhotoToFile).
  // NOTE: Camera stays active during capture — do NOT gate cameraActive on
  // `capturing`, toggling isActive mid-shutter aborts the native capture.
  const cameraOutputs = useMemo(
    () => [faceDetectorOutput, frameOutput, photoOutput],
    [faceDetectorOutput, frameOutput, photoOutput],
  );

  const triggerCapture = useCallback(
    async (isRetry = false): Promise<void> => {
      if (busyRef.current || phaseRef.current !== "camera") return;
      // Manual taps follow the same readiness rules as auto-hold: the
      // native session must be warmed up and the gates must hold
      // continuously. (Auto-hold enforces this via its 2s loop; the retry
      // path bypasses it because it already verified readiness.)
      if (
        !isRetry &&
        (!warmedUpRef.current ||
          passSinceRef.current == null ||
          Date.now() - passSinceRef.current < MANUAL_STABLE_MS)
      ) {
        if (__DEV__)
          console.log("[skin-capture] shutter not ready, ignoring tap");
        return;
      }
      busyRef.current = true;
      if (isRetry) {
        setRetrying(true);
      } else {
        setCapturing(true);
      }
      // Snapshot shutter-time perception: face moves after this point must not
      // corrupt the draft, and a lost gate means discard-and-retry.
      const snapshotLandmarks = landmarkRefsRef.current;
      const snapshotPose = poseRef.current ? { ...poseRef.current } : null;
      // First still pays the native init cost — give it a longer timeout.
      const timeoutMs = hasCapturedRef.current
        ? CAPTURE_TIMEOUT_MS
        : FIRST_CAPTURE_TIMEOUT_MS;
      const startedAt = Date.now();
      // Settle tracker for the leaked native op: on timeout the raw promise
      // keeps holding the camera, so the soft retry must wait for it (or a
      // short delay) instead of firing a colliding second capture.
      let rawSettled: Promise<void> | null = null;
      try {
        const raw = photoOutput.capturePhotoToFile(
          {
            flashMode: "off",
            enableShutterSound: true,
            // Fixed off for front selfies: keeps still latency down and
            // identical for every session (comparisons stay consistent).
            enableDistortionCorrection: false,
          },
          {},
        );
        rawSettled = raw.then(
          () => undefined,
          () => undefined,
        );
        const result = await withTimeout(raw, timeoutMs, "capture");
        if (phaseRef.current !== "camera") return;
        // Discard-and-retry: the photo is frozen at shutter time, but if the
        // live gates failed while the shutter was processing the user moved —
        // stay in camera and require a fresh hold instead of showing a photo
        // that no longer matches the preview.
        if (!allPassRef.current) {
          if (__DEV__)
            console.log(
              "[skin-capture] discarded capture — face moved during shutter, retrying",
            );
          holdStartRef.current = null;
          setHoldProgress(0);
          Toast.show({
            type: "info",
            text1: "Moved during capture",
            text2: "Hold still to retry",
            position: "bottom",
          });
          return;
        }
        const path = result.filePath;
        const uri = `file://${path}`;
        Vibration.vibrate(40);
        if (__DEV__) {
          console.log(
            `[skin-capture] captured ${path} in ${Date.now() - startedAt}ms ` +
              `luma=${lumaRef.current?.toFixed(1)} pass=${allPassRef.current}`,
          );
        }
      let outUri = uri;
      let outPath = path;
      let photoW = 0;
      let photoH = 0;
      let flipped = false;
      let flipError: string | undefined;
      if (device?.position === "front") {
        const outcome = await withTimeout(
          flipPhotoHorizontal(uri),
          POST_TIMEOUT_MS,
          "flip",
        );
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
        const crop = await withTimeout(
          cropPhotoToScreenAspect(outUri, {
            photoWidth: photoW,
            photoHeight: photoH,
            screenWidth: width,
            screenHeight: height,
          }),
          POST_TIMEOUT_MS,
          "crop",
        );
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
      capturedLandmarksRef.current = snapshotLandmarks;
      capturedPoseRef.current = snapshotPose;
      hasCapturedRef.current = true;
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
      const timedOut = isTimeoutError(e);
      if (__DEV__)
        console.log(
          `[skin-capture] capture ${isRetry ? "retry" : "attempt"} failed ` +
            `after ${Date.now() - startedAt}ms:`,
          e,
        );
      // Soft single auto-retry on timeout: keep the busy lock so no manual
      // tap or second native capture can collide with the leaked op, wait
      // for it to settle (or a short delay), then retry once with a calm
      // message — never a dead end or an error toast.
      if (timedOut && !isRetry && phaseRef.current === "camera") {
        setCapturing(false);
        setRetrying(true);
        Toast.show({
          type: "info",
          text1: "Hold still",
          text2: "Retrying capture…",
          position: "bottom",
        });
        try {
          await Promise.race([
            rawSettled ?? Promise.resolve(),
            delay(RETRY_DELAY_MS),
          ]);
        } catch {
          // Settle tracker never rejects (mapped above) — defensive only.
        }
        if (phaseRef.current !== "camera") return;
        holdStartRef.current = null;
        setHoldProgress(0);
        // Release the lock before re-entering: the retry re-acquires it.
        // (finally below re-clears — harmless no-op.)
        busyRef.current = false;
        setCapturing(false);
        setRetrying(false);
        return triggerCaptureRef.current(true);
      }
      holdStartRef.current = null;
      setHoldProgress(0);
      Toast.show({
        type: "info",
        text1: "Couldn't capture",
        text2: "Hold still and try again",
        position: "bottom",
      });
    } finally {
      busyRef.current = false;
      setCapturing(false);
      setRetrying(false);
    }
  }, [photoOutput, device, width, height]);

  const triggerCaptureRef = useRef(triggerCapture);
  triggerCaptureRef.current = triggerCapture;

  useEffect(() => {
    if (!cameraActive) {
      holdStartRef.current = null;
      setHoldProgress(0);
      return;
    }
    const id = setInterval(() => {
      if (
        busyRef.current ||
        phaseRef.current !== "camera" ||
        !autoHoldRef.current ||
        !warmedUpRef.current
      ) {
        holdStartRef.current = null;
        setHoldProgress(0);
        return;
      }
      if (!allPassRef.current) {
        holdStartRef.current = null;
        setHoldProgress(0);
        return;
      }
      // Require live signals, not frozen perception: the face box and the
      // light reading must both be fresh, otherwise a stale passing gate
      // (e.g. after a shutter cycle) could auto-fire with no live face.
      const now = Date.now();
      const faceFresh =
        lastFaceAtRef.current != null &&
        now - lastFaceAtRef.current < 1500;
      const lumaFresh =
        lumaRef.current != null &&
        lastLumaAtRef.current != null &&
        now - lastLumaAtRef.current < 1500;
      if (!faceFresh || !lumaFresh) {
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
    capturedLandmarksRef.current = null;
    capturedPoseRef.current = null;
    // Drop frozen shutter-time perception so the gates can't pass on stale
    // data, and disarm auto-hold: from here on it's manual shutter only.
    setFaces([]);
    primaryFaceRef.current = null;
    landmarkRefsRef.current = null;
    poseRef.current = null;
    allPassRef.current = false;
    lastFaceAtRef.current = null;
    lastLumaAtRef.current = null;
    passSinceRef.current = null;
    lowSinceRef.current = null;
    autoHoldRef.current = false;
    holdStartRef.current = null;
    setHoldProgress(0);
    setPhase("camera");
  };

  const handleUsePhoto = () => {
    if (!photoUri || !photoPath) return;
    setDraft({
      photoPath,
      photoUri,
      capturedAt: new Date().toISOString(),
      landmarks: capturedLandmarksRef.current ?? landmarkRefsRef.current,
      pose: capturedPoseRef.current ?? poseRef.current,
      frameSize: { width, height },
      luma: quality?.luma ?? null,
      variance: quality?.variance ?? null,
    });
    if (__DEV__) console.log("[skin-capture] draft saved to context");
    router.replace("/(modals)/face-annotation");
  };

  const qualityIssue =
    quality != null &&
    (quality.blurry || quality.tooDark || quality.tooBright);
  const qualityUnknown =
    quality != null && !qualityIssue && quality.lumaUnknown;

  const mode: OvalMode = !primaryGateFace
    ? "gray"
    : allPass
      ? "green"
      : "amber";

  // Session state fed to the oval tooltip — the pill is the single place
  // for user guidance, so the screen never renders its own second line.
  // Priority: shutter in-flight → warmup → hold progress → gate tip.
  const tipOverride =
    capturing || retrying
      ? { message: "Hold still…", tone: "success" as const }
      : !warmedUp
        ? { message: "Getting ready…", tone: "neutral" as const }
        : allPass && holdProgress > 0 && holdProgress < 1
          ? { message: "Hold steady…", tone: "success" as const }
          : null;

  // Manual shutter follows the same readiness rules as auto-hold.
  // Read at render; face detections re-render continuously so this stays
  // fresh without extra state.
  const stablePass =
    passSinceRef.current != null &&
    Date.now() - passSinceRef.current >= MANUAL_STABLE_MS;
  const shutterReady = allPass && warmedUp && stablePass;
  const shutterColor = shutterReady ? btnColor : disabledColor;
  const shutterDisabled = capturing || retrying || !shutterReady;
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
            outputs={cameraOutputs}
            onError={(e) => {
              if (__DEV__)
                console.log("[skin-capture] camera onError:", e?.message ?? e);
              setError(String(e?.message ?? e));
            }}
            onStarted={() => {
              cameraStartedRef.current = true;
              if (__DEV__) console.log("[skin-capture] camera started");
            }}
            onPreviewStarted={() => {
              previewStartedRef.current = true;
              if (__DEV__) console.log("[skin-capture] preview started");
            }}
          />

          {phase === "camera" ? (
            <>
              {ghostUri && (
                <Image
                  source={{ uri: ghostUri }}
                  style={[StyleSheet.absoluteFill, { opacity: ghostOpacity }]}
                  resizeMode="cover"
                  pointerEvents="none"
                />
              )}
              <GuideOval
                geometry={geometry}
                gates={gates}
                mode={mode}
                width={width}
                height={height}
                statusOverride={tipOverride}
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
                {ghostUri && (
                  <>
                    <IconButton
                      iconColor={txtColor}
                      activeColor={btnColor}
                      onPress={decGhostOpacity}
                      IconComponent={MaterialCommunityIcons}
                      iconName="minus"
                    />
                    <ThemedText
                      style={{
                        color: txtColor,
                        minWidth: 40,
                        textAlign: "center",
                      }}
                      type="caption"
                      weight="semiBold"
                    >
                      {Math.round(ghostOpacity * 100)}%
                    </ThemedText>
                    <IconButton
                      iconColor={txtColor}
                      activeColor={btnColor}
                      onPress={incGhostOpacity}
                      IconComponent={MaterialCommunityIcons}
                      iconName="plus"
                    />
                  </>
                )}
                <IconButton
                  active={ringLight}
                  iconColor={txtColor}
                  activeColor={btnColor}
                  onPress={() => {
                    // Never change brightness mid-shot: it re-meters
                    // exposure and stalls the still.
                    if (
                      busyRef.current ||
                      holdStartRef.current != null ||
                      capturing ||
                      retrying
                    ) {
                      return;
                    }
                    setRingLight((p) => !p);
                  }}
                  disabled={capturing || retrying}
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
                  {shutterReady && !capturing && !retrying && (
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
                  onPress={
                    shutterReady
                      ? () => void triggerCaptureRef.current(false)
                      : undefined
                  }
                  activeOpacity={0.85}
                  disabled={shutterDisabled}
                >
                  {capturing || retrying ? (
                    <ActivityIndicator size="large" color={btnColor} />
                  ) : (
                    <View
                      style={[
                        styles.shutterInner,
                        {
                          backgroundColor: shutterReady
                            ? btnColor
                            : disabledColor,
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
                        qualityIssue
                          ? "alert-circle-outline"
                          : qualityUnknown
                            ? "help-circle-outline"
                            : "check-decagram-outline"
                      }
                      size={18}
                      color={
                        qualityIssue
                          ? "#F4B740"
                          : qualityUnknown
                            ? txtColor
                            : btnColor
                      }
                    />
                    <ThemedText
                      style={{ color: txtColor }}
                      type="bodyLarge"
                      weight="semiBold"
                    >
                      {qualityIssue
                        ? "Retake recommended"
                        : qualityUnknown
                          ? "Couldn't check lighting"
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
                          ? "A bit dark! Use more light."
                          : quality.tooBright
                            ? "A bit bright! Move out of direct light."
                            : "Looking a little blurry! Steady your hand."}
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
