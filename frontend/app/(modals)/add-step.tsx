import { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedButton from "@/components/ui/themed-button";
import ThemedDropdown from "@/components/ui/themed-dropdown";
import { withAlpha } from "@/components/ui/glass-surface";
import { useTemplateSelection } from "@/contexts/TemplateContext";
import { useProducts } from "@/hooks/use-products";
import { STEP_LABELS } from "@/constants/routine";
import type { StepType, Frequency } from "@/types";

const STEP_TYPES: StepType[] = [
  "cleanse",
  "tone",
  "treat",
  "moisturize",
  "spf",
  "other",
];

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "every_other_day", label: "Every Other Day" },
  { value: "weekly", label: "Weekly" },
];

export default function AddStepScreen() {
  const { timeOfDay } = useLocalSearchParams<{
    timeOfDay: "AM" | "PM";
  }>();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const { pendingProductChanges, setPendingAddStep, clearPendingAddStep } =
    useTemplateSelection();
  const { products } = useProducts();

  const [selectedStepType, setSelectedStepType] = useState<StepType | null>(
    null,
  );
  const [selectedFrequency, setSelectedFrequency] =
    useState<Frequency>("daily");
  const [tempStepId, setTempStepId] = useState(-1);

  const handleOpenProductPicker = () => {
    const nextId = tempStepId - 1;
    setTempStepId(nextId);
    router.push({
      pathname: "/(modals)/product-picker",
      params: {
        stepId: nextId.toString(),
        stepType: selectedStepType!,
        timeOfDay: timeOfDay ?? "AM",
      },
    });
  };

  const pendingProductId = pendingProductChanges.get(tempStepId) ?? null;
  const selectedProduct = pendingProductId
    ? products.find((p) => p.id === pendingProductId)
    : null;

  const handleAdd = () => {
    if (!selectedStepType) return;
    setPendingAddStep({
      stepType: selectedStepType,
      frequency: selectedFrequency,
      timeOfDay: (timeOfDay as "AM" | "PM") ?? "AM",
      productId: pendingProductId,
    });
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedButton
          link
          text="Cancel"
          leftIconName="arrow-back"
          LeftIconComponent={MaterialIcons}
          onPress={() => router.back()}
          color={colors.neutral[800]}
          alignment="flex-start"
        />
        <ThemedText type="h2">
          Add {timeOfDay === "AM" ? "Morning" : "Night"} Step
        </ThemedText>
        <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
          Build this step for your routine
        </ThemedText>
      </View>

      <View style={styles.content}>
        <View style={styles.field}>
          <ThemedText
            type="caption"
            weight="bold"
            style={{ color: colors.primary[700] }}
          >
            STEP TYPE
          </ThemedText>
          <View style={styles.chipRow}>
            {STEP_TYPES.map((stepType) => (
              <ThemedButton
                key={stepType}
                text={STEP_LABELS[stepType]}
                textType="bodySmall"
                outlined={selectedStepType !== stepType}
                color={
                  selectedStepType === stepType
                    ? colors.secondary[500]
                    : colors.secondary[700]
                }
                onPress={() =>
                  setSelectedStepType(
                    selectedStepType === stepType ? null : stepType,
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText
            type="caption"
            weight="bold"
            style={{ color: colors.primary[700] }}
          >
            PRODUCT
          </ThemedText>
          {selectedStepType ? (
            <TouchableOpacity
              style={[
                styles.productPickerButton,
                {
                  borderColor: colors.neutral[300],
                  backgroundColor: withAlpha(colors.background, 0.4),
                },
              ]}
              onPress={handleOpenProductPicker}
            >
              <MaterialIcons
                name="edit"
                size={18}
                color={colors.primary[600]}
              />
              <ThemedText
                type="body"
                style={{
                  color: selectedProduct ? colors.text : colors.neutral[500],
                }}
              >
                {selectedProduct?.name ?? "Select Product"}
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <ThemedTextInput
              value=""
              onChangeText={() => {}}
              placeholder="Select a step type first"
              editable={false}
            />
          )}
        </View>

        <View style={styles.field}>
          <ThemedText
            type="caption"
            weight="bold"
            style={{ color: colors.primary[700] }}
          >
            FREQUENCY
          </ThemedText>
          <ThemedDropdown
            options={FREQUENCY_OPTIONS}
            value={selectedFrequency}
            onChange={(v) => setSelectedFrequency(v as Frequency)}
            placeholder="Select frequency"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedButton
          text="Add Step"
          onPress={handleAdd}
          disabled={!selectedStepType}
          color={colors.primary[600]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  field: {
    gap: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  productPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
});
