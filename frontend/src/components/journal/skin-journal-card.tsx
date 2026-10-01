import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { TAXONOMY_DISCLAIMER } from "@/constants/taxonomy";
import { ThemedText } from "@/components/ui/themed-text";
import GlassSurface from "@/components/ui/glass-surface";
import IconButton from "@/components/ui/icon-button";
import SkinCirclePreview from "./skin-circle-preview";
import { concernLabel, type SkinDayEntry } from "@/utils/skin-sessions";

const LINE_GAP = 16 * 1.6;
const LINE_THICKNESS = 1;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${WEEKDAYS[date.getDay()]}, ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface SkinJournalCardProps {
  session: SkinSessionOut;
  entries: SkinDayEntry[];
  /** Check-ins logged on the same local day as `session`, newest first. */
  dayCount: number;
  /** 0-based position of `session` within that day. */
  dayIndex: number;
  /** Whether the day has more than one check-in to page through. */
  canPage: boolean;
  /** True when `session` is the latest check-in rather than the selected day. */
  isFallback: boolean;
  onStep?: (delta: number) => void;
  onDelete?: () => void;
}

export default function SkinJournalCard({
  session,
  entries,
  dayCount,
  dayIndex,
  canPage,
  isFallback,
  onStep,
  onDelete,
}: SkinJournalCardProps) {
  const [linesHeight, setLinesHeight] = useState(0);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const lineColor = colors.neutral[300];

  const onLinesLayout = useCallback((e: LayoutChangeEvent) => {
    setLinesHeight(e.nativeEvent.layout.height);
  }, []);

  const { ruleColors, ruleLocations } = useMemo(() => {
    if (linesHeight <= 0) return { ruleColors: [], ruleLocations: [] };
    const cols: string[] = [];
    const locs: number[] = [];
    const count = Math.ceil(linesHeight / LINE_GAP);
    for (let i = 0; i < count; i++) {
      const start = i * LINE_GAP;
      if (start >= linesHeight) break;
      const end = Math.min(start + LINE_THICKNESS, linesHeight);
      cols.push("transparent", lineColor, lineColor, "transparent");
      locs.push(
        start / linesHeight,
        start / linesHeight,
        end / linesHeight,
        end / linesHeight,
      );
    }
    return { ruleColors: cols, ruleLocations: locs };
  }, [linesHeight, lineColor]);

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.cardHeader}>
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
        </View>
        <View style={styles.headerActions}>
          {onDelete && (
            <IconButton
              iconSize={18}
              onPress={onDelete}
              IconComponent={MaterialCommunityIcons}
              iconName="trash-can-outline"
              iconColor={colors.error}
              backgroundColor={colors.neutral[300]}
            />
          )}
          {canPage && onStep && (
            <View style={styles.pager}>
              <IconButton
                iconSize={18}
                onPress={() => onStep(-1)}
                disabled={dayIndex === 0}
                IconComponent={MaterialCommunityIcons}
                iconName="chevron-left"
                iconColor={colors.neutral[600]}
                backgroundColor={colors.neutral[300]}
              />
              <ThemedText
                type="captionSmall"
                weight="semiBold"
                style={{ color: colors.neutral[600] }}
              >
                {`${dayIndex + 1} / ${dayCount}`}
              </ThemedText>
              <IconButton
                iconSize={18}
                onPress={() => onStep(1)}
                disabled={dayIndex >= dayCount - 1}
                IconComponent={MaterialCommunityIcons}
                iconName="chevron-right"
                iconColor={colors.neutral[600]}
                backgroundColor={colors.neutral[300]}
              />
            </View>
          )}
        </View>
      </View>
      <SkinCirclePreview session={session} entries={entries} />

      <View style={styles.listArea}>
        <LinearGradient
          pointerEvents="none"
          colors={ruleColors as [string, string, ...string[]]}
          locations={ruleLocations as [number, number, ...number[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          onLayout={onLinesLayout}
          style={styles.linesBackground}
        />

        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {entries.length === 0 ? (
            <ThemedText type="bodyLarge" style={{ color: colors.neutral[500] }}>
              No concerns marked on this check-in
            </ThemedText>
          ) : (
            entries.map((entry) => {
              const resolved = entry.resolvedHere;
              const badgeColor = resolved
                ? colors.success[500]
                : entry.concern.status === "labeled"
                  ? colors.primary[500]
                  : colors.neutral[400];
              const statusText = resolved
                ? "Healed today"
                : entry.isNew
                  ? "New"
                  : "Tracked";
              return (
                <View key={entry.concern.id} style={styles.row}>
                  <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                    <ThemedText
                      style={{ color: "#FFFFFF", fontSize: 11, lineHeight: 14 }}
                      weight="bold"
                    >
                      {entry.number}
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={[
                      styles.rowLabel,
                      resolved && { color: colors.neutral[500] },
                    ]}
                  >
                    {concernLabel(entry.concern)}
                  </ThemedText>
                  <ThemedText
                    type="captionSmall"
                    style={{ color: colors.neutral[600] }}
                  >
                    {statusText}
                  </ThemedText>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    minWidth: 300,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
    gap: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  listArea: {
    flex: 1,
    minHeight: 60,
  },
  linesBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  listContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    flex: 1,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
