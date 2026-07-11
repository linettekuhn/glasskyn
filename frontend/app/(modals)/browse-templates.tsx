import { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  useColorScheme,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { listTemplates, getSuggestedTemplates } from "@/api/routines";
import { useTemplateSelection } from "@/contexts/TemplateContext";
import type { RoutineTemplate, SkinType } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import DayNightToggle from "@/components/ui/day-night-toggle";
import TemplateCard from "@/components/template-card";

const skinTypeChips: { key: "all" | SkinType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "dry", label: "Dry" },
  { key: "oily", label: "Oily" },
  { key: "combination", label: "Combination" },
  { key: "normal", label: "Normal" },
];

export default function BrowseTemplatesScreen() {
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [suggestedIds, setSuggestedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedSkinTypes, setSelectedSkinTypes] = useState<SkinType[]>([]);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<"AM" | "PM">("AM");
  const { selectedTemplateId } = useTemplateSelection();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [all, suggested] = await Promise.all([
        listTemplates("skincare"),
        getSuggestedTemplates().catch(() => [] as RoutineTemplate[]),
      ]);
      setTemplates(all);
      setSuggestedIds(new Set(suggested.map((t) => t.id)));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTemplates();
    }, [fetchTemplates]),
  );

  const filteredTemplates = (
    selectedSkinTypes.length === 0
      ? templates
      : templates.filter(
          (t) =>
            t.skin_type_tags &&
            t.skin_type_tags.some((st) =>
              selectedSkinTypes.includes(st as SkinType),
            ),
        )
  ).sort((a, b) => {
    if (selectedTemplateId === a.id) return -1;
    if (selectedTemplateId === b.id) return 1;
    return (suggestedIds.has(b.id) ? 1 : 0) - (suggestedIds.has(a.id) ? 1 : 0);
  });

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (templates.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.neutral[100] }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.header}>
          <ThemedText type="h1">Choose a Template</ThemedText>
          <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
            Find a routine that works for your skin
          </ThemedText>
        </View>
        <View style={styles.emptyState}>
          <ThemedText type="bodyLarge" style={{ color: colors.neutral[700] }}>
            No templates available
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      edges={["top", "bottom"]}
    >
      <View style={styles.header}>
        <ThemedText type="h1">Choose a Template</ThemedText>
        <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
          Find a routine that works for your skin
        </ThemedText>
      </View>

      <View style={styles.filterWrapper}>
        <ThemedText type="overline" weight="semiBold">
          time of day
        </ThemedText>
        <DayNightToggle
          value={selectedTimeOfDay === "AM"}
          onValueChange={(am) => setSelectedTimeOfDay(am ? "AM" : "PM")}
        />
      </View>

      <View style={styles.filterWrapper}>
        <ThemedText type="overline" weight="semiBold">
          skin type
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {skinTypeChips.map((chip) => {
            const isAll = chip.key === "all";
            const chipKey = chip.key as SkinType;
            const active = isAll
              ? selectedSkinTypes.length === 0
              : selectedSkinTypes.includes(chipKey);
            return (
              <ThemedButton
                key={chip.key}
                text={chip.label}
                textType="bodySmall"
                color={active ? colors.secondary[500] : colors.secondary[400]}
                outlined={!active}
                alignment="auto"
                onPress={() => {
                  if (isAll) {
                    setSelectedSkinTypes([]);
                  } else {
                    setSelectedSkinTypes((prev) => {
                      if (prev.includes(chipKey)) {
                        return prev.filter((c) => c !== chipKey);
                      }
                      return prev.length === 5 ? [] : [...prev, chipKey];
                    });
                  }
                }}
              />
            );
          })}
        </ScrollView>
      </View>

      {filteredTemplates.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedText type="bodyLarge" style={{ color: colors.neutral[700] }}>
            No templates match this skin type
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredTemplates}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TemplateCard
              template={item}
              selectedTimeOfDay={selectedTimeOfDay}
              isRecommended={suggestedIds.has(item.id)}
              isSelected={selectedTemplateId === item.id}
              onPress={() =>
                router.push({
                  pathname: "/(modals)/template-preview",
                  params: { templateId: item.id },
                })
              }
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 24,
    gap: 4,
  },
  chipRow: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    minHeight: 60,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  filterWrapper: {
    gap: 2,
    paddingHorizontal: 24,
  },
});
