import { useState } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "@/components/ui/themed-button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import OnboardingStep from "@/components/ui/onboarding-step";

const DRY_SKIN_ICON = require("../../assets/icons/dry-skin-icon.png");
const OILY_SKIN_ICON = require("../../assets/icons/oily-skin-icon.png");
const COMBO_SKIN_ICON = require("../../assets/icons/combo-skin-icon.png");
const NORMAL_SKIN_ICON = require("../../assets/icons/normal-skin-icon.png");

const SKIN_TYPES = [
  {
    key: "dry",
    label: "Dry",
    desc: "Tight, flaky, or rough, needs extra moisture",
    icon: DRY_SKIN_ICON,
  },
  {
    key: "oily",
    label: "Oily",
    desc: "Shine, larger pores, tendency to break out",
    icon: OILY_SKIN_ICON,
  },
  {
    key: "combination",
    label: "Combination",
    desc: "Oily down the center, drier along the cheeks",
    icon: COMBO_SKIN_ICON,
  },
  {
    key: "normal",
    label: "Normal",
    desc: "Balanced, not too oily or dry, few concerns",
    icon: NORMAL_SKIN_ICON,
  },
];

export default function SkinTypeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();
  const { state, setSkinType, setIsSensitive } = useOnboarding();
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
    <OnboardingStep currentStep={1}>
      <View style={styles.header}>
        <ThemedText type="h1">What's your skin type?</ThemedText>
        <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
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
                  backgroundColor: active
                    ? colors.primary[400]
                    : colors.primary[200],
                },
              ]}
            >
              <ThemedText
                type="bodyLarge"
                weight="semiBold"
                style={{ color: colors.primary[900] }}
              >
                {st.label}
              </ThemedText>
              <Image
                source={st.icon}
                style={{ width: 100, height: 100 }}
                resizeMode="contain"
              />
              <ThemedText
                type="captionSmall"
                italic
                style={{ textAlign: "center", color: colors.primary[800] }}
              >
                {st.desc}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sensitiveSection}>
        <ThemedText type="body" weight="medium">
          Is your skin sensitive or easily irritated?
        </ThemedText>
        <View style={styles.toggleRow}>
          <ThemedButton
            text="Yes"
            outlined={sensitive !== true}
            onPress={() => setSensitive(true)}
            color={colors.primary[400]}
            alignment="center"
          />
          <ThemedButton
            text="No"
            outlined={sensitive !== false}
            onPress={() => setSensitive(false)}
            color={colors.primary[400]}
            alignment="center"
          />
        </View>
      </View>

      <ThemedButton
        text="Continue"
        onPress={handleContinue}
        disabled={!canContinue}
        color={colors.secondary[500]}
      />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
  grid: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    maxWidth: 150,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  sensitiveSection: {
    gap: 4,
    alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
  },
});
