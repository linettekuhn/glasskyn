import { useEffect, useMemo, useRef, useState } from "react";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
} from "@/utils/anchor";
import { useSkinCapture, type SkinLandmarkRefs } from "@/contexts/SkinCaptureContext";
import { usePhotoTransform } from "@/hooks/use-photo-transform";
import { submitSkinCheckIn, getSkinSessions } from "@/api/skin";
import type {
  AnnotationAction,
  Concern,
  CircleAnnotation,
  SkinCheckInPayload,
  SkinSessionOut,
} from "@/types";

const DOT_SIZE = 24;
const DOT_RADIUS = DOT_SIZE / 2;
const TRASH_RADIUS = 32;
const PEEK_HEIGHT = 178;

const MS_PER_DAY = 86400000;

function daysBetween(fromIso: string | null | undefined): number | null {
  if (!fromIso) return null;
  const start = new Date(fromIso).getTime();
  if (!Number.isFinite(start)) return null;
  return Math.max(1, Math.floor((Date.now() - start) / MS_PER_DAY));
}

function carryConcernsFrom(
  prev: SkinSessionOut,
  newLandmarks: SkinLandmarkRefs,
): CircleAnnotation[] {
  const carried: CircleAnnotation[] = [];
  for (const concern of prev.concerns ?? []) {
    if (!concern.uuid) continue;
    if (!concern.label) continue;
    if (concern.resolved_session_id != null) continue;
    const coords = lastSeenCoords(concern);
    if (!coords) continue;
    const anchor = computeAnchor(coords, prev.face_landmarks);
    const projected = projectConcern(anchor, newLandmarks, coords);
    carried.push({
      uuid: concern.uuid,
      number: 0,
      x: projected.x,
      y: projected.y,
      concernId: concern.label,
      status: "labeled",
      createdOrder: 0,
      carriedFrom: concern.uuid,
      carriedCreatedAt: concern.created_at,
      isResolved: false,
    });
  }
  return carried;
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
  const { draft, setDraft } = useSkinCapture();

  const [mode, setMode] = useState<"circling" | "labeling">("circling");
  const [circles, setCircles] = useState<CircleAnnotation[]>([]);
  const [history, setHistory] = useState<AnnotationAction[]>([]);
  const [sheetSnap, setSheetSnap] = useState<BottomSheetSnap>("peek");
  const [draggingUuid, setDraggingUuid] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const activeCircle = mode === "labeling" ? findNextUnlabeled(circles) : null;
  const isAllSettled = allSettled(circles);
  const carriedCount = circles.filter(
    (c) => c.carriedFrom && !c.isResolved,
  ).length;
  const resolvedCount = circles.filter((c) => c.isResolved).length;

  const counterText =
    mode === "circling"
      ? `${circles.length} ${circles.length === 1 ? "concern" : "concerns"} marked`
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
    };
    setCircles((prev) => renumber([...prev, circle]));
    pushHistory({ type: "place", circle });
  };

  const carriedLoadedRef = useRef(false);
  useEffect(() => {
    if (!draft || carriedLoadedRef.current) return;
    const landmarkRefs = draft.landmarks;
    if (!landmarkRefs) return;
    carriedLoadedRef.current = true;
    let cancelled = false;
    const capturedAt = draft.capturedAt;
    (async () => {
      try {
        const sessions = await getSkinSessions();
        if (cancelled) return;
        const prev = sessions.find(
          (s) => new Date(s.timestamp).getTime() < new Date(capturedAt).getTime(),
        );
        if (!prev || !prev.face_landmarks) return;
        const carried = carryConcernsFrom(prev, landmarkRefs);
        if (cancelled || carried.length === 0) return;
        setCircles((existing) =>
          renumber([...carried, ...(existing ?? [])]),
        );
        if (__DEV__)
          console.log(
            "[face-annotation] carried over",
            `prev_session=${prev.id}`, `n=${carried.length}`,
          );
      } catch (e) {
        if (__DEV__)
          console.warn(
            "[face-annotation] carry-forward failed",
            e instanceof Error ? e.message : String(e),
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft]);

  const onCanvasTap = (px: number, py: number) => {
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

  const trashCenter = { x: width / 2, y: height - PEEK_HEIGHT - 96 };

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
  };

  const handleStartLabeling = () => {
    setMode("labeling");
    setSheetSnap("expanded");
  };

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: SkinCheckInPayload = {
        photo_uri: draft?.photoUri ?? null,
        captured_at: draft?.capturedAt ?? null,
        face_landmarks: draft?.landmarks ?? null,
        concerns: circles.map((c) => ({
          uuid: c.uuid,
          number: c.number,
          x: c.x,
          y: c.y,
          concern_id: c.concernId,
          status: c.status,
          carried_uuid: c.carriedFrom,
          resolved: c.isResolved,
        })),
      };
      const result = await submitSkinCheckIn(payload);
      if (__DEV__) {
        getSkinSessions()
          .then((sessions) =>
            console.log(
              "[skin] round-trip: session",
              result.session_id,
              "returned",
              sessions.length,
              "session(s)",
            ),
          )
          .catch((e) =>
            console.warn("[skin] round-trip list failed", e?.message ?? e),
          );
      }
      const keptCarried = circles.filter(
        (c) => c.carriedFrom && !c.isResolved,
      ).length;
      const healed = circles.filter((c) => c.isResolved).length;
      const fresh = circles.filter((c) => !c.carriedFrom).length;
      const parts = [
        fresh > 0 ? `${fresh} new` : null,
        keptCarried > 0 ? `${keptCarried} carried` : null,
        healed > 0 ? `${healed} healed` : null,
      ].filter(Boolean);
      Toast.show({
        type: "success",
        text1: "Check-in saved",
        text2:
          parts.length > 0
            ? parts.join(" · ")
            : `${circles.length} ${circles.length === 1 ? "concern" : "concerns"} recorded`,
        position: "bottom",
      });
      setDraft(null);
      router.back();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Could not save",
        text2: e instanceof Error ? e.message : String(e),
        position: "bottom",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const collapsedContent =
    mode === "circling" ? (
      <View style={styles.collapsedIntro}>
        <ThemedText type="caption" style={{ color: colors.neutral[600] }}>
          Mark the concerns you can see first, then label them all in one pass.
        </ThemedText>
        {carriedCount > 0 && (
          <ThemedText
            type="caption"
            weight="semiBold"
            style={{ color: colors.neutral[600] }}
          >
            {carriedCount}{" "}
            {carriedCount === 1 ? "concern has" : "concerns have"} been carried
            over from your last check-in — dashed circles. Drag a carried
            circle to the trash to mark it healed.
          </ThemedText>
        )}
        {resolvedCount > 0 && (
          <ThemedText
            type="caption"
            weight="semiBold"
            style={{ color: colors.success[500] }}
          >
            {"\u2713"} {resolvedCount}{" "}
            {resolvedCount === 1 ? "concern" : "concerns"} healed this session
          </ThemedText>
        )}
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
      <View style={styles.collapsedLabel}>
        <View style={styles.activeTitleRow}>
          <ThemedText type="bodyLarge" weight="semiBold">
            {activeCircle
              ? `Circle ${activeCircle.number} — what do you see?`
              : "All circles answered"}
          </ThemedText>
        </View>
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
          <Chip label="Not sure / skip" muted onPress={skipActive} />
        </ScrollView>
        {isAllSettled && (
          <ThemedButton
            text="Save check-in"
            onPress={handleSave}
            loading={submitting}
            disabled={submitting}
            color={btnColor}
            alignment="stretch"
            leftIconName="check"
            LeftIconComponent={MaterialCommunityIcons}
          />
        )}
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
          <ThemedText type="h4">Concern guide</ThemedText>
          <View style={styles.disclaimer}>
            <MaterialCommunityIcons
              name="information-outline"
              size={16}
              color={colors.neutral[600]}
            />
            <ThemedText
              type="captionSmall"
              style={{ color: colors.neutral[600], flex: 1 }}
            >
              {TAXONOMY_DISCLAIMER}
            </ThemedText>
          </View>
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
              <ThemedText type="overline" weight="semiBold">
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
                <ThemedText type="bodySmall" weight="semiBold">
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
              paddingBottom: insets.bottom + 12,
              backgroundColor: colors.background,
            },
          ]}
        >
          <ThemedButton
            outlined
            text="Not sure / skip this circle"
            onPress={skipActive}
            disabled={!activeCircle}
            color={colors.neutral[700]}
            alignment="stretch"
          />
          {isAllSettled ? (
            <ThemedButton
              text="Save check-in"
              onPress={handleSave}
              loading={submitting}
              disabled={submitting}
              color={btnColor}
              alignment="stretch"
              leftIconName="check"
              LeftIconComponent={MaterialCommunityIcons}
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
        <View style={{ flex: 1 }} />
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

      {circles.length > 0 && (
        <View
          pointerEvents="none"
          style={[styles.counterWrap, { top: insets.top + 62 }]}
        >
          <View style={styles.counterPill}>
            <MaterialCommunityIcons
              name={
                mode === "labeling"
                  ? "label-outline"
                  : "circle-multiple-outline"
              }
              size={14}
              color={txtColor}
            />
            <ThemedText
              style={{ color: txtColor }}
              type="caption"
              weight="semiBold"
            >
              {counterText}
            </ThemedText>
          </View>
        </View>
      )}

      {mode === "circling" && circles.length === 0 && (
        <View
          pointerEvents="none"
          style={[styles.instruction, { top: height * 0.3 }]}
        >
          <MaterialCommunityIcons
            name="gesture-tap"
            size={28}
            color="#FFFFFF"
          />
          <ThemedText
            style={{ color: "#FFFFFF" }}
            type="bodyLarge"
            weight="semiBold"
          >
            Tap a spot to mark a concern
          </ThemedText>
          <ThemedText
            style={{ color: "#FFFFFF", opacity: 0.75 }}
            type="caption"
          >
            Pinch to zoom • drag a circle to move it
          </ThemedText>
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
        peekHeight={PEEK_HEIGHT}
        collapsedContent={collapsedContent}
        expandedContent={expandedContent}
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
    alignItems: "center",
    gap: 10,
  },
  counterWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
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
  instruction: {
    position: "absolute",
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
    paddingBottom: 16,
    paddingTop: 4,
  },
  activeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
