import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import { getSkinProfile, upsertSkinProfile } from "@/api/routines";
import type { SkinType } from "@/types";

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

const CONCERNS = [
  "Acne",
  "Aging",
  "Dark Spots",
  "Redness",
  "Enlarged Pores",
  "Dryness",
  "Oiliness",
  "Dullness",
];

const GOALS = [
  "Hydration",
  "Brightening",
  "Anti-Aging",
  "Barrier Repair",
  "Soothing",
  "Mattifying",
  "Even Tone",
  "Firming",
];

export default function EditSkinProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [isSensitive, setIsSensitive] = useState<boolean | null>(null);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);

  useEffect(() => {
    getSkinProfile()
      .then((profile) => {
        setSkinType(profile.skin_type as SkinType | null);
        setIsSensitive(profile.is_sensitive);
        setConcerns(profile.concerns);
        setGoals(profile.goals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleConcern = (concern: string) => {
    setConcerns((prev) =>
      prev.includes(concern)
        ? prev.filter((c) => c !== concern)
        : [...prev, concern],
    );
  };

  const toggleGoal = (goal: string) => {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await upsertSkinProfile({
        skin_type: skinType ?? undefined,
        is_sensitive: isSensitive,
        concerns,
        goals,
      });
      Toast.show({
        type: "success",
        text1: "Saved",
        text2: "Skin profile updated",
        position: "top",
      });
      router.back();
    } catch {
      // interceptor shows toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <View style={[styles.header, { borderBottomColor: colors.neutral[200] }]}>
        <ThemedText type="h2">Skin Profile</ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Close skin profile"
          style={styles.closeButton}
        >
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={colors.primary[700]}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <ThemedText type="h3">Skin type</ThemedText>
            <View style={styles.grid}>
              {SKIN_TYPES.map((st) => {
                const active = skinType === st.key;
                return (
                  <TouchableOpacity
                    key={st.key}
                    onPress={() => setSkinType(st.key as SkinType)}
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
                      numberOfLines={1}
                      style={{
                        width: "100%",
                        textAlign: "center",
                        color: colors.primary[900],
                      }}
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
                      style={{
                        textAlign: "center",
                        color: colors.primary[800],
                      }}
                    >
                      {st.desc}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="h3">Sensitive skin?</ThemedText>
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Easily irritated or reactive products
            </ThemedText>
            <View style={styles.toggleRow}>
              <ThemedButton
                text="Yes"
                outlined={isSensitive !== true}
                onPress={() => setIsSensitive(true)}
                color={colors.primary[400]}
                alignment="center"
              />
              <ThemedButton
                text="No"
                outlined={isSensitive !== false}
                onPress={() => setIsSensitive(false)}
                color={colors.primary[400]}
                alignment="center"
              />
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="h3">Concerns</ThemedText>
            <View style={styles.chipGrid}>
              {CONCERNS.map((concern) => {
                const active = concerns.includes(concern);
                return (
                  <ThemedButton
                    key={concern}
                    text={concern}
                    outlined={!active}
                    onPress={() => toggleConcern(concern)}
                    color={colors.primary[400]}
                    alignment="center"
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="h3">Goals</ThemedText>
            <View style={styles.chipGrid}>
              {GOALS.map((goal) => {
                const active = goals.includes(goal);
                return (
                  <ThemedButton
                    key={goal}
                    text={goal}
                    outlined={!active}
                    onPress={() => toggleGoal(goal)}
                    color={colors.primary[400]}
                    alignment="center"
                  />
                );
              })}
            </View>
          </View>

          <ThemedButton
            text="Save"
            onPress={handleSave}
            loading={saving}
            color={colors.primary[600]}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 24,
    gap: 28,
  },
  section: {
    gap: 12,
  },
  grid: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    minWidth: 120,
    maxWidth: 160,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
