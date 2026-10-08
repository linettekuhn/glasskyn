import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import type { GateName, GateResult, OvalGeometry } from "@/utils/face-gating";
import { useGuideTip } from "@/hooks/use-guide-tip";
import { Colors } from "@/constants/theme";

const OVAL_COLORS = {
  gray: Colors["light"].neutral[300],
  amber: "#F4B740",
  green: Colors["light"].primary[400],
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
  /**
   * Session state from the capture screen (warmup, shutter in-flight,
   * hold progress). When set it replaces the gate tip so exactly one line
   * is ever shown — the pill is the single place for user guidance.
   */
  statusOverride?: { message: string; tone: "success" | "neutral" } | null;
}

export default function GuideOval({
  geometry,
  gates,
  mode,
  width,
  height,
  statusOverride = null,
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

  const {
    text: tipText,
    category: tipCategory,
    opacity: tipOpacity,
  } = useGuideTip(gates.tip);
  const tipIsSuccess = tipCategory === "success";
  const tipColor = tipIsSuccess ? OVAL_COLORS.green : OVAL_COLORS.amber;

  // Session override wins over the gate tip — one line at a time.
  const overrideText = statusOverride?.message ?? null;
  const overrideIsSuccess = statusOverride?.tone === "success";
  const shownText = overrideText ?? tipText;
  const shownIsSuccess = overrideText != null ? overrideIsSuccess : tipIsSuccess;
  const shownColor = overrideText != null
    ? overrideIsSuccess
      ? OVAL_COLORS.green
      : OVAL_COLORS.gray
    : tipColor;

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

      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: greenOpacity }]}
      >
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

      <View style={[styles.chips, { top: inner.top - 66 }]}>
        {CHIP_DEFS.map((chip) => {
          const pass = gates[chip.gate];
          // Unknown light (no luma sample yet) renders neutral gray rather
          // than a fake green pass.
          const unknownLight =
            chip.gate === "brightness" && gates.metrics.luma == null;
          const color =
            mode === "gray" || unknownLight
              ? OVAL_COLORS.gray
              : pass
                ? OVAL_COLORS.green
                : OVAL_COLORS.amber;
          return (
            <View key={chip.gate} style={[styles.chip, { borderColor: color }]}>
              <MaterialCommunityIcons
                name={chip.icon}
                size={14}
                color={color}
              />
              <ThemedText style={{ color, fontSize: 10 }} weight="semiBold">
                {chip.label}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {shownText && (
        <View
          style={[
            styles.tipPill,
            {
              borderColor: shownColor,
              top: inner.top + inner.height + 36,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={
              shownIsSuccess ? "check-circle-outline" : "lightbulb-on-outline"
            }
            size={14}
            color={shownColor}
          />
          <Animated.View style={{ opacity: tipOpacity, flex: 1 }}>
            <ThemedText
              style={{ color: shownColor, fontSize: 13, flex: 1 }}
              weight="medium"
            >
              {shownText}
            </ThemedText>
          </Animated.View>
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
    backgroundColor: "rgba(0, 0, 0, 0.71)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
