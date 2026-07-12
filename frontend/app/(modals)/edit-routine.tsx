import { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { getRoutine, deleteRoutine, updateRoutineStep } from "@/api/routines";
import { useProducts } from "@/hooks/use-products";
import type { Routine, StepType } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { ScrollView } from "react-native-gesture-handler";

const STEP_LABELS: Record<StepType, string> = {
  cleanse: "Cleanse",
  tone: "Tone",
  treat: "Treat",
  moisturize: "Moisturize",
  spf: "SPF",
  other: "Other",
};

interface StepDisplay {
  id: number;
  step_order: number;
  step_type: StepType;
  time_of_day: "AM" | "PM";
  product_id: number | null;
  product_name: string | null;
}

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

  const morningSteps = sortedSteps.filter((s) => s.time_of_day === "AM");
  const nightSteps = sortedSteps.filter((s) => s.time_of_day === "PM");

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
      await Promise.all(promises);
      router.back();
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!routine) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.neutral[100] }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.center}>
          <ThemedText type="bodyLarge">Routine not found</ThemedText>
          <ThemedButton text="Go Back" link onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const renderStep = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<StepDisplay>) => {
    const hasProduct = item.product_id !== null;
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={[
            styles.stepRow,
            {
              borderColor: colors.neutral[300],
              backgroundColor: isActive
                ? colors.primary[100]
                : colors.background,
            },
          ]}
        >
          <TouchableOpacity onLongPress={drag} disabled={isActive}>
            <MaterialIcons name="list" size={24} color={colors.neutral[500]} />
          </TouchableOpacity>

          <View style={styles.stepContent}>
            <ThemedText type="body">
              {STEP_LABELS[item.step_type] ?? item.step_type}
              {hasProduct
                ? ` with ${item.product_name}`
                : " with no product found"}
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(modals)/product-picker",
                params: {
                  stepId: item.id,
                  stepType: item.step_type,
                  returnTo: "/(modals)/edit-routine",
                  routineId,
                },
              })
            }
          >
            <MaterialIcons
              name={hasProduct ? "edit" : "warning"}
              size={20}
              color={hasProduct ? colors.primary[600] : "#e65100"}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const renderSection = (
    label: string,
    icon: React.ReactNode,
    data: StepDisplay[],
    timeOfDay: "AM" | "PM",
  ) => {
    if (data.length === 0) return null;
    return (
      <View style={styles.section}>
        <ThemedText type="overline" weight="bold">
          {icon} {label}
        </ThemedText>
        <DraggableFlatList
          data={data}
          renderItem={renderStep}
          keyExtractor={(item) => item.id.toString()}
          onDragEnd={({ data }) => handleDragEnd(timeOfDay, data)}
          scrollEnabled={false}
        />
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      edges={["top", "bottom"]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View>
          <ThemedText type="h1">Edit Routine</ThemedText>
          <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
            Reorder steps or swap products from your shelf
          </ThemedText>
        </View>
        {renderSection(
          "morning steps",
          <MaterialIcons name="sunny" size={12} color={colors.text} />,
          morningSteps,
          "AM",
        )}

        {renderSection(
          "night steps",
          <MaterialIcons
            name="nightlight-round"
            size={12}
            color={colors.text}
          />,
          nightSteps,
          "PM",
        )}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.neutral[300],
          },
        ]}
      >
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={18}
            color={colors.neutral[600]}
          />
          <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
            Delete
          </ThemedText>
        </TouchableOpacity>
        <ThemedButton
          text="Done"
          onPress={handleDone}
          disabled={saving}
          loading={saving}
          color={colors.primary[600]}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    padding: 24,
    gap: 24,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  section: {
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepContent: {
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
