import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, useColorScheme, Alert } from "react-native";
import { Octicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { ThemedText } from "./themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedTextInput from "./themed-text-input";
import ThemedButton from "./themed-button";
import RoutineStepEditor from "./routine-step-editor";
import { useTemplateSelection } from "@/contexts/TemplateContext";
import { useProducts } from "@/hooks/use-products";
import type { StepDisplay, StepType, Frequency, TimeOfDay } from "@/types";

export interface RoutineFormStep {
  step_order: number;
  step_type: StepType;
  time_of_day: TimeOfDay;
  product_id: number | null;
  frequency: Frequency;
}

export interface RoutineFormSubmit {
  name: string;
  steps: RoutineFormStep[];
}

interface RoutineFormProps {
  title: string;
  subtitle: string;
  loading?: boolean;
  notFound?: boolean;
  notFoundMessage?: string;
  initialName?: string;
  initialSteps?: StepDisplay[] | null;
  productPickerReturnTo: string;
  productPickerExtraParam?: { key: string; value: string };
  onSubmit: (payload: RoutineFormSubmit) => void | Promise<void>;
  onSaved?: () => void;
  submitLabel: string;
  bottomBarExtra?: React.ReactNode;
  saveOnBack?: boolean;
  onGoBack?: () => void;
  rightIconName?: React.ComponentProps<typeof Octicons>["name"];
  RightIconComponent?: typeof Octicons;
}

export default function RoutineForm({
  title,
  subtitle,
  loading = false,
  notFound,
  notFoundMessage,
  initialName = "",
  initialSteps = null,
  productPickerReturnTo,
  productPickerExtraParam,
  onSubmit,
  onSaved,
  submitLabel,
  bottomBarExtra,
  saveOnBack = false,
  onGoBack,
  rightIconName,
  RightIconComponent,
}: RoutineFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const {
    pendingProductChanges,
    pendingAddStep,
    clearPendingAddStep,
    clearPendingChanges,
  } = useTemplateSelection();
  const { products } = useProducts();

  const [routineName, setRoutineName] = useState(initialName);
  const [localSteps, setLocalSteps] = useState<StepDisplay[]>(initialSteps ?? []);
  const [nextTempId, setNextTempId] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [localStepOrder, setLocalStepOrder] = useState<number[] | null>(null);

  useEffect(() => {
    if (loading) return;
    setRoutineName(initialName);
    setLocalSteps(initialSteps ?? []);
    setLocalStepOrder(null);
    setNextTempId(-1);
  }, [loading, initialSteps, initialName]);

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
      const effectiveProductId = pendingProductId ?? s.product_id;
      const product = effectiveProductId
        ? products.find((p) => p.id === effectiveProductId)
        : null;
      return {
        ...s,
        product_id: effectiveProductId,
        product_name: product?.name ?? s.product_name ?? null,
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

  const handleSubmit = async (notify = true) => {
    if (!routineName.trim() || enrichedSteps.length === 0) return;
    setSaving(true);
    try {
      const steps: RoutineFormStep[] = enrichedSteps.map((s, i) => ({
        step_order: i + 1,
        step_type: s.step_type,
        time_of_day: s.time_of_day,
        product_id: s.product_id ?? null,
        frequency: s.frequency ?? "daily",
      }));
      await onSubmit({ name: routineName.trim(), steps });
      if (notify) onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = async () => {
    const leave = () => (onGoBack ? onGoBack() : router.back());

    if (saveOnBack) {
      await handleSubmit(false);
      leave();
      return;
    }

    if (routineName.trim() || localSteps.length > 0) {
      Alert.alert(
        "Discard Routine",
        "Discard this routine draft? Your changes won't be saved.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: leave },
        ],
      );
      return;
    }

    leave();
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

  const submitDisabled =
    saving || !routineName.trim() || enrichedSteps.length === 0;

  const bottomBar = (
    <>
      {bottomBarExtra}
      <ThemedButton
        text={submitLabel}
        onPress={handleSubmit}
        disabled={submitDisabled}
        loading={saving}
        RightIconComponent={RightIconComponent}
        rightIconName={rightIconName}
        color={colors.primary[600]}
      />
    </>
  );

  return (
    <RoutineStepEditor
      title={title}
      subtitle={subtitle}
      steps={enrichedSteps}
      loading={loading}
      notFound={notFound}
      notFoundMessage={notFoundMessage}
      productPickerReturnTo={productPickerReturnTo}
      productPickerExtraParam={productPickerExtraParam}
      onDragEnd={handleDragEnd}
      onDeleteStep={handleDeleteStep}
      onAddStep={handleOpenAddStep}
      headerContent={headerContent}
      onGoBack={handleGoBack}
      bottomBar={bottomBarExtra ? <View style={styles.bottomBar}>{bottomBar}</View> : bottomBar}
    />
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    gap: 8,
  },
  bottomBar: {
    gap: 12,
  },
});
