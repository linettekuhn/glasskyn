import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import type { SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import GlassSurface from "@/components/ui/glass-surface";
import SkinCirclePreview from "./skin-circle-preview";
import SessionReview, { hasReview } from "./session-review";
import {
  formatSessionDay as formatDay,
  formatSessionTime as formatTime,
  type SkinDayEntry,
} from "@/utils/skin-sessions";

interface SkinJournalCardProps {
  session: SkinSessionOut;
  entries: SkinDayEntry[];
  onPhotoPress?: () => void;
}

export default function SkinJournalCard({
  session,
  entries,
  onPhotoPress,
}: SkinJournalCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.cardHeader}>
        <Pressable
          onPress={onPhotoPress}
          accessibilityRole="button"
          accessibilityLabel="Open progress montage"
          disabled={!onPhotoPress}
        >
          <SkinCirclePreview session={session} entries={entries} size={130} />
        </Pressable>
        <View>
          <View>
            <ThemedText type="h3" italic numberOfLines={1}>
              {formatDay(session.timestamp)}
            </ThemedText>
            <ThemedText
              type="captionSmall"
              style={{ color: colors.neutral[600] }}
            >
              {formatTime(session.timestamp)}
            </ThemedText>
            <ThemedText
              type="captionSmall"
              style={{ color: colors.neutral[600] }}
            >
              {entries.length === 0
                ? "No concerns marked"
                : `${entries.length} concern${entries.length === 1 ? "" : "s"}`}
            </ThemedText>
            {onPhotoPress && (
              <ThemedButton
                text="View more"
                onPress={onPhotoPress}
                link
                textType="captionSmall"
                color={colors.secondary[600]}
                alignment="flex-start"
              />
            )}
          </View>
        </View>
      </View>
      {hasReview(session) && <SessionReview session={session} />}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 8,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    minWidth: 300,
    alignItems: "center",
    paddingBottom: 30,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
});
