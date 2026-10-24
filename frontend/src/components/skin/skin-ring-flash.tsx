import { useEffect, useRef } from "react";
import { Animated, StyleSheet, useWindowDimensions } from "react-native";

interface SkinRingFlashProps {
  active: boolean;
}

const GLOW_SPREAD = 100; // blur radius of the inward glow
const RIM_RADIUS = 60; // corner rounding

export default function SkinRingFlash({ active }: SkinRingFlashProps) {
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    Animated.timing(ringOpacity, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [active, ringOpacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          opacity: ringOpacity,
          width,
          height,
          borderRadius: RIM_RADIUS,
          borderWidth: 12,
          borderColor: "rgba(255,255,255,0.95)",
          boxShadow: `inset 0 0 ${GLOW_SPREAD}px ${GLOW_SPREAD / 2}px rgba(255,255,255,0.9)`,
        },
      ]}
    />
  );
}
