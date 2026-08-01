import { useState, useEffect, useRef } from "react";
import { useLocalSearchParams, router } from "expo-router";

import { getTemplate, createRoutine } from "@/api/routines";
import { useProducts } from "@/hooks/use-products";
import type { RoutineTemplate, StepDisplay } from "@/types";
import { STEP_TO_PRODUCT_TYPES } from "@/constants/routine";
import RoutineForm from "@/components/ui/routine-form";

export default function EditTemplateScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const [template, setTemplate] = useState<RoutineTemplate | null>(null);
  const [initialSteps, setInitialSteps] = useState<StepDisplay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { products, loading: productsLoading } = useProducts();
  const matchedRef = useRef(false);

  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    setInitialSteps(null);
    matchedRef.current = false;
    getTemplate(Number(templateId))
      .then(setTemplate)
      .catch(() => setTemplate(null))
      .finally(() => setLoading(false));
  }, [templateId]);

  useEffect(() => {
    if (!template || productsLoading || matchedRef.current) return;
    matchedRef.current = true;
    const matched = template.steps.map((s) => {
      const allowed = STEP_TO_PRODUCT_TYPES[s.step_type] ?? [];
      const match = products.find(
        (p) =>
          p.product_type !== null &&
          allowed.includes(p.product_type) &&
          p.category === template.routine_type,
      );
      return {
        id: s.id,
        step_order: s.step_order,
        step_type: s.step_type,
        time_of_day: s.time_of_day,
        product_id: match?.id ?? null,
        product_name: match?.name ?? null,
        frequency: s.frequency,
      };
    });
    setInitialSteps(matched);
  }, [template, products, productsLoading]);

  const handleSubmit = async (payload: {
    name: string;
    steps: {
      step_order: number;
      step_type: string;
      time_of_day: string;
      product_id: number | null;
      frequency: string;
    }[];
  }) => {
    await createRoutine({
      name: payload.name,
      source: "template",
      routine_type: "skincare",
      steps: payload.steps,
    });
    router.dismissAll();
    router.replace("/(main)/routine");
  };

  return (
    <RoutineForm
      key={`template-${templateId}`}
      title="Edit Template"
      subtitle="Fill up each step with a product from your shelf"
      loading={loading || (template !== null && initialSteps === null)}
      notFound={!template && !loading}
      notFoundMessage="Template not found"
      initialName={template?.name ?? ""}
      initialSteps={initialSteps}
      productPickerReturnTo="/(modals)/edit-template"
      productPickerExtraParam={{ key: "templateId", value: templateId ?? "" }}
      submitLabel="Done"
      onSubmit={handleSubmit}
    />
  );
}
