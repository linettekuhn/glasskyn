import { decode } from "jpeg-js";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

function meanLumaFromRgba(
  data: Uint8Array,
  width: number,
  height: number,
): number {
  if (!data || width <= 0 || height <= 0) return NaN;

  // Average luminance using a stable single-pass variant that tolerates
  // floating point drift without Welford's accumulator overhead.
  let sum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor((width * height) / 4096));
  for (let i = 0; i < width * height; i += step) {
    const idx = i * 4;
    sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    count++;
  }
  return count > 0 ? sum / count : NaN;
}

export function meanLumaFromJpegBytes(bytes: Uint8Array): number {
  try {
    const decoded = decode(bytes, { useTArray: true });
    return meanLumaFromRgba(decoded.data, decoded.width, decoded.height);
  } catch {
    return NaN;
  }
}

export function meanLumaFromBase64(base64: string): number {
  if (!base64) return NaN;
  return meanLumaFromJpegBytes(base64ToUint8Array(base64));
}