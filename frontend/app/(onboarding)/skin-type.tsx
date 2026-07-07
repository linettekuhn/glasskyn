import { useState } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "@/components/ui/themed-button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const SKIN_TYPES = [
  { key: "dry", label: "Dry" },
  { key: "oily", label: "Oily" },
  { key: "combination", label: "Combination" },
  { key: "normal", label: "Normal" },
];

export default function SkinTypeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();
  const { state, setSkinType, setIsSensitive, reset } = useOnboarding();
  const [selected, setSelected] = useState<string | null>(state.skinType);
  const [sensitive, setSensitive] = useState<boolean | null>(state.isSensitive);

  const canContinue = selected !== null && sensitive !== null;

  const handleContinue = () => {
    if (!canContinue) return;
    setSkinType(selected!);
    setIsSensitive(sensitive);
    router.push("/(onboarding)/concerns");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: "flex-start" }}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.neutral[700]} />
      </TouchableOpacity>
      <View style={styles.header}>
        <ThemedText type="h1">What's your skin type?</ThemedText>
        <ThemedText
          type="bodyLarge"
          style={{ color: colors.secondary[600] }}
        >
          Pick the one that fits most days. You can always update this later.
        </ThemedText>
      </View>

      <View style={styles.grid}>
        {SKIN_TYPES.map((st) => {
          const active = selected === st.key;
          return (
            <TouchableOpacity
              key={st.key}
              onPress={() => setSelected(st.key)}
              style={[
                styles.card,
                {
                  backgroundColor: active ? colors.primary[100] : colors.neutral[100],
                  borderColor: active ? colors.primary[500] : colors.neutral[400],
                },
              ]}
            >
              <ThemedText
                type="bodyLarge"
                weight="medium"
                style={{ color: active ? colors.primary[700] : colors.text }}
              >
                {st.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sensitiveSection}>
        <ThemedText type="bodyLarge" weight="medium">
          Is your skin sensitive or easily irritated?
        </ThemedText>
        <View style={styles.toggleRow}>
          <ThemedButton
            text="Yes"
            outlined={sensitive !== true}
            onPress={() => setSensitive(true)}
            color={colors.primary[500]}
            alignment="center"
          />
          <ThemedButton
            text="No"
            outlined={sensitive !== false}
            onPress={() => setSensitive(false)}
            color={colors.primary[500]}
            alignment="center"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedButton
          text="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
        />
        <ThemedText type="caption" style={{ color: colors.neutral[700], textAlign: "center" }}>
          Step 1 of 3
        </ThemedText>
      </View>

      <ThemedButton
        link
        text="Reset"
        onPress={() => { reset(); router.replace("/(onboarding)/welcome"); }}
        color={colors.neutral[700]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 32,
  },
  header: {
    gap: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47%",
    aspectRatio: 1.5,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sensitiveSection: {
    gap: 16,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  footer: {
    gap: 12,
  },
});
