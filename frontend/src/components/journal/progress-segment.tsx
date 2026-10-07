import { useCallback, useMemo, useRef } from "react";
import { Alert, StyleSheet, useColorScheme, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { deleteSkinSession, getSkinSessions } from "@/api/skin";
import { localToday } from "@/api/routines";
import {
  getCachedSkinPhotoDimsSync,
  getCachedSkinPhotoUrlSync,
} from "@/api/skin-photo-urls";
import type { SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import LoadingSpinner from "@/components/ui/loading-spinner";
import SkinJournalCard from "./skin-journal-card";
import CheckInCTA from "./check-in-cta";
import {
  allConcerns,
  dayEntries,
  groupSessionsByDay,
  localDayKey,
} from "@/utils/skin-sessions";

interface ProgressSegmentProps {
  /** All skin sessions, owned and fetched by the journal screen. */
  sessions: SkinSessionOut[];
  /** True until the first sessions fetch completes (avoids empty flash). */
  sessionsLoading: boolean;
  /** Day selected in the shared journal calendar. */
  selected: string | null;
  /** Paging offset within a multi-check-in day. */
  dayOffset: number;
  onSelect: (day: string | null) => void;
  onDayOffsetChange: (offset: number) => void;
  onSessionsChange: (sessions: SkinSessionOut[]) => void;
}

export default function ProgressSegment({
  sessions,
  sessionsLoading,
  selected,
  dayOffset,
  onSelect,
  onDayOffsetChange,
  onSessionsChange,
}: ProgressSegmentProps) {
  const deletingRef = useRef(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const dayMap = useMemo(() => groupSessionsByDay(sessions), [sessions]);
  const concerns = useMemo(() => allConcerns(sessions), [sessions]);

  // The check-in CTA only ever targets today: backfilling a selfie onto a
  // past day would break the montage's honesty.
  const todayKey = localToday();
  const todayBucket = dayMap.get(todayKey);
  const todayEmpty = !todayBucket || todayBucket.length === 0;
  const viewingToday = selected == null || selected === todayKey;

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

  const step = useCallback(
    (delta: number) => {
      const bucket = selected ? dayMap.get(selected) : undefined;
      if (!bucket || bucket.length === 0) return;
      onDayOffsetChange(
        Math.min(Math.max(dayOffset + delta, 0), bucket.length - 1),
      );
    },
    [selected, dayMap, dayOffset, onDayOffsetChange],
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
                .then(onSessionsChange)
                .catch(() => {
                  // Keep the card from lingering if the refetch fails.
                  onSessionsChange(sessions.filter((s) => s.id !== target.id));
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
  }, [session, entries, onSessionsChange, sessions]);

  if (sessionsLoading) {
    return <LoadingSpinner />;
  }

  const startCheckIn = () => router.push("/(modals)/skin-capture");

  // Primary moment: viewing today with no check-in yet (including the
  // first-ever check-in) gets the large CTA instead of any card.
  if (sessions.length === 0 || (viewingToday && todayEmpty)) {
    return (
      <View style={styles.dashboard}>
        <CheckInCTA onPress={startCheckIn} />
      </View>
    );
  }

  // Past day with no entry: plain empty state, deliberately no CTA so a
  // check-in can't be backfilled onto a past day.
  if (!session) {
    return (
      <View style={styles.dashboard}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="image-off-outline"
            size={44}
            color={colors.neutral[500]}
          />
          <ThemedText type="h3" style={styles.centered}>
            No check-in on this day
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dashboard}>
      <View style={styles.cardArea}>
        <SkinJournalCard
          session={session}
          entries={entries}
          dayCount={dayCount}
          dayIndex={dayIndex}
          canPage={canPage}
          isFallback={isFallback}
          onStep={step}
          onDelete={handleDelete}
          onPhotoPress={() => {
            const initialUrl = getCachedSkinPhotoUrlSync(session.image_url);
            const dims = getCachedSkinPhotoDimsSync(session.image_url);
            router.push({
              pathname: "/(modals)/journal-montage",
              params: {
                startId: String(session.id),
                ...(initialUrl
                  ? {
                      initialId: String(session.id),
                      initialUrl,
                      ...(dims
                        ? {
                            initialW: String(dims.width),
                            initialH: String(dims.height),
                          }
                        : null),
                    }
                  : null),
              },
            });
          }}
        />
        {viewingToday && <CheckInCTA compact onPress={startCheckIn} />}
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
    paddingBottom: 24,
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
