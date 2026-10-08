import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { patchConcernPosition } from "@/api/skin";
import { useSkinSessions } from "@/contexts/SkinSessionsContext";
import {
  getCachedSkinPhotoDimsSync,
  getCachedSkinPhotoUrl,
  getCachedSkinPhotoUrlSync,
  prefetchSkinPhotoUrls,
  primeSkinPhotoDims,
} from "@/api/skin-photo-urls";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import IconButton from "@/components/ui/icon-button";
import GlassSurface from "@/components/ui/glass-surface";
import ConcernHero from "@/components/journal/concern-hero";
import ConcernScrubber from "@/components/journal/concern-scrubber";
import { buildConcernTimeline } from "@/hooks/use-concern-timeline";
import { formatSessionDay, formatSessionTime } from "@/utils/skin-sessions";
import { cropImageLayout, getConcernCropRect } from "@/utils/concern-crop";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export default function ConcernProgressionScreen() {
  const { concernUuid, sessionId } = useLocalSearchParams<{
    concernUuid?: string;
    sessionId?: string;
  }>();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const txtColor = colors.text;

  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
    refresh: refreshSessions,
    applyConcernPatch,
  } = useSkinSessions();
  const [displayUrls, setDisplayUrls] = useState<Record<number, string>>({});
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCircle, setShowCircle] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustValue, setAdjustValue] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const heroSize = Math.min(windowWidth - 32, 420);
  const halfSize = heroSize / 2;

  // Record intrinsic aspects from decoded images (also primes the shared
  // dims cache so the montage lays markers out instantly on remount).
  const handlePhotoLoad = useCallback(
    (loadedUri: string, w: number, h: number) => {
      if (!w || !h) return;
      const match = sessions.find(
        (s) => displayUrls[s.id] === loadedUri,
      );
      if (!match) return;
      primeSkinPhotoDims(match.image_url, w, h);
      setAspects((prev) =>
        prev[match.id] ? prev : { ...prev, [match.id]: w / h },
      );
    },
    [sessions, displayUrls],
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  // Sessions come from the shared store; seed/resolve photos locally as
  // the shared set changes (deletes included — stale ids are pruned).
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    const seed: Record<number, string> = {};
    for (const s of sessions) {
      const cached = getCachedSkinPhotoUrlSync(s.image_url);
      if (cached) seed[s.id] = cached;
    }
    setDisplayUrls((prev) => {
      const next: Record<number, string> = {};
      for (const s of sessions) {
        if (prev[s.id]) next[s.id] = prev[s.id];
        else if (seed[s.id]) next[s.id] = seed[s.id];
      }
      return next;
    });
    const seedAspects: Record<number, number> = {};
    for (const s of sessions) {
      const dims = getCachedSkinPhotoDimsSync(s.image_url);
      if (dims) seedAspects[s.id] = dims.width / dims.height;
    }
    setAspects((prev) => {
      const next: Record<number, number> = {};
      for (const s of sessions) {
        if (prev[s.id]) next[s.id] = prev[s.id];
        else if (seedAspects[s.id]) next[s.id] = seedAspects[s.id];
      }
      return next;
    });
    const missing = sessions
      .filter((s) => seed[s.id] == null)
      .map((s) => s.image_url);
    if (missing.length > 0) {
      void prefetchSkinPhotoUrls(missing).then(() => {
        setDisplayUrls((prev) => {
          const next = { ...prev };
          for (const s of sessions) {
            const cached = getCachedSkinPhotoUrlSync(s.image_url);
            if (cached && !next[s.id]) next[s.id] = cached;
          }
          return next;
        });
      });
    }
  }, [sessions]);

  const timeline = useMemo(
    () => buildConcernTimeline(sessions, concernUuid ?? null),
    [sessions, concernUuid],
  );

  // Clamp the selection when the frame list shrinks (e.g. an entry deleted
  // in the montage underneath this stacked modal).
  useEffect(() => {
    if (!timeline) return;
    setSelectedIndex((prev) =>
      prev >= timeline.frames.length
        ? Math.max(timeline.frames.length - 1, 0)
        : prev,
    );
  }, [timeline]);

  // Default selection: requested session, else latest appearance.
  useEffect(() => {
    if (!timeline) return;
    if (sessionId != null) {
      const i = timeline.frames.findIndex(
        (f) => String(f.session.id) === sessionId,
      );
      if (i >= 0) {
        setSelectedIndex(i);
        return;
      }
    }
    const lastSeen = timeline.frames.reduce(
      (acc, f, i) => (!f.isGap ? i : acc),
      0,
    );
    setSelectedIndex(lastSeen);
  }, [timeline, sessionId]);

  // Resolve + prefetch neighbors of the selection (windowed, never all N).
  useEffect(() => {
    const frame = timeline?.frames[selectedIndex];
    if (!frame) return;
    const keys: string[] = [];
    const urls: string[] = [];
    for (let o = 0; o <= 2; o += 1) {
      for (const idx of [selectedIndex + o, selectedIndex - o]) {
        const f = timeline?.frames[idx];
        if (!f) continue;
        const url = displayUrls[f.session.id];
        if (url) urls.push(url);
        else if (f.session.image_url) keys.push(f.session.image_url);
      }
    }
    if (keys.length > 0) {
      for (const f of timeline?.frames ?? []) {
        if (keys.includes(f.session.image_url)) {
          void getCachedSkinPhotoUrl(f.session.image_url).then((url) => {
            setDisplayUrls((prev) =>
              prev[f.session.id] ? prev : { ...prev, [f.session.id]: url },
            );
          });
        }
      }
    }
    if (urls.length > 0) {
      Image.prefetch(urls).catch(() => {});
    }
  }, [selectedIndex, timeline, displayUrls]);

  const selectIndex = useCallback(
    (index: number) => {
      if (!timeline || timeline.frames.length === 0) return;
      const clamped = Math.min(Math.max(0, index), timeline.frames.length - 1);
      setSelectedIndex((prev) => (prev === clamped ? prev : clamped));
      setAdjusting(false);
      setAdjustValue(null);
    },
    [timeline],
  );

  const frame = timeline?.frames[selectedIndex] ?? null;
  const firstFrame = timeline?.frames.find((f) => !f.isGap) ?? null;

  const flingLeft = Gesture.Fling()
    .direction(1)
    .runOnJS(true)
    .onEnd(() => {
      if (!adjusting && !comparing) {
        Haptics.selectionAsync().catch(() => {});
        selectIndex(selectedIndex + 1);
      }
    });
  const flingRight = Gesture.Fling()
    .direction(8)
    .runOnJS(true)
    .onEnd(() => {
      if (!adjusting && !comparing) {
        Haptics.selectionAsync().catch(() => {});
        selectIndex(selectedIndex - 1);
      }
    });
  const swipeGesture = Gesture.Simultaneous(flingLeft, flingRight);

  const longPress = Gesture.LongPress()
    .minDuration(400)
    .runOnJS(true)
    .onStart(() => {
      if (!adjusting && frame && !frame.isGap && timeline!.frames.length > 1) {
        Haptics.selectionAsync().catch(() => {});
        setComparing(true);
      }
    })
    .onEnd(() => setComparing(false));

  const heroGesture = Gesture.Exclusive(longPress, swipeGesture);

  const handleSaveAdjust = useCallback(async () => {
    if (
      !timeline ||
      !frame ||
      frame.isGap ||
      !adjustValue ||
      saving ||
      !concernUuid
    ) {
      return;
    }
    setSaving(true);
    try {
      const result = await patchConcernPosition(
        concernUuid,
        frame.session.id,
        {
          x: clamp01(adjustValue.x),
          y: clamp01(adjustValue.y),
        },
      );
      const updated = result.concern;
      // Publish through the shared store so the montage/cards show the new
      // position immediately, no remount needed.
      applyConcernPatch(updated);
      setAdjusting(false);
      setAdjustValue(null);
      Toast.show({
        type: "success",
        text1: "Position updated",
        // "Reference" copy only when the endpoint actually rewrote the
        // anchor (first appearance + landmarks); a landmark-less first
        // frame corrects just that entry.
        text2: result.anchor_updated
          ? "Future check-ins will use this as reference."
          : "Saved for this check-in.",
        position: "bottom",
      });
    } catch {
      Toast.show({
        type: "error",
        text1: "Couldn't save",
        text2: "Check your connection and try again.",
        position: "bottom",
      });
    } finally {
      setSaving(false);
    }
  }, [timeline, frame, adjustValue, saving, concernUuid, applyConcernPatch]);

  const scrollRef = useRef(null);

  if (sessionsLoading && sessions.length === 0) {
    return (
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: colors.secondary[100],
          },
        ]}
      >
        <StatusBar style="light" />
        {sessionsError && sessions.length === 0 ? (
          <View style={styles.centered}>
            <ThemedText type="h3">Couldn't load progress</ThemedText>
            <ThemedText type="bodySmall">
              Check your connection and try again.
            </ThemedText>
            <ThemedButton text="Retry" onPress={() => void refreshSessions()} />
          </View>
        ) : (
          <View style={styles.centered}>
            <View
              style={[
                styles.skeletonHero,
                { width: heroSize, height: heroSize },
              ]}
            />
            <ActivityIndicator color={txtColor} />
          </View>
        )}
      </View>
    );
  }

  if (!timeline) {
    return (
      <View
        style={[
          styles.root,
          styles.centered,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: colors.secondary[100],
          },
        ]}
      >
        <StatusBar style="light" />
        <ThemedText type="h3">Concern not found</ThemedText>
        <ThemedButton text="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  const captionDay = frame?.dayN != null ? `Day ${frame.dayN}` : null;
  const captionDate = frame
    ? `${formatSessionDay(frame.dateIso)} · ${formatSessionTime(frame.dateIso)}`
    : "";
  const isFinalHealedFrame =
    timeline.healed &&
    frame != null &&
    timeline.resolvedIso != null &&
    frame.dateIso === timeline.resolvedIso;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: colors.secondary[100] },
      ]}
    >
      <StatusBar style="light" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.controls}>
          <ThemedButton
            link
            text="Go Back"
            leftIconName="arrow-back"
            LeftIconComponent={MaterialIcons}
            onPress={() => router.back()}
            color={colors.neutral[800]}
            alignment="flex-start"
          />
          <IconButton
            onPress={() => setShowCircle((v) => !v)}
            iconName={showCircle ? "eye-off-outline" : "eye-outline"}
            IconComponent={MaterialCommunityIcons}
            iconColor={txtColor}
          />
        </View>
        <View style={styles.headerTitle}>
          <ThemedText type="h3" numberOfLines={1}>
            {timeline.label}
          </ThemedText>
          <View
            style={[
              styles.statusChip,
              {
                backgroundColor: timeline.healed
                  ? "rgba(255,255,255,0.16)"
                  : colors.primary[500],
              },
            ]}
          >
            <ThemedText type="captionSmall" weight="semiBold">
              {timeline.statusText}
            </ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{ width: heroSize, alignSelf: "center" }}>
          {comparing && firstFrame && frame && !frame.isGap ? (
            <Pressable
              onPress={() => setComparing(false)}
              accessibilityRole="button"
              accessibilityLabel="Exit compare view"
            >
              <View
                style={[
                  styles.compareRow,
                  { width: heroSize, height: heroSize },
                ]}
              >
                <CompareHalf
                  uri={displayUrls[firstFrame.session.id]}
                  aspect={aspects[firstFrame.session.id]}
                  coords={firstFrame.coords}
                  width={halfSize}
                  height={heroSize}
                />
                <CompareHalf
                  uri={frame ? displayUrls[frame.session.id] : undefined}
                  aspect={frame ? aspects[frame.session.id] : undefined}
                  coords={frame?.coords ?? null}
                  width={halfSize}
                  height={heroSize}
                />
              </View>
              <ThemedText
                type="captionSmall"
                style={[{ marginTop: 8, textAlign: "center" }]}
              >
                First appearance vs selected. Tap to exit
              </ThemedText>
            </Pressable>
          ) : adjusting ? (
            <ConcernHero
              uri={frame ? displayUrls[frame.session.id] : undefined}
              aspect={frame ? aspects[frame.session.id] : undefined}
              coords={null}
              mode="full"
              size={heroSize}
              showCircle={showCircle}
              reduceMotion={reduceMotion}
              adjusting
              adjustValue={adjustValue ?? frame?.coords ?? null}
              onAdjustMove={(c) => setAdjustValue(c)}
              onPhotoLoad={handlePhotoLoad}
            />
          ) : (
            <GestureDetector gesture={heroGesture}>
              <View>
                <ConcernHero
                  uri={frame ? displayUrls[frame.session.id] : undefined}
                  aspect={frame ? aspects[frame.session.id] : undefined}
                  coords={frame?.coords ?? null}
                  mode={
                    frame && (frame.isGap || frame.lowConfidence)
                      ? "full"
                      : "crop"
                  }
                  size={heroSize}
                  showCircle={showCircle}
                  reduceMotion={reduceMotion}
                  onPhotoLoad={handlePhotoLoad}
                />
                {timeline.frames.length > 1 && !adjusting && (
                  <ThemedText
                    type="captionSmall"
                    style={[{ marginTop: 8, textAlign: "center" }]}
                  >
                    Long-press to compare with the first appearance
                  </ThemedText>
                )}
              </View>
            </GestureDetector>
          )}

          {/* Caption */}
          <View style={styles.caption}>
            <ThemedText type="bodySmall">
              {captionDate}
              {captionDay ? ` · ${captionDay}` : ""}
            </ThemedText>
            {isFinalHealedFrame && (
              <ThemedText
                type="captionSmall"
                weight="semiBold"
                style={{ color: colors.primary[300] }}
              >
                {timeline.healedDays === 0
                  ? "Healed the same day it appeared"
                  : `Healed in ${timeline.healedDays} ${timeline.healedDays === 1 ? "day" : "days"}`}
              </ThemedText>
            )}
          </View>

          {/* Scrubber */}
          <View style={styles.scrubberWrap}>
            <ConcernScrubber
              frames={timeline.frames}
              selectedIndex={selectedIndex}
              onSelect={selectIndex}
              displayUrls={displayUrls}
              aspects={aspects}
            />
          </View>

          {timeline.frames.length <= 1 && (
            <ThemedText
              type="captionSmall"
              style={[{ textAlign: "center", marginTop: 12 }]}
            >
              Progress appears after the next entry.
            </ThemedText>
          )}

          {/* Gap / low-confidence states */}
          {frame?.isGap && (
            <GlassSurface style={styles.notice}>
              <ThemedText type="bodySmall">
                Not marked in this session
              </ThemedText>
              <ThemedText type="captionSmall">
                Showing the full photo so nothing is hidden.
              </ThemedText>
            </GlassSurface>
          )}
          {frame && !frame.isGap && frame.lowConfidence && !adjusting && (
            <GlassSurface style={styles.notice}>
              <ThemedText type="bodySmall">
                Position may be off in this frame
              </ThemedText>
              <ThemedText type="captionSmall">
                Showing the full photo. Drag the marker to the right spot.
              </ThemedText>
              <ThemedButton
                text="Adjust"
                onPress={() => {
                  setAdjustValue(frame.coords);
                  setAdjusting(true);
                }}
              />
            </GlassSurface>
          )}
          {adjusting && (
            <View style={styles.adjustRow}>
              <ThemedButton
                text="Cancel"
                link
                onPress={() => {
                  setAdjusting(false);
                  setAdjustValue(null);
                }}
              />
              <ThemedButton
                text={saving ? "Saving…" : "Save position"}
                onPress={handleSaveAdjust}
                disabled={saving || !adjustValue}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Fixed side-by-side compare half (v1: no draggable divider). Same fixed
 * crop geometry as the hero, uniformly scaled to the half width so nothing
 * is distorted.
 */
function CompareHalf({
  uri,
  aspect,
  coords,
  width,
  height,
}: {
  uri: string | undefined;
  aspect: number | undefined;
  coords: { x: number; y: number } | null;
  width: number;
  height: number;
}) {
  const center = coords ?? { x: 0.5, y: 0.5 };
  const rect = getConcernCropRect(center, aspect);
  // Full-crop layout at reference size, then uniform scale to half width.
  const refSize = width * 2;
  const full = cropImageLayout(refSize, rect);
  const scale = width / refSize;
  return (
    <View
      style={{ width, height, overflow: "hidden", backgroundColor: "#000" }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            position: "absolute",
            width: full.width * scale,
            height: full.height * scale,
            left: full.left * scale,
            top: full.top * scale + (height - refSize * scale) / 2,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  skeletonHero: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  body: {
    gap: 12,
    paddingHorizontal: 16,
    justifyContent: "flex-start",
  },
  compareRow: {
    flexDirection: "row",
    borderRadius: 16,
    overflow: "hidden",
  },
  caption: {
    marginTop: 10,
    gap: 2,
  },
  notice: {
    marginTop: 12,
    padding: 14,
    gap: 6,
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 12,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  scrubberWrap: {
    marginTop: 4,
  },
});
