import { useMemo } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { localToday } from "@/api/routines";
import {
  getCachedSkinPhotoDimsSync,
  getCachedSkinPhotoUrlSync,
} from "@/api/skin-photo-urls";
import type { SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import LoadingSpinner from "@/components/ui/loading-spinner";
import SkinEntryPager from "./skin-entry-pager";
import CheckInCTA from "./check-in-cta";
import {
  allConcerns,
  groupSessionsByDay,
  localDayKey,
} from "@/utils/skin-sessions";

interface ProgressSegmentProps {
  /** All skin sessions, from the shared store via the journal screen. */
  sessions: SkinSessionOut[];
  /** True until the first sessions fetch completes (avoids empty flash). */
  sessionsLoading: boolean;
  /** Day selected in the shared journal calendar. */
  selected: string | null;
  /** Paging offset within a multi-check-in day. */
  dayOffset: number;
  onSelect: (day: string | null) => void;
  onDayOffsetChange: (offset: number) => void;
}

export default function ProgressSegment({
  sessions,
  sessionsLoading,
  selected,
  dayOffset,
  onSelect,
  onDayOffsetChange,
}: ProgressSegmentProps) {
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

  // The day's entries, newest first. The index is clamped so a shrinking
  // session list can never leave us out of range.
  const { bucket, dayIndex } = useMemo(() => {
    const list = selected ? dayMap.get(selected) : undefined;
    if (list && list.length > 0) {
      return {
        bucket: list,
        dayIndex: Math.min(dayOffset, list.length - 1),
      };
    }
    const latest = sessions[0] ?? null;
    if (!latest) {
      return { bucket: [], dayIndex: 0 };
    }
    return { bucket: [latest], dayIndex: 0 };
  }, [selected, dayOffset, dayMap, sessions]);

  if (sessionsLoading) {
    return <LoadingSpinner />;
  }

  const startCheckIn = () => router.push("/(modals)/skin-capture");

  const openEntry = (entry: SkinSessionOut, expanded: boolean) => {
    const initialUrl = getCachedSkinPhotoUrlSync(entry.image_url);
    const dims = getCachedSkinPhotoDimsSync(entry.image_url);
    router.push({
      pathname: "/(modals)/journal-montage",
      params: {
        startId: String(entry.id),
        ...(expanded ? { expandDetails: "1" } : null),
        ...(initialUrl
          ? {
              initialId: String(entry.id),
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
  };

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
  if (bucket.length === 0) {
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
        <SkinEntryPager
          sessions={bucket}
          concerns={concerns}
          currentIndex={dayIndex}
          onIndexChange={onDayOffsetChange}
          onPhotoPress={(entry) => openEntry(entry, false)}
          onViewMorePress={(entry) => openEntry(entry, true)}
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
