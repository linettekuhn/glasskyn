import { Octicons } from "@expo/vector-icons";
import { router } from "expo-router";

import RoutineForm from "@/components/ui/routine-form";
import { createRoutine } from "@/api/routines";
import { useTemplateSelection } from "@/contexts/TemplateContext";

export default function ManualRoutineScreen() {
  const { clearPendingChanges } = useTemplateSelection();

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
      source: "manual",
      routine_type: "skincare",
      steps: payload.steps,
    });
    clearPendingChanges();
    router.dismissAll();
    router.replace("/(main)/routine");
  };

  return (
    <RoutineForm
      title="Manually Create"
      subtitle="Build your routine step by step"
      initialSteps={[]}
      productPickerReturnTo="/(modals)/routine-manual"
      submitLabel="Finish Routine"
      rightIconName="arrow-right"
      RightIconComponent={Octicons}
      onSubmit={handleSubmit}
    />
  );
}
