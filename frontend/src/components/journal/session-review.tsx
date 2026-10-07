import { StyleSheet, View, useColorScheme } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import type { SkinSessionOut } from "@/types";

interface SessionReviewProps {
  session: SkinSessionOut;
  dark?: boolean;
  showNotes?: boolean;
}

const CATEGORIES = [
  { key: "moisture_rating", label: "Moisture" },
  { key: "texture_rating", label: "Texture" },
  { key: "tone_rating", label: "Tone" },
] as const;

export function hasReview(session: SkinSessionOut): boolean {
  return (
    session.moisture_rating != null ||
    session.texture_rating != null ||
    session.tone_rating != null ||
    (session.notes != null && session.notes.trim().length > 0)
  );
}

export default function SessionReview({
  session,
  dark = false,
  showNotes = false,
}: SessionReviewProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const ratings = CATEGORIES.map((c) => ({
    ...c,
    value: session[c.key] ?? null,
  })).filter((r) => r.value != null);
  const notes = session.notes?.trim() ? session.notes.trim() : null;

  if (ratings.length === 0 && !notes) return null;

  const labelColor = dark ? "rgba(255,255,255,0.85)" : colors.neutral[600];
  const notesColor = dark ? "#FFFFFF" : colors.text;
  const starFilled = dark ? "#FFFFFF" : colors.tertiary[500];
  const starEmpty = dark ? "rgba(255,255,255,0.4)" : colors.neutral[400];

  return (
    <View
      style={styles.wrap}
      accessibilityRole="summary"
      accessibilityLabel="Skin ratings for this entry"
    >
      {ratings.length > 0 && (
        <View style={styles.rows}>
          {ratings.map((row) => (
            <View
              key={row.key}
              style={styles.row}
              accessibilityRole="text"
              accessibilityLabel={`${row.label}, ${row.value} of 5 stars`}
            >
              <ThemedText
                type="captionSmall"
                weight="medium"
                style={{ color: labelColor, minWidth: 64 }}
              >
                {row.label}
              </ThemedText>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <MaterialCommunityIcons
                    key={star}
                    name={star <= (row.value ?? 0) ? "star" : "star-outline"}
                    size={14}
                    color={star <= (row.value ?? 0) ? starFilled : starEmpty}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
      {notes && showNotes && (
        <ThemedText
          type="bodySmall"
          numberOfLines={4}
          style={{ color: notesColor }}
        >
          {notes}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    paddingTop: 8,
  },
  rows: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
});
