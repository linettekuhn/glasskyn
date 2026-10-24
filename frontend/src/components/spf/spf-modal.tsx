import { ComponentProps, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Keyframe } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GlassSurface from "@/components/ui/glass-surface";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import Divider from "@/components/ui/divider";
import { Colors, getTheme } from "@/constants/theme";
import {
  computeTodayTotal,
  formatRemaining,
  formatTime,
  localDateString,
  type SpfState,
} from "@/lib/spf-state";

export interface SpfModalProps {
  visible: boolean;
  state: SpfState;
  remainingMs: number | null;
  lastAppliedAt: Date | null;
  firstAppliedAt: Date | null;
  intervalMin: number;
  windowEndMin: number;
  todayCount: number;
  indoorsToday: boolean;
  saveInterval: (min: number) => Promise<void>;
  setIndoors: () => Promise<void>;
  clearIndoors: () => Promise<void>;
  resetToday: () => Promise<void>;
  onClose: () => void;
}

const INTERVAL_PRESETS = [
  { label: "1.5h", min: 90 },
  { label: "2h", min: 120 },
  { label: "3h", min: 180 },
];

const LOCATION_OPTIONS = [
  { label: "Out & About", isIndoors: false, iconName: "weather-sunny" },
  { label: "Staying In", isIndoors: true, iconName: "home-outline" },
];

const EXIT_MS = 220;

const panelEnter = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -16 }, { scale: 0.96 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(250);

const panelExit = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -16 }, { scale: 0.96 }] },
}).duration(EXIT_MS);

export default function SpfModal({
  visible,
  state,
  remainingMs,
  lastAppliedAt,
  firstAppliedAt,
  intervalMin,
  windowEndMin,
  todayCount,
  indoorsToday,
  saveInterval,
  setIndoors,
  clearIndoors,
  resetToday,
  onClose,
}: SpfModalProps) {
  const colors = Colors[getTheme(useColorScheme())];
  const insets = useSafeAreaInsets();
  const windowH = Dimensions.get("window").height;

  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    const timer = setTimeout(() => setRendered(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  const maxH = Math.min(
    windowH * 0.85,
    windowH - insets.top - insets.bottom - 32,
  );

  const accent = colors.tertiary[600];

  const todayTotal = computeTodayTotal(
    firstAppliedAt,
    windowEndMin,
    intervalMin,
  );
  const percent =
    firstAppliedAt != null
      ? Math.min(100, Math.round((todayCount / todayTotal) * 100))
      : 0;

  const appliedToday =
    lastAppliedAt != null &&
    localDateString(lastAppliedAt) === localDateString(new Date());

  const baseText =
    state === "fresh" && remainingMs != null
      ? `Protected for ${formatRemaining(remainingMs)}`
      : state === "due"
        ? "Unprotected. Reapply"
        : state === "idle"
          ? "No application today"
          : state === "resting"
            ? appliedToday
              ? "No more needed today"
              : "Past sun hours"
            : state === "indoors"
              ? "Indoors today"
              : "Sunscreen";

  const statusText =
    appliedToday && lastAppliedAt != null
      ? state === "lapsed"
        ? `Last applied ${formatTime(lastAppliedAt)}`
        : `${baseText}. Applied ${formatTime(lastAppliedAt)}`
      : baseText;

  const confirmReset = () => {
    Alert.alert(
      "Reset today's sunscreen?",
      "This clears today's applications. You can undo it from the home tile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetToday();
          },
        },
      ],
    );
  };

  const handleLocationChange = (isIndoors: boolean) => {
    if (isIndoors) {
      void setIndoors();
    } else {
      void clearIndoors();
    }
  };

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <BlurView
          intensity={30}
          tint="default"
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sunscreen settings"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheet}
        >
          {visible && (
            <Animated.View entering={panelEnter} exiting={panelExit}>
              <GlassSurface style={[styles.panel, { maxHeight: maxH }]}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.body}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                      <MaterialCommunityIcons
                        name="white-balance-sunny"
                        size={22}
                        color={accent}
                      />
                      <ThemedText type="bodyLarge" weight="semiBold">
                        Sun protection
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      onPress={onClose}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Close sunscreen settings"
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={22}
                        color={colors.neutral[600]}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 8 }}>
                    {firstAppliedAt != null && (
                      <>
                        <View style={styles.progressHeader}>
                          <ThemedText
                            type="caption"
                            style={{ color: colors.neutral[600] }}
                          >
                            {`${todayCount} of ${todayTotal} application${todayCount > 1 ? "s" : ""} today`}
                          </ThemedText>
                          <ThemedText
                            type="overline"
                            weight="semiBold"
                            style={{ color: accent }}
                          >
                            {`${percent}%`}
                          </ThemedText>
                        </View>
                        <View
                          style={[
                            styles.progressTrack,
                            { backgroundColor: colors.neutral[200] },
                          ]}
                        >
                          <View
                            style={[
                              styles.progressFill,
                              {
                                backgroundColor: accent,
                                width: `${percent}%`,
                              },
                            ]}
                          />
                        </View>
                      </>
                    )}
                    <ThemedText
                      type="caption"
                      style={{ color: colors.neutral[600] }}
                    >
                      {statusText}
                    </ThemedText>
                  </View>

                  <View>
                    <ThemedText type="bodyLarge" weight="semiBold">
                      Reapply interval
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: colors.neutral[600] }}
                    >
                      How often to prompt a reapplication reminder.
                    </ThemedText>
                  </View>

                  <View style={styles.chipRow}>
                    {INTERVAL_PRESETS.map((preset) => (
                      <ThemedButton
                        key={preset.label}
                        text={preset.label}
                        textType="caption"
                        onPress={() => {
                          void saveInterval(preset.min);
                        }}
                        outlined={intervalMin !== preset.min}
                        color={colors.primary[500]}
                      />
                    ))}
                  </View>

                  <View>
                    <ThemedText type="bodyLarge" weight="semiBold">
                      Sun exposure
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: colors.neutral[600] }}
                    >
                      Staying in? Disable SPF reminders while inside.
                    </ThemedText>
                  </View>

                  <GlassSurface style={styles.segmentContainer}>
                    {LOCATION_OPTIONS.map((option) => {
                      const selected = indoorsToday === option.isIndoors;
                      return (
                        <TouchableOpacity
                          key={option.label}
                          activeOpacity={0.7}
                          style={[
                            styles.segmentOption,
                            {
                              backgroundColor: selected
                                ? colors.secondary[300]
                                : "transparent",
                            },
                          ]}
                          onPress={() => handleLocationChange(option.isIndoors)}
                        >
                          <MaterialCommunityIcons
                            name={
                              option.iconName as ComponentProps<
                                typeof MaterialCommunityIcons
                              >["name"]
                            }
                            size={20}
                            color={selected ? colors.text : colors.neutral[600]}
                          />
                          <ThemedText
                            type="bodySmall"
                            weight={selected ? "medium" : "light"}
                            style={{
                              color: selected
                                ? colors.text
                                : colors.neutral[600],
                            }}
                          >
                            {option.label}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </GlassSurface>

                  <Divider />

                  <ThemedButton
                    text="Reset today"
                    onPress={confirmReset}
                    color={colors.error}
                  />
                </ScrollView>
              </GlassSurface>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  panel: {
    padding: 20,
  },
  body: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 12,
    overflow: "hidden",
  },
  segment: {
    flexDirection: "row",
    overflow: "hidden",
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
});
