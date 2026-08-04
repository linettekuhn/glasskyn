import { useEffect } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface ParticleSpec {
  dx: number;
  dy: number;
  size: number;
  delay: number;
  icon: IconName;
}

const PARTICLES: ParticleSpec[] = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
  const distance = 52 + (i % 3) * 14;
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
    size: 14 + (i % 2) * 6,
    delay: i * 40,
    icon: i % 2 === 0 ? "star-four-points" : "shimmer",
  };
});

function Particle({ spec, color }: { spec: ParticleSpec; color: string }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);
  const rotate = useSharedValue("0deg");

  useEffect(() => {
    tx.value = withDelay(
      spec.delay,
      withTiming(spec.dx, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    ty.value = withDelay(
      spec.delay,
      withTiming(spec.dy, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    scale.value = withDelay(
      spec.delay,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) }),
    );
    rotate.value = withDelay(
      spec.delay,
      withTiming("180deg", { duration: 600 }),
    );
    opacity.value = withDelay(spec.delay, withTiming(1, { duration: 60 }));
    opacity.value = withDelay(
      spec.delay + 420,
      withTiming(0, { duration: 400 }),
    );
  }, [spec, tx, ty, opacity, scale, rotate]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: rotate.value },
    ],
  }));

  return (
    <Animated.View style={[styles.particle, style]}>
      <MaterialCommunityIcons name={spec.icon} size={spec.size} color={color} />
    </Animated.View>
  );
}

export default function CelebrationBurst({ color }: { color: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <View style={styles.container} pointerEvents="none">
      {PARTICLES.map((spec, i) => (
        <Particle key={i} spec={spec} color={color ?? colors.secondary[500]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  particle: {
    position: "absolute",
  },
});
