import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ProgressRing from "@/components/ui/progress-ring";
import ThemedButton from "@/components/ui/themed-button";
import CelebrationBurst from "./celebration-burst";
import type { RoutineStatus } from "@/utils/routine-status";

interface RoutineStatusCardProps {
  status: RoutineStatus;
  routineName: string;
  onPressCta: () => void;
}

function todayKey(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function RoutineStatusCard({
  status,
  routineName,
  onPressCta,
}: RoutineStatusCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const celebratedRef = useRef<string | null>(null);
  const [burstActive, setBurstActive] = useState(false);

  const isFullDay = status.key === "fullDayComplete";

  useEffect(() => {
    if (status.key !== "fullDayComplete") return;
    const key = todayKey();
    if (celebratedRef.current === key) return;
    celebratedRef.current = key;
    setBurstActive(true);
    const timer = setTimeout(() => setBurstActive(false), 1600);
    return () => clearTimeout(timer);
  }, [status.key]);

  const ringColor = isFullDay ? colors.secondary[600] : colors.primary[600];
  const captionColor = isFullDay ? colors.primary[800] : colors.neutral[600];
  const titleColor = isFullDay ? colors.text : colors.text;

  return (
    <View
      style={[
        styles.card,
        isFullDay
          ? undefined
          : {
              backgroundColor: colors.background,
              borderColor: colors.neutral[200],
            },
      ]}
    >
      {isFullDay && (
        <LinearGradient
          colors={[colors.secondary[100], colors.secondary[300]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={styles.content}>
        <View style={styles.textColumn}>
          <ThemedText
            type={isFullDay ? "h3" : "bodyLarge"}
            weight={isFullDay ? "semiBold" : "semiBold"}
            style={{ color: titleColor }}
          >
            {status.message}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: captionColor, textTransform: "capitalize" }}
          >
            {routineName}
          </ThemedText>
        </View>
        <ProgressRing size={68} progress={status.progress} color={ringColor} />
      </View>

      {status.ctaLabel && (
        <ThemedButton
          text={status.ctaLabel}
          onPress={onPressCta}
          outlined={status.ctaVariant === "outlined"}
          link={status.ctaVariant === "link"}
          alignment="flex-start"
        />
      )}

      {burstActive && <CelebrationBurst color={colors.secondary[600]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  textColumn: {
    flex: 1,
    gap: 4,
  },
});
