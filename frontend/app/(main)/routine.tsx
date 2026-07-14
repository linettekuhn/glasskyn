import { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { listRoutines } from "@/api/routines";
import { useProducts } from "@/hooks/use-products";
import type { Routine } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { CREATE_ROUTINE_OPTIONS } from "@/constants/routine";
import { ThemedText } from "@/components/ui/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LoadingSpinner from "@/components/ui/loading-spinner";
import RoutinePager from "@/components/ui/routine-pager";
import CreateRoutineSheet from "@/components/ui/create-routine-sheet";
import CreateRoutineOptionRow from "@/components/ui/create-routine-option";
import IconButton from "@/components/ui/icon-button";

export default function RoutineScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
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
      const data = await listRoutines("skincare");
      setRoutines(data);
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
    <View style={[styles.container, { backgroundColor: colors.neutral[100] }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText type="h1">{`My Routine${hasMultipleRoutines ? "s" : ""}`}</ThemedText>
          {hasMultipleRoutines && (
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Swipe to switch routines
            </ThemedText>
          )}
        </View>
        <IconButton
          onPress={() => setShowCreateSheet(true)}
          IconComponent={MaterialCommunityIcons}
          iconName="plus"
          backgroundColor={colors.primary[600]}
        />
      </View>

      {hasRoutine ? (
        <RoutinePager routines={routines} productMap={productMap} />
      ) : (
        <View style={styles.emptyState}>
          <ThemedText
            type="bodyLarge"
            style={{ color: colors.neutral[600], marginBottom: 24 }}
          >
            You haven&apos;t created a routine yet
          </ThemedText>

          <View style={styles.landingCards}>
            {CREATE_ROUTINE_OPTIONS.map((option) => (
              <CreateRoutineOptionRow
                key={option.title}
                option={option}
                onPress={() => option.route && router.push(option.route as any)}
                iconSize={28}
                chevronSize={24}
                style={{ backgroundColor: colors.background }}
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    gap: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  landingCards: {
    paddingHorizontal: 32,
    gap: 12,
    width: "100%",
  },
});
