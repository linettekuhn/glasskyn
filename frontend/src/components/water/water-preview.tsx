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

export interface WaterPreviewProps {
  loaded: boolean;
  intakeMl: number;
  goalMl: number;
  progress: number;
  percent: number;
  goalMet: boolean;
  isFirstTime: boolean;
  incrementMl: number;
  canUndo: boolean;
  burstActive: boolean;
  displayMl: (ml: number) => string;
  add: (ml: number) => Promise<void>;
  undo: () => Promise<void>;
  onPress: () => void;
  onAddWhenNoGoal: () => void;
  highlight?: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export default function WaterPreview({
  loaded,
  intakeMl,
  goalMl,
  progress,
  percent,
  goalMet,
  isFirstTime,
  incrementMl,
  canUndo,
  burstActive,
  displayMl,
  add,
  undo,
  onPress,
  onAddWhenNoGoal,
  highlight = false,
}: WaterPreviewProps) {
  const colors = Colors[getTheme(useColorScheme())];
  const [tileH, setTileH] = useState(0);

  const fillH = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    fillH.value = withTiming(clamp01(progress) * tileH, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, tileH, fillH]);

  useEffect(() => {
    if (highlight) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 180 }),
          withTiming(1, { duration: 180 }),
        ),
        2,
      );
    }
  }, [highlight, pulse]);

  const fillStyle = useAnimatedStyle(() => ({ height: fillH.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const accent = goalMet ? colors.tertiary[600] : colors.primary[600];

  const tileLabel = isFirstTime
    ? "Water intake, no goal set. Opens goal settings"
    : `Water intake, ${percent} percent of daily goal. Opens settings`;

  const handleAdd = () => {
    if (isFirstTime) {
      onAddWhenNoGoal();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void add(incrementMl);
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
            accessibilityLabel={tileLabel}
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
                  styles.waterFill,
                  {
                    backgroundColor: goalMet
                      ? withAlpha(colors.tertiary[600], 0.5)
                      : withAlpha(colors.primary[500], 0.4),
                  },
                  fillStyle,
                ]}
              />
              <View pointerEvents="none" style={styles.topLabels}>
                {!isFirstTime && (
                  <ThemedText
                    type="captionSmall"
                    numberOfLines={1}
                    style={{ color: colors.neutral[600], textAlign: "center" }}
                  >
                    {`${displayMl(intakeMl)} / ${displayMl(goalMl)}`}
                  </ThemedText>
                )}
              </View>
              <View pointerEvents="none" style={styles.center}>
                <MaterialCommunityIcons
                  name={goalMet ? "water-check" : "cup-water"}
                  size={52}
                  color={accent}
                />
                {isFirstTime && (
                  <ThemedText
                    type="caption"
                    style={{ color: colors.neutral[600] }}
                  >
                    Set goal
                  </ThemedText>
                )}
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
            accessibilityLabel="Undo last water entry"
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
            accessibilityLabel={`Add ${displayMl(incrementMl)} of water`}
            style={styles.controlRight}
          >
            <View
              style={[
                styles.addPill,
                {
                  backgroundColor: withAlpha(colors.background, 0.7),
                  borderColor: colors.neutral[200],
                },
              ]}
            >
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color={colors.neutral[600]}
              />
              {!isFirstTime && (
                <ThemedText
                  type="captionSmall"
                  numberOfLines={1}
                  style={{ color: colors.neutral[600] }}
                >
                  {`+${displayMl(incrementMl)}`}
                </ThemedText>
              )}
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
  waterFill: {
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
  addPill: {
    height: 36,
    minWidth: 36,
    maxWidth: 110,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
  },
  disabled: {
    opacity: 0.4,
  },
});
