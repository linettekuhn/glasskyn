import { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import GlassSurface from "@/components/ui/glass-surface";
import {
  dismissSkinNudge,
  getLatestSkinNudge,
  onSkinCheckInSaved,
} from "@/api/skin";
import type { SkinNudge } from "@/types";

/** Delay before re-checking after a check-in; the nudge is built async. */
const POST_CHECKIN_RETRY_MS = 2500;

export default function SkinNudgeCard() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [nudge, setNudge] = useState<SkinNudge | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const latest = await getLatestSkinNudge();
      setNudge(latest);
      return latest;
    } catch {
      return null;
    }
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      load().catch(() => {});
    }, POST_CHECKIN_RETRY_MS);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  useEffect(() => {
    const unsubscribe = onSkinCheckInSaved(() => {
      // The nudge is built in a background task after check-in commits,
      // so the first fetch may land before it exists — retry once shortly.
      load()
        .then((latest) => {
          if (!latest) scheduleRetry();
        })
        .catch(() => {});
    });
    return () => {
      unsubscribe();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [load, scheduleRetry]);

  const handleDismiss = async () => {
    if (!nudge) return;
    const previous = nudge;
    setNudge(null);
    try {
      await dismissSkinNudge(previous.id);
    } catch {
      setNudge(previous);
    }
  };

  const openJournal = () => router.push("/(main)/journal");

  if (!nudge) return null;

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.header}>
        <View
          style={[styles.accent, { backgroundColor: colors.primary[500] }]}
        />
        <ThemedText type="overline" weight="semiBold">
          Skin Check-in
        </ThemedText>
        <TouchableOpacity
          onPress={handleDismiss}
          accessibilityLabel="Dismiss skin update"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons
            name="close"
            size={20}
            color={colors.neutral[500]}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={openJournal}
        accessibilityLabel="Open skin journal"
        accessibilityRole="button"
      >
        <ThemedText type="bodyLarge">{nudge.text}</ThemedText>
      </TouchableOpacity>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accent: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
});
