import { useId } from "react";
import {
  StyleSheet,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { Colors, getTheme } from "@/constants/theme";

const OVAL_RX_RATIO = 0.55;
const OVAL_RY_RATIO = 0.72;

type GradientColors = readonly [string, string, ...string[]];
type GradientLocations = readonly [number, number, ...number[]];

interface GradientBackgroundProps {
  colors?: GradientColors;
  locations?: GradientLocations;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  ovalColor?: string;
  ovalOpacity?: number;
  ovalScale?: number;
}

export default function GradientBackground({
  colors,
  locations,
  start,
  end,
  ovalColor,
  ovalOpacity = 1,
  ovalScale = 1.5,
}: GradientBackgroundProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[getTheme(colorScheme)];
  const { width, height } = useWindowDimensions();
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");

  const gradientColors = colors ?? theme.bg.gradient;
  const gradientLocations = locations ?? theme.bg.gradientLocations;
  const gradientStart = start ?? { x: 0, y: 0 };
  const gradientEnd = end ?? { x: 1, y: 1 };
  const glow = ovalColor ?? theme.bg.oval;

  const rx = width * OVAL_RX_RATIO * ovalScale;
  const ry = height * OVAL_RY_RATIO * ovalScale;
  const cx = width / 2;
  const cy = height;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        start={gradientStart}
        end={gradientEnd}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient
            id={gradientId}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fx={cx}
            fy={cy}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={glow} stopOpacity={ovalOpacity} />
            <Stop offset="60%" stopColor={glow} stopOpacity={ovalOpacity} />
            <Stop
              offset="80%"
              stopColor={glow}
              stopOpacity={ovalOpacity * 0.5}
            />
            <Stop offset="100%" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}
