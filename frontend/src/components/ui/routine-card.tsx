import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import type { Routine, Product } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { FREQUENCY_LABELS } from "@/constants/routine";
import { markStepComplete } from "@/api/routines";
import { ThemedText } from "./themed-text";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import DayNightToggle from "./day-night-toggle";
import ThemedButton from "./themed-button";
import IconButton from "./icon-button";

const STEP_TYPE_LABELS: Record<string, string> = {
  cleanse: "Cleanse",
  tone: "Tone",
  treat: "Treat",
  moisturize: "Moisturize",
  spf: "SPF",
  other: "Other",
};

interface RoutineCardProps {
  routine: Routine;
  productMap: Map<number, Product>;
  onCompletionChange?: () => void;
}

export default function RoutineCard({
  routine,
  productMap,
  onCompletionChange,
}: RoutineCardProps) {
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<"AM" | "PM">("AM");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  useEffect(() => {
    setCompletedSteps(
      new Set(routine.steps.filter((s) => s.completed_today).map((s) => s.id)),
    );
  }, [routine.steps]);

  const filteredSteps = useMemo(() => {
    return routine.steps
      .filter((s) => s.time_of_day === selectedTimeOfDay)
      .sort((a, b) => a.step_order - b.step_order);
  }, [routine.steps, selectedTimeOfDay]);

  const toggleStep = useCallback(
    (id: number) => {
      const nowCompleted = !completedSteps.has(id);
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        if (nowCompleted) next.add(id);
        else next.delete(id);
        return next;
      });
      markStepComplete(routine.id, id, nowCompleted)
        .catch(() => {
          setCompletedSteps((prev) => {
            const next = new Set(prev);
            if (nowCompleted) next.delete(id);
            else next.add(id);
            return next;
          });
        })
        .finally(() => onCompletionChange?.());
    },
    [completedSteps, routine.id, onCompletionChange],
  );

  const toggleAll = useCallback(() => {
    const allChecked =
      filteredSteps.length > 0 &&
      filteredSteps.every((s) => completedSteps.has(s.id));
    const desired = !allChecked;
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      for (const s of filteredSteps) {
        if (desired) next.add(s.id);
        else next.delete(s.id);
      }
      return next;
    });
    const ops = filteredSteps.map((s) =>
      markStepComplete(routine.id, s.id, desired).catch(() => {
        setCompletedSteps((prev) => {
          const next = new Set(prev);
          if (desired) next.delete(s.id);
          else next.add(s.id);
          return next;
        });
      }),
    );
    Promise.allSettled(ops).finally(() => onCompletionChange?.());
  }, [completedSteps, filteredSteps, routine.id, onCompletionChange]);

  const allChecked =
    filteredSteps.length > 0 &&
    filteredSteps.every((s) => completedSteps.has(s.id));

  if (filteredSteps.length === 0 && !routine.steps.length) {
    return (
      <View style={styles.emptySteps}>
        <ThemedText type="bodyLarge" style={{ color: colors.neutral[500] }}>
          No steps in this routine yet
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.neutral[200] }]}>
      <View style={styles.cardHeader}>
        <ThemedText type="h3" italic numberOfLines={1}>
          {routine.name}
        </ThemedText>
        <View style={styles.cardHeaderControls}>
          <DayNightToggle
            value={selectedTimeOfDay === "AM"}
            onValueChange={(am) => setSelectedTimeOfDay(am ? "AM" : "PM")}
          />
          <View
            style={{
              flexDirection: "row",
              gap: 4,
            }}
          >
            <IconButton
              onPress={toggleAll}
              IconComponent={MaterialCommunityIcons}
              iconName={
                allChecked
                  ? "checkbox-multiple-blank-circle-outline"
                  : "checkbox-multiple-marked-circle"
              }
              iconSize={24}
              iconColor={colors.primary[600]}
              backgroundColor="rgba(0,0,0,0.2)"
            />
            <IconButton
              onPress={() =>
                router.push({
                  pathname: "/(modals)/edit-routine",
                  params: { routineId: routine.id },
                })
              }
              IconComponent={MaterialIcons}
              iconName="edit"
              iconSize={24}
              iconColor={colors.primary[600]}
              backgroundColor="rgba(0,0,0,0.2)"
            />
          </View>
        </View>
      </View>
      <FlatList
        data={filteredSteps}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => {
          const isChecked = completedSteps.has(item.id);
          const productName = item.product_id
            ? productMap.get(item.product_id)?.name
            : null;
          return (
            <TouchableOpacity
              style={styles.stepCard}
              onPress={() => toggleStep(item.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={
                  isChecked
                    ? "checkbox-marked-circle"
                    : "checkbox-blank-circle-outline"
                }
                size={20}
                color={isChecked ? colors.primary[600] : colors.neutral[500]}
                style={{ marginTop: 4 }}
              />
              <View>
                <ThemedText type="bodyLarge" weight="semiBold">
                  {index + 1}.{" "}
                  {STEP_TYPE_LABELS[item.step_type] || item.step_type}
                  {item.frequency
                    ? ` ${FREQUENCY_LABELS[item.frequency] ?? item.frequency}`
                    : ""}
                </ThemedText>
                {productName && <ThemedText>with {productName}</ThemedText>}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
  },
  cardHeader: {
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardHeaderControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  listContent: {
    gap: 12,
    paddingBottom: 40,
  },
  emptySteps: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
