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
import { ThemedText } from "@/components/ui/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LoadingSpinner from "@/components/ui/loading-spinner";
import RoutineCard from "@/components/ui/routine-card";

export default function RoutineScreen() {
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasRoutine, setHasRoutine] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { products } = useProducts();

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const fetchRoutine = useCallback(async () => {
    setLoading(true);
    try {
      const routines = await listRoutines("skincare");
      if (routines.length > 0) {
        const active = routines.find((r) => r.is_active);
        setRoutine(active || routines[0]);
        setHasRoutine(true);
      } else {
        setRoutine(null);
        setHasRoutine(false);
      }
    } catch {
      setHasRoutine(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRoutine();
    }, [fetchRoutine]),
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!hasRoutine) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.neutral[100], justifyContent: "center" },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="h1">My Routine</ThemedText>
          <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
            You haven't created a routine yet
          </ThemedText>
        </View>

        <View style={styles.landingCards}>
          <TouchableOpacity
            style={[
              styles.landingCard,
              {
                borderColor: colors.primary[200],
                backgroundColor: colors.background,
              },
            ]}
            onPress={() => router.push("/(modals)/routine-manual")}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.landingIcon,
                { backgroundColor: colors.primary[100] },
              ]}
            >
              <MaterialCommunityIcons
                name="playlist-plus"
                size={28}
                color={colors.primary[600]}
              />
            </View>
            <View style={styles.landingText}>
              <ThemedText type="bodyLarge" weight="semiBold">
                Create from Scratch
              </ThemedText>
              <ThemedText
                type="bodySmall"
                style={{ color: colors.neutral[700] }}
              >
                Build your own routine
              </ThemedText>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={colors.neutral[600]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.landingCard,
              {
                borderColor: colors.primary[200],
                backgroundColor: colors.background,
              },
            ]}
            onPress={() => router.push("/(modals)/browse-templates")}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.landingIcon,
                { backgroundColor: colors.primary[100] },
              ]}
            >
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={28}
                color={colors.primary[600]}
              />
            </View>
            <View style={styles.landingText}>
              <ThemedText type="bodyLarge" weight="semiBold">
                Browse Templates
              </ThemedText>
              <ThemedText
                type="bodySmall"
                style={{ color: colors.neutral[700] }}
              >
                Start with a premade routine
              </ThemedText>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={colors.neutral[600]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.landingCard,
              {
                borderColor: colors.primary[200],
                backgroundColor: colors.background,
              },
            ]}
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.landingIcon,
                { backgroundColor: colors.primary[100] },
              ]}
            >
              <MaterialCommunityIcons
                name="auto-fix"
                size={28}
                color={colors.primary[600]}
              />
            </View>
            <View style={styles.landingText}>
              <ThemedText type="bodyLarge" weight="semiBold">
                Create with AI
              </ThemedText>
              <ThemedText
                type="bodySmall"
                style={{ color: colors.neutral[700] }}
              >
                Let AI build a routine for you
              </ThemedText>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={colors.neutral[600]}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.neutral[100],
          justifyContent: "space-between",
        },
      ]}
    >
      <View style={styles.header}>
        <ThemedText type="h1">My Routine</ThemedText>
      </View>

      {routine?.steps && routine.steps.length > 0 ? (
        <RoutineCard routine={routine} productMap={productMap} />
      ) : (
        <View style={styles.emptySteps}>
          <ThemedText type="bodyLarge" style={{ color: colors.neutral[700] }}>
            No steps in this routine yet
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  header: {
    paddingTop: 16,
    gap: 8,
  },
  landingCards: {
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  landingCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  landingIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  landingText: {
    flex: 1,
    gap: 2,
  },
  emptySteps: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
