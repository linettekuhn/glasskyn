import { useEffect, useMemo, useRef, useState } from "react";
import type { CameraPhotoOutput } from "react-native-vision-camera";
import { meanLumaFromJpegBytes } from "../utils/image-luma";

export interface LiveLumaOptions {
  /**
   * The photo output to capture the low-energy light samples from.
   *
   * VisionCamera only supports a single photo output per session
   * (AVFoundation allows one `AVCapturePhotoOutput`, CameraX one
   * `ImageCapture`), so the light gate must share the capture-eligible
   * photo output of the owning camera instead of creating its own.
   */
  photoOutput: CameraPhotoOutput;
  isActive: boolean;
  sampleIntervalMs?: number;
  onError?: (error: unknown) => void;
}

export interface LiveLumaState {
  luma: number | null;
  sampling: boolean;
}

/**
 * Live luminance sampler.
 *
 * VisionCamera v5 no longer ships a JS frame-processor API, so instead of
 * reading raw frames we capture a tiny, low-quality in-memory photo on the
 * session's photo output at a throttled rate and decode its average luma.
 * The whole operation is JS-only (jpeg-js + the photo pipeline) and stops
 * short as soon as it is not needed.
 *
 * `luma` is `null` while unknown, the first sample is pending, or sampling
 * failed — callers should treat `null` as a non-blocking "unknown" light
 * gate rather than hard-failing the capture.
 */
export function useLiveLuma({
  photoOutput,
  isActive,
  sampleIntervalMs = 1200,
  onError,
}: LiveLumaOptions): LiveLumaState {
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [luma, setLuma] = useState<number | null>(null);
  const [sampling, setSampling] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setLuma(null);
      setSampling(false);
      return;
    }

    let cancelled = false;
    let busy = false;

    const sample = async () => {
      if (busy || cancelled || !activeRef.current) return;
      busy = true;
      setSampling(true);
      let photo: Awaited<ReturnType<CameraPhotoOutput["capturePhoto"]>> | null =
        null;
      try {
        photo = await photoOutput.capturePhoto(
          { flashMode: "off", enableShutterSound: false },
          {},
        );
        if (cancelled) return;
        const bytes = new Uint8Array(photo.getFileData());
        const value = meanLumaFromJpegBytes(bytes);
        if (!cancelled) setLuma(Number.isFinite(value) ? value : null);
      } catch (e) {
        if (!cancelled) {
          if (__DEV__) console.log("[live-luma] sample error:", e);
          onErrorRef.current?.(e);
          setLuma(null);
        }
      } finally {
        photo?.dispose();
        busy = false;
        if (!cancelled) setSampling(false);
      }
    };

    const id = setInterval(() => {
      void sample();
    }, sampleIntervalMs);
    void sample();

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [photoOutput, isActive, sampleIntervalMs]);

  return useMemo(() => ({ luma, sampling }), [luma, sampling]);
}