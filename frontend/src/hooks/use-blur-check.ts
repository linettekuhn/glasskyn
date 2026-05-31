import { useEffect, useState } from "react";
import { Image } from "react-native";
import { checkBlur, type CropRect } from "../utils/blur-detection";

type BlurStatus = "checking" | "sharp" | "blurry";

export function useBlurCheck(imageUri: string | null) {
  const [blurStatus, setBlurStatus] = useState<BlurStatus>("checking");
  const [variance, setVariance] = useState(0);

  useEffect(() => {
    if (!imageUri) {
      setBlurStatus("checking");
      setVariance(0);
      return;
    }

    let cancelled = false;

    (async () => {
      let cropRect: CropRect | undefined;

      try {
        const imgSize = await getImageSize(imageUri);
        if (cancelled) return;

        const cropRatio = 0.65;
        const cropW = Math.round(imgSize.width * cropRatio);
        const cropH = Math.round(imgSize.height * cropRatio);
        cropRect = {
          originX: Math.round((imgSize.width - cropW) / 2),
          originY: Math.round((imgSize.height - cropH) / 2),
          width: cropW,
          height: cropH,
        };
      } catch {
        // fallback: no crop
      }

      if (cancelled) return;
      const result = await checkBlur(imageUri, cropRect);
      if (cancelled) return;
      setVariance(result.variance);
      setBlurStatus(result.isBlurry ? "blurry" : "sharp");
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUri]);

  return { blurStatus, variance };
}

function getImageSize(
  uri: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err),
    );
  });
}
