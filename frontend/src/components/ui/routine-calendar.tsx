import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getRoutineCalendar } from "@/api/routines";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import GlassSurface from "./glass-surface";

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

interface RoutineCalendarProps {
  routineId: number | null;
  refreshKey?: number;
}

export default function RoutineCalendar({
  routineId,
  refreshKey = 0,
}: RoutineCalendarProps) {
  const now = new Date();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [days, setDays] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const fetchedMonths = useRef<Set<string>>(new Set());
  const lastRefreshKey = useRef(refreshKey);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const todayKey = isoDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
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

  const fetchKey = useMemo(
    () =>
      monthsNeeded
        .map(({ year, month }) => `${year}-${month}`)
        .sort()
        .join(","),
    [monthsNeeded],
  );

  useEffect(() => {
    if (routineId == null) return;
    let cancelled = false;
    if (refreshKey !== lastRefreshKey.current) {
      fetchedMonths.current.clear();
      lastRefreshKey.current = refreshKey;
    }
    const missing = monthsNeeded.filter(
      ({ year, month }) => !fetchedMonths.current.has(`${year}-${month}`),
    );
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(
      missing.map(({ year, month }) =>
        getRoutineCalendar(routineId, month + 1, year),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setDays((prev) => {
          const next = new Map(prev);
          results.forEach((data, i) => {
            const { year, month } = missing[i];
            fetchedMonths.current.add(`${year}-${month}`);
            for (const d of data) next.set(d.date, d.completed);
          });
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routineId, monthsNeeded, fetchKey, refreshKey]);

  const changeWeek = useCallback((delta: number) => {
    setSelected(null);
    setAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta * 7);
      return next;
    });
  }, []);

  const changeMonth = useCallback((delta: number) => {
    setSelected(null);
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
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === "week" ? "month" : "week"));
  }, []);

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

  const renderCell = (cell: CalendarCell | null, key: string) =>
    cell ? (
      <TouchableOpacity
        key={key}
        style={styles.cell}
        onPress={() =>
          setSelected((prev) => (prev === cell.key ? null : cell.key))
        }
      >
        <View
          style={[
            styles.dayCircle,
            cell.key === todayKey && {
              borderColor: colors.primary[600],
              borderWidth: 1.5,
            },
            cell.key === selected && {
              backgroundColor: colors.primary[100],
            },
          ]}
        >
          <ThemedText
            type="overline"
            weight={cell.key === todayKey ? "semiBold" : "regular"}
          >
            {cell.day}
          </ThemedText>
        </View>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: days.get(cell.key)
                ? colors.secondary[500]
                : "transparent",
            },
          ]}
        />
      </TouchableOpacity>
    ) : (
      <View key={key} style={styles.cell} />
    );

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
    height: 35,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  loadingRow: {
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRowWeek: {
    height: 70,
  },
});
