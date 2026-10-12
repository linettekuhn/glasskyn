import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import GlassSurface, { withAlpha } from "@/components/ui/glass-surface";
import { ThemedText } from "@/components/ui/themed-text";
import CelebrationBurst from "@/components/routine/celebration-burst";
import { Colors, getTheme } from "@/constants/theme";
import { formatRemaining, formatTime, type SpfState } from "@/lib/spf-state";

export interface SpfPreviewProps {
  loaded: boolean;
  state: SpfState;
  remainingMs: number | null;
  intervalMs: number;
  lastAppliedAt: Date | null;
  todayCount: number;
  canUndo: boolean;
  burstActive: boolean;
  goalMet: boolean;
  apply: () => Promise<void>;
  undo: () => Promise<void>;
  onPress: () => void;
  highlight?: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export default function SpfPreview({
  loaded,
  state,
  remainingMs,
  intervalMs,
  lastAppliedAt,
  todayCount,
  canUndo,
  burstActive,
  goalMet,
  apply,
  undo,
  onPress,
  highlight = false,
}: SpfPreviewProps) {
  const colors = Colors[getTheme(useColorScheme())];
  const [tileH, setTileH] = useState(0);

  const fillH = useSharedValue(0);
  const pulse = useSharedValue(1);

  // Drain once from the current fraction down to zero over the remaining
  // time. Re-running on ticker updates restarts from the same fraction, so
  // there is no visible jump.
  useEffect(() => {
    if (
      state === "fresh" &&
      remainingMs != null &&
      remainingMs > 0 &&
      intervalMs > 0 &&
      tileH > 0
    ) {
      fillH.value = clamp01(remainingMs / intervalMs) * tileH;
      fillH.value = withTiming(0, {
        duration: remainingMs,
        easing: Easing.linear,
      });
    } else {
      fillH.value = withTiming(0, { duration: 300 });
    }
  }, [state, remainingMs, intervalMs, tileH, fillH]);

  useEffect(() => {
    if (state === "due") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 900 }),
          withTiming(1, { duration: 900 }),
        ),
        -1,
        true,
      );
    } else if (highlight) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 180 }),
          withTiming(1, { duration: 180 }),
        ),
        2,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [state, highlight, pulse]);

  const fillStyle = useAnimatedStyle(() => ({ height: fillH.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const accent = goalMet ? colors.tertiary[600] : colors.secondary[600];
  const quiet = state === "indoors";

  const centerText =
    state === "fresh" && remainingMs != null
      ? `Reapply in ${formatRemaining(remainingMs)}`
      : state === "due"
        ? "Reapply now"
        : state === "idle"
          ? "Tap + to apply"
          : state === "resting"
            ? "SPF done today"
            : state === "indoors"
              ? "Staying indoors"
              : lastAppliedAt != null
                ? `Last applied ${formatTime(lastAppliedAt)}`
                : "Sunscreen";

  const iconName =
    state === "resting"
      ? "star-check"
      : state === "indoors"
        ? "home-outline"
        : goalMet
          ? "shield-check"
          : state === "due"
            ? "sun-clock"
            : "shield-sun";

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void apply();
  };

  return (
    <View
      style={styles.square}
      onLayout={(e: LayoutChangeEvent) => setTileH(e.nativeEvent.layout.height)}
    >
      {!loaded ? (
        <GlassSurface style={styles.fill}>
          <View style={styles.center}>
            <ActivityIndicator color={colors.neutral[600]} />
          </View>
        </GlassSurface>
      ) : (
        <Animated.View style={[styles.fill, pulseStyle]}>
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Sunscreen, ${centerText}. Opens settings`}
            style={styles.fill}
          >
            <GlassSurface style={styles.fill}>
              {goalMet && (
                <LinearGradient
                  pointerEvents="none"
                  colors={[colors.neutral[100], colors.neutral[200]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.sunFill,
                  {
                    backgroundColor: goalMet
                      ? withAlpha(colors.tertiary[600], 0.5)
                      : withAlpha(colors.tertiary[500], 0.4),
                  },
                  fillStyle,
                ]}
              />
              <View pointerEvents="none" style={styles.topLabels}>
                {state === "due" ? (
                  <ThemedText
                    type="caption"
                    weight="semiBold"
                    style={{ color: accent, textAlign: "center" }}
                  >
                    {centerText}
                  </ThemedText>
                ) : (
                  <ThemedText
                    type="caption"
                    style={{
                      color: colors.neutral[600],
                      textAlign: "center",
                    }}
                  >
                    {centerText}
                  </ThemedText>
                )}
              </View>
              <View
                pointerEvents="none"
                style={[styles.center, quiet && styles.dimmed]}
              >
                <MaterialCommunityIcons
                  name={iconName}
                  size={52}
                  color={quiet ? colors.neutral[600] : accent}
                />
              </View>
            </GlassSurface>
          </Pressable>

          <Pressable
            onPress={() => {
              void undo();
            }}
            disabled={!canUndo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Undo last sunscreen application"
            style={[styles.controlLeft, !canUndo && styles.disabled]}
          >
            <View
              style={[
                styles.circleButton,
                {
                  backgroundColor: withAlpha(colors.background, 0.7),
                  borderColor: colors.neutral[200],
                },
              ]}
            >
              <MaterialCommunityIcons
                name="undo-variant"
                size={20}
                color={colors.neutral[600]}
              />
            </View>
          </Pressable>

          <Pressable
            onPress={handleAdd}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Log sunscreen application now"
            style={styles.controlRight}
          >
            <View
              style={[
                styles.circleButton,
                styles.emphasis,
                {
                  backgroundColor: withAlpha(colors.background, 0.7),
                  borderColor: colors.neutral[200],
                },
              ]}
            >
              <MaterialCommunityIcons
                name="plus"
                size={20}
                color={colors.neutral[600]}
              />
            </View>
          </Pressable>

          {burstActive && <CelebrationBurst color={colors.tertiary[600]} />}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    aspectRatio: 1,
    width: "100%",
  },
  fill: {
    flex: 1,
  },
  sunFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  topLabels: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    gap: 2,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  dimmed: {
    opacity: 0.6,
  },
  controlLeft: {
    position: "absolute",
    left: 10,
    bottom: 10,
  },
  controlRight: {
    position: "absolute",
    right: 10,
    bottom: 10,
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  emphasis: {
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.4,
  },
});
