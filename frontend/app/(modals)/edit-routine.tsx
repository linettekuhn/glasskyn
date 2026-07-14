import { useState, useCallback } from "react";
import { useColorScheme, TouchableOpacity, Alert, View } from "react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { getRoutine, deleteRoutine, updateRoutineStep } from "@/api/routines";
import { useProducts } from "@/hooks/use-products";
import type { Routine, StepDisplay } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import RoutineStepEditor from "@/components/ui/routine-step-editor";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

export default function EditRoutineScreen() {
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [localStepOrder, setLocalStepOrder] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { products } = useProducts();

  const [pendingProductChanges, setPendingProductChanges] = useState<
    Map<number, number>
  >(new Map());

  const [pendingOrderChanges, setPendingOrderChanges] = useState<
    Map<number, number>
  >(new Map());

  const setPendingProduct = useCallback((stepId: number, productId: number) => {
    setPendingProductChanges((prev) => {
      const next = new Map(prev);
      next.set(stepId, productId);
      return next;
    });
  }, []);

  const setPendingOrder = useCallback((stepId: number, newOrder: number) => {
    setPendingOrderChanges((prev) => {
      const next = new Map(prev);
      next.set(stepId, newOrder);
      return next;
    });
  }, []);

  const fetchRoutine = useCallback(async () => {
    if (!routineId) return;
    setLoading(true);
    setLocalStepOrder(null);
    setPendingProductChanges(new Map());
    setPendingOrderChanges(new Map());
    try {
      const data = await getRoutine(Number(routineId));
      setRoutine(data);
    } catch {
      setRoutine(null);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useFocusEffect(
    useCallback(() => {
      fetchRoutine();
    }, [fetchRoutine]),
  );

  const enrichedSteps: StepDisplay[] = (() => {
    if (!routine) return [];
    return routine.steps.map((s) => {
      const pendingProductId = pendingProductChanges.get(s.id);
      const effectiveProductId = pendingProductId ?? s.product_id;
      const product = effectiveProductId
        ? products.find((p) => p.id === effectiveProductId)
        : null;
      return {
        id: s.id,
        step_order: s.step_order,
        step_type: s.step_type,
        time_of_day: s.time_of_day,
        product_id: effectiveProductId,
        product_name: product?.name ?? null,
      };
    });
  })();

  const sortedSteps = (() => {
    if (localStepOrder) {
      const orderMap = new Map(localStepOrder.map((id, i) => [id, i]));
      return [...enrichedSteps].sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );
    }
    return [...enrichedSteps].sort((a, b) => a.step_order - b.step_order);
  })();

  const handleDragEnd = (timeOfDay: "AM" | "PM", newOrder: StepDisplay[]) => {
    const reordered = newOrder.map((s, i) => ({ ...s, step_order: i + 1 }));
    reordered.forEach((s) => setPendingOrder(s.id, s.step_order));

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
  };

  const handleDone = async () => {
    if (!routineId) return;
    setSaving(true);
    try {
      const promises: Promise<void>[] = [];
      pendingOrderChanges.forEach((newOrder, stepId) => {
        promises.push(
          updateRoutineStep(Number(routineId), stepId, {
            step_order: newOrder,
          }),
        );
      });
      pendingProductChanges.forEach((productId, stepId) => {
        promises.push(
          updateRoutineStep(Number(routineId), stepId, {
            product_id: productId,
          }),
        );
      });
      await Promise.all(promises).catch(() => {});
    } finally {
      setSaving(false);
      router.dismissAll();
      router.replace("/(main)/routine");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Routine",
      `Delete "${routine?.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRoutine(Number(routineId));
              router.dismissAll();
            } catch {
              // toast shown by interceptor
            }
          },
        },
      ],
    );
  };

  return (
    <RoutineStepEditor
      title="Edit Routine"
      subtitle="Reorder steps or swap products from your shelf"
      steps={sortedSteps}
      loading={loading}
      notFound={!routine && !loading}
      notFoundMessage="Routine not found"
      productPickerReturnTo="/(modals)/edit-routine"
      productPickerExtraParam={{ key: "routineId", value: routineId ?? "" }}
      onDragEnd={handleDragEnd}
      bottomBar={
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.background,
            },
          ]}
        >
          <ThemedButton
            text="Done"
            onPress={handleDone}
            disabled={saving}
            loading={saving}
            color={colors.primary[600]}
          />
          <ThemedButton
            link
            text="Delete Routine"
            leftIconName="delete-outline"
            LeftIconComponent={MaterialCommunityIcons}
            onPress={handleDelete}
            color={colors.neutral[800]}
          />
        </View>
      }
    />
  );
}

const styles = {
  deleteButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  bottomBar: {
    gap: 12,
    paddingHorizontal: 24,
  },
};
