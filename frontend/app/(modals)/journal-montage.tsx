import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSkinPhotoUrl, getSkinSessions } from "@/api/skin";
import type { SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import IconButton from "@/components/ui/icon-button";
import {
  allConcerns,
  dayEntries,
  formatSessionDay,
  formatSessionTime,
} from "@/utils/skin-sessions";

const THUMB_SIZE = 56;
const THUMB_GAP = 8;
const THUMB_STRIDE = THUMB_SIZE + THUMB_GAP;
const PLAY_INTERVAL_MS = 700;
const DOT_SIZE = 22;
const DOT_RADIUS = DOT_SIZE / 2;

// TODO(progress-montage): the backend only returns the full-res original
// (`SkinSessionOut.image_url` is an S3 file key). Once the backend provides
// thumbnail (~256px) and medium (~1080px) variants, use the thumb URL for the
// filmstrip and the medium URL for the pager here instead of `displayUrls`.
// Needed backend change: generate resized variants at check-in upload time
// and expose them (e.g. `image_thumb_url` / `image_medium_url`) on
// `GET /skin/sessions`.
export default function JournalMontageScreen() {
  const { startId } = useLocalSearchParams<{ startId?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [sessions, setSessions] = useState<SkinSessionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayUrls, setDisplayUrls] = useState<Record<number, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [pagerHeight, setPagerHeight] = useState(0);

  const pagerRef = useRef<FlatList<SkinSessionOut>>(null);
  const filmRef = useRef<FlatList<SkinSessionOut>>(null);
  const activeRef = useRef(0);
  activeRef.current = activeIndex;

  // Oldest to newest so play mode runs forward in time.
  // `getSkinSessions()` returns sessions newest first.
  const sorted = useMemo(() => [...sessions].reverse(), [sessions]);
  const concerns = useMemo(() => allConcerns(sessions), [sessions]);

  const startIndex = useMemo(() => {
    if (sorted.length === 0) return 0;
    const i = sorted.findIndex((s) => String(s.id) === startId);
    return i >= 0 ? i : sorted.length - 1;
  }, [sorted, startId]);

  useEffect(() => {
    let cancelled = false;
    getSkinSessions()
      .then((data) => {
        if (cancelled) return;
        setSessions(data);
        const ordered = [...data].reverse();
        const i = ordered.findIndex((s) => String(s.id) === startId);
        setActiveIndex(i >= 0 ? i : Math.max(ordered.length - 1, 0));
        activeRef.current = i >= 0 ? i : Math.max(ordered.length - 1, 0);
        // Resolve each session's S3 file key to a display URL.
        Promise.all(
          ordered.map((s) =>
            getSkinPhotoUrl(s.image_url)
              .then((url) => ({ id: s.id, url }))
              .catch(() => null),
          ),
        ).then((resolved) => {
          if (cancelled) return;
          const map: Record<number, string> = {};
          for (const r of resolved) {
            if (r) map[r.id] = r.url;
          }
          setDisplayUrls(map);
        });
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startId]);

  // Stable viewability callback (settle-based sync is fine for v1).
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setActiveIndex(first.index);
      }
    },
  ).current;

  // Play mode: advance one frame every ~700ms, looping at the end.
  useEffect(() => {
    if (!playing || sorted.length <= 1) return;
    const id = setInterval(() => {
      const next = (activeRef.current + 1) % sorted.length;
      try {
        pagerRef.current?.scrollToIndex({ index: next, animated: true });
      } catch {
        // Pager not laid out yet; the index state still advances.
      }
      setActiveIndex(next);
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, sorted.length]);

  // Keep the active thumb centered in the filmstrip.
  useEffect(() => {
    if (sorted.length <= 1) return;
    try {
      filmRef.current?.scrollToIndex({
        index: activeIndex,
        viewPosition: 0.5,
        animated: true,
      });
    } catch {
      filmRef.current?.scrollToOffset({
        offset: Math.max(
          activeIndex * THUMB_STRIDE - windowWidth / 2 + THUMB_SIZE / 2,
          0,
        ),
        animated: true,
      });
    }
  }, [activeIndex, sorted.length, windowWidth]);

  // Prefetch the next few display URLs as the active index changes.
  useEffect(() => {
    if (sorted.length === 0) return;
    const upcoming: string[] = [];
    for (let o = 1; o <= 3; o += 1) {
      const url = displayUrls[sorted[(activeIndex + o) % sorted.length]?.id];
      if (url) upcoming.push(url);
    }
    if (upcoming.length > 0) {
      Image.prefetch(upcoming).catch(() => {});
    }
  }, [activeIndex, displayUrls, sorted]);

  const stopPlaying = useCallback(() => setPlaying(false), []);

  const goToIndex = useCallback(
    (index: number) => {
      stopPlaying();
      setActiveIndex(index);
      try {
        pagerRef.current?.scrollToIndex({ index, animated: true });
      } catch {
        // Pager not laid out yet; viewability sync will catch up.
      }
    },
    [stopPlaying],
  );

  const onPagerLayout = useCallback((e: LayoutChangeEvent) => {
    setPagerHeight(e.nativeEvent.layout.height);
  }, []);

  const onImageLoad = useCallback((sessionId: number, w: number, h: number) => {
    if (!w || !h) return;
    setAspects((prev) =>
      prev[sessionId] ? prev : { ...prev, [sessionId]: w / h },
    );
  }, []);

  const activeSession = sorted[activeIndex] ?? null;

  const renderPage = useCallback(
    ({ item }: { item: SkinSessionOut }) => {
      const uri = displayUrls[item.id];
      const aspect = aspects[item.id];
      const markers = showMarkers ? dayEntries(item.id, concerns) : [];

      // `contentFit="contain"` letterboxes; derive the displayed rect so
      // numbered markers land on the right pixels.
      let dispW = windowWidth;
      let dispH = pagerHeight;
      let offX = 0;
      let offY = 0;
      if (aspect && windowWidth > 0 && pagerHeight > 0) {
        if (windowWidth / pagerHeight > aspect) {
          dispH = pagerHeight;
          dispW = pagerHeight * aspect;
        } else {
          dispW = windowWidth;
          dispH = windowWidth / aspect;
        }
        offX = (windowWidth - dispW) / 2;
        offY = (pagerHeight - dispH) / 2;
      }

      return (
        <View style={{ width: windowWidth, height: pagerHeight }}>
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: windowWidth, height: pagerHeight }}
              contentFit="contain"
              cachePolicy="memory-disk"
              onLoad={(e) => onImageLoad(item.id, e.source.width, e.source.height)}
            />
          ) : (
            <View style={styles.pageFallback}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          )}
          {aspect != null &&
            markers.map((entry) => (
              <View
                key={entry.concern.id}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: offX + entry.coords.x * dispW - DOT_RADIUS,
                  top: offY + entry.coords.y * dispH - DOT_RADIUS,
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={[
                    styles.dot,
                    { borderStyle: entry.carried ? "dashed" : "solid" },
                  ]}
                >
                  <ThemedText
                    style={{ lineHeight: 13, color: "#FFFFFF", fontSize: 11 }}
                    weight="bold"
                  >
                    {entry.number}
                  </ThemedText>
                </View>
              </View>
            ))}
        </View>
      );
    },
    [aspects, concerns, displayUrls, onImageLoad, pagerHeight, showMarkers, windowWidth],
  );

  const renderThumb = useCallback(
    ({ item, index }: { item: SkinSessionOut; index: number }) => {
      const uri = displayUrls[item.id];
      const isActive = index === activeIndex;
      return (
        <Pressable
          onPress={() => goToIndex(index)}
          accessibilityRole="button"
          accessibilityLabel={`Go to check-in ${index + 1}`}
          style={[
            styles.thumb,
            {
              opacity: isActive ? 1 : 0.45,
              borderColor: isActive ? colors.primary[500] : "transparent",
            },
          ]}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.thumbImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.thumbFallback}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
        </Pressable>
      );
    },
    [activeIndex, colors.primary, displayUrls, goToIndex],
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (sorted.length === 0) {
    return (
      <View
        style={[
          styles.root,
          styles.centered,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <ThemedText type="h3" style={{ color: "#FFFFFF" }}>
          No check-ins yet
        </ThemedText>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close montage"
          style={[styles.closePill, { backgroundColor: colors.primary[500] }]}
        >
          <ThemedText weight="semiBold" style={{ color: "#FFFFFF" }}>
            Close
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const showChrome = sorted.length > 1;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.topBar}>
        <IconButton
          onPress={() => router.back()}
          IconComponent={MaterialCommunityIcons}
          iconName="close"
          iconSize={22}
          iconColor="#FFFFFF"
          backgroundColor="rgba(255,255,255,0.16)"
        />
        <Pressable
          onPress={() => setShowMarkers((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: showMarkers }}
          accessibilityLabel="Toggle concern markers"
          style={styles.toggle}
        >
          <MaterialCommunityIcons
            name={showMarkers ? "eye-outline" : "eye-off-outline"}
            size={18}
            color="#FFFFFF"
          />
          <ThemedText type="captionSmall" style={{ color: "#FFFFFF" }}>
            {showMarkers ? "Markers on" : "Markers off"}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.pagerWrap} onLayout={onPagerLayout}>
        {pagerHeight > 0 && (
          <FlatList
            ref={pagerRef}
            data={sorted}
            keyExtractor={(s: SkinSessionOut) => String(s.id)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={startIndex}
            getItemLayout={(
              _: ArrayLike<SkinSessionOut> | null | undefined,
              index: number,
            ) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollBeginDrag={stopPlaying}
            renderItem={renderPage}
            windowSize={3}
          />
        )}
      </View>

      {activeSession && (
        <View style={styles.dateRow}>
          <ThemedText type="h3" style={{ color: "#FFFFFF" }}>
            {formatSessionDay(activeSession.timestamp)}
          </ThemedText>
          <ThemedText type="captionSmall" style={{ color: "rgba(255,255,255,0.7)" }}>
            {`${formatSessionTime(activeSession.timestamp)} · ${activeIndex + 1} of ${sorted.length}`}
          </ThemedText>
        </View>
      )}

      {showChrome && (
        <FlatList
          ref={filmRef}
          data={sorted}
          keyExtractor={(s: SkinSessionOut) => String(s.id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: windowWidth / 2 - THUMB_SIZE / 2,
            gap: THUMB_GAP,
            alignItems: "center",
          }}
          getItemLayout={(
            _: ArrayLike<SkinSessionOut> | null | undefined,
            index: number,
          ) => ({
            length: THUMB_STRIDE,
            offset: THUMB_STRIDE * index,
            index,
          })}
          renderItem={renderThumb}
          style={styles.filmstrip}
        />
      )}

      <View style={styles.controls}>
        <IconButton
          onPress={() => router.back()}
          IconComponent={MaterialCommunityIcons}
          iconName="close"
          iconSize={22}
          iconColor="#FFFFFF"
          backgroundColor="rgba(255,255,255,0.16)"
        />
        {showChrome ? (
          <IconButton
            onPress={() => setPlaying((p) => !p)}
            IconComponent={MaterialCommunityIcons}
            iconName={playing ? "pause" : "play"}
            iconSize={26}
            iconColor="#FFFFFF"
            backgroundColor={colors.primary[500]}
          />
        ) : (
          <ThemedText type="captionSmall" style={{ color: "rgba(255,255,255,0.7)" }}>
            Your first check-in
          </ThemedText>
        )}
        <View style={{ width: 36 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Dark backdrop is required for photo viewing; chrome uses theme tokens.
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  pagerWrap: {
    flex: 1,
  },
  pageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_RADIUS,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  dateRow: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 2,
  },
  filmstrip: {
    maxHeight: THUMB_SIZE + 16,
    paddingVertical: 8,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  closePill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
});
