import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { getTemplate } from "@/api/routines";
import { useTemplateSelection } from "@/contexts/TemplateContext";
import type { RoutineTemplate, StepType } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

const STEP_LABELS: Record<StepType, string> = {
  cleanse: "Cleanse",
  tone: "Tone",
  treat: "Treat",
  moisturize: "Moisturize",
  spf: "SPF",
  other: "Other",
};

export default function TemplatePreviewScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const [template, setTemplate] = useState<RoutineTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectTemplate } = useTemplateSelection();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    getTemplate(Number(templateId))
      .then(setTemplate)
      .catch(() => setError("Failed to load template"))
      .finally(() => setLoading(false));
  }, [templateId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (error || !template) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.neutral[100] }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.center}>
          <ThemedText type="bodyLarge">
            {error ?? "Template not found"}
          </ThemedText>
          <ThemedButton
            leftIconName="arrow-back"
            LeftIconComponent={MaterialIcons}
            text="Go Back"
            link
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const morningSteps = template.steps
    .filter((s) => s.time_of_day === "AM")
    .sort((a, b) => a.step_order - b.step_order);

  const nightSteps = template.steps
    .filter((s) => s.time_of_day === "PM")
    .sort((a, b) => a.step_order - b.step_order);

  const skinTypes = template.skin_type_tags?.join(", ") ?? "";
  const concerns = template.concern_tags?.join(", ").toLowerCase() ?? "";

  const handleSelect = () => {
    selectTemplate(template.id);
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      edges={["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <ThemedText type="h1" italic>
            {template.name}
          </ThemedText>
          <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
            {template.description}
          </ThemedText>
        </View>

        {morningSteps.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="overline" weight="bold">
              <MaterialIcons name="sunny" size={12} color={colors.text} />{" "}
              morning steps
            </ThemedText>
            {morningSteps.map((step, index) => (
              <View
                key={step.id}
                style={[styles.stepRow, { borderColor: colors.neutral[300] }]}
              >
                <ThemedText type="body">
                  {index + 1}. {STEP_LABELS[step.step_type] ?? step.step_type}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {nightSteps.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="overline" weight="bold">
              <MaterialCommunityIcons
                name="moon-waning-crescent"
                size={12}
                color={colors.text}
              />{" "}
              night steps
            </ThemedText>
            {nightSteps.map((step, index) => (
              <View
                key={step.id}
                style={[styles.stepRow, { borderColor: colors.neutral[300] }]}
              >
                <ThemedText type="body">
                  {index + 1}. {STEP_LABELS[step.step_type] ?? step.step_type}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <ThemedButton
          text="Use this Routine"
          onPress={handleSelect}
          color={colors.primary[600]}
        />
        <ThemedButton
          link
          text="Go Back"
          leftIconName="arrow-back"
          LeftIconComponent={MaterialIcons}
          onPress={() => router.back()}
          color={colors.neutral[800]}
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bottomBar: {
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
});
