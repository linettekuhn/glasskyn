import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ConcernFrame } from "@/hooks/use-concern-timeline";
import {
  cropImageLayout,
  getConcernCropRect,
} from "@/utils/concern-crop";

interface ConcernScrubberProps {
  frames: ConcernFrame[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  displayUrls: Record<number, string>;
  aspects: Record<number, number>;
  thumbSize?: number;
}

const DEFAULT_THUMB = 64;

async function tick(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    // Haptics unavailable (e.g. simulator) — scrub still works.
  }
}

function ScrubThumb({
  frame,
  uri,
  aspect,
  size,
  selected,
  onPress,
  index,
  total,
}: {
  frame: ConcernFrame;
  uri: string | undefined;
  aspect: number | undefined;
  size: number;
  selected: boolean;
  onPress: () => void;
  index: number;
  total: number;
}) {
  const rect =
    frame.coords != null
      ? getConcernCropRect(frame.coords, aspect)
      : { x0: 0, y0: 0, rw: 1, rh: 1 };
  const layout = cropImageLayout(size, rect);
  return (
    <Pressable
      onPress={() => {
        void tick();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Go to appearance ${index + 1} of ${total}${frame.isGap ? ", not marked" : ""}`}
      accessibilityState={{ selected }}
      style={[
        styles.thumb,
        {
          width: size,
          height: size,
          borderColor: selected ? "#FFFFFF" : "transparent",
          opacity: frame.isGap ? 0.45 : 1,
        },
      ]}
    >
      {uri && !frame.isGap ? (
        <Image
          source={{ uri }}
          style={{
            position: "absolute",
            width: layout.width,
            height: layout.height,
            left: layout.left,
            top: layout.top,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`concern-thumb-${frame.session.id}`}
          priority="low"
        />
      ) : (
        <View style={styles.placeholder}>
          <MaterialCommunityIcons
            name={frame.isGap ? "image-off-outline" : "image-outline"}
            size={20}
            color="rgba(255,255,255,0.6)"
          />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Horizontal strip of crop thumbnails, one per session in the concern's
 * lifespan (gaps kept as greyed placeholders, never skipped). Windowed
 * FlatList so long lifespans don't decode everything at once.
 */
export default function ConcernScrubber({
  frames,
  selectedIndex,
  onSelect,
  displayUrls,
  aspects,
  thumbSize = DEFAULT_THUMB,
}: ConcernScrubberProps) {
  const renderItem = useCallback(
    ({ item, index }: { item: ConcernFrame; index: number }) => (
      <ScrubThumb
        frame={item}
        uri={displayUrls[item.session.id]}
        aspect={aspects[item.session.id]}
        size={thumbSize}
        selected={index === selectedIndex}
        onPress={() => onSelect(index)}
        index={index}
        total={frames.length}
      />
    ),
    [displayUrls, aspects, thumbSize, selectedIndex, onSelect, frames.length],
  );

  return (
    <FlatList
      data={frames}
      keyExtractor={(f: ConcernFrame) => String(f.session.id)}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={renderItem}
      getItemLayout={(_: unknown, index: number) => ({
        length: thumbSize + 8,
        offset: (thumbSize + 8) * index,
        index,
      })}
      windowSize={5}
      initialNumToRender={7}
      maxToRenderPerBatch={5}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  thumb: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
