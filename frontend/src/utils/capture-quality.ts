import { checkBlur } from "./blur-detection";
import { GATE_CONSTANTS } from "./face-gating";
import { meanLumaFromBase64 } from "./image-luma";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export interface CaptureQualityResult {
  luma: number | null;
  tooDark: boolean;
  tooBright: boolean;
  variance: number;
  blurry: boolean;
}

export async function analyzeCapture(
  uri: string,
): Promise<CaptureQualityResult> {
  let luma: number | null = null;

  try {
    const context = ImageManipulator.manipulate(uri).resize({ width: 96 });
    const rendered = await context.renderAsync();
    const out = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      base64: true,
    });
    luma = out.base64 ? meanLumaFromBase64(out.base64) : null;
    if (luma != null && !Number.isFinite(luma)) luma = null;
    rendered.release();
    context.release();
  } catch {
    // non-fatal: brightness simply stays unknown
  }

  const blur = await checkBlur(uri);

  return {
    luma,
    tooDark: luma != null && luma < GATE_CONSTANTS.lumaMin,
    tooBright: luma != null && luma > GATE_CONSTANTS.lumaMax,
    variance: blur.variance >= 0 ? blur.variance : 0,
    blurry: blur.isBlurry,
  };
}