import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Octicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedButton from "@/components/ui/themed-button";

export default function ManualRoutineScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [product, setProduct] = useState("");
  const [frequency, setFrequency] = useState("");
  const [morningSteps, setMorningSteps] = useState<string[]>([]);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const steps = [
    "Cleanse",
    "Tone",
    "Serum",
    "Moisturizer",
    "Sunscreen",
  ];

  const handleFinishRoutine = () => {};

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <ThemedText type="h1">Manually Create</ThemedText>
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.secondary[600] }}
            >
              Enter your routine&apos;s steps to create your routine.
            </ThemedText>
          </View>

          <View style={styles.morningSteps}>
            <View style={styles.morningStepsHeader}>
              <ThemedText type="h2">Morning Steps</ThemedText>
              <ThemedText type="bodyLarge">AM / PM</ThemedText>
            </View>

            {morningSteps.map((step, index) => (
              <View key={index} style={styles.inputWrapper}>
                <ThemedText
                  type="bodyLarge"
                  style={{ color: colors.secondary[600] }}
                >
                  {index + 1}. {step}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.stepTypeSection}>
            <ThemedText
              type="bodyLarge"
              weight="medium"
              style={{ color: colors.primary[700] }}
            >
              STEP TYPE
            </ThemedText>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {steps.map((step) => (
                <ThemedButton
                  key={step}
                  text={step}
                  textType="bodySmall"
                  outlined={selectedStep !== step}
                  color={
                    selectedStep === step
                      ? colors.secondary[500]
                      : colors.secondary[700]
                  }
                  onPress={() => setSelectedStep(step)}
                />
              ))}
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <ThemedText
                type="bodyLarge"
                weight="medium"
                style={{ color: colors.primary[700] }}
              >
                PRODUCT
              </ThemedText>

              <ThemedTextInput
                value={product}
                onChangeText={setProduct}
                placeholder="Select Product"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <ThemedText
                type="bodyLarge"
                weight="medium"
                style={{ color: colors.primary[700] }}
              >
                FREQUENCY
              </ThemedText>

              <ThemedTextInput
                value={frequency}
                onChangeText={setFrequency}
                placeholder='"daily" | "every_other_day" | "weekly"'
                autoCapitalize="none"
              />
            </View>

            <ThemedButton
              text="Add Step"
              textType="bodySmall"
              color={colors.primary[500]}
              outlined={false}
              onPress={() => {
                if (selectedStep) {
                  setMorningSteps((prev) => [...prev, selectedStep]);
                }
              }}
            />

            <ThemedButton
              text="Finish Routine"
              onPress={handleFinishRoutine}
              RightIconComponent={Octicons}
              rightIconName="arrow-right"
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 32,
    gap: 32,
  },
  heading: {
    alignItems: "flex-start",
  },
  morningStepsHeader: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  morningSteps: {
    alignItems: "flex-start",
  },
  stepTypeSection: {
    gap: 8,
  },
  inputWrapper: {
    gap: 8,
  },
  form: {
    gap: 24,
  },
});