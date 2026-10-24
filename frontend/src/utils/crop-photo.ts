import { Image } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export interface CropOutcome {
  /** `file://` URI of the file to display/use (cropped, or the original on failure). */
  uri: string;
  /** Raw file-system path (no scheme) matching `uri`. */
  path: string;
  width: number;
  height: number;
  /** Whether the crop actually succeeded (false = original file used). */
  cropped: boolean;
  /** Set when the crop failed — the original file is used instead. */
  error?: string;
}

export interface CropOptions {
  /** Width/height of the source photo in photo pixels. */
  photoWidth: number;
  photoHeight: number;
  /** Width/height of the visible preview in screen px (CSS px). */
  screenWidth: number;
  screenHeight: number;
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
 * Crops the captured photo to the screen aspect ratio, matching the framing
 * of the live preview (which shows a horizontal center strip of the 4:3
 * sensor, zoomed to fill the portrait screen). The strip is centered on the
 * photo center — identical to what the camera preview shows.
 *
 * If the crop fails, the original file is kept and reported via `error`.
 */
export async function cropPhotoToScreenAspect(
  sourceUri: string,
  opts: CropOptions,
): Promise<CropOutcome> {
  const originalUri = toFileUri(sourceUri);
  try {
    const { photoWidth, photoHeight, screenWidth, screenHeight } = opts;
    if (
      photoWidth <= 0 ||
      photoHeight <= 0 ||
      screenWidth <= 0 ||
      screenHeight <= 0
    ) {
      throw new Error("invalid crop dimensions");
    }

    const cropWidth = Math.max(
      1,
      Math.min(
        photoWidth,
        Math.round(photoHeight * (screenWidth / screenHeight)),
      ),
    );

    const originX = Math.round((photoWidth - cropWidth) / 2);

    const context = ImageManipulator.manipulate(originalUri).crop({
      originX,
      originY: 0,
      width: cropWidth,
      height: photoHeight,
    });
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
      width: cropWidth,
      height: photoHeight,
      cropped: cropWidth < photoWidth,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (__DEV__) console.log("[crop-photo] crop failed:", e);
    const dims = await measure(originalUri).catch(() => null);
    return {
      uri: originalUri,
      path: originalUri.replace(/^file:\/\//, ""),
      width: dims?.width ?? 0,
      height: dims?.height ?? 0,
      cropped: false,
      error: message,
    };
  }
}