import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import GlassSurface from "@/components/ui/glass-surface";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface CalendarCell {
  day: number;
  key: string;
}

interface JournalCalendarProps {
  /** Local `YYYY-MM-DD` keys where at least one routine was fully checked off. */
  completedDays: Set<string>;
  /** Local `YYYY-MM-DD` keys that have at least one skin check-in. */
  checkInDays: Set<string>;
  selected: string | null;
  onSelect: (day: string | null) => void;
  loading?: boolean;
  /**
   * Reported whenever the displayed week/month changes so callers can fetch
   * dot data for exactly the months on screen. Months are `{ year, month }`
   * with a zero-based month.
   */
  onVisibleMonths?: (months: { year: number; month: number }[]) => void;
}

/**
 * Shared journal calendar: primary dots mark fully checked-off routine days,
 * secondary dots mark skin check-in days, and the tertiary fill marks the
 * selected day. Used identically on the Routines and Progress tabs.
 */
export default function JournalCalendar({
  completedDays,
  checkInDays,
  selected,
  onSelect,
  loading = false,
  onVisibleMonths,
}: JournalCalendarProps) {
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const todayKey = isoDate(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate(),
  );

  const weekStart = useMemo(() => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - anchor.getDay());
    return d;
  }, [anchor]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 6);
    return d;
  }, [weekStart]);

  const monthsNeeded = useMemo(() => {
    const months = new Map<string, { year: number; month: number }>();
    const targets = viewMode === "week" ? [weekStart, weekEnd] : [anchor];
    for (const d of targets) {
      months.set(`${d.getFullYear()}-${d.getMonth()}`, {
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return Array.from(months.values());
  }, [anchor, viewMode, weekStart, weekEnd]);

  const monthsKey = monthsNeeded
    .map(({ year, month }) => `${year}-${month}`)
    .sort()
    .join(",");

  useEffect(() => {
    onVisibleMonths?.(monthsNeeded);
    // monthsKey re-fires only when the visible months actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsKey, onVisibleMonths]);

  const changeWeek = (delta: number) => {
    onSelect(null);
    setAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta * 7);
      return next;
    });
  };

  const changeMonth = (delta: number) => {
    onSelect(null);
    setAnchor((prev) => {
      const targetMonth = prev.getMonth() + delta;
      const targetYear = prev.getFullYear();
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      return new Date(
        targetYear,
        targetMonth,
        Math.min(prev.getDate(), lastDay),
      );
    });
  };

  const toggleViewMode = () =>
    setViewMode((prev) => (prev === "week" ? "month" : "week"));

  const weekTitle = useMemo(() => {
    const sameMonth =
      weekStart.getMonth() === weekEnd.getMonth() &&
      weekStart.getFullYear() === weekEnd.getFullYear();
    const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
    if (sameMonth) {
      return `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekEnd.getDate()}`;
    }
    if (sameYear) {
      return `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${SHORT_MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}`;
    }
    return `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}, ${weekStart.getFullYear()} – ${SHORT_MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}`;
  }, [weekStart, weekEnd]);

  const weekCells = useMemo(() => {
    const out: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      out.push({
        day: d.getDate(),
        key: isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      });
    }
    return out;
  }, [weekStart]);

  const firstWeekday = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    1,
  ).getDay();
  const daysInMonth = new Date(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    0,
  ).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const monthCells: (CalendarCell | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      monthCells.push(null);
      continue;
    }
    monthCells.push({
      day: dayNumber,
      key: isoDate(anchor.getFullYear(), anchor.getMonth() + 1, dayNumber),
    });
  }

  const renderCell = (cell: CalendarCell | null, key: string) => {
    if (!cell) return <View key={key} style={styles.cell} />;
    const isComplete = completedDays.has(cell.key);
    const hasCheckIn = checkInDays.has(cell.key);
    const isSelected = cell.key === selected;
    const descriptors = [
      isComplete ? "routine complete" : "",
      hasCheckIn ? "has a journal entry" : "",
    ]
      .filter(Boolean)
      .join(", ");
    return (
      <TouchableOpacity
        key={key}
        style={styles.cell}
        onPress={() => onSelect(isSelected ? null : cell.key)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${cell.key}${descriptors ? `, ${descriptors}` : ""}`}
      >
        <View
          style={[
            styles.dayCircle,
            cell.key === todayKey && {
              borderColor: colors.tertiary[600],
              borderWidth: 1.5,
            },
            isSelected && { backgroundColor: colors.tertiary[500] },
          ]}
        >
          <ThemedText
            type="overline"
            weight={cell.key === todayKey ? "semiBold" : "regular"}
            style={isSelected && { color: "#FFFFFF" }}
          >
            {cell.day}
          </ThemedText>
        </View>
        <View style={styles.dotsRow}>
          {isComplete && (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: colors.primary[500],
                },
              ]}
            />
          )}
          {hasCheckIn && (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: colors.secondary[500],
                },
              ]}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <GlassSurface style={styles.container} color={colors.tertiary[200]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            viewMode === "week" ? changeWeek(-1) : changeMonth(-1)
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={loading}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={colors.primary[600]}
          />
        </TouchableOpacity>
        <ThemedText
          type="overline"
          weight="semiBold"
          numberOfLines={1}
          style={styles.headerTitle}
        >
          {viewMode === "week"
            ? weekTitle
            : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}
        </ThemedText>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={toggleViewMode}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={
                viewMode === "week"
                  ? "chevron-double-down"
                  : "chevron-double-up"
              }
              size={20}
              color={colors.primary[600]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              viewMode === "week" ? changeWeek(1) : changeMonth(1)
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={colors.primary[600]}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={styles.cell}>
            <ThemedText type="overline" style={{ color: colors.neutral[500] }}>
              {w}
            </ThemedText>
          </View>
        ))}
      </View>

      {loading ? (
        <View
          style={[
            styles.loadingRow,
            viewMode === "week" && styles.loadingRowWeek,
          ]}
        >
          <ActivityIndicator color={colors.neutral[700]} />
        </View>
      ) : viewMode === "week" ? (
        <View style={styles.weekRow}>
          {weekCells.map((cell) => renderCell(cell, cell.key))}
        </View>
      ) : (
        <View>
          {Array.from({ length: totalCells / 7 }, (_, week) => (
            <View key={week} style={styles.weekRow}>
              {monthCells
                .slice(week * 7, week * 7 + 7)
                .map((cell, i) =>
                  renderCell(cell, cell ? cell.key : `blank-${i}`),
                )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.primary[500] }]}
          />
          <ThemedText
            type="captionSmall"
            style={{ color: colors.neutral[600] }}
            numberOfLines={1}
          >
            Routine Complete
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: colors.secondary[500] },
            ]}
          />
          <ThemedText
            type="captionSmall"
            style={{ color: colors.neutral[600] }}
            numberOfLines={1}
          >
            Journal Entry
          </ThemedText>
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerTitle: {
    flexShrink: 1,
    marginHorizontal: 4,
    textAlign: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  weekRow: {
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
    height: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  loadingRow: {
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRowWeek: {
    height: 70,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    gap: 16,
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
