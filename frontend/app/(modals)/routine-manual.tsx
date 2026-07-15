import { useState, useCallback } from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import { Octicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedButton from "@/components/ui/themed-button";
import RoutineStepEditor from "@/components/ui/routine-step-editor";
import { useTemplateSelection } from "@/contexts/TemplateContext";
import { useProducts } from "@/hooks/use-products";
import { createRoutine } from "@/api/routines";
import type { StepDisplay } from "@/types";

export default function ManualRoutineScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const {
    pendingProductChanges,
    pendingAddStep,
    clearPendingAddStep,
    clearPendingChanges,
  } = useTemplateSelection();
  const { products } = useProducts();

  const [routineName, setRoutineName] = useState("");
  const [localSteps, setLocalSteps] = useState<StepDisplay[]>([]);
  const [nextTempId, setNextTempId] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [localStepOrder, setLocalStepOrder] = useState<number[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (pendingAddStep) {
        const { stepType, frequency, timeOfDay, productId } = pendingAddStep;
        const sameTimeSteps = localSteps.filter(
          (s) => s.time_of_day === timeOfDay,
        );
        const product = productId
          ? products.find((p) => p.id === productId)
          : null;

        const newStep: StepDisplay = {
          id: nextTempId,
          step_order: sameTimeSteps.length + 1,
          step_type: stepType,
          time_of_day: timeOfDay,
          product_id: productId,
          product_name: product?.name ?? null,
          frequency,
        };

        setLocalSteps((prev) => [...prev, newStep]);
        setNextTempId((prev) => prev - 1);
        clearPendingAddStep();
      }
    }, [pendingAddStep, clearPendingAddStep, localSteps, nextTempId, products]),
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        clearPendingChanges();
      };
    }, [clearPendingChanges]),
  );

  const enrichedSteps: StepDisplay[] = (() => {
    const base = localSteps.map((s) => {
      const pendingProductId = pendingProductChanges.get(s.id);
      const product = pendingProductId
        ? products.find((p) => p.id === pendingProductId)
        : null;
      return {
        ...s,
        product_id: pendingProductId ?? s.product_id,
        product_name: product?.name ?? s.product_name,
        frequency: s.frequency ?? null,
      };
    });
    if (localStepOrder) {
      const orderMap = new Map(localStepOrder.map((id, i) => [id, i]));
      return [...base].sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );
    }
    return base;
  })();

  const handleDragEnd = (timeOfDay: "AM" | "PM", newOrder: StepDisplay[]) => {
    const reordered = newOrder.map((s, i) => ({ ...s, step_order: i + 1 }));

    const amIds = enrichedSteps
      .filter((s) => s.time_of_day === "AM")
      .map((s) => s.id);
    const pmIds = enrichedSteps
      .filter((s) => s.time_of_day === "PM")
      .map((s) => s.id);

    if (timeOfDay === "AM") {
      setLocalStepOrder([
        ...reordered.map((s) => s.id),
        ...pmIds.filter((id) => !reordered.some((r) => r.id === id)),
      ]);
    } else {
      setLocalStepOrder([
        ...amIds.filter((id) => !reordered.some((r) => r.id === id)),
        ...reordered.map((s) => s.id),
      ]);
    }

    setLocalSteps((prev) => {
      const steps = [...prev];
      reordered.forEach((s) => {
        const idx = steps.findIndex((x) => x.id === s.id);
        if (idx !== -1)
          steps[idx] = { ...steps[idx], step_order: s.step_order };
      });
      return steps;
    });
  };

  const handleOpenAddStep = (timeOfDay: "AM" | "PM") => {
    router.push({
      pathname: "/(modals)/add-step",
      params: { timeOfDay },
    });
  };

  const handleDeleteStep = (id: number) => {
    setLocalSteps((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      return filtered.map((s, i) => ({ ...s, step_order: i + 1 }));
    });
    setLocalStepOrder(null);
  };

  const handleFinishRoutine = async () => {
    if (!routineName.trim() || localSteps.length === 0) return;
    setSaving(true);
    try {
      const steps = enrichedSteps.map((s, i) => ({
        step_order: i + 1,
        step_type: s.step_type,
        time_of_day: s.time_of_day,
        product_id: s.product_id ?? null,
        frequency: s.frequency ?? "daily",
      }));

      await createRoutine({
        name: routineName.trim(),
        source: "manual",
        routine_type: "skincare",
        steps,
      });

      clearPendingChanges();
      router.dismissAll();
      router.replace("/(main)/routine");
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <View style={styles.inputWrapper}>
      <ThemedText
        type="caption"
        weight="bold"
        style={{ color: colors.primary[700] }}
      >
        ROUTINE NAME
      </ThemedText>
      <ThemedTextInput
        value={routineName}
        onChangeText={setRoutineName}
        placeholder="e.g. My Skincare"
        autoCapitalize="words"
      />
    </View>
  );

  return (
    <RoutineStepEditor
      title="Manually Create"
      subtitle="Build your routine step by step"
      steps={enrichedSteps}
      loading={false}
      productPickerReturnTo="/(modals)/routine-manual"
      onDragEnd={handleDragEnd}
      onDeleteStep={handleDeleteStep}
      onAddStep={handleOpenAddStep}
      headerContent={headerContent}
      bottomBar={
        <ThemedButton
          text="Finish Routine"
          onPress={handleFinishRoutine}
          disabled={saving || !routineName.trim() || localSteps.length === 0}
          loading={saving}
          RightIconComponent={Octicons}
          rightIconName="arrow-right"
          color={colors.primary[600]}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    gap: 8,
  },
});
