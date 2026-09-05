import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Ellipse } from "react-native-svg";
import type { OvalGeometry } from "@/utils/face-gating";

const RING_WHITE = "rgba(255,255,255,0.95)";

interface SkinRingFlashProps {
  active: boolean;
  geometry: OvalGeometry;
  boostOpacity?: number;
}

/**
 * Screen-flash "ring light" for front-facing captures. Front cameras rarely
 * have a hardware flash, so we light the scene from the screen itself: a
 * bright ring drawn around the guide oval plus a soft full-screen boost.
 */
export default function SkinRingFlash({
  active,
  geometry,
  boostOpacity = 0.12,
}: SkinRingFlashProps) {
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const boost = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ringOpacity, {
        toValue: active ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(boost, {
        toValue: active ? boostOpacity : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, boostOpacity, ringOpacity, boost]);

  const { oval } = geometry;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF", opacity: boost }]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: ringOpacity }]}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Ellipse
            cx={oval.cx}
            cy={oval.cy}
            rx={oval.rx + 10}
            ry={oval.ry + 10}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={18}
          />
          <Ellipse
            cx={oval.cx}
            cy={oval.cy}
            rx={oval.rx + 10}
            ry={oval.ry + 10}
            fill="none"
            stroke={RING_WHITE}
            strokeWidth={4}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}