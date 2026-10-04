import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CommonResolutions,
  useFrameOutput,
  type CameraFrameOutput,
  type Frame,
} from "react-native-vision-camera";
import { scheduleOnRN } from "react-native-worklets";
import { useSharedValue } from "react-native-reanimated";

export interface LiveLumaOptions {
  isActive: boolean;
  /** Minimum milliseconds between forwarded samples (~2/s at 500). */
  sampleIntervalMs?: number;
  onError?: (error: unknown) => void;
}

export interface LiveLumaState {
  luma: number | null;
  sampling: boolean;
  frameOutput: CameraFrameOutput;
}

/**
 * Live luminance gate backed by the camera's Frame Output.
 *
 * The luma value is derived inside the frame worklet by subsampling the Y
 * plane of a low-resolution YUV frame (throttled to ~2 samples/sec), then
 * bridged to the JS thread via `runOnJS`. No photo capture, JPEG encoding or
 * temp file is involved — the light gate no longer competes with the photo
 * pipeline, which keeps the preview smooth and the exposure stable.
 *
 * `luma` is `null` while unknown (before the first sample, while inactive, or
 * after a sampling failure) — callers must treat `null` as a non-blocking
 * "unknown" light gate rather than hard-failing the capture. Callers should
 * still surface the unknown state in UI so a dead sampler can't masquerade
 * as good lighting.
 *
 * @note Requires `react-native-vision-camera-worklets` (native) to be built
 * into the running app.
 */
export function useLiveLuma({
  isActive,
  sampleIntervalMs = 500,
  onError,
}: LiveLumaOptions): LiveLumaState {
  const setLumaRef = useRef<(value: number) => void>(() => {});
  const setSamplingRef = useRef<(value: boolean) => void>(() => {});
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [luma, setLuma] = useState<number | null>(null);
  const [sampling, setSampling] = useState(false);

  const internalOnLuma = useCallback((value: number) => {
    if (Number.isFinite(value)) {
      setLumaRef.current(value);
      setSamplingRef.current(true);
    }
  }, []);

  const internalOnLumaError = useCallback((detail: string) => {
    onErrorRef.current?.(detail);
  }, []);

  // NOTE: do NOT bridge via runOnJS() here. Its wrapper is a runtime-created
  // plain closure, which the frame runtime rejects ("tried to synchronously
  // call a non-worklet anonymous function"). scheduleOnRN is a global host
  // function present on every runtime and accepts component-scope callbacks,
  // which the babel plugin captures into the worklet closure below.

  // Frame-counter throttle (~2 samples/sec at 30fps for the 500ms default).
  // Deliberately avoids Date.now()/frame.timestamp inside the worklet — clock
  // access has been observed to throw on some Nitro worklet runtimes, which
  // killed every sample and left luma null forever.
  const everyNthFrame = Math.max(1, Math.round(sampleIntervalMs / 33));
  const frameCount = useSharedValue(0);
  const didLogFirst = useSharedValue(false);
  const didReportError = useSharedValue(false);
  const onFrame = useCallback(
    (frame: Frame) => {
      "worklet";
      let stage = "throttle";
      try {
        frameCount.value += 1;
        if (frameCount.value % everyNthFrame !== 0) return;

        stage = "planes";
        let bytes: Uint8Array | null = null;
        let w = 0;
        let h = 0;
        let bytesPerRow = 0;
        if (frame.isPlanar) {
          const planes = frame.getPlanes();
          const plane = planes.length > 0 ? planes[0] : null;
          if (!plane || plane.width <= 0 || plane.height <= 0) return;
          bytes = new Uint8Array(plane.getPixelBuffer());
          w = plane.width;
          h = plane.height;
          bytesPerRow = plane.bytesPerRow > 0 ? plane.bytesPerRow : w;
        } else {
          // Non-planar fallback (e.g. packed RGB): sample the buffer directly.
          if (frame.width <= 0 || frame.height <= 0) return;
          bytes = new Uint8Array(frame.getPixelBuffer());
          w = frame.width;
          h = frame.height;
          bytesPerRow = w;
        }

        stage = "sample";
        const stride = Math.max(1, Math.floor((w * h) / 4096));
        let sum = 0;
        let count = 0;
        for (let y = 0; y < h; y++) {
          const row = y * bytesPerRow;
          for (let x = 0; x < w; x += stride) {
            sum += (bytes as Uint8Array)[row + x];
            count += 1;
          }
        }
        if (count === 0) return;

        stage = "normalize";
        let mean = sum / count;
        const pf = frame.pixelFormat ?? "";
        if (pf.includes("video") && !pf.includes("full")) {
          // Limited-range YUV (16..235) -> 0..255 to match the existing gate.
          mean = (mean - 16) * (255 / 219);
        }
        if (mean < 0) mean = 0;
        else if (mean > 255) mean = 255;

        stage = "forward";
        scheduleOnRN(internalOnLuma, mean);
        if (!didLogFirst.value) {
          didLogFirst.value = true;
          console.log(`[live-luma] first sample: ${mean}`);
        }
      } catch (e) {
        // Worklet Errors don't serialize across the bridge (they log as {}),
        // so extract a plain string and record which stage threw. Report once
        // per activation to avoid spamming the JS thread at frame rate.
        if (didReportError.value) return;
        didReportError.value = true;
        let detail = "unknown";
        try {
          const anyErr = e as { message?: unknown; code?: unknown } | null;
          if (typeof anyErr?.message === "string" && anyErr.message) {
            detail = anyErr.message;
          } else if (
            typeof anyErr?.code === "string" ||
            typeof anyErr?.code === "number"
          ) {
            detail = String(anyErr.code);
          } else if (typeof e === "string") {
            detail = e;
          }
        } catch {
          detail = "unserializable";
        }
        console.log(`[live-luma] worklet sample error at ${stage}: ${detail}`);
        scheduleOnRN(internalOnLumaError, `${stage}: ${detail}`);
      } finally {
        frame.dispose();
      }
    },
    [internalOnLuma, internalOnLumaError, everyNthFrame],
  );

  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_4_3,
    pixelFormat: "yuv",
    dropFramesWhileBusy: true,
    onFrame,
    onFrameDropped: (reason) => {
      if (__DEV__) console.log(`[live-luma] frame dropped: ${reason}`);
    },
  });

  useEffect(() => {
    if (!isActive) {
      setLuma(null);
      setSampling(false);
      return;
    }
    setLumaRef.current = setLuma;
    setSamplingRef.current = setSampling;
    // Allow one fresh worklet error report per activation.
    didReportError.value = false;
  }, [isActive, didReportError]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  return useMemo(
    () => ({ luma, sampling, frameOutput }),
    [luma, sampling, frameOutput],
  );
}