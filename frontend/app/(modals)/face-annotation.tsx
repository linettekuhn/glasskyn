import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SetStateAction } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import IconButton from "@/components/ui/icon-button";
import Chip from "@/components/ui/chip";
import BottomSheet, {
  type BottomSheetSnap,
} from "@/components/ui/bottom-sheet";
import { Colors, getTheme } from "@/constants/theme";
import {
  TAXONOMY,
  TAXONOMY_GROUPS,
  TAXONOMY_DISCLAIMER,
} from "@/constants/taxonomy";
import {
  allSettled,
  findNextUnlabeled,
  nextOrder,
  renumber,
  reverseAction,
} from "@/utils/annotation";
import {
  computeAnchor,
  lastSeenCoords,
  projectConcern,
  type ConcernAnchor,
} from "@/utils/anchor";
import {
  useSkinCapture,
  type SkinLandmarkRefs,
} from "@/contexts/SkinCaptureContext";
import { usePhotoTransform } from "@/hooks/use-photo-transform";
import { getSkinSessions } from "@/api/skin";
import { allConcerns, dayEntries } from "@/utils/skin-sessions";
import type {
  AnnotationAction,
  Concern,
  CircleAnnotation,
  SkinConcernOut,
  SkinSessionOut,
} from "@/types";
import EntrySteps from "@/components/journal/entry-steps";
import { withAlpha } from "@/components/ui/glass-surface";
import Divider from "@/components/ui/divider";

const DOT_SIZE = 24;
const DOT_RADIUS = DOT_SIZE / 2;
const TRASH_RADIUS = 32;
const PEEK_HEIGHT_CIRCLING = 178;
// Labeling peek budgets the full collapsed stack (title + chips + save) plus
// the sheet handle, with breathing room.
const PEEK_HEIGHT_LABELING = 220;

import { daysSince } from "@/utils/skin-days";

// Legacy name kept at call sites; now calendar-day based and shared with the
// progression view (12G) so both screens agree. Previously
// max(1, floor(elapsed/24h)); now max(0, calendar-day diff). Values can shift
// by ±1 for sub-24h spans (e.g. 11pm -> 8am next day is now 1, was 0->1).
function daysBetween(fromIso: string | null | undefined): number | null {
  const d = daysSince(fromIso);
  return d == null ? null : Math.max(1, d);
}

interface CarrySkip {
  id: number;
  uuid: string | null;
  reason: string;
  /** Session ids in the concern's history, for diagnosing carry gaps. */
  historySessions?: number[];
}

interface CarrySource {
  concern: SkinConcernOut;
  /** Coordinates of this concern on the prev session (source of truth). */
  coords: { x: number; y: number } | null;
}

interface CarryResult {
  carried: CircleAnnotation[];
  skipped: CarrySkip[];
  /** True when no landmark ref could be used, so coords were carried as-is. */
  usedFallbackCoords: boolean;
  /** Per-concern projection source counts (original-truth observability). */
  storedAnchorCount: number;
  freshAnchorCount: number;
}

function carryConcernsFrom(
  prev: SkinSessionOut,
  newLandmarks: SkinLandmarkRefs | null,
  sources?: CarrySource[],
): CarryResult {
  const carried: CircleAnnotation[] = [];
  const skipped: CarrySkip[] = [];
  const prevLandmarks = prev.face_landmarks ?? null;
  let usedFallbackCoords = false;
  let storedAnchorCount = 0;
  let freshAnchorCount = 0;

  // Default source preserves the old behavior; callers pass history-aware
  // sources so concerns carried *through* prev (not originated there) are
  // included — the backend only lists origin concerns on each session.
  const list: CarrySource[] = sources ?? [];
  if (!sources) {
    for (const concern of prev.concerns ?? []) {
      list.push({ concern, coords: lastSeenCoords(concern) });
    }
  }

  for (const { concern, coords: prevCoords } of list) {
    const historySessions = (concern.history ?? [])
      .map((h) => h.session_id)
      .filter((id): id is number => typeof id === "number");
    const skip = (reason: string) =>
      skipped.push({ id: concern.id, uuid: concern.uuid, reason, historySessions });

    if (!concern.uuid) {
      skip("no-uuid");
      continue;
    }
    if (!concern.label) {
      skip("no-label");
      continue;
    }
    if (concern.resolved_session_id != null) {
      skip("already-resolved");
      continue;
    }
    // Stored coords on prev are the source of truth; fall back to the
    // latest seen only if the caller didn't supply prev's coords.
    const coords = prevCoords ?? lastSeenCoords(concern);
    if (!coords) {
      skip("no-coords");
      continue;
    }
    // Narrowed to string by the no-uuid skip above; hoisted so the
    // pushCarried closure keeps the narrow type.
    const uuid: string = concern.uuid;
    const pushCarried = (x: number, y: number) => {
      carried.push({
        uuid,
        number: 0,
        x,
        y,
        concernId: concern.label,
        status: "labeled",
        createdOrder: 0,
        carriedFrom: concern.uuid,
        carriedCreatedAt: concern.created_at,
        isResolved: false,
        wasDragged: false,
      });
    };
    // Original mark is truth: project the stored anchor (computed at first
    // appearance) onto the new photo, so error can't compound generation
    // after generation. Fresh-anchor chaining below is fallback only.
    // NOTE: projectConcern is not scale-aware (plain offsets) — verify with
    // a close-up + far photo pair before trusting this at mixed distances.
    const storedAnchor = concern.anchor as ConcernAnchor | null;
    const storedUsable =
      newLandmarks != null &&
      (storedAnchor?.refs ?? []).some((r) => newLandmarks[r.key] != null);
    if (storedUsable) {
      const projected = projectConcern(storedAnchor, newLandmarks, coords);
      storedAnchorCount += 1;
      pushCarried(projected.x, projected.y);
      continue;
    }
    // With landmarks on either side the concern is re-projected onto the new
    // capture; without them it carries at its last known coordinates.
    if (!prevLandmarks || !newLandmarks) {
      usedFallbackCoords = true;
      pushCarried(coords.x, coords.y);
      continue;
    }
    const anchor = computeAnchor(coords, prevLandmarks);
    const projected = projectConcern(anchor, newLandmarks, coords);
    if (projected.x === coords.x && projected.y === coords.y) {
      usedFallbackCoords = true;
    }
    freshAnchorCount += 1;
    pushCarried(projected.x, projected.y);
  }
  return {
    carried,
    skipped,
    usedFallbackCoords,
    storedAnchorCount,
    freshAnchorCount,
  };
}

const btnColor = Colors["light"].primary[400];
const txtColor = Colors["light"].neutral[100];
const activeRingColor = "#FFD9A0";

function CircleDot({
  circle,
  active,
  width,
  height,
}: {
  circle: CircleAnnotation;
  active: boolean;
  width: number;
  height: number;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.15, { duration: 800 }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [active, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + 0.5 * pulse.value,
    transform: [{ scale: 1 + 0.45 * pulse.value }],
  }));

  const carried = circle.carriedFrom != null;
  const ringColor = active ? activeRingColor : "#FFFFFF";
  const fill = carried
    ? "rgba(255,255,255,0.16)"
    : circle.status === "labeled"
      ? Colors["light"].primary[400]
      : circle.status === "skipped"
        ? Colors["light"].neutral[500]
        : "rgba(0,0,0,0.5)";

  return (
    <View
      style={{
        position: "absolute",
        left: circle.x * width - DOT_RADIUS,
        top: circle.y * height - DOT_RADIUS,
        width: DOT_SIZE,
        height: DOT_SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {active && (
        <Animated.View
          style={[
            styles.dotGlow,
            {
              backgroundColor: Colors["light"].secondary[300],
              borderRadius: DOT_RADIUS,
            },
            glowStyle,
          ]}
        />
      )}
      <View
        style={[
          styles.dot,
          {
            borderColor: ringColor,
            backgroundColor: fill,
            borderStyle: carried ? "dashed" : "solid",
          },
        ]}
      >
        <ThemedText
          style={{ lineHeight: 14, color: "#FFFFFF", fontSize: 10 }}
          weight="bold"
        >
          {circle.number}
        </ThemedText>
      </View>
    </View>
  );
}

export default function FaceAnnotationScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const {
    draft,
    circles: sharedCircles,
    setCircles: setSharedCircles,
  } = useSkinCapture();

  const [mode, setMode] = useState<"circling" | "labeling">("circling");
  const [circles, setCirclesLocal] = useState<CircleAnnotation[]>(
    sharedCircles ?? [],
  );
  const setCircles = useCallback((next: SetStateAction<CircleAnnotation[]>) => {
    setCirclesLocal(next);
  }, []);
  useEffect(() => {
    setSharedCircles(circles);
  }, [circles, setSharedCircles]);
  const [history, setHistory] = useState<AnnotationAction[]>([]);
  const [sheetSnap, setSheetSnap] = useState<BottomSheetSnap>("peek");
  const [draggingUuid, setDraggingUuid] = useState<string | null>(null);
  // Manually selected circle for relabeling in labeling mode. Validated
  // against live circles on every read so a deleted circle can't stick.
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

  const transform = usePhotoTransform(width, height);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const circlesRef = useRef<CircleAnnotation[]>([]);
  circlesRef.current = circles;
  const screenToNormalizedRef = useRef(transform.screenToNormalized);
  screenToNormalizedRef.current = transform.screenToNormalized;
  const normalizedToScreenRef = useRef(transform.normalizedToScreen);
  normalizedToScreenRef.current = transform.normalizedToScreen;
  const dragStartRef = useRef<{
    uuid: string;
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  useEffect(() => {
    if (!draft) router.back();
  }, [draft]);

  const selectedCircle =
    mode === "labeling" && selectedUuid != null
      ? (circles.find((c) => c.uuid === selectedUuid) ?? null)
      : null;
  const activeCircle =
    mode === "labeling" ? (selectedCircle ?? findNextUnlabeled(circles)) : null;
  const isAllSettled = allSettled(circles);
  const carriedCount = circles.filter(
    (c) => c.carriedFrom && !c.isResolved,
  ).length;
  const resolvedCount = circles.filter((c) => c.isResolved).length;

  const counterText =
    mode === "circling"
      ? `${circles.length === 1 ? "concern" : "concerns"} marked`
      : `${circles.filter((c) => c.status !== "unlabeled").length} of ${circles.length} labeled`;

  const pushHistory = (action: AnnotationAction) =>
    setHistory((h) => [...h, action]);

  const handleUndo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setCircles((prev) => reverseAction(prev, last));
  };

  const placeCircle = (nx: number, ny: number) => {
    const circle: CircleAnnotation = {
      uuid: Crypto.randomUUID(),
      number: 0,
      x: nx,
      y: ny,
      concernId: null,
      status: "unlabeled",
      createdOrder: nextOrder(circlesRef.current),
      carriedFrom: null,
      carriedCreatedAt: null,
      isResolved: false,
      wasDragged: false,
    };
    setCircles((prev) => renumber([...prev, circle]));
    pushHistory({ type: "place", circle });
  };

  const carriedLoadedRef = useRef(false);
  useEffect(() => {
    const bail = (reason: string, extra?: Record<string, unknown>) => {
      if (__DEV__)
        console.log(
          `[face-annotation] carry-forward skipped reason=${reason}`,
          extra ?? "",
        );
    };

    if (!draft) {
      bail("no-draft");
      return;
    }
    if (carriedLoadedRef.current) {
      bail("already-loaded");
      return;
    }
    if (sharedCircles !== null) {
      bail("restored-from-context");
      return;
    }
    const landmarkRefs = draft.landmarks ?? null;
    carriedLoadedRef.current = true;
    let cancelled = false;
    const capturedAt = draft.capturedAt;
    (async () => {
      try {
        const sessions = await getSkinSessions();
        if (cancelled) return;
        const prev = sessions.find(
          (s) =>
            new Date(s.timestamp).getTime() < new Date(capturedAt).getTime(),
        );
        if (!prev) {
          bail("no-prev-session", { sessions: sessions.length });
          return;
        }
        // History-aware sources: the backend only lists origin concerns on
        // each session, so concerns carried *through* prev would be missed
        // if we read prev.concerns alone (e.g. 3rd photo of the day).
        const present = dayEntries(prev.id, allConcerns(sessions));
        const {
          carried,
          skipped,
          usedFallbackCoords,
          storedAnchorCount,
          freshAnchorCount,
        } = carryConcernsFrom(
          prev,
          landmarkRefs,
          present.map((e) => ({ concern: e.concern, coords: e.coords })),
        );
        if (carried.length === 0) {
          bail("carried-zero", {
            prev_session: prev.id,
            concerns: prev.concerns?.length ?? 0,
            present_on_prev: present.length,
            all_concerns: allConcerns(sessions).length,
            skipped: JSON.stringify(skipped),
          });
          return;
        }
        setCircles((existing) => renumber([...carried, ...(existing ?? [])]));
        if (__DEV__)
          console.log(
            "[face-annotation] carry-forward ok",
            `prev_session=${prev.id}`,
            `n=${carried.length}`,
            `present_on_prev=${present.length}`,
            `skipped=${skipped.length}`,
            `fallback_coords=${usedFallbackCoords}`,
            `anchor=stored:${storedAnchorCount}/fresh:${freshAnchorCount}`,
            `new_landmarks=${landmarkRefs ? "yes" : "no"}`,
            `prev_landmarks=${prev.face_landmarks ? "yes" : "no"}`,
            skipped.length ? `skipped_detail=${JSON.stringify(skipped)}` : "",
          );
      } catch (e) {
        bail(`error:${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft]);

  const onCanvasTap = (px: number, py: number) => {
    if (modeRef.current === "labeling") {
      // Relabel selection: tap a circle to make it active, tap empty canvas
      // to fall back to the next unlabeled circle.
      const hit = hitCircleAt(px, py);
      setSelectedUuid(hit ? hit.uuid : null);
      return;
    }
    if (modeRef.current !== "circling") return;
    const scaleValue = transform.scale.value;
    const normalized = screenToNormalizedRef.current(px, py);
    const onExisting = circlesRef.current.some((c) => {
      const s = normalizedToScreenRef.current(c.x, c.y);
      return Math.hypot(s.x - px, s.y - py) < DOT_RADIUS * scaleValue + 8;
    });
    if (onExisting) return;
    placeCircle(normalized.x, normalized.y);
  };

  const onCircleDragStart = (uuid: string, px: number, py: number) => {
    const c = circlesRef.current.find((x) => x.uuid === uuid);
    if (!c) return;
    const finger = screenToNormalizedRef.current(px, py);
    dragStartRef.current = {
      uuid,
      x: c.x,
      y: c.y,
      ox: c.x - finger.x,
      oy: c.y - finger.y,
    };
    setDraggingUuid(uuid);
  };

  const onCircleDragMove = (px: number, py: number) => {
    const start = dragStartRef.current;
    if (!start) return;
    const finger = screenToNormalizedRef.current(px, py);
    setCircles((prev) =>
      renumber(
        prev.map((c) =>
          c.uuid === start.uuid
            ? {
                ...c,
                x: Math.min(1, Math.max(0, finger.x + start.ox)),
                y: Math.min(1, Math.max(0, finger.y + start.oy)),
              }
            : c,
        ),
      ),
    );
  };

  const trashCenter = {
    x: width / 2,
    y: height - PEEK_HEIGHT_CIRCLING - 96,
  };

  const onCircleDragEnd = () => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    setDraggingUuid(null);
    if (!start) return;
    const circle = circlesRef.current.find((x) => x.uuid === start.uuid);
    if (!circle) return;
    const scr = normalizedToScreenRef.current(circle.x, circle.y);
    if (
      Math.hypot(scr.x - trashCenter.x, scr.y - trashCenter.y) < TRASH_RADIUS
    ) {
      if (circle.carriedFrom && !circle.isResolved) {
        pushHistory({ type: "resolve", uuid: circle.uuid });
        setCircles((prev) =>
          renumber(
            prev.map((x) =>
              x.uuid === start.uuid
                ? { ...x, isResolved: true, status: "labeled" }
                : x,
            ),
          ),
        );
        const days = daysBetween(circle.carriedCreatedAt);
        Toast.show({
          type: "success",
          text1: "Concern resolved",
          text2:
            days != null
              ? `Healed in ${days} ${days === 1 ? "day" : "days"}`
              : "Marked as healed",
          position: "bottom",
        });
      } else {
        pushHistory({ type: "delete", circle });
        setCircles((prev) =>
          renumber(prev.filter((x) => x.uuid !== start.uuid)),
        );
      }
    } else if (start.x !== circle.x || start.y !== circle.y) {
      pushHistory({
        type: "move",
        uuid: start.uuid,
        prev: { x: start.x, y: start.y },
      });
      // A user drag is a deliberate correction: flag it so the submitted
      // history entry is stored user_corrected and never flagged for Adjust.
      setCircles((prev) =>
        prev.map((x) =>
          x.uuid === start.uuid ? { ...x, wasDragged: true } : x,
        ),
      );
    }
  };

  const hitCircleAt = (px: number, py: number) =>
    circlesRef.current.find((c) => {
      const s = normalizedToScreenRef.current(c.x, c.y);
      return (
        Math.hypot(s.x - px, s.y - py) < DOT_RADIUS * transform.scale.value + 8
      );
    });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .runOnJS(true)
    .onStart((e) => {
      if (modeRef.current === "circling") {
        const hit = hitCircleAt(e.absoluteX, e.absoluteY);
        if (hit) {
          onCircleDragStart(hit.uuid, e.absoluteX, e.absoluteY);
          return;
        }
      }
      transform.panStart();
    })
    .onUpdate((e) => {
      if (dragStartRef.current) {
        onCircleDragMove(e.absoluteX, e.absoluteY);
        return;
      }
      transform.applyTranslation(e.translationX, e.translationY);
    })
    .onEnd(() => {
      if (dragStartRef.current) onCircleDragEnd();
    })
    .onFinalize((_e, success) => {
      if (!success) {
        dragStartRef.current = null;
        setDraggingUuid(null);
      }
    });

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e, success) => {
      if (!success) return;
      onCanvasTap(e.absoluteX, e.absoluteY);
    });

  const composedGesture = Gesture.Simultaneous(
    transform.pinchGesture,
    panGesture,
    tapGesture,
  );

  const labelActive = (concernId: string) => {
    const target = activeCircle?.uuid;
    if (!target) return;
    setCircles((prev) =>
      renumber(
        prev.map((c) =>
          c.uuid === target ? { ...c, concernId, status: "labeled" } : c,
        ),
      ),
    );
    // A manually selected circle falls back to the next unlabeled one after
    // it is answered, so flow continues forward.
    setSelectedUuid(null);
  };

  const skipActive = () => {
    const target = activeCircle?.uuid;
    if (!target) return;
    setCircles((prev) =>
      renumber(
        prev.map((c) =>
          c.uuid === target ? { ...c, concernId: null, status: "skipped" } : c,
        ),
      ),
    );
    setSelectedUuid(null);
  };

  const handleStartLabeling = () => {
    setMode("labeling");
    setSheetSnap("peek");
  };

  // Back to marking: circles (positions AND labels), history, and drafts are
  // untouched, so nothing is lost in either direction.
  const handleBackToMarking = () => {
    setSelectedUuid(null);
    setMode("circling");
    setSheetSnap("peek");
  };

  const handleContinueToReview = () => {
    setSharedCircles(circles);
    router.push("/(modals)/skin-review");
  };

  const collapsedContent =
    mode === "circling" ? (
      <View style={styles.collapsedIntro}>
        <ThemedText type="body" style={{ color: colors.neutral[600] }}>
          Mark all the concerns you see, label them next
        </ThemedText>

        <ThemedButton
          text={
            circles.length === 0
              ? "Label concerns"
              : `Label ${circles.length} ${circles.length === 1 ? "concern" : "concerns"}`
          }
          color={btnColor}
          disabled={circles.length === 0}
          onPress={handleStartLabeling}
          alignment="stretch"
          rightIconName="arrow-right"
          RightIconComponent={MaterialCommunityIcons}
        />
      </View>
    ) : (
      <View style={styles.collapsedLabelRow}>
        <View style={[styles.collapsedLabel, { flex: 1 }]}>
          <View style={styles.activeTitleRow}>
            <IconButton
              IconComponent={MaterialCommunityIcons}
              iconName="chevron-left"
              iconSize={22}
              iconColor={colors.neutral[600]}
              backgroundColor="transparent"
              onPress={handleBackToMarking}
            />
            <ThemedText
              type="bodyLarge"
              weight="semiBold"
              style={{ flex: 1, textAlign: "center" }}
            >
              {activeCircle
                ? `Label ${activeCircle.number}: what do you see?`
                : "All concerns labeled"}
            </ThemedText>
            <IconButton
              IconComponent={MaterialCommunityIcons}
              iconName="information-outline"
              iconSize={22}
              iconColor={colors.neutral[600]}
              backgroundColor="transparent"
              onPress={() => setSheetSnap("expanded")}
            />
          </View>
          {activeCircle ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {TAXONOMY.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  image={t.circleImageUrl}
                  active={activeCircle?.concernId === t.id}
                  onPress={() => labelActive(t.id)}
                />
              ))}
              <Chip
                label="Other"
                active={activeCircle?.concernId === "other"}
                onPress={() => labelActive("other")}
              />
              <Chip label="Not sure" muted onPress={skipActive} />
            </ScrollView>
          ) : (
            <ThemedText type="caption" style={{ color: colors.neutral[600] }}>
              Tap a circle to edit its label or save your journal entry.
            </ThemedText>
          )}
          {isAllSettled && (
            <ThemedButton
              text="Continue to review"
              onPress={handleContinueToReview}
              color={btnColor}
              alignment="stretch"
              rightIconName="arrow-right"
              RightIconComponent={MaterialCommunityIcons}
            />
          )}
        </View>
      </View>
    );

  const sections = useMemo(
    () => TAXONOMY_GROUPS.map((g) => ({ title: g.label, data: g.items })),
    [],
  );

  const expandedContent =
    mode === "circling" ? (
      <View
        style={[styles.expandedCircling, { paddingBottom: insets.bottom + 16 }]}
      >
        <EntrySteps active="mark" />
        <ThemedText type="h4">Marking concerns</ThemedText>
        <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
          Tap a spot on the photo to drop a numbered pin. Drag pins to nudge
          them, and drag a pin down to the trash to remove it.
        </ThemedText>
        <ThemedButton
          text="Label concerns"
          color={btnColor}
          disabled={circles.length === 0}
          onPress={handleStartLabeling}
          alignment="stretch"
          rightIconName="arrow-right"
          RightIconComponent={MaterialCommunityIcons}
        />
      </View>
    ) : (
      <View style={[styles.expandedPad, { paddingBottom: 0 }]}>
        <View style={styles.expandedHeader}>
          <EntrySteps active="mark" />
          <ThemedButton
            link
            text="Go Back To marking "
            leftIconName="arrow-back"
            LeftIconComponent={MaterialIcons}
            onPress={handleBackToMarking}
            color={colors.secondary[700]}
            alignment="flex-start"
            textType="overline"
          />
          <View style={{ flexDirection: "row" }}>
            <ThemedText type="h4">Skin Concerns Guide</ThemedText>
            <IconButton
              IconComponent={MaterialCommunityIcons}
              iconName="chevron-down"
              iconSize={22}
              iconColor={colors.secondary[800]}
              backgroundColor="transparent"
              onPress={() => setSheetSnap("peek")}
            />
          </View>
          <View style={styles.disclaimer}>
            <ThemedText
              type="captionSmall"
              style={{ color: colors.neutral[600], flex: 1 }}
            >
              {TAXONOMY_DISCLAIMER}
            </ThemedText>
          </View>
          <Divider color={colors.neutral[700]}>
            <ThemedText
              type="captionLarge"
              weight="semiBold"
              style={{
                textAlign: "center",
                paddingHorizontal: 10,
                color: colors.neutral[700],
              }}
            >
              {activeCircle
                ? `Label ${activeCircle.number}`
                : "All concerns labeled"}
            </ThemedText>
          </Divider>
          <ThemedText
            type="captionSmall"
            style={{ color: colors.neutral[700] }}
          >
            {activeCircle
              ? `Identify and label this skin concern as one of the following:`
              : "Tap a circle to edit its label or save your journal entry."}
          </ThemedText>
        </View>
        <SectionList
          style={styles.list}
          sections={sections}
          keyExtractor={(item: Concern) => item.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({
            section,
          }: {
            section: { title: string; data: Concern[] };
          }) => (
            <View style={styles.sectionHeader}>
              <ThemedText type="overline" weight="medium">
                {section.title}
              </ThemedText>
            </View>
          )}
          renderItem={({ item }: { item: Concern }) => (
            <Pressable
              onPress={() => labelActive(item.id)}
              style={({ pressed }) => [
                styles.taxRow,
                pressed && styles.taxRowPressed,
              ]}
            >
              <Image source={item.imageUrl} style={styles.taxImage} />
              <View style={styles.taxText}>
                <ThemedText type="bodySmall" weight="regular">
                  {item.label}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: colors.neutral[600] }}
                  numberOfLines={4}
                >
                  {item.description}
                </ThemedText>
              </View>
              {activeCircle?.concernId === item.id && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={22}
                  color={btnColor}
                />
              )}
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
        />
        <View
          style={[
            styles.expandedFooter,
            {
              paddingBottom: insets.bottom + 150,
              backgroundColor: colors.background,
            },
          ]}
        >
          {activeCircle && (
            <ThemedButton
              outlined
              text="Skip this label"
              onPress={skipActive}
              disabled={!activeCircle}
              color={colors.neutral[700]}
              alignment="stretch"
            />
          )}
          {isAllSettled ? (
            <ThemedButton
              text="Continue to review"
              onPress={handleContinueToReview}
              color={btnColor}
              alignment="stretch"
              rightIconName="arrow-right"
              RightIconComponent={MaterialCommunityIcons}
            />
          ) : (
            <ThemedText
              type="caption"
              style={{ color: colors.neutral[600], textAlign: "center" }}
            >
              Label or skip each circle to finish.
            </ThemedText>
          )}
        </View>
      </View>
    );

  if (!draft) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ThemedText style={{ color: txtColor }} type="bodyLarge">
          No photo yet
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              transform.animatedStyle,
              { transformOrigin: "0 0" },
            ]}
          >
            <Image
              source={{ uri: draft.photoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              transform.animatedStyle,
              { transformOrigin: "0 0" },
            ]}
          >
            {circles
              .filter((c) => !c.isResolved)
              .map((circle) => (
                <CircleDot
                  key={circle.uuid}
                  circle={circle}
                  active={activeCircle?.uuid === circle.uuid}
                  width={width}
                  height={height}
                />
              ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <IconButton
          iconColor={txtColor}
          activeColor={btnColor}
          onPress={() => router.back()}
          IconComponent={MaterialCommunityIcons}
          iconName="close"
        />
        {circles.length > 0 && (
          <View pointerEvents="none" style={{ gap: 2 }}>
            <View style={styles.counterPill}>
              {mode === "circling" && (
                <MaterialCommunityIcons
                  name={
                    `numeric-${circles.length > 9 ? "9-plus" : String(circles.length)}-circle` as React.ComponentProps<
                      typeof MaterialCommunityIcons
                    >["name"]
                  }
                  size={20}
                  color={txtColor}
                />
              )}
              <ThemedText
                style={{ color: txtColor }}
                type="caption"
                weight="semiBold"
              >
                {counterText}
              </ThemedText>
            </View>
            {resolvedCount > 0 && mode === "circling" && (
              <View style={styles.counterPill}>
                <MaterialCommunityIcons
                  name={
                    `numeric-${resolvedCount > 9 ? "9-plus" : String(resolvedCount)}-circle` as React.ComponentProps<
                      typeof MaterialCommunityIcons
                    >["name"]
                  }
                  size={20}
                  color={txtColor}
                />
                <ThemedText
                  style={{ color: txtColor }}
                  type="caption"
                  weight="semiBold"
                >
                  {resolvedCount === 1 ? "concern" : "concerns"} healed
                </ThemedText>
              </View>
            )}
          </View>
        )}
        {mode === "circling" && history.length > 0 && (
          <IconButton
            iconColor={txtColor}
            activeColor={btnColor}
            onPress={handleUndo}
            IconComponent={MaterialCommunityIcons}
            iconName="undo-variant"
          />
        )}
      </View>

      {mode === "circling" && circles.length === 0 && (
        <>
          <View pointerEvents="none" style={styles.instructionBackdrop} />
          <View
            pointerEvents="none"
            style={[styles.instruction, { top: height * 0.3 }]}
          >
            <MaterialCommunityIcons
              name="gesture-tap"
              size={64}
              color="#FFFFFF"
            />
            <ThemedText
              style={{ color: "#FFFFFF" }}
              type="bodyLarge"
              weight="semiBold"
            >
              Tap a spot to mark a concern
            </ThemedText>
          </View>
        </>
      )}

      {mode === "circling" && draggingUuid == null && (
        <View
          pointerEvents="none"
          style={[styles.hintFloat, { bottom: PEEK_HEIGHT_CIRCLING + 12 }]}
        >
          <View
            style={[
              styles.hint,
              { backgroundColor: withAlpha(colors.neutral[100], 0.8) },
            ]}
          >
            <View
              style={[
                styles.hintIcon,
                { backgroundColor: colors.neutral[400] },
              ]}
            >
              <MaterialCommunityIcons
                name="gesture-pinch"
                size={24}
                color="white"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="captionLarge" weight="semiBold">
                How to edit circles
              </ThemedText>
              <ThemedText
                type="captionSmall"
                style={{ color: colors.neutral[700] }}
              >
                Drag a circle to move it. Pinch to zoom. Drag to trash or undo
                to remove circles.{" "}
                {carriedCount > 0
                  ? "Dashed means older concerns. Trash if healed."
                  : null}
              </ThemedText>
            </View>
          </View>
        </View>
      )}

      {draggingUuid != null && (
        <View
          pointerEvents="none"
          style={[
            styles.trashTarget,
            {
              left: trashCenter.x - TRASH_RADIUS,
              top: trashCenter.y - TRASH_RADIUS,
            },
          ]}
        >
          <MaterialCommunityIcons name="delete" size={26} color="#FFFFFF" />
        </View>
      )}

      <BottomSheet
        snap={sheetSnap}
        onSnapChange={setSheetSnap}
        peekHeight={
          mode === "circling" ? PEEK_HEIGHT_CIRCLING : PEEK_HEIGHT_LABELING
        }
        collapsedContent={collapsedContent}
        expandedContent={expandedContent}
        locked={mode === "circling"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  counterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hint: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  hintIcon: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  hintFloat: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  instructionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  instruction: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
  },
  trashTarget: {
    position: "absolute",
    width: TRASH_RADIUS * 2,
    height: TRASH_RADIUS * 2,
    borderRadius: TRASH_RADIUS,
    backgroundColor: "rgba(150,0,40,0.82)",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_RADIUS,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dotGlow: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
  },
  collapsedIntro: {
    gap: 12,
    paddingBottom: 16,
    paddingTop: 4,
  },
  collapsedLabel: {
    gap: 10,
    paddingBottom: 24,
    paddingTop: 4,
  },
  collapsedLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chipScroll: {
    gap: 8,
    paddingRight: 8,
  },
  expandedCircling: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 14,
  },
  expandedPad: {
    flex: 1,
  },
  expandedHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 10,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "transparent",
  },
  list: {
    flex: 1,
    marginBottom: 150,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
    backgroundColor: "transparent",
  },
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  taxRowPressed: {
    opacity: 0.6,
  },
  taxImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  taxText: {
    flex: 1,
    gap: 2,
  },
  listContent: {
    paddingBottom: 170,
  },
  expandedFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
});
