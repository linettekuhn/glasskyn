import { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { getTemplate, cloneTemplate, updateRoutineStep } from "@/api/routines";
import { getProducts } from "@/api/products";
import { useTemplateSelection } from "@/contexts/TemplateContext";
import type { RoutineTemplate, Product, StepType } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { STEP_TO_PRODUCT_TYPES } from "@/constants/routine";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { MaterialIcons } from "@expo/vector-icons";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";

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

export default function EditTemplateScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const [template, setTemplate] = useState<RoutineTemplate | null>(null);
  const [localStepOrder, setLocalStepOrder] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const {
    pendingProductChanges,
    pendingOrderChanges,
    setPendingProduct,
    setPendingOrder,
    clearPendingChanges,
  } = useTemplateSelection();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const fetchData = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setLocalStepOrder(null);
    try {
      const [templateData, allProducts] = await Promise.all([
        getTemplate(Number(templateId)),
        getProducts(),
      ]);
      setTemplate(templateData);
      setProducts(allProducts);

      templateData.steps.forEach((s) => {
        const allowed = STEP_TO_PRODUCT_TYPES[s.step_type] ?? [];
        const match = allProducts.find(
          (p: Product) =>
            p.product_type !== null &&
            allowed.includes(p.product_type) &&
            p.category === templateData.routine_type,
        );
        if (match) {
          setPendingProduct(s.id, match.id);
        }
      });
    } catch {
      setTemplate(null);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const enrichedSteps: StepDisplay[] = (() => {
    if (!template) return [];
    const base = template.steps.map((s) => {
      const pendingProductId = pendingProductChanges.get(s.id);
      const product = pendingProductId
        ? products.find((p: Product) => p.id === pendingProductId)
        : null;
      return {
        id: s.id,
        step_order: s.step_order,
        step_type: s.step_type,
        time_of_day: s.time_of_day,
        product_id: pendingProductId ?? null,
        product_name: product?.name ?? null,
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

  const morningSteps = enrichedSteps.filter((s) => s.time_of_day === "AM");
  const nightSteps = enrichedSteps.filter((s) => s.time_of_day === "PM");

  const handleDragEnd = (
    timeOfDay: "AM" | "PM",
    newOrder: StepDisplay[],
  ) => {
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
    setSaving(true);
    try {
      const routine = await cloneTemplate(Number(templateId));

      const promises: Promise<void>[] = [];
      pendingOrderChanges.forEach((newOrder, stepId) => {
        promises.push(
          updateRoutineStep(routine.id, stepId, { step_order: newOrder }),
        );
      });
      pendingProductChanges.forEach((productId, stepId) => {
        promises.push(
          updateRoutineStep(routine.id, stepId, { product_id: productId }),
        );
      });
      await Promise.all(promises);
      clearPendingChanges();
      router.dismissAll();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!template) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.neutral[100] }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.center}>
          <ThemedText type="bodyLarge">Template not found</ThemedText>
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
            <MaterialIcons
              name="list"
              size={24}
              color={colors.neutral[500]}
            />
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
                  returnTo: "/(modals)/edit-template",
                  templateId,
                },
              })
            }
          >
            <MaterialIcons
              name={hasProduct ? "edit" : "warning"}
              size={20}
              color={
                hasProduct ? colors.primary[600] : "#e65100"
              }
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
      <View style={styles.scrollContent}>
        <View>
          <ThemedText type="h1">Edit Template</ThemedText>
          <ThemedText
            type="bodyLarge"
            style={{ color: colors.secondary[600] }}
          >
            Fill up each step with a product from your shelf
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
      </View>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.neutral[300],
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
  },
});
