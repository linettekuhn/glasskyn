import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, useColorScheme, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { deleteSkinSession, getSkinSessions } from "@/api/skin";
import type { SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import SkinCalendar from "./skin-calendar";
import SkinJournalCard from "./skin-journal-card";
import {
  allConcerns,
  dayEntries,
  groupSessionsByDay,
  localDayKey,
} from "@/utils/skin-sessions";

export default function ProgressSegment() {
  const [sessions, setSessions] = useState<SkinSessionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const deletingRef = useRef(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSkinSessions()
        .then((data) => {
          if (cancelled) return;
          setSessions(data);
        })
        .catch(() => {
          if (!cancelled) setSessions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const dayMap = useMemo(() => groupSessionsByDay(sessions), [sessions]);
  const checkInDays = useMemo(
    () => new Set(Array.from(dayMap.keys())),
    [dayMap],
  );
  const concerns = useMemo(() => allConcerns(sessions), [sessions]);

  // Latest session on the selected day, falling back to the latest overall.
  // `getSkinSessions()` already returns sessions newest first.
  const { session, isFallback, dayCount, canPage, dayIndex } = useMemo(() => {
    const bucket = selected ? dayMap.get(selected) : undefined;
    if (bucket && bucket.length > 0) {
      // Clamp so a shrinking session list can never leave us out of range.
      const i = Math.min(dayOffset, bucket.length - 1);
      return {
        session: bucket[i],
        isFallback: false,
        dayCount: bucket.length,
        canPage: bucket.length > 1,
        dayIndex: i,
      };
    }
    const latest = sessions[0] ?? null;
    if (!latest) {
      return {
        session: null,
        isFallback: false,
        dayCount: 0,
        canPage: false,
        dayIndex: 0,
      };
    }
    const latestKey = localDayKey(latest.timestamp);
    return {
      session: latest,
      isFallback: selected != null,
      dayCount: latestKey ? (dayMap.get(latestKey)?.length ?? 1) : 1,
      canPage: false,
      dayIndex: 0,
    };
  }, [selected, dayOffset, dayMap, sessions]);

  const entries = useMemo(
    () => (session ? dayEntries(session.id, concerns) : []),
    [session, concerns],
  );

  const handleSelect = useCallback((day: string | null) => {
    setDayOffset(0);
    setSelected(day);
  }, []);

  const step = useCallback(
    (delta: number) => {
      const bucket = selected ? dayMap.get(selected) : undefined;
      if (!bucket || bucket.length === 0) return;
      setDayOffset((prev) =>
        Math.min(Math.max(prev + delta, 0), bucket.length - 1),
      );
    },
    [selected, dayMap],
  );

  const handleDelete = useCallback(() => {
    if (!session || deletingRef.current) return;
    const target = session;
    const originCount = entries.filter((e) => e.isNew).length;
    const message =
      originCount > 0
        ? `This permanently deletes this check-in, its photo, and the ${
            originCount === 1 ? "concern" : `${originCount} concerns`
          } first logged here. This cannot be undone.`
        : "This permanently deletes this check-in and its photo. This cannot be undone.";

    Alert.alert("Delete check-in", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (deletingRef.current) return;
          deletingRef.current = true;
          deleteSkinSession(target.id)
            .then(() => {
              Toast.show({
                type: "success",
                text1: "Check-in deleted",
                position: "bottom",
              });
              return getSkinSessions()
                .then(setSessions)
                .catch(() => {
                  // Keep the card from lingering if the refetch fails.
                  setSessions((prev) => prev.filter((s) => s.id !== target.id));
                });
            })
            .catch(() => {
              // interceptor shows toast
            })
            .finally(() => {
              deletingRef.current = false;
            });
        },
      },
    ]);
  }, [session, entries]);

  if (loading) {
    return <LoadingSpinner />;
  }

  const startCheckIn = () => router.push("/(modals)/skin-capture");

  if (sessions.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="camera-outline"
          size={44}
          color={colors.secondary[500]}
        />
        <ThemedText type="h3" style={styles.centered}>
          No journal entries yet
        </ThemedText>
        <ThemedText
          type="bodyLarge"
          style={{ color: colors.neutral[600], ...styles.centered }}
        >
          Add a photo to start your skin journal and see how your skin changes
          over time
        </ThemedText>
        <ThemedButton text="Add an entry" onPress={startCheckIn} />
      </View>
    );
  }

  return (
    <View style={styles.dashboard}>
      <SkinCalendar
        checkInDays={checkInDays}
        selected={selected}
        onSelect={handleSelect}
      />
      <View style={styles.cardArea}>
        {session && (
          <SkinJournalCard
            session={session}
            entries={entries}
            dayCount={dayCount}
            dayIndex={dayIndex}
            canPage={canPage}
            isFallback={isFallback}
            onStep={step}
            onDelete={handleDelete}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    flex: 1,
    gap: 4,
  },
  cardArea: {
    flex: 1,
    alignItems: "center",
  },
  emptyState: {
    gap: 12,
    paddingHorizontal: 32,
    paddingTop: 24,
    alignItems: "center",
  },
  centered: {
    textAlign: "center",
    alignSelf: "center",
  },
});
