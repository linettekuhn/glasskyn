import { useState, useEffect, useMemo } from "react";
import { Alert, useColorScheme } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { getRoutine, deleteRoutine, updateRoutine } from "@/api/routines";
import type { Routine, StepDisplay } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "@/components/ui/themed-button";
import RoutineForm from "@/components/ui/routine-form";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function EditRoutineScreen() {
  const { routineId, returnTo } = useLocalSearchParams<{ routineId: string; returnTo?: string }>();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  useEffect(() => {
    if (!routineId) return;
    setLoading(true);
    setRoutine(null);
    getRoutine(Number(routineId))
      .then(setRoutine)
      .catch(() => setRoutine(null))
      .finally(() => setLoading(false));
  }, [routineId]);

  const initialSteps: StepDisplay[] | null = useMemo(
    () =>
      routine
        ? routine.steps.map((s) => ({
            id: s.id,
            step_order: s.step_order,
            step_type: s.step_type,
            time_of_day: s.time_of_day,
            product_id: s.product_id,
            product_name: null,
            frequency: s.frequency,
          }))
        : null,
    [routine],
  );

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
    if (!routineId) return;
    await updateRoutine(Number(routineId), {
      name: payload.name,
      steps: payload.steps,
    });
    router.dismissAll();
    if (returnTo) {
      router.replace(`${returnTo}?routineSaved=1`);
    } else {
      router.replace("/(main)/routine");
    }
  };

  const handleBackToChat = () => {
    Alert.alert(
      "Discard Routine",
      "Discard this routine? This will delete the generated routine.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRoutine(Number(routineId));
            } catch {
              // toast shown by interceptor
            }
            router.dismissAll();
            if (returnTo) router.replace(`${returnTo}?routineDiscarded=1`);
            else router.back();
          },
        },
      ],
    );
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
    <RoutineForm
      key={`routine-${routineId}`}
      title="Edit Routine"
      subtitle="Reorder steps or swap products from your shelf"
      loading={loading || (routine !== null && initialSteps === null)}
      notFound={!routine && !loading}
      notFoundMessage="Routine not found"
      initialName={routine?.name ?? ""}
      initialSteps={initialSteps}
      productPickerReturnTo="/(modals)/edit-routine"
      productPickerExtraParam={{ key: "routineId", value: routineId ?? "" }}
      submitLabel="Done"
      onSubmit={handleSubmit}
      onGoBack={returnTo ? handleBackToChat : undefined}
      bottomBarExtra={
        <ThemedButton
          link
          text="Delete Routine"
          leftIconName="delete-outline"
          LeftIconComponent={MaterialCommunityIcons}
          onPress={handleDelete}
          color={colors.neutral[800]}
        />
      }
    />
  );
}
