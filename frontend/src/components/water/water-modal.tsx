import { useEffect, useRef, useState } from "react";
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
import GlassSurface, { withAlpha } from "@/components/ui/glass-surface";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedDropdown from "@/components/ui/themed-dropdown";
import ThemedButton from "@/components/ui/themed-button";
import Divider from "@/components/ui/divider";
import { Colors, getTheme } from "@/constants/theme";
import type { UserPreference } from "@/types";
import type { SaveGoalPayload } from "@/hooks/use-water-intake";
import {
  kgToLb,
  lbToKg,
  mlToOz,
  ozToMl,
  recommendedOz,
  roundTo10,
} from "@/lib/water-units";

export interface WaterModalProps {
  visible: boolean;
  expandCalculator: boolean;
  isMetric: boolean;
  prefs: UserPreference | null;
  intakeMl: number;
  goalMl: number;
  percent: number;
  goalMet: boolean;
  isFirstTime: boolean;
  incrementMl: number;
  displayMl: (ml: number) => string;
  saveGoal: (payload: SaveGoalPayload) => Promise<boolean>;
  saveIncrement: (ml: number) => Promise<void>;
  reset: () => Promise<void>;
  onClose: () => void;
}

const ACTIVITY_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Moderate", value: "moderate" },
  { label: "Active", value: "active" },
];

const CLIMATE_OPTIONS = [
  { label: "Temperate", value: "temperate" },
  { label: "Hot", value: "hot" },
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

export default function WaterModal({
  visible,
  expandCalculator,
  isMetric,
  prefs,
  intakeMl,
  goalMl,
  percent,
  goalMet,
  isFirstTime,
  incrementMl,
  displayMl,
  saveGoal,
  saveIncrement,
  reset,
  onClose,
}: WaterModalProps) {
  const colors = Colors[getTheme(useColorScheme())];
  const insets = useSafeAreaInsets();
  const windowH = Dimensions.get("window").height;

  const [rendered, setRendered] = useState(visible);
  const [goalOpen, setGoalOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weightDraft, setWeightDraft] = useState("");
  const [debouncedWeight, setDebouncedWeight] = useState("");
  const [activity, setActivity] = useState<string | null>(null);
  const [climate, setClimate] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalAutoTracked, setGoalAutoTracked] = useState(false);
  const [incrementDraft, setIncrementDraft] = useState(incrementMl);
  const incrementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    const timer = setTimeout(() => setRendered(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    return () => {
      if (incrementTimer.current) clearTimeout(incrementTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const storedWeight = prefs?.water_weight_lb ?? null;
    if (storedWeight != null) {
      const weightDisplay =
        prefs?.units === "metric" ? lbToKg(storedWeight) : storedWeight;
      const rounded = Math.round(weightDisplay * 10) / 10;
      setWeightDraft(String(rounded));
      setDebouncedWeight(String(rounded));
    } else {
      setWeightDraft("");
      setDebouncedWeight("");
    }
    const storedActivity = prefs?.water_activity_level ?? null;
    const storedClimate = prefs?.water_climate ?? null;
    setActivity(storedActivity);
    setClimate(storedClimate);
    setIncrementDraft(incrementMl);
    if (expandCalculator) {
      setGoalOpen(true);
      const storedGoal = prefs?.water_goal_ml ?? 0;
      if (storedGoal > 0) {
        setGoalAutoTracked(false);
        setGoalDraft(
          isMetric
            ? String(storedGoal)
            : String(Math.round(mlToOz(storedGoal))),
        );
        setCalculatorOpen(false);
      } else {
        setGoalAutoTracked(true);
        setCalculatorOpen(true);
        if (storedWeight != null && storedWeight > 0) {
          const rec = ozToMl(
            recommendedOz(storedWeight, storedActivity, storedClimate),
          );
          setGoalDraft(
            isMetric ? String(roundTo10(rec)) : String(Math.round(mlToOz(rec))),
          );
        } else {
          setGoalDraft("");
        }
      }
    } else {
      setGoalOpen(false);
      setCalculatorOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedWeight(weightDraft), 500);
    return () => clearTimeout(timer);
  }, [weightDraft]);

  const weightNum = parseFloat(debouncedWeight);
  const hasWeight = Number.isFinite(weightNum) && weightNum > 0;
  const weightLb = hasWeight
    ? isMetric
      ? kgToLb(weightNum)
      : weightNum
    : null;
  const recommendedMl = weightLb
    ? ozToMl(recommendedOz(weightLb, activity, climate))
    : null;

  const accent = goalMet ? colors.tertiary[600] : colors.secondary[500];

  const formatRecommended = (ml: number) =>
    isMetric ? String(roundTo10(ml)) : String(Math.round(mlToOz(ml)));

  useEffect(() => {
    if (goalAutoTracked && recommendedMl != null) {
      setGoalDraft(formatRecommended(recommendedMl));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalAutoTracked, recommendedMl, isMetric]);

  const openCalculator = () => {
    setGoalOpen(true);
    if (goalMl > 0) {
      setGoalAutoTracked(false);
      setGoalDraft(
        isMetric ? String(goalMl) : String(Math.round(mlToOz(goalMl))),
      );
    } else {
      setGoalAutoTracked(true);
      if (recommendedMl != null) {
        setGoalDraft(formatRecommended(recommendedMl));
      }
    }
  };

  const onSaveGoal = async () => {
    const parsed = Math.round(parseFloat(goalDraft) || 0);
    const goalValueMl = parsed > 0 ? (isMetric ? parsed : ozToMl(parsed)) : 0;
    setSaving(true);
    const ok = await saveGoal({
      water_goal_ml: goalValueMl,
      water_weight_lb: weightLb,
      water_activity_level: activity,
      water_climate: climate,
    });
    if (ok) {
      setGoalDraft(
        isMetric
          ? String(goalValueMl)
          : String(Math.round(mlToOz(goalValueMl))),
      );
      setGoalAutoTracked(false);
      setGoalOpen(false);
    }
    setSaving(false);
  };

  const incrementStep = isMetric ? 50 : ozToMl(1);
  const incrementMin = isMetric ? 50 : ozToMl(1);
  const incrementMax = 1000;
  const incrementPresets = isMetric
    ? [
        { label: "250ml", ml: 250 },
        { label: "500ml", ml: 500 },
      ]
    : [
        { label: "8oz", ml: ozToMl(8) },
        { label: "12oz", ml: ozToMl(12) },
        { label: "16oz", ml: ozToMl(16) },
      ];

  const commitIncrement = (ml: number) => {
    const clamped = Math.max(incrementMin, Math.min(incrementMax, ml));
    setIncrementDraft(clamped);
    if (incrementTimer.current) clearTimeout(incrementTimer.current);
    incrementTimer.current = setTimeout(() => {
      void saveIncrement(clamped);
    }, 400);
  };

  const confirmReset = () => {
    Alert.alert(
      "Reset today's water?",
      "This sets today's intake back to 0. You can undo it from the home tile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void reset();
          },
        },
      ],
    );
  };

  const maxH = Math.min(
    windowH * 0.85,
    windowH - insets.top - insets.bottom - 32,
  );

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
          accessibilityLabel="Close water settings"
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
                        name={goalMet ? "water-check" : "water-outline"}
                        size={22}
                        color={accent}
                      />
                      <ThemedText type="bodyLarge" weight="semiBold">
                        Water intake
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      onPress={onClose}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Close water settings"
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={22}
                        color={colors.neutral[600]}
                      />
                    </TouchableOpacity>
                  </View>

                  {isFirstTime ? (
                    !goalOpen && (
                    <View style={styles.firstTimeRow}>
                      <ThemedText type="bodyLarge" weight="semiBold">
                        Set a daily water goal
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.neutral[600] }}
                      >
                        Get a personalized target in under a minute
                      </ThemedText>
                      <ThemedButton
                        text="Set goal"
                        onPress={openCalculator}
                        alignment="flex-start"
                        color={colors.primary[500]}
                      />
                    </View>
                    )
                  ) : (
                    <>
                      <View style={styles.progressHeader}>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.neutral[600] }}
                        >
                          {`${displayMl(intakeMl)} of ${displayMl(goalMl)} today`}
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
                            { backgroundColor: accent, width: `${percent}%` },
                          ]}
                        />
                      </View>
                    </>
                  )}

                  {goalOpen && (
                    <View
                      style={[
                        styles.calculator,
                        {
                          backgroundColor: withAlpha(colors.neutral[100], 0.5),
                          borderColor: colors.neutral[200],
                        },
                      ]}
                    >
                      <ThemedText type="bodyLarge" weight="semiBold">
                        Set your daily water intake goal
                      </ThemedText>
                      <ThemedText
                        type="overline"
                        style={{ color: colors.neutral[600] }}
                      >
                        {isMetric ? "Goal (ml/day)" : "Goal (oz/day)"}
                      </ThemedText>
                      <ThemedTextInput
                        value={goalDraft}
                        onChangeText={(text) => {
                          setGoalAutoTracked(false);
                          setGoalDraft(text);
                        }}
                        keyboardType="numeric"
                        placeholder={
                          recommendedMl != null
                            ? formatRecommended(recommendedMl)
                            : isMetric
                              ? "e.g. 2000"
                              : "e.g. 64"
                        }
                      />

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          alignSelf: "center",
                          width: "100%",
                        }}
                      >
                        <ThemedText type="caption">Not sure?</ThemedText>
                        <ThemedButton
                          link
                          textType="caption"
                          onPress={() => setCalculatorOpen((v) => !v)}
                          color={colors.secondary[700]}
                          text="Try a calculator"
                        />
                      </View>

                      <ThemedButton
                        text={saving ? "Saving…" : "Save goal"}
                        onPress={onSaveGoal}
                        loading={saving}
                        color={colors.primary[500]}
                      />

                      {calculatorOpen && (
                        <>
                          <Divider />

                          <ThemedText type="bodyLarge" weight="semiBold">
                            Calculator
                          </ThemedText>
                          <ThemedText
                            type="captionSmall"
                            style={{ color: colors.neutral[600] }}
                          >
                            Estimate a goal based on your weight, activity
                            level, and climate.
                          </ThemedText>

                          <ThemedText
                            type="overline"
                            style={{ color: colors.neutral[600] }}
                          >
                            {isMetric ? "Weight (kg)" : "Weight (lb)"}
                          </ThemedText>
                          <ThemedTextInput
                            value={weightDraft}
                            onChangeText={setWeightDraft}
                            keyboardType="numeric"
                            placeholder={isMetric ? "e.g. 55" : "e.g. 120"}
                          />

                          <ThemedText
                            type="overline"
                            style={{ color: colors.neutral[600] }}
                          >
                            Activity level
                          </ThemedText>
                          <ThemedDropdown
                            options={ACTIVITY_OPTIONS}
                            value={activity}
                            onChange={setActivity}
                            placeholder="Select activity level"
                          />

                          <ThemedText
                            type="overline"
                            style={{ color: colors.neutral[600] }}
                          >
                            Climate
                          </ThemedText>
                          <ThemedDropdown
                            options={CLIMATE_OPTIONS}
                            value={climate}
                            onChange={setClimate}
                            placeholder="Select climate"
                          />

                          {recommendedMl != null && (
                            <ThemedText
                              type="bodyLarge"
                              weight="semiBold"
                              style={{ color: colors.secondary[600] }}
                            >
                              {isMetric
                                ? `Recommended: ${roundTo10(recommendedMl)}ml/day`
                                : `Recommended: ${Math.round(mlToOz(recommendedMl))}oz/day`}
                            </ThemedText>
                          )}
                        </>
                      )}
                    </View>
                  )}

                  {!isFirstTime && (
                    <>
                      <ThemedText type="bodyLarge" weight="semiBold">
                        Amount per tap
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.neutral[600] }}
                      >
                        How much water each tap of + on the tile adds.
                      </ThemedText>
                      <View style={styles.chipRow}>
                        {incrementPresets.map((preset) => (
                          <ThemedButton
                            key={preset.label}
                            text={preset.label}
                            textType="caption"
                            onPress={() => commitIncrement(preset.ml)}
                            outlined={incrementDraft !== preset.ml}
                            color={colors.primary[500]}
                          />
                        ))}
                      </View>
                      <View
                        style={[
                          styles.stepperRow,
                          {
                            backgroundColor: withAlpha(
                              colors.neutral[100],
                              0.5,
                            ),
                            borderColor: colors.neutral[200],
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            commitIncrement(incrementDraft - incrementStep)
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons
                            name="minus"
                            size={20}
                            color={colors.primary[600]}
                          />
                        </TouchableOpacity>
                        <ThemedText type="bodyLarge" weight="semiBold">
                          {displayMl(incrementDraft)}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() =>
                            commitIncrement(incrementDraft + incrementStep)
                          }
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={20}
                            color={colors.primary[600]}
                          />
                        </TouchableOpacity>
                      </View>
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
  firstTimeRow: {
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
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  calculator: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
});
