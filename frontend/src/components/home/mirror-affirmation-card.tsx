import { useState } from "react";
import { Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import GlassSurface from "@/components/ui/glass-surface";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import { affirmations } from "@/constants/affirmations";

const dailyIndex = () =>
  Math.floor(Date.now() / 86400000) % affirmations.length;

export default function MirrorAffirmationCard() {
  const colors = Colors[getTheme(useColorScheme())];
  const [index, setIndex] = useState(dailyIndex);

  const shuffle = () => {
    Haptics.selectionAsync();
    setIndex((i) => {
      let next = Math.floor(Math.random() * affirmations.length);
      if (next === i) next = (next + 1) % affirmations.length;
      return next;
    });
  };

  return (
    <GlassSurface style={styles.card} color={colors.tertiary[200]}>
      <View style={styles.labelRow}>
        <View style={styles.label}>
          <MaterialCommunityIcons
            name="mirror"
            size={18}
            color={colors.neutral[600]}
          />
          <ThemedText
            type="overline"
            weight="semiBold"
            style={{ color: colors.neutral[600], letterSpacing: 0.6 }}
          >
            SAY IT TO YOUR REFLECTION
          </ThemedText>
        </View>
        <Pressable
          onPress={shuffle}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Show a different affirmation"
        >
          <MaterialCommunityIcons
            name="shuffle-variant"
            size={18}
            color={colors.neutral[600]}
          />
        </Pressable>
      </View>

      <ThemedText
        type="h3"
        italic
        style={[styles.quote, { color: colors.tertiary[800] }]}
      >
        {affirmations[index]}
      </ThemedText>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 14, overflow: "hidden" },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { flexDirection: "row", alignItems: "center", gap: 6 },
  quote: { textAlign: "center", paddingHorizontal: 8, lineHeight: 30 },
  hint: { textAlign: "center" },
});
