import { useEffect, useState } from "react";
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
  formatRemaining,
  formatTime,
  type SpfState,
} from "@/lib/spf-state";

export interface SpfModalProps {
  visible: boolean;
  state: SpfState;
  remainingMs: number | null;
  lastAppliedAt: Date | null;
  intervalMin: number;
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
  intervalMin,
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

  const statusText =
    state === "fresh" && remainingMs != null
      ? `Protected · reapply in ${formatRemaining(remainingMs)}`
      : state === "due"
        ? "Protection has worn off · reapply now"
        : state === "idle"
          ? "No application logged yet today"
          : state === "resting"
            ? "Outside sun hours · done for today"
            : state === "indoors"
              ? "Marked as staying in today"
              : lastAppliedAt != null
                ? `Last applied ${formatTime(lastAppliedAt)}`
                : "Sunscreen";

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

                  <ThemedText
                    type="caption"
                    style={{ color: colors.neutral[600] }}
                  >
                    {statusText}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: colors.neutral[600] }}
                  >
                    {todayCount === 1
                      ? "1 application today"
                      : `${todayCount} applications today`}
                  </ThemedText>

                  <ThemedText type="bodyLarge" weight="semiBold">
                    Reapply every
                  </ThemedText>
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

                  {indoorsToday ? (
                    <>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.neutral[600] }}
                      >
                        You&apos;re marked as staying in today, so no
                        reapply countdown is running.
                      </ThemedText>
                      <ThemedButton
                        text="Undo"
                        textType="caption"
                        onPress={() => {
                          void clearIndoors();
                        }}
                        outlined
                        color={colors.primary[500]}
                        alignment="flex-start"
                      />
                    </>
                  ) : (
                    <>
                      <ThemedText type="bodyLarge" weight="semiBold">
                        Staying inside?
                      </ThemedText>
                      <ThemedButton
                        text="Staying in today"
                        textType="caption"
                        onPress={() => {
                          void setIndoors();
                        }}
                        outlined
                        color={colors.primary[500]}
                        alignment="flex-start"
                      />
                    </>
                  )}

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
  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
});
