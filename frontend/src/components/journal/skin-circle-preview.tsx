import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getCachedSkinPhotoDimsSync,
  getCachedSkinPhotoUrl,
  primeSkinPhotoDims,
  primeSkinPhotoUrlCache,
} from "@/api/skin-photo-urls";
import type { SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import type { SkinDayEntry } from "@/utils/skin-sessions";

const DOT_SIZE = 16;
const DOT_RADIUS = DOT_SIZE / 2;

function measure(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      (err) => reject(err),
    );
  });
}

interface SkinCirclePreviewProps {
  session: SkinSessionOut;
  entries: SkinDayEntry[];
  size?: number;
}

export default function SkinCirclePreview({
  session,
  entries,
  size = 150,
}: SkinCirclePreviewProps) {
  const fileKey = session.image_url;
  // Intrinsic dims live in the shared photo cache (single eviction point
  // when an entry is deleted) so re-renders don't re-measure.
  const cached = getCachedSkinPhotoDimsSync(fileKey);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [aspect, setAspect] = useState<number | null>(() =>
    cached ? cached.height / cached.width : null,
  );
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  useEffect(() => {
    const known = getCachedSkinPhotoDimsSync(fileKey);
    if (known) {
      setAspect(known.height / known.width);
    }
    let cancelled = false;
    setFailed(false);
    setUri(null);
    getCachedSkinPhotoUrl(fileKey)
      .then((url) => {
        if (cancelled) return;
        primeSkinPhotoUrlCache(fileKey, url);
        setUri(url);
        if (known) {
          primeSkinPhotoDims(fileKey, known.width, known.height);
          return;
        }
        measure(url)
          .then((dims) => {
            if (cancelled) return;
            if (!dims.width || !dims.height) return;
            primeSkinPhotoDims(fileKey, dims.width, dims.height);
            primeSkinPhotoUrlCache(fileKey, url, dims.width, dims.height);
            setAspect(dims.height / dims.width);
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fileKey]);

  // The image fills the circle's width and overflows vertically, centered.
  const renderedHeight = aspect == null ? null : size * aspect;
  const topOffset = renderedHeight == null ? 0 : (size - renderedHeight) / 2;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.neutral[300],
          },
        ]}
      >
        {uri && aspect != null && (
          <Image
            source={{ uri }}
            style={{
              position: "absolute",
              left: 0,
              top: topOffset,
              width: size,
              height: renderedHeight ?? size,
            }}
          />
        )}

        {aspect != null &&
          entries.map((entry) => {
            const carried = entry.carried;
            const fill = "rgba(0,0,0,0.5)";
            return (
              <View
                key={entry.concern.id}
                style={{
                  position: "absolute",
                  left: entry.coords.x * size - DOT_RADIUS,
                  top:
                    topOffset +
                    entry.coords.y * (renderedHeight ?? size) -
                    DOT_RADIUS,
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      borderColor: "#FFFFFF",
                      backgroundColor: fill,
                      borderStyle: carried ? "dashed" : "solid",
                    },
                  ]}
                >
                  <ThemedText
                    style={{ lineHeight: 11, color: "#FFFFFF", fontSize: 9 }}
                    weight="bold"
                  >
                    {entry.number}
                  </ThemedText>
                </View>
              </View>
            );
          })}

        {failed && (
          <View style={styles.center}>
            <MaterialCommunityIcons
              name="image-off"
              size={24}
              color={colors.neutral[600]}
            />
          </View>
        )}
        {!failed && !uri && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.neutral[700]} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  circle: {
    overflow: "hidden",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_RADIUS,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
