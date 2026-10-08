import { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { listRoutines, localToday } from "@/api/routines";
import { useSkinSessions } from "@/contexts/SkinSessionsContext";
import { useProducts } from "@/hooks/use-products";
import { useRoutineCompletionDots } from "@/hooks/use-routine-completion-dots";
import { groupSessionsByDay } from "@/utils/skin-sessions";
import type { Routine } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { CREATE_ROUTINE_OPTIONS } from "@/constants/routine";
import { ThemedText } from "@/components/ui/themed-text";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import LoadingSpinner from "@/components/ui/loading-spinner";
import RoutinePager from "@/components/ui/routine-pager";
import JournalCalendar from "@/components/ui/journal-calendar";
import CreateRoutineSheet from "@/components/ui/create-routine-sheet";
import CreateRoutineOptionRow from "@/components/ui/create-routine-option";
import SegmentedControl, {
  SegmentedControlOption,
} from "@/components/ui/segmented-control";
import ProgressSegment from "@/components/journal/progress-segment";
import IconButton from "@/components/ui/icon-button";

type JournalTab = "routines" | "progress";

const SEGMENTS: SegmentedControlOption<JournalTab>[] = [
  {
    value: "routines",
    label: "Routines",
    LeftIconComponent: MaterialIcons,
    leftIconName: "checklist",
  },
  {
    value: "progress",
    label: "Progress",
    LeftIconComponent: MaterialCommunityIcons,
    leftIconName: "face-recognition",
  },
];

export default function JournalScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [currentRoutineIndex, setCurrentRoutineIndex] = useState(0);
  const [completionVersion, setCompletionVersion] = useState(0);
  const [tab, setTab] = useState<JournalTab>("routines");
  // Skin sessions come from the shared store (single source of truth) —
  // deletes/updates anywhere propagate here without a refetch.
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } =
    useSkinSessions();
  const [selected, setSelected] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [dotsVersion, setDotsVersion] = useState(0);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { products } = useProducts();

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const fetchRoutines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRoutines("skincare", localToday());
      setRoutines(data);
      setCurrentRoutineIndex(0);
    } catch {
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRoutines();
      refreshSessions();
      // Refresh routine dots too: steps may have been toggled elsewhere.
      setDotsVersion((v) => v + 1);
    }, [fetchRoutines, refreshSessions]),
  );

  const routineIds = useMemo(() => routines.map((r) => r.id), [routines]);
  const {
    completedDays,
    loading: dotsLoading,
    ensureMonths,
  } = useRoutineCompletionDots(routineIds, completionVersion + dotsVersion);

  const checkInDays = useMemo(
    () => new Set(Array.from(groupSessionsByDay(sessions).keys())),
    [sessions],
  );

  const handleSelect = useCallback((day: string | null) => {
    setDayOffset(0);
    setSelected(day);
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  const hasRoutine = routines.length > 0;
  const hasMultipleRoutines = routines.length > 1;
  const showRoutines = tab === "routines";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText type="h1">My Skin Journal</ThemedText>
          {showRoutines &&
            (hasRoutine ? (
              <ThemedText
                type="bodyLarge"
                style={{ color: colors.neutral[600] }}
              >
                {hasMultipleRoutines
                  ? "Swipe to switch between routines"
                  : "Log your routine each day"}
              </ThemedText>
            ) : (
              <ThemedText
                type="bodyLarge"
                style={{ color: colors.neutral[600] }}
              >
                Build your first routine to get started
              </ThemedText>
            ))}
          {!showRoutines && (
            <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
              Check in and see your skin's story build
            </ThemedText>
          )}
        </View>
        {showRoutines && hasRoutine && (
          <View style={styles.headerRight}>
            <IconButton
              onPress={() => setShowCreateSheet(true)}
              IconComponent={MaterialIcons}
              iconName="add"
              backgroundColor={colors.secondary[400]}
              accessibilityLabel="New routine"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            />
          </View>
        )}
      </View>

      <View style={styles.calendarWrap}>
        <JournalCalendar
          completedDays={completedDays}
          checkInDays={checkInDays}
          selected={selected}
          onSelect={handleSelect}
          loading={dotsLoading}
          onVisibleMonths={ensureMonths}
        />
      </View>

      <View style={styles.segmentBar}>
        <SegmentedControl options={SEGMENTS} value={tab} onChange={setTab} />
      </View>

      {showRoutines ? (
        hasRoutine ? (
          <View style={styles.routineDashboard}>
            <RoutinePager
              routines={routines}
              productMap={productMap}
              currentIndex={currentRoutineIndex}
              onIndexChange={setCurrentRoutineIndex}
              onCompletionChange={() => setCompletionVersion((v) => v + 1)}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.landingCards}>
              {CREATE_ROUTINE_OPTIONS.map((option) => (
                <CreateRoutineOptionRow
                  key={option.title}
                  option={option}
                  onPress={() =>
                    option.route && router.push(option.route as any)
                  }
                  iconSize={28}
                  chevronSize={24}
                />
              ))}
            </View>
          </View>
        )
      ) : (
        <ProgressSegment
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          selected={selected}
          dayOffset={dayOffset}
          onSelect={handleSelect}
          onDayOffsetChange={setDayOffset}
        />
      )}

      <CreateRoutineSheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendarWrap: {
    paddingTop: 12,
  },
  segmentBar: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 16,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    justifyContent: "flex-start",
    gap: 8,
    paddingHorizontal: 32,
  },
  landingCards: {
    gap: 12,
    width: "100%",
  },

  routineDashboard: {
    flex: 1,
    gap: 4,
  },
});
