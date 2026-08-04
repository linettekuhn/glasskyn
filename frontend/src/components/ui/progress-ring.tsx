import { useEffect } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number;
  color?: string;
}

export default function ProgressRing({
  size = 64,
  strokeWidth = 6,
  progress,
  color,
}: ProgressRingProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const c = color ?? colors.primary[600];
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progressValue = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withSpring(Math.max(0, Math.min(1, progress)), {
      damping: 14,
      stiffness: 120,
    });
  }, [progress, progressValue]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progressValue.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.neutral[300]}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={c}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.center}>
        <ThemedText
          type="caption"
          weight="semiBold"
          style={{ color: c }}
        >
          {Math.round(Math.max(0, Math.min(1, progress)) * 100)}%
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});
