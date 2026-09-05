import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import type {
  GateName,
  GateResult,
  OvalGeometry,
} from "@/utils/face-gating";

const OVAL_COLORS = {
  gray: "#9AA7A6",
  amber: "#F4B740",
  green: "#00E5A0",
} as const;

export type OvalMode = keyof typeof OVAL_COLORS;

const CHIP_DEFS: {
  gate: GateName;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}[] = [
  { gate: "centered", label: "Position", icon: "crosshairs" },
  { gate: "distance", label: "Distance", icon: "arrow-expand-all" },
  { gate: "pose", label: "Head", icon: "human" },
  { gate: "brightness", label: "Light", icon: "white-balance-sunny" },
];

function buildCutoutPath(
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): string {
  return [
    `M0 0 H${w} V${h} H0 Z`,
    `M${cx - rx} ${cy}`,
    `A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}`,
    `A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`,
    "Z",
  ].join(" ");
}

interface GuideOvalProps {
  geometry: OvalGeometry;
  gates: GateResult;
  mode: OvalMode;
  width: number;
  height: number;
}

export default function GuideOval({
  geometry,
  gates,
  mode,
  width,
  height,
}: GuideOvalProps) {
  const greenOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode === "green") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(greenOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(greenOpacity, {
            toValue: 0.55,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    Animated.timing(greenOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    return;
  }, [mode, greenOpacity]);

  const { inner, oval } = geometry;

  const baseColor = OVAL_COLORS[mode];
  const cutout = buildCutoutPath(
    width,
    height,
    oval.cx,
    oval.cy,
    oval.rx,
    oval.ry,
  );

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={cutout} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
        <Ellipse
          cx={oval.cx}
          cy={oval.cy}
          rx={oval.rx}
          ry={oval.ry}
          fill="none"
          stroke={baseColor}
          strokeWidth={3}
          strokeOpacity={mode === "gray" ? 0.7 : 1}
        />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: greenOpacity }]}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Ellipse
            cx={oval.cx}
            cy={oval.cy}
            rx={oval.rx}
            ry={oval.ry}
            fill="none"
            stroke={OVAL_COLORS.green}
            strokeWidth={4}
          />
        </Svg>
      </Animated.View>

      <View style={[styles.chips, { top: inner.top - 46 }]}>
        {CHIP_DEFS.map((chip) => {
          const pass = gates[chip.gate];
          const color =
            mode === "gray"
              ? OVAL_COLORS.gray
              : pass
                ? OVAL_COLORS.green
                : OVAL_COLORS.amber;
          return (
            <View key={chip.gate} style={[styles.chip, { borderColor: color }]}>
              <MaterialCommunityIcons name={chip.icon} size={14} color={color} />
              <ThemedText style={{ color, fontSize: 10 }} weight="semiBold">
                {chip.label}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {gates.tips.length > 0 && (
        <View style={[styles.tipPill, { top: inner.top + inner.height + 26 }]}>
          <MaterialCommunityIcons
            name="lightbulb-on-outline"
            size={14}
            color={OVAL_COLORS.amber}
          />
          <ThemedText
            style={{ color: "#FFF8EA", fontSize: 13, flex: 1 }}
            weight="medium"
          >
            {gates.tips.slice(0, 2).join(" ")}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tipPill: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(43,30,10,0.78)",
    borderColor: OVAL_COLORS.amber,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});