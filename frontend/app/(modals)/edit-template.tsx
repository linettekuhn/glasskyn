import { useState, useCallback, useEffect, useRef } from "react";
import { useColorScheme } from "react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { getTemplate, cloneTemplate, updateRoutineStep } from "@/api/routines";
import { useProducts } from "@/hooks/use-products";
import { useTemplateSelection } from "@/contexts/TemplateContext";
import type { RoutineTemplate, StepDisplay } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { STEP_TO_PRODUCT_TYPES } from "@/constants/routine";
import ThemedButton from "@/components/ui/themed-button";
import RoutineStepEditor from "@/components/ui/routine-step-editor";

export default function EditTemplateScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const [template, setTemplate] = useState<RoutineTemplate | null>(null);
  const [localStepOrder, setLocalStepOrder] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const {
    pendingProductChanges,
    pendingOrderChanges,
    setPendingProduct,
    setPendingOrder,
    clearPendingChanges,
  } = useTemplateSelection();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { products } = useProducts();
  const matchedRef = useRef(false);

  const fetchTemplate = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setLocalStepOrder(null);
    matchedRef.current = false;
    try {
      const templateData = await getTemplate(Number(templateId));
      setTemplate(templateData);
    } catch {
      setTemplate(null);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useFocusEffect(
    useCallback(() => {
      fetchTemplate();
    }, [fetchTemplate]),
  );

  useEffect(() => {
    if (!template || products.length === 0 || matchedRef.current) return;
    matchedRef.current = true;
    template.steps.forEach((s) => {
      const allowed = STEP_TO_PRODUCT_TYPES[s.step_type] ?? [];
      const match = products.find(
        (p) =>
          p.product_type !== null &&
          allowed.includes(p.product_type) &&
          p.category === template.routine_type,
      );
      if (match) {
        setPendingProduct(s.id, match.id);
      }
    });
  }, [template, products]);

  const enrichedSteps: StepDisplay[] = (() => {
    if (!template) return [];
    const base = template.steps.map((s) => {
      const pendingProductId = pendingProductChanges.get(s.id);
      const product = pendingProductId
        ? products.find((p) => p.id === pendingProductId)
        : null;
      return {
        id: s.id,
        step_order: s.step_order,
        step_type: s.step_type,
        time_of_day: s.time_of_day,
        product_id: pendingProductId ?? null,
        product_name: product?.name ?? null,
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

      const templateToRoutine = new Map<number, number>();
      template!.steps.forEach((ts, i) => {
        templateToRoutine.set(ts.id, routine.steps[i].id);
      });

      const promises: Promise<void>[] = [];
      pendingOrderChanges.forEach((newOrder, templateStepId) => {
        const routineStepId = templateToRoutine.get(templateStepId);
        if (routineStepId != null) {
          promises.push(
            updateRoutineStep(routine.id, routineStepId, {
              step_order: newOrder,
            }),
          );
        }
      });
      pendingProductChanges.forEach((productId, templateStepId) => {
        const routineStepId = templateToRoutine.get(templateStepId);
        if (routineStepId != null) {
          promises.push(
            updateRoutineStep(routine.id, routineStepId, {
              product_id: productId,
            }),
          );
        }
      });
      await Promise.all(promises).catch(() => {});
      clearPendingChanges();
    } finally {
      setSaving(false);
      router.dismissAll();
      router.replace("/(main)/routine");
    }
  };

  return (
    <RoutineStepEditor
      title="Edit Template"
      subtitle="Fill up each step with a product from your shelf"
      steps={enrichedSteps}
      loading={loading}
      notFound={!template && !loading}
      notFoundMessage="Template not found"
      productPickerReturnTo="/(modals)/edit-template"
      productPickerExtraParam={{ key: "templateId", value: templateId ?? "" }}
      onDragEnd={handleDragEnd}
      bottomBar={
        <ThemedButton
          text="Done"
          onPress={handleDone}
          disabled={saving}
          loading={saving}
          color={colors.primary[600]}
        />
      }
    />
  );
}
