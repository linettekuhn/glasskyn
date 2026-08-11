import { useState, useEffect, useCallback, useRef } from "react";
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

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [days, setDays] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const prevMonthKey = useRef<string | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const todayKey = isoDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );

  const monthKey = `${routineId}-${viewMonth}-${viewYear}`;

  useEffect(() => {
    if (routineId == null) return;
    let cancelled = false;
    const firstLoadForMonth = prevMonthKey.current !== monthKey;
    prevMonthKey.current = monthKey;
    if (firstLoadForMonth) {
      setDays(new Map());
      setLoading(true);
    }
    getRoutineCalendar(routineId, viewMonth + 1, viewYear)
      .then((data) => {
        if (cancelled) return;
        const m = new Map<string, boolean>();
        for (const d of data) m.set(d.date, d.completed);
        setDays(m);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routineId, viewMonth, viewYear, refreshKey, monthKey]);

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const changeMonth = useCallback(
    (delta: number) => {
      setSelected(null);
      setViewMonth((prev) => {
        const next = new Date(viewYear, prev + delta, 1);
        setViewYear(next.getFullYear());
        return next.getMonth();
      });
    },
    [viewYear],
  );

  const completedCount = Array.from(days.values()).filter(Boolean).length;

  const selectedCompleted = selected ? (days.get(selected) ?? false) : null;
  const selectedDate = selected ? new Date(`${selected}T00:00:00`) : null;

  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cells.push(null);
      continue;
    }
    cells.push({
      day: dayNumber,
      key: isoDate(viewYear, viewMonth + 1, dayNumber),
    });
  }

  return (
    <GlassSurface
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => changeMonth(-1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={loading}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={colors.primary[600]}
          />
        </TouchableOpacity>
        <ThemedText type="overline" weight="semiBold">
          {MONTHS[viewMonth]} {viewYear}
        </ThemedText>
        <TouchableOpacity
          onPress={() => changeMonth(1)}
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
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary[600]} />
        </View>
      ) : (
        <View>
          {Array.from({ length: totalCells / 7 }, (_, week) => (
            <View key={week} style={styles.weekRow}>
              {cells.slice(week * 7, week * 7 + 7).map((cell, i) =>
                cell ? (
                  <TouchableOpacity
                    key={cell.key}
                    style={styles.cell}
                    onPress={() =>
                      setSelected((prev) =>
                        prev === cell.key ? null : cell.key,
                      )
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
                  <View key={`blank-${i}`} style={styles.cell} />
                ),
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
  footer: {
    alignItems: "center",
    paddingTop: 6,
  },
});
