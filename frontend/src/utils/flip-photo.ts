import { Image } from "react-native";
import {
  FlipType,
  ImageManipulator,
  SaveFormat,
} from "expo-image-manipulator";

export interface FlipOutcome {
  /** `file://` URI of the file to display/use (mirrored, or the original on failure). */
  uri: string;
  /** Raw file-system path (no scheme) matching `uri`. */
  path: string;
  /** Whether the horizontal mirror actually succeeded. */
  flipped: boolean;
  width: number;
  height: number;
  /** Set when the mirror failed — the original file is used instead. */
  error?: string;
}

function measure(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      (err) => reject(err),
    );
  });
}

function toFileUri(pathOrUri: string): string {
  return pathOrUri.startsWith("file://") ? pathOrUri : `file://${pathOrUri}`;
}

/**
 * Mirrors the captured photo horizontally so the review image matches the
 * (mirrored) live preview.
 *
 * If the mirror fails, the original file is kept and the failure is reported
 * via `FlipOutcome.error` (never a silent fallback), so callers can surface
 * the result and dimension of the file that is actually displayed.
 */
export async function flipPhotoHorizontal(
  sourceUri: string,
): Promise<FlipOutcome> {
  const originalUri = toFileUri(sourceUri);
  try {
    const context = ImageManipulator.manipulate(originalUri).flip(
      FlipType.Horizontal,
    );
    const rendered = await context.renderAsync();
    const out = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 1.0,
    });
    rendered.release();
    context.release();
    const uri = toFileUri(out.uri);
    return {
      uri,
      path: uri.replace(/^file:\/\//, ""),
      flipped: true,
      width: out.width,
      height: out.height,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (__DEV__) console.log("[flip-photo] horizontal flip failed:", e);
    const dims = await measure(originalUri).catch(() => null);
    return {
      uri: originalUri,
      path: originalUri.replace(/^file:\/\//, ""),
      flipped: false,
      width: dims?.width ?? 0,
      height: dims?.height ?? 0,
      error: message,
    };
  }
}