import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type LayoutChangeEvent,
  type ViewToken,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
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
import BottomSheet, {
  type BottomSheetSnap,
} from "@/components/ui/bottom-sheet";
import SessionReview, { hasReview } from "@/components/journal/session-review";
import {
  allConcerns,
  concernLabel,
  dayEntries,
  formatSessionDay,
  formatSessionTime,
  type SkinDayEntry,
} from "@/utils/skin-sessions";
import {
  filterEntriesByZones,
  noConcernsMessage,
  zoneByConcernId,
  zoneCounts,
  ZONE_LABELS,
  ZONE_ORDER,
  type SkinZone,
} from "@/utils/skin-regions";
import ThemedButton from "@/components/ui/themed-button";

const THUMB_SIZE = 56;
const THUMB_GAP = 8;
const THUMB_STRIDE = THUMB_SIZE + THUMB_GAP;
const PLAY_CYCLE_MS = 1200;
const FADE_MS = 500;
const FADE_FALLBACK_MS = 600;
const DOT_SIZE = 22;
const DOT_RADIUS = DOT_SIZE / 2;
const LINE_GAP = 15.13 * 1.65;
const LINE_THICKNESS = 1;
const txtColor = Colors["light"].neutral[100];

import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

const VIGNETTE_CENTER_Y = 0.5; // fraction of screen height
const VIGNETTE_RX = 0.5; // oval half-width, fraction of screen width
const VIGNETTE_RY = 0.4; // oval half-height, fraction of screen height
const VIGNETTE_CLEAR_UNTIL = 0.65; // 0 to 1, how much of the oval stays clear
const VIGNETTE_EDGE_OPACITY = 0.6;

const FaceVignette = memo(function FaceVignette({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const cx = width / 2;
  const cy = height * VIGNETTE_CENTER_Y;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient
            id="faceVignette"
            gradientUnits="userSpaceOnUse"
            cx={cx}
            cy={cy}
            fx={cx}
            fy={cy}
            rx={width * VIGNETTE_RX}
            ry={height * VIGNETTE_RY}
          >
            <Stop
              offset={VIGNETTE_CLEAR_UNTIL}
              stopColor="#000"
              stopOpacity={0}
            />
            <Stop
              offset={1}
              stopColor="#000"
              stopOpacity={VIGNETTE_EDGE_OPACITY}
            />
          </RadialGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#faceVignette)"
        />
      </Svg>
    </View>
  );
});

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
  onMarkerPress?: (concernUuid: string | null, sessionId: number) => void;
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
  onMarkerPress,
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
          <Pressable
            key={entry.concern.id}
            onPress={() => onMarkerPress?.(entry.concern.uuid, sessionId)}
            accessibilityRole="button"
            accessibilityLabel={`Open progress for ${entry.number}`}
            hitSlop={12}
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
          </Pressable>
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

// Peek grows to fit the 12G region filter bar above the filmstrip so the
// bar + playback controls stay visible on small devices.
const PEEK_BASE_HEIGHT = 214;

interface ZoneFilterBarProps {
  counts: { all: number } & Record<SkinZone, number>;
  selected: ReadonlySet<SkinZone>;
  onToggle: (zone: SkinZone) => void;
  onSelectAll: () => void;
  accent: string;
  dimmedText: string;
}

/**
 * 12G region filter chips. Always visible (no modal), one tap applies
 * instantly. Zero-count zones stay visible but dimmed so layout is stable.
 * "Other" only renders when at least one concern maps to it.
 */
const ZoneFilterBar = memo(function ZoneFilterBar({
  counts,
  selected,
  onToggle,
  onSelectAll,
  accent,
  dimmedText,
}: ZoneFilterBarProps) {
  const allSelected = selected.size === 0;
  const renderChip = (
    key: string,
    label: string,
    isSelected: boolean,
    onPress: () => void,
    a11yLabel: string,
    dimmed: boolean,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.zoneChip,
        {
          backgroundColor: isSelected ? accent : "rgba(255,255,255,0.12)",
          borderColor: isSelected ? accent : "rgba(255,255,255,0.24)",
          opacity: dimmed && !isSelected ? 0.45 : 1,
        },
      ]}
    >
      <ThemedText
        type="captionSmall"
        weight="semiBold"
        style={{ color: isSelected ? "#FFFFFF" : dimmedText }}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.zoneBarContent}
      style={styles.zoneBar}
    >
      {renderChip(
        "all",
        `All ${counts.all}`,
        allSelected,
        onSelectAll,
        `All, ${counts.all} concerns${allSelected ? ", selected" : ""}`,
        false,
      )}
      {ZONE_ORDER.filter((z) => z !== "other" || counts.other > 0).map((zone) =>
        renderChip(
          zone,
          `${ZONE_LABELS[zone]} ${counts[zone]}`,
          selected.has(zone),
          () => onToggle(zone),
          `${ZONE_LABELS[zone]}, ${counts[zone]} concerns${selected.has(zone) ? ", selected" : ""}`,
          counts[zone] === 0,
        ),
      )}
    </ScrollView>
  );
});

export default function JournalMontageScreen() {
  const { startId, initialId, initialUrl, initialW, initialH, expandDetails } =
    useLocalSearchParams<{
      startId?: string;
      initialId?: string;
      initialUrl?: string;
      initialW?: string;
      initialH?: string;
      expandDetails?: string;
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
  const [sheetSnap, setSheetSnap] = useState<BottomSheetSnap>(
    expandDetails === "1" ? "expanded" : "peek",
  );
  const [aspects, setAspects] = useState<Record<number, number>>({});

  const pagerRef = useRef<FlatList<SkinSessionOut>>(null);
  const filmRef = useRef<FlatList<SkinSessionOut>>(null);
  const activeRef = useRef(0);
  activeRef.current = activeIndex;

  // Oldest to newest so play mode runs forward in time.
  // `getSkinSessions()` returns sessions newest first.
  const sorted = useMemo(() => [...sessions].reverse(), [sessions]);
  const concerns = useMemo(() => allConcerns(sessions), [sessions]);

  // 12G region filter: local-only state, resets on close. Empty set = All.
  const [selectedZones, setSelectedZones] = useState<Set<SkinZone>>(new Set());
  const toggleZone = useCallback((zone: SkinZone) => {
    setSelectedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }, []);
  const selectAllZones = useCallback(() => setSelectedZones(new Set()), []);

  // Zone per concern + distinct-concern counts, recomputed only when the
  // session set changes (deletes included). No network or image work here.
  const zoneMap = useMemo(() => zoneByConcernId(concerns), [concerns]);
  const counts = useMemo(() => zoneCounts(concerns), [concerns]);
  // TEMP-DEBUG 12G: what anchors came back + what the filter computed.
  useEffect(() => {
    console.log("[12G] sessions:", sessions.length, "concerns:", concerns.length);
    for (const s of sorted.slice(0, 5)) {
      console.log(
        "[12G] session",
        s.id,
        "landmarkKeys:",
        s.face_landmarks ? Object.keys(s.face_landmarks).join(",") : "null",
      );
    }
    for (const c of concerns.slice(0, 10)) {
      console.log(
        "[12G] concern",
        c.id,
        "uuid:",
        c.uuid,
        "anchor:",
        JSON.stringify(c.anchor),
      );
    }
    console.log("[12G] counts:", JSON.stringify(counts));
    console.log(
      "[12G] zoneMap:",
      JSON.stringify(Array.from(zoneMap.entries()).slice(0, 10)),
    );
  }, [sessions, concerns, counts, zoneMap, sorted]);
  const isFiltered = selectedZones.size > 0;
  const selectedList = useMemo(() => Array.from(selectedZones), [selectedZones]);
  // Positive empty-state line shared by the inline row and the details list.
  const globalEmptyMessage = useMemo(
    () => (isFiltered ? noConcernsMessage(selectedList) : null),
    [isFiltered, selectedList],
  );
  const hasAnyConcerns = concerns.length > 0;

  // Apply once at the data layer: filter numbered entries after
  // `dayEntries()` so each concern's number stays stable (gaps are fine).
  const filteredDayEntries = useCallback(
    (sessionId: number): SkinDayEntry[] =>
      filterEntriesByZones(dayEntries(sessionId, concerns), selectedZones, zoneMap),
    [concerns, selectedZones, zoneMap],
  );

  // Repeating ruled-lines background for the expanded details, same
  // pattern as the routine card: the gradient measures its own laid-out
  // height and builds one thin rule per LINE_GAP of space.
  const [linesHeight, setLinesHeight] = useState(0);

  const onLinesLayout = useCallback((e: LayoutChangeEvent) => {
    setLinesHeight(e.nativeEvent.layout.height);
  }, []);

  const lineColor = colors.neutral[300];

  const { ruleColors, ruleLocations } = useMemo(() => {
    if (linesHeight <= 0) return { ruleColors: [], ruleLocations: [] };
    const ruleColors: string[] = [];
    const ruleLocations: number[] = [];
    const count = Math.ceil(linesHeight / LINE_GAP);
    for (let i = 0; i < count; i++) {
      const lineStart = i * LINE_GAP;
      if (lineStart >= linesHeight) break;
      const lineEnd = Math.min(lineStart + LINE_THICKNESS, linesHeight);
      ruleColors.push("transparent", lineColor, lineColor, "transparent");
      ruleLocations.push(
        lineStart / linesHeight,
        lineStart / linesHeight,
        lineEnd / linesHeight,
        lineEnd / linesHeight,
      );
    }
    return { ruleColors, ruleLocations };
  }, [linesHeight, lineColor]);

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
            s.image_url != null ? getCachedSkinPhotoUrlSync(s.image_url) : null;
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

  // 12G entry points: tap a circle in session detail, or long-press a
  // timeline thumb (opens the session's first concern — thumbs are
  // per-session, not per-concern). Pause autoplay before pushing.
  const openProgression = useCallback(
    (concernUuid: string | null, sessionId: number) => {
      if (!concernUuid) return;
      stopPlaying();
      router.push({
        pathname: "/(modals)/concern-progression",
        params: { concernUuid, sessionId: String(sessionId) },
      });
    },
    [stopPlaying],
  );

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
    () => (activeSession ? filteredDayEntries(activeSession.id) : []),
    [activeSession, filteredDayEntries],
  );
  // Sessions keep their place in the timeline; thumbs with no matching
  // concerns are dimmed as polish (photo + pager page always stay).
  const activeHasMatches = activeEntries.length > 0;

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
                setSessions((prev) => prev.filter((s) => s.id !== target.id));
                const sortedIndex = sorted.findIndex((s) => s.id === target.id);
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
            markers: showMarkers ? filteredDayEntries(id) : [],
          },
    [displayUrls, aspects, showMarkers, filteredDayEntries],
  );
  const slotA = useMemo(() => buildFrame(slotAId), [buildFrame, slotAId]);
  const slotB = useMemo(() => buildFrame(slotBId), [buildFrame, slotBId]);

  const renderPage = useCallback(
    ({ item }: { item: SkinSessionOut }) => (
      <MontageFrame
        sessionId={item.id}
        uri={displayUrls[item.id]}
        aspect={aspects[item.id]}
        markers={showMarkers ? filteredDayEntries(item.id) : []}
        width={windowWidth}
        height={windowHeight}
        onLoad={onImageLoad}
        onMarkerPress={(uuid, sid) => openProgression(uuid, sid)}
      />
    ),
    [
      aspects,
      filteredDayEntries,
      displayUrls,
      onImageLoad,
      openProgression,
      showMarkers,
      windowHeight,
      windowWidth,
    ],
  );

  const renderThumb = useCallback(
    ({ item, index }: { item: SkinSessionOut; index: number }) => {
      const uri = displayUrls[item.id];
      const isActive = index === activeIndex;
      const entries = filteredDayEntries(item.id);
      const hasMatches = !isFiltered || entries.length > 0;
      return (
        <Pressable
          onPress={() => goToIndex(index)}
          onLongPress={() => {
            const first = entries[0];
            if (first) openProgression(first.concern.uuid, item.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Go to check-in ${index + 1}`}
          style={[
            styles.thumb,
            {
              opacity: isActive ? 1 : hasMatches ? 0.45 : 0.25,
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
    [
      activeIndex,
      colors.primary,
      filteredDayEntries,
      isFiltered,
      displayUrls,
      goToIndex,
      openProgression,
    ],
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

  const collapsedContent = (
    <View>
      {hasAnyConcerns && (
        <ZoneFilterBar
          counts={counts}
          selected={selectedZones}
          onToggle={toggleZone}
          onSelectAll={selectAllZones}
          accent={colors.primary[500]}
          dimmedText={colors.neutral[600]}
        />
      )}
      {isFiltered &&
        (selectedList.every((z) => counts[z] === 0) ? (
          <ThemedText
            type="captionSmall"
            style={[styles.zoneInlineNote, { color: colors.neutral[600] }]}
          >
            {globalEmptyMessage}
          </ThemedText>
        ) : (
          !activeHasMatches && (
            <ThemedText
              type="captionSmall"
              style={[styles.zoneInlineNote, { color: colors.neutral[600] }]}
            >
              No concerns here in this check-in
            </ThemedText>
          )
        ))}
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
          style={[
            styles.filmstrip,
            {
              backgroundColor: colors.primary[100],
            },
          ]}
        />
      )}
      <View style={styles.collapsedRow}>
        {showChrome ? (
          <>
            <IconButton
              onPress={() => goToIndex(activeIndex - 1)}
              disabled={activeIndex <= 0}
              IconComponent={MaterialCommunityIcons}
              iconName="chevron-left"
              iconSize={26}
              iconColor={colors.neutral[600]}
              backgroundColor="transparent"
              accessibilityLabel="Previous entry"
            />
            <IconButton
              onPress={() => (playing ? stopPlaying() : startPlaying())}
              IconComponent={MaterialCommunityIcons}
              iconName={playing ? "pause" : "play"}
              iconSize={26}
              iconColor="#FFFFFF"
              backgroundColor={colors.primary[500]}
              accessibilityLabel={
                playing ? "Pause slideshow" : "Play slideshow"
              }
            />
            <IconButton
              onPress={() => goToIndex(activeIndex + 1)}
              disabled={activeIndex >= sorted.length - 1}
              IconComponent={MaterialCommunityIcons}
              iconName="chevron-right"
              iconSize={26}
              iconColor={colors.neutral[600]}
              backgroundColor="transparent"
              accessibilityLabel="Next entry"
            />
            <ThemedText
              type="captionSmall"
              style={{ color: colors.neutral[600] }}
            >
              {`${activeIndex + 1} of ${sorted.length}`}
            </ThemedText>
          </>
        ) : (
          <ThemedText
            type="captionSmall"
            style={{ color: colors.neutral[600] }}
          >
            Your first check-in
          </ThemedText>
        )}
        <IconButton
          onPress={() => setSheetSnap("expanded")}
          IconComponent={MaterialCommunityIcons}
          iconName="chevron-up"
          iconSize={22}
          iconColor={colors.neutral[600]}
          backgroundColor="transparent"
          accessibilityLabel="View entry details"
        />
      </View>
    </View>
  );

  const expandedContent = activeSession ? (
    <View style={[styles.expandedWrap, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.expandedHeader}>
        {hasAnyConcerns && (
          <ZoneFilterBar
            counts={counts}
            selected={selectedZones}
            onToggle={toggleZone}
            onSelectAll={selectAllZones}
            accent={colors.primary[500]}
            dimmedText={colors.neutral[600]}
          />
        )}
        {isFiltered &&
          (selectedList.every((z) => counts[z] === 0) ? (
            <ThemedText
              type="captionSmall"
              style={[styles.zoneInlineNote, { color: colors.neutral[600] }]}
            >
              {globalEmptyMessage}
            </ThemedText>
          ) : (
            !activeHasMatches && (
              <ThemedText
                type="captionSmall"
                style={[styles.zoneInlineNote, { color: colors.neutral[600] }]}
              >
                No concerns here in this check-in
              </ThemedText>
            )
          ))}
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
            style={[
              styles.filmstrip,
              {
                backgroundColor: colors.primary[100],
              },
            ]}
          />
        )}
        <View style={styles.collapsedRow}>
          {showChrome ? (
            <>
              <IconButton
                onPress={() => goToIndex(activeIndex - 1)}
                disabled={activeIndex <= 0}
                IconComponent={MaterialCommunityIcons}
                iconName="chevron-left"
                iconSize={26}
                iconColor={colors.neutral[600]}
                backgroundColor="transparent"
                accessibilityLabel="Previous entry"
              />
              <IconButton
                onPress={() => (playing ? stopPlaying() : startPlaying())}
                IconComponent={MaterialCommunityIcons}
                iconName={playing ? "pause" : "play"}
                iconSize={26}
                iconColor="#FFFFFF"
                backgroundColor={colors.primary[500]}
                accessibilityLabel={
                  playing ? "Pause slideshow" : "Play slideshow"
                }
              />
              <IconButton
                onPress={() => goToIndex(activeIndex + 1)}
                disabled={activeIndex >= sorted.length - 1}
                IconComponent={MaterialCommunityIcons}
                iconName="chevron-right"
                iconSize={26}
                iconColor={colors.neutral[600]}
                backgroundColor="transparent"
                accessibilityLabel="Next entry"
              />
              <ThemedText
                type="captionSmall"
                style={{ color: colors.neutral[600] }}
              >
                {`${activeIndex + 1} of ${sorted.length}`}
              </ThemedText>
            </>
          ) : (
            <ThemedText
              type="captionSmall"
              style={{ color: colors.neutral[600] }}
            >
              Your first check-in
            </ThemedText>
          )}
          <IconButton
            onPress={() => setSheetSnap("peek")}
            IconComponent={MaterialCommunityIcons}
            iconName="chevron-down"
            iconSize={22}
            iconColor={colors.neutral[600]}
            backgroundColor="transparent"
            accessibilityLabel="View entry details"
          />
        </View>
      </View>
      <View style={styles.linesWrap}>
        <LinearGradient
          pointerEvents="none"
          colors={ruleColors as [string, string, ...string[]]}
          locations={ruleLocations as [number, number, ...number[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          onLayout={onLinesLayout}
          style={styles.linesBackground}
        />
        <ScrollView
          contentContainerStyle={styles.expandedContent}
          showsVerticalScrollIndicator={false}
        >
          <View>
            {activeEntries.length === 0 ? (
              <ThemedText
                type="bodySmall"
                style={{ color: colors.neutral[600] }}
              >
                {!isFiltered
                  ? "No concerns marked on this check-in"
                  : selectedList.every((z) => counts[z] === 0)
                    ? (globalEmptyMessage ?? "No concerns here")
                    : "No concerns here in this check-in"}
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
                      style={{ color: colors.text, flex: 1 }}
                    >
                      {concernLabel(entry.concern)}
                    </ThemedText>
                    <ThemedText
                      type="captionSmall"
                      style={{ color: colors.neutral[600] }}
                    >
                      {statusText}
                    </ThemedText>
                  </View>
                );
              })
            )}
          </View>
          {hasReview(activeSession) && (
            <SessionReview session={activeSession} showNotes />
          )}
        </ScrollView>
      </View>
    </View>
  ) : null;

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

      {showMarkers && (
        <FaceVignette width={windowWidth} height={windowHeight} />
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
            iconColor={txtColor}
          />
          {activeSession && (
            <View pointerEvents="none" style={styles.dateRow}>
              <ThemedText type="h3" style={{ color: "#FFFFFF" }}>
                {formatSessionDay(activeSession.timestamp)}
              </ThemedText>
              <ThemedText type="captionSmall" style={{ color: txtColor }}>
                {`${formatSessionTime(activeSession.timestamp)} · ${activeIndex + 1} of ${sorted.length}`}
              </ThemedText>
            </View>
          )}
          <View style={styles.controls}>
            <IconButton
              onPress={() => setShowMarkers((v) => !v)}
              iconName={!showMarkers ? "eye-outline" : "eye-off-outline"}
              IconComponent={MaterialCommunityIcons}
              iconColor={txtColor}
            />
            <IconButton
              onPress={handleDelete}
              IconComponent={MaterialCommunityIcons}
              iconName="trash-can-outline"
              iconSize={22}
              iconColor={colors.error}
            />
          </View>
        </View>
      </View>

      <BottomSheet
        snap={sheetSnap}
        onSnapChange={setSheetSnap}
        peekHeight={PEEK_BASE_HEIGHT + insets.bottom}
        collapsedContent={collapsedContent}
        expandedContent={expandedContent}
        expandedVisibleRatio={0.6}
      />
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
  collapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 16,
    paddingTop: 4,
  },
  zoneBar: {
    maxHeight: 48,
    marginBottom: 4,
  },
  zoneBarContent: {
    gap: 8,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  zoneChip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  zoneInlineNote: {
    textAlign: "center",
    paddingBottom: 4,
  },
  expandedWrap: {
    flex: 1,
    paddingHorizontal: 20,
  },
  expandedHeader: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  expandedContent: {
    paddingBottom: 16,
    gap: LINE_GAP,
  },
  linesWrap: {
    flex: 1,
  },
  linesBackground: {
    ...StyleSheet.absoluteFillObject,
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
    borderRadius: 10,
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
    gap: 4,
  },
  closePill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
});
