import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode } from "jpeg-js";

const SHARPNESS_THRESHOLD = 6;

export interface BlurResult {
  isBlurry: boolean;
  variance: number;
}

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

function computeSharpnessScore(
  data: Uint8Array,
  width: number,
  height: number,
): number {
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      gray[y * width + x] =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  let totalEdgeEnergy = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        1 * gray[i - width] +
        1 * gray[i - 1] +
        -4 * gray[i] +
        1 * gray[i + 1] +
        1 * gray[i + width];
      totalEdgeEnergy += Math.abs(lap);
    }
  }

  const pixelCount = (width - 2) * (height - 2);
  return totalEdgeEnergy / pixelCount;
}

export async function checkBlur(
  imageUri: string,
  cropRect?: CropRect,
): Promise<BlurResult> {
  let context: any;
  let renderedImage: any;
  try {
    context = ImageManipulator.manipulate(imageUri);
    if (cropRect) context.crop(cropRect);
    context.resize({ width: 400 });
    renderedImage = await context.renderAsync();
    const result = await renderedImage.saveAsync({
      format: SaveFormat.JPEG,
      base64: true,
    });

    if (!result.base64) {
      return { isBlurry: false, variance: -1 };
    }

    const rawData = base64ToUint8Array(result.base64);
    const decoded = decode(rawData, { useTArray: true });
    const score = computeSharpnessScore(
      decoded.data,
      decoded.width,
      decoded.height,
    );

    return {
      isBlurry: score < SHARPNESS_THRESHOLD,
      variance: score,
    };
  } catch {
    return { isBlurry: false, variance: -1 };
  } finally {
    renderedImage?.release();
    context?.release();
  }
}
