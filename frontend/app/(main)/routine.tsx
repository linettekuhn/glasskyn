import { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { listRoutines, localToday } from "@/api/routines";
import { useProducts } from "@/hooks/use-products";
import type { Routine } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { CREATE_ROUTINE_OPTIONS } from "@/constants/routine";
import { ThemedText } from "@/components/ui/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LoadingSpinner from "@/components/ui/loading-spinner";
import RoutinePager from "@/components/ui/routine-pager";
import RoutineCalendar from "@/components/ui/routine-calendar";
import CreateRoutineSheet from "@/components/ui/create-routine-sheet";
import CreateRoutineOptionRow from "@/components/ui/create-routine-option";
import IconButton from "@/components/ui/icon-button";

export default function RoutineScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [currentRoutineIndex, setCurrentRoutineIndex] = useState(0);
  const [completionVersion, setCompletionVersion] = useState(0);
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
    }, [fetchRoutines]),
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  const hasRoutine = routines.length > 0;
  const hasMultipleRoutines = routines.length > 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
            }}
          >
            <ThemedText type="h1">{`My Routine${hasMultipleRoutines ? "s" : ""}`}</ThemedText>
            {hasRoutine && (
              <IconButton
                iconSize={20}
                onPress={() => setShowCreateSheet(true)}
                IconComponent={MaterialCommunityIcons}
                iconName="plus"
                backgroundColor={colors.primary[600]}
              />
            )}
          </View>
          {hasRoutine && (
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.secondary[600] }}
            >
              {hasMultipleRoutines
                ? "Swipe to switch between your routines"
                : "Track your steps and stay consistent"}
            </ThemedText>
          )}
        </View>
      </View>

      {hasRoutine ? (
        <View style={styles.routineDashboard}>
          <RoutineCalendar
            routineId={routines[currentRoutineIndex]?.id ?? null}
            refreshKey={completionVersion}
          />
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
          <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
            Build your first routine to get started
          </ThemedText>

          <View style={styles.landingCards}>
            {CREATE_ROUTINE_OPTIONS.map((option) => (
              <CreateRoutineOptionRow
                key={option.title}
                option={option}
                onPress={() => option.route && router.push(option.route as any)}
                iconSize={28}
                chevronSize={24}
              />
            ))}
          </View>
        </View>
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
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  headerLeft: {
    gap: 2,
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
