import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { deleteSkinSession, getSkinSessions } from "@/api/skin";
import {
  getCachedSkinPhotoDimsSync,
  getCachedSkinPhotoUrl,
  getCachedSkinPhotoUrlSync,
  prefetchSkinPhotoUrls,
  primeSkinPhotoDims,
  primeSkinPhotoUrlCache,
} from "@/api/skin-photo-urls";
import type { SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import IconButton from "@/components/ui/icon-button";
import SessionReview, { hasReview } from "@/components/journal/session-review";
import {
  allConcerns,
  concernLabel,
  dayEntries,
  formatSessionDay,
  formatSessionTime,
  type SkinDayEntry,
} from "@/utils/skin-sessions";

const THUMB_SIZE = 56;
const THUMB_GAP = 8;
const THUMB_STRIDE = THUMB_SIZE + THUMB_GAP;
const PLAY_CYCLE_MS = 1200;
const FADE_MS = 500;
const FADE_FALLBACK_MS = 600;
const DOT_SIZE = 22;
const DOT_RADIUS = DOT_SIZE / 2;

/**
 * Displayed rect of a `contentFit="contain"` image inside a container, so
 * numbered markers land on the right pixels despite letterboxing.
 */
function containedRect(
  containerW: number,
  containerH: number,
  aspect?: number,
) {
  let dispW = containerW;
  let dispH = containerH;
  let offX = 0;
  let offY = 0;
  if (aspect && containerW > 0 && containerH > 0) {
    if (containerW / containerH > aspect) {
      dispH = containerH;
      dispW = containerH * aspect;
    } else {
      dispW = containerW;
      dispH = containerW / aspect;
    }
    offX = (containerW - dispW) / 2;
    offY = (containerH - dispH) / 2;
  }
  return { dispW, dispH, offX, offY };
}

interface MontageFrameProps {
  sessionId: number;
  uri?: string;
  aspect?: number;
  markers: SkinDayEntry[];
  width: number;
  height: number;
  onLoad: (sessionId: number, w: number, h: number) => void;
}

/** One check-in photo with its numbered concern markers. */
function MontageFrame({
  sessionId,
  uri,
  aspect,
  markers,
  width,
  height,
  onLoad,
}: MontageFrameProps) {
  const { dispW, dispH, offX, offY } = containedRect(width, height, aspect);
  return (
    <View style={{ width, height }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width, height }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={String(sessionId)}
          priority="high"
          onLoad={(e) => onLoad(sessionId, e.source.width, e.source.height)}
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
}

interface PlayFrame {
  id: number;
  uri?: string;
  aspect?: number;
  markers: SkinDayEntry[];
}

interface PlayOverlayProps {
  width: number;
  height: number;
  slotA: PlayFrame | null;
  slotB: PlayFrame | null;
  top: "A" | "B";
  opA: SharedValue<number>;
  opB: SharedValue<number>;
  onFrameLoad: (sessionId: number, w: number, h: number) => void;
  onStop: () => void;
}

/**
 * Crossfading fixed slots shown while playing. A slot's content only ever
 * changes while it's at opacity 0, and the outgoing slot is only zeroed once
 * the incoming one is fully opaque on top. That way no content swap can race
 * a render and no frame can flash. Markers live inside each layer so they
 * dissolve with their photo.
 */
function PlayOverlay({
  width,
  height,
  slotA,
  slotB,
  top,
  opA,
  opB,
  onFrameLoad,
  onStop,
}: PlayOverlayProps) {
  const styleA = useAnimatedStyle(() => ({ opacity: opA.value }));
  const styleB = useAnimatedStyle(() => ({ opacity: opB.value }));
  const render = (f: PlayFrame | null) =>
    f && (
      <MontageFrame
        sessionId={f.id}
        uri={f.uri}
        aspect={f.aspect}
        markers={f.markers}
        width={width}
        height={height}
        onLoad={onFrameLoad}
      />
    );
  return (
    <View style={styles.playOverlay} onTouchStart={onStop}>
      <Animated.View
        style={[styles.playLayer, { zIndex: top === "A" ? 2 : 1 }, styleA]}
      >
        {render(slotA)}
      </Animated.View>
      <Animated.View
        style={[styles.playLayer, { zIndex: top === "B" ? 2 : 1 }, styleB]}
      >
        {render(slotB)}
      </Animated.View>
    </View>
  );
}

// TODO(progress-montage): the backend only returns the full-res original
// (`SkinSessionOut.image_url` is an S3 file key). Once the backend provides
// thumbnail (~256px) and medium (~1080px) variants, use the thumb URL for the
// filmstrip and the medium URL for the pager here instead of `displayUrls`.
// Needed backend change: generate resized variants at check-in upload time
// and expose them (e.g. `image_thumb_url` / `image_medium_url`) on
// `GET /skin/sessions`.
const URL_RESOLVE_CONCURRENCY = 4;

export default function JournalMontageScreen() {
  const { startId, initialId, initialUrl, initialW, initialH } =
    useLocalSearchParams<{
      startId?: string;
      initialId?: string;
      initialUrl?: string;
      initialW?: string;
      initialH?: string;
    }>();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [sessions, setSessions] = useState<SkinSessionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayUrls, setDisplayUrls] = useState<Record<number, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [aspects, setAspects] = useState<Record<number, number>>({});

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
    // Pass-through photo from the journal card (its file key is resolved
    // below once sessions arrive) so the tapped frame paints instantly.
    const seedId = initialId != null ? Number(initialId) : NaN;
    const seedW = initialW != null ? Number(initialW) : NaN;
    const seedH = initialH != null ? Number(initialH) : NaN;
    getSkinSessions()
      .then((data) => {
        if (cancelled) return;
        setSessions(data);
        const ordered = [...data].reverse();
        const i = ordered.findIndex((s) => String(s.id) === startId);
        const startIdx = i >= 0 ? i : Math.max(ordered.length - 1, 0);
        setActiveIndex(startIdx);
        activeRef.current = startIdx;

        // Seed instantly from the shared cache (warmed by the journal card
        // and any previous montage visit) so the first frame + aspects are
        // ready without waiting on the network.
        const seedUrls: Record<number, string> = {};
        const seedAspects: Record<number, number> = {};
        for (const s of ordered) {
          const cached =
            s.image_url != null
              ? getCachedSkinPhotoUrlSync(s.image_url)
              : null;
          if (cached) seedUrls[s.id] = cached;
          const dims =
            s.image_url != null
              ? getCachedSkinPhotoDimsSync(s.image_url)
              : null;
          if (dims) seedAspects[s.id] = dims.width / dims.height;
        }
        // Fold in the pending pass-through URL once its file key is known.
        if (initialUrl && Number.isFinite(seedId)) {
          const match = ordered.find((s) => s.id === seedId);
          if (match) {
            seedUrls[seedId] = initialUrl;
            primeSkinPhotoUrlCache(match.image_url, initialUrl);
            if (Number.isFinite(seedW) && Number.isFinite(seedH) && seedH) {
              seedAspects[seedId] = (seedW as number) / (seedH as number);
              primeSkinPhotoUrlCache(
                match.image_url,
                initialUrl,
                seedW as number,
                seedH as number,
              );
            }
          }
        }
        setDisplayUrls(seedUrls);
        setAspects((prev) => ({ ...seedAspects, ...prev }));
        setLoading(false);

        // Resolve the rest in viewing-priority order (start, ±1, ±2, …)
        // with bounded concurrency, painting each URL as it arrives instead
        // of blocking on the slowest of all N presigns.
        const queue: SkinSessionOut[] = [];
        for (let o = 0; o < ordered.length; o += 1) {
          const fwd = ordered[startIdx + o];
          const back = o === 0 ? undefined : ordered[startIdx - o];
          if (fwd && seedUrls[fwd.id] == null) queue.push(fwd);
          if (back && seedUrls[back.id] == null) queue.push(back);
        }
        if (queue.length === 0) return;
        let cursor = 0;
        const worker = async (): Promise<void> => {
          while (!cancelled) {
            const next = queue[cursor];
            cursor += 1;
            if (!next) return;
            try {
              const url = await getCachedSkinPhotoUrl(next.image_url);
              if (cancelled) return;
              setDisplayUrls((prev) =>
                prev[next.id] ? prev : { ...prev, [next.id]: url },
              );
            } catch {
              // Per-frame spinner stays; a retry happens on remount.
            }
          }
        };
        void Promise.all(
          Array.from(
            { length: Math.min(URL_RESOLVE_CONCURRENCY, queue.length) },
            () => worker(),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSessions([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // initial* params seed first paint only; sessions load once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Play mode: crossfade one frame per cycle, looping at the end. Two
  // fixed slots (A/B) each own an opacity value; a slot's content only ever
  // changes while it's at opacity 0, so content swaps can't race renders.
  const opA = useSharedValue(1);
  const opB = useSharedValue(0);
  const [slotAId, setSlotAId] = useState<number | null>(null);
  const [slotBId, setSlotBId] = useState<number | null>(null);
  const [topSlot, setTopSlot] = useState<"A" | "B">("A");
  const visibleRef = useRef<"A" | "B">("A");
  const incomingRef = useRef<{ slot: "A" | "B"; id: number } | null>(null);
  const fadePendingRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors slotAId/slotBId so the play interval can read them without
  // depending on state. Depending on state re-ran the effect every tick and
  // its cleanup cancelled the pending fade, leaving the image stuck.
  const slotIdsRef = useRef<{ A: number | null; B: number | null }>({
    A: null,
    B: null,
  });

  const startFade = useCallback(() => {
    const inc = incomingRef.current;
    if (!inc || !fadePendingRef.current) return;
    fadePendingRef.current = false;
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    const inSV = inc.slot === "A" ? opA : opB;
    const outSV = inc.slot === "A" ? opB : opA;
    visibleRef.current = inc.slot;
    inSV.value = withTiming(
      1,
      { duration: FADE_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        // Outgoing layer is fully covered now, so zeroing it is invisible.
        if (finished) outSV.value = 0;
      },
    );
  }, [opA, opB]);

  // Seed everything in the same batch as `playing`, so the overlay's first
  // render already has a photo in it.
  const startPlaying = useCallback(() => {
    if (sorted.length <= 1) return;
    const seedId = sorted[activeRef.current]?.id ?? null;
    opA.value = 1;
    opB.value = 0;
    visibleRef.current = "A";
    incomingRef.current = null;
    fadePendingRef.current = false;
    slotIdsRef.current = { A: seedId, B: null };
    setSlotAId(seedId);
    setSlotBId(null);
    setTopSlot("A");
    setPlaying(true);
  }, [sorted, opA, opB]);

  useEffect(() => {
    if (!playing || sorted.length <= 1) return;
    const id = setInterval(() => {
      const next = (activeRef.current + 1) % sorted.length;
      const nextId = sorted[next].id;
      const hidden = visibleRef.current === "A" ? "B" : "A";
      const hiddenId = slotIdsRef.current[hidden];

      // The hidden slot is at opacity 0, so changing its content is invisible.
      if (hiddenId !== nextId) {
        slotIdsRef.current[hidden] = nextId;
        if (hidden === "A") setSlotAId(nextId);
        else setSlotBId(nextId);
      }
      setTopSlot(hidden);
      incomingRef.current = { slot: hidden, id: nextId };
      fadePendingRef.current = true;
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (hiddenId === nextId) {
        // Same photo already in the slot: onLoad won't re-fire, so start the
        // fade immediately instead of waiting out the fallback timer.
        startFade();
      } else {
        // Never fade into a spinner: the incoming onLoad starts the fade,
        // this is only a fallback in case it never fires.
        fadeTimerRef.current = setTimeout(startFade, FADE_FALLBACK_MS);
      }

      // Keep the hidden pager in step so stopping doesn't flash a stale page.
      try {
        pagerRef.current?.scrollToIndex({ index: next, animated: false });
      } catch {
        // Pager not laid out yet; the stop-sync effect below will catch up.
      }
      setActiveIndex(next);
    }, PLAY_CYCLE_MS);

    return () => {
      clearInterval(id);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadePendingRef.current = false;
    };
  }, [playing, sorted, startFade]);

  // When play stops, land the hidden pager on the frame that was visible.
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (wasPlayingRef.current && !playing && sorted.length > 0) {
      try {
        pagerRef.current?.scrollToIndex({
          index: activeRef.current,
          animated: false,
        });
      } catch {
        // Pager not laid out yet; viewability sync will catch up.
      }
    }
    wasPlayingRef.current = playing;
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

  // Keep upcoming presigns warm (cheap, deduped) and prefetch decoded bytes
  // for resolved neighbors in both directions as the active index changes.
  useEffect(() => {
    if (sorted.length === 0) return;
    const neighborKeys: string[] = [];
    const neighborUrls: string[] = [];
    for (let o = 1; o <= 3; o += 1) {
      for (const idx of [activeIndex + o, activeIndex - o]) {
        if (idx < 0 || idx >= sorted.length) continue;
        const session = sorted[idx];
        if (!session) continue;
        const url = displayUrls[session.id];
        if (url) neighborUrls.push(url);
        else if (session.image_url) neighborKeys.push(session.image_url);
      }
    }
    if (neighborKeys.length > 0) void prefetchSkinPhotoUrls(neighborKeys);
    if (neighborUrls.length > 0) {
      Image.prefetch(neighborUrls).catch(() => {});
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



  const onImageLoad = useCallback(
    (sessionId: number, w: number, h: number) => {
      if (!w || !h) return;
      setAspects((prev) =>
        prev[sessionId] ? prev : { ...prev, [sessionId]: w / h },
      );
      // Remember intrinsic dims for instant marker layout on remount.
      const key = sessions.find((s) => s.id === sessionId)?.image_url;
      if (key) primeSkinPhotoDims(key, w, h);
    },
    [sessions],
  );

  const activeSession = sorted[activeIndex] ?? null;

  const activeEntries = useMemo(
    () => (activeSession ? dayEntries(activeSession.id, concerns) : []),
    [activeSession, concerns],
  );

  const deletingRef = useRef(false);

  const handleDelete = useCallback(() => {
    if (!activeSession || deletingRef.current) return;
    const target = activeSession;
    stopPlaying();
    Alert.alert(
      "Delete this entry?",
      "This will remove the photo, marked concerns, and ratings. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (deletingRef.current) return;
            deletingRef.current = true;
            deleteSkinSession(target.id)
              .then(() => {
                Toast.show({
                  type: "success",
                  text1: "Journal entry deleted",
                  position: "bottom",
                });
                setSessions((prev) =>
                  prev.filter((s) => s.id !== target.id),
                );
                const sortedIndex = sorted.findIndex(
                  (s) => s.id === target.id,
                );
                const remaining = sorted.length - 1;
                if (remaining <= 0) {
                  router.back();
                } else {
                  goToIndex(Math.min(sortedIndex, remaining - 1));
                }
              })
              .catch(() => {
                // Interceptor shows the error toast, entry stays in place.
              })
              .finally(() => {
                deletingRef.current = false;
              });
          },
        },
      ],
    );
  }, [activeSession, sorted, stopPlaying, goToIndex]);

  // Starts the fade once the incoming play layer has decoded. Falls back to
  // the timer armed in the interval if onLoad never fires.
  const onFrameLoad = useCallback(
    (sessionId: number, w: number, h: number) => {
      onImageLoad(sessionId, w, h);
      if (sessionId === incomingRef.current?.id) startFade();
    },
    [onImageLoad, startFade],
  );

  const buildFrame = useCallback(
    (id: number | null): PlayFrame | null =>
      id == null
        ? null
        : {
            id,
            uri: displayUrls[id],
            aspect: aspects[id],
            markers: showMarkers ? dayEntries(id, concerns) : [],
          },
    [displayUrls, aspects, showMarkers, concerns],
  );
  const slotA = useMemo(() => buildFrame(slotAId), [buildFrame, slotAId]);
  const slotB = useMemo(() => buildFrame(slotBId), [buildFrame, slotBId]);

  const renderPage = useCallback(
    ({ item }: { item: SkinSessionOut }) => (
      <MontageFrame
        sessionId={item.id}
        uri={displayUrls[item.id]}
        aspect={aspects[item.id]}
        markers={showMarkers ? dayEntries(item.id, concerns) : []}
        width={windowWidth}
        height={windowHeight}
        onLoad={onImageLoad}
      />
    ),
    [
      aspects,
      concerns,
      displayUrls,
      onImageLoad,
      showMarkers,
      windowHeight,
      windowWidth,
    ],
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
              recyclingKey={`thumb-${item.id}`}
              priority="low"
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
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Full-screen photo pager behind everything. */}
      <View style={styles.pagerWrap}>
        <FlatList
          ref={pagerRef}
          data={sorted}
          keyExtractor={(s: SkinSessionOut) => String(s.id)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.pagerList}
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
      </View>
      {playing && (
        <PlayOverlay
          width={windowWidth}
          height={windowHeight}
          slotA={slotA}
          slotB={slotB}
          top={topSlot}
          opA={opA}
          opB={opB}
          onFrameLoad={onFrameLoad}
          onStop={stopPlaying}
        />
      )}

      {/* Floating top chrome. box-none lets swipes reach the pager. */}
      <View
        pointerEvents="box-none"
        style={[styles.topOverlay, { paddingTop: insets.top }]}
      >
        <View pointerEvents="none" style={styles.topScrim} />
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
      </View>

      {/* Floating bottom chrome: date + filmstrip + controls. */}
      <View
        pointerEvents="box-none"
        style={[styles.bottomOverlay, { paddingBottom: insets.bottom }]}
      >
        <View pointerEvents="none" style={styles.bottomScrim} />
        {activeSession && (
          <View pointerEvents="none" style={styles.dateRow}>
            <ThemedText type="h3" style={{ color: "#FFFFFF" }}>
              {formatSessionDay(activeSession.timestamp)}
            </ThemedText>
            <ThemedText
              type="captionSmall"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {`${formatSessionTime(activeSession.timestamp)} · ${activeIndex + 1} of ${sorted.length}`}
            </ThemedText>
            {hasReview(activeSession) && (
              <SessionReview session={activeSession} dark />
            )}
          </View>
        )}

        {activeSession && (
          <View style={styles.detailsToggleWrap}>
            <Pressable
              onPress={() => setShowDetails((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: showDetails }}
              accessibilityLabel="Toggle entry details"
              style={styles.detailsToggle}
            >
              <MaterialCommunityIcons
                name={showDetails ? "chevron-down" : "chevron-up"}
                size={18}
                color="#FFFFFF"
              />
              <ThemedText type="captionSmall" style={{ color: "#FFFFFF" }}>
                {showDetails ? "Hide details" : "View details"}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {activeSession && showDetails && (
          <View style={styles.detailsPanel}>
            <ScrollView
              style={styles.detailsScroll}
              contentContainerStyle={styles.detailsContent}
              showsVerticalScrollIndicator={false}
            >
              {activeEntries.length === 0 ? (
                <ThemedText
                  type="bodySmall"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  No concerns marked on this check-in
                </ThemedText>
              ) : (
                activeEntries.map((entry) => {
                  const resolved = entry.resolvedHere;
                  const badgeColor = resolved
                    ? colors.success[500]
                    : entry.concern.status === "labeled"
                      ? colors.primary[500]
                      : colors.neutral[400];
                  const statusText = resolved
                    ? "Healed today"
                    : entry.isNew
                      ? "New"
                      : "Tracked";
                  return (
                    <View key={entry.concern.id} style={styles.detailRow}>
                      <View
                        style={[
                          styles.detailBadge,
                          { backgroundColor: badgeColor },
                        ]}
                      >
                        <ThemedText
                          style={{
                            color: "#FFFFFF",
                            fontSize: 11,
                            lineHeight: 14,
                          }}
                          weight="bold"
                        >
                          {entry.number}
                        </ThemedText>
                      </View>
                      <ThemedText
                        type="bodySmall"
                        style={{ color: "#FFFFFF", flex: 1 }}
                      >
                        {concernLabel(entry.concern)}
                      </ThemedText>
                      <ThemedText
                        type="captionSmall"
                        style={{ color: "rgba(255,255,255,0.7)" }}
                      >
                        {statusText}
                      </ThemedText>
                    </View>
                  );
                })
              )}
              {hasReview(activeSession) && (
                <SessionReview session={activeSession} dark showNotes />
              )}
            </ScrollView>
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
              onPress={() => (playing ? stopPlaying() : startPlaying())}
              IconComponent={MaterialCommunityIcons}
              iconName={playing ? "pause" : "play"}
              iconSize={26}
              iconColor="#FFFFFF"
              backgroundColor={colors.primary[500]}
            />
          ) : (
            <ThemedText
              type="captionSmall"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Your first check-in
            </ThemedText>
          )}
          <IconButton
            onPress={handleDelete}
            IconComponent={MaterialCommunityIcons}
            iconName="trash-can-outline"
            iconSize={22}
            iconColor={colors.error}
            backgroundColor="rgba(255,255,255,0.16)"
            accessibilityLabel="Delete entry"
          />
        </View>
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
  topOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: undefined,
    zIndex: 10,
  },
  topScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  bottomOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: undefined,
    bottom: 0,
    zIndex: 10,
  },
  bottomScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
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
    ...StyleSheet.absoluteFillObject,
  },
  pagerList: {
    flex: 1,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  playLayer: {
    ...StyleSheet.absoluteFillObject,
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
  detailsToggleWrap: {
    alignItems: "center",
    paddingBottom: 4,
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  detailsPanel: {
    alignSelf: "stretch",
    marginHorizontal: 16,
    marginBottom: 8,
    maxHeight: 220,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    overflow: "hidden",
  },
  detailsScroll: {
    maxHeight: 220,
  },
  detailsContent: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
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
