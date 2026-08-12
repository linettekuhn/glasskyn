import { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getPreferences, savePreferences } from "@/api/preferences";
import { getWaterIntake, setWaterIntake } from "@/api/water";
import type { Units, UserPreference } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedDropdown from "@/components/ui/themed-dropdown";
import ThemedButton from "@/components/ui/themed-button";
import GlassSurface, { withAlpha } from "@/components/ui/glass-surface";
import Divider from "./ui/divider";
import CelebrationBurst from "./routine/celebration-burst";
import { LinearGradient } from "expo-linear-gradient";

const INFO_SUBTITLE =
  "Hydration from within helps skin stay plump and resilient.";
const GOAL_MET_MESSAGE = "You're fully hydrated for today";

const OZ_TO_ML = 29.5735;
const LB_TO_KG = 0.45359237;

const ACTIVITY_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Moderate", value: "moderate" },
  { label: "Active", value: "active" },
];

const CLIMATE_OPTIONS = [
  { label: "Temperate", value: "temperate" },
  { label: "Hot", value: "hot" },
];

function mlToOz(ml: number): number {
  return ml / OZ_TO_ML;
}

function ozToMl(oz: number): number {
  return Math.round(oz * OZ_TO_ML);
}

function lbToKg(lb: number): number {
  return lb * LB_TO_KG;
}

function kgToLb(kg: number): number {
  return kg / LB_TO_KG;
}

function roundTo10(ml: number): number {
  return Math.round(ml / 10) * 10;
}

function recommendedOz(
  weightLb: number,
  activity: string | null,
  climate: string | null,
): number {
  const base = weightLb * 0.5;
  const activityBonus =
    activity === "moderate" ? 8 : activity === "active" ? 16 : 0;
  const climateBonus = climate === "hot" ? 8 : 0;
  return Math.max(0, Math.round(base + activityBonus + climateBonus));
}

export default function WaterIntakeCard() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [intakeMl, setIntakeMl] = useState(0);
  const [undoStack, setUndoStack] = useState<number[]>([]);
  const undoStackRef = useRef<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState(237);
  const celebratedRef = useRef(false);
  const [burstActive, setBurstActive] = useState(false);
  const [loadTick, setLoadTick] = useState(0);

  const [weightDraft, setWeightDraft] = useState("");
  const [debouncedWeight, setDebouncedWeight] = useState("");
  const [activity, setActivity] = useState<string | null>(null);
  const [climate, setClimate] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalAutoTracked, setGoalAutoTracked] = useState(false);

  const units: Units = prefs?.units ?? "imperial";
  const isMetric = units === "metric";

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getPreferences(), getWaterIntake()])
        .then(([pref, intake]) => {
          if (!active) return;
          setPrefs(pref);
          setIntakeMl(intake.ml);
          undoStackRef.current = [];
          setUndoStack([]);
          if (pref.water_weight_lb != null) {
            const weightDisplay =
              pref.units === "metric"
                ? lbToKg(pref.water_weight_lb)
                : pref.water_weight_lb;
            const rounded = Math.round(weightDisplay * 10) / 10;
            setWeightDraft(String(rounded));
            setDebouncedWeight(String(rounded));
          }
          setActivity(pref.water_activity_level);
          setClimate(pref.water_climate);
          celebratedRef.current = false;
        })
        .catch(() => {})
        .finally(() => {
          if (active) {
            setLoaded(true);
            setLoadTick((t) => t + 1);
          }
        });
      return () => {
        active = false;
      };
    }, []),
  );

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

  const goalMl = prefs?.water_goal_ml ?? 0;
  const isFirstTime = prefs != null && goalMl <= 0;
  const goalMet = goalMl > 0 && intakeMl >= goalMl;
  const progress = goalMl > 0 ? Math.min(1, intakeMl / goalMl) : 0;
  const percent = Math.round(progress * 100);

  const accent = goalMet ? colors.tertiary[600] : colors.secondary[500];

  const displayMl = (ml: number) =>
    isMetric ? `${ml}ml` : `${Math.round(mlToOz(ml))}oz`;

  const formatRecommended = (ml: number) =>
    isMetric ? String(roundTo10(ml)) : String(Math.round(mlToOz(ml)));

  useEffect(() => {
    if (goalAutoTracked && recommendedMl != null) {
      setGoalDraft(formatRecommended(recommendedMl));
    }
  }, [goalAutoTracked, recommendedMl, isMetric]);

  useEffect(() => {
    if (!loaded) return;
    if (!goalMet) {
      celebratedRef.current = false;
      setBurstActive(false);
      return;
    }
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    setBurstActive(true);
    const timer = setTimeout(() => setBurstActive(false), 1600);
    return () => clearTimeout(timer);
  }, [goalMet, loadTick, loaded]);

  const openCalculator = useCallback(() => {
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
  }, [goalMl, isMetric, recommendedMl]);

  const addMl = useCallback(
    async (amountMl: number) => {
      const next = Math.max(0, intakeMl + amountMl);
      undoStackRef.current = [...undoStackRef.current.slice(-19), intakeMl];
      setUndoStack(undoStackRef.current);
      setIntakeMl(next);
      setCustomOpen(false);
      try {
        const result = await setWaterIntake(next);
        setIntakeMl(result.ml);
      } catch {
        try {
          const result = await getWaterIntake();
          setIntakeMl(result.ml);
        } catch {}
      }
    },
    [intakeMl],
  );

  const undoLastMl = useCallback(async () => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setUndoStack(undoStackRef.current);
    setIntakeMl(previous);
    setCustomOpen(false);
    try {
      const result = await setWaterIntake(previous);
      setIntakeMl(result.ml);
    } catch {
      try {
        const result = await getWaterIntake();
        setIntakeMl(result.ml);
      } catch {}
    }
  }, []);

  const onSaveGoal = useCallback(async () => {
    const parsed = Math.round(parseFloat(goalDraft) || 0);
    const goalValueMl =
      parsed > 0 ? (isMetric ? parsed : Math.round(parsed * OZ_TO_ML)) : 0;
    const payload = {
      water_goal_ml: goalValueMl,
      water_weight_lb: weightLb,
      water_activity_level: activity,
      water_climate: climate,
    };
    setSaving(true);
    try {
      const updated = await savePreferences(payload);
      setPrefs(updated);
      setGoalDraft(
        updated.water_goal_ml != null
          ? isMetric
            ? String(updated.water_goal_ml)
            : String(Math.round(mlToOz(updated.water_goal_ml)))
          : String(goalValueMl),
      );
      setGoalAutoTracked(false);
      setGoalOpen(false);
    } catch {
    } finally {
      setSaving(false);
    }
  }, [goalDraft, isMetric, weightLb, activity, climate]);

  if (!loaded) {
    return null;
  }

  const quickAddOptions = isMetric
    ? [
        { label: "+250ml", ml: 250 },
        { label: "+500ml", ml: 500 },
      ]
    : [
        { label: "+8oz", ml: ozToMl(8) },
        { label: "+16oz", ml: ozToMl(16) },
      ];

  return (
    <GlassSurface style={styles.card}>
      {goalMet && (
        <LinearGradient
          colors={[colors.neutral[100], colors.neutral[200]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
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
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={undoLastMl}
            disabled={undoStack.length === 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.iconButton,
              undoStack.length === 0 && styles.iconButtonDisabled,
            ]}
          >
            <MaterialCommunityIcons
              name="undo-variant"
              size={20}
              color={colors.neutral[600]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setGoalOpen((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.iconButton}
          >
            <MaterialCommunityIcons
              name="cog-outline"
              size={20}
              color={colors.neutral[600]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {goalMet ? (
        <ThemedText type="bodySmall" style={{ color: colors.primary[600] }}>
          {GOAL_MET_MESSAGE}
        </ThemedText>
      ) : (
        <ThemedText type="captionSmall" style={{ color: colors.neutral[600] }}>
          {INFO_SUBTITLE}
        </ThemedText>
      )}

      {isFirstTime ? (
        <View style={styles.firstTimeRow}>
          <ThemedText type="bodyLarge" weight="semiBold">
            Set a daily water goal
          </ThemedText>
          <ThemedText type="caption" style={{ color: colors.neutral[600] }}>
            Get a personalized target in under a minute
          </ThemedText>
          <ThemedButton
            text="Set goal"
            onPress={openCalculator}
            alignment="flex-start"
            color={colors.primary[500]}
          />
        </View>
      ) : (
        <>
          <View style={styles.progressHeader}>
            <ThemedText type="caption" style={{ color: colors.neutral[600] }}>
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

          <View style={styles.quickAddRow}>
            {quickAddOptions.map((option) => (
              <ThemedButton
                text={option.label}
                textType="caption"
                key={option.label}
                onPress={() => addMl(option.ml)}
                outlined
              />
            ))}
            <ThemedButton
              text="Custom"
              textType="caption"
              onPress={() => {
                setCustomMl(isMetric ? 250 : ozToMl(8));
                setCustomOpen((v) => !v);
              }}
              outlined
            />
          </View>

          {customOpen && (
            <View
              style={[
                styles.stepperRow,
                {
                  backgroundColor: withAlpha(colors.neutral[100], 0.5),
                  borderColor: colors.neutral[200],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() =>
                  setCustomMl((v) => Math.max(1, v - (isMetric ? 50 : 30)))
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
                {displayMl(customMl)}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setCustomMl((v) => v + (isMetric ? 50 : 30))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={20}
                  color={colors.primary[600]}
                />
              </TouchableOpacity>
              <ThemedButton
                text="Add"
                onPress={() => addMl(customMl)}
                outlined
                textType="caption"
                alignment="auto"
              />
            </View>
          )}
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
          <ThemedText type="overline" style={{ color: colors.neutral[600] }}>
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
                Estimate a goal based on your weight, activity level, and
                climate.
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

      {burstActive && <CelebrationBurst color={colors.tertiary[600]} />}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconButton: {
    padding: 4,
  },
  iconButtonDisabled: {
    opacity: 0.4,
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
  quickAddRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
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
