import { useEffect, useMemo } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { SvgXml } from "react-native-svg";
import { Avatar, Style } from "@dicebear/core";
import { Colors, getTheme } from "@/constants/theme";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import definition from "@dicebear/styles/waves.json" with { type: "json" };

const glassStyle = new Style(definition);

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/g, "")
    .replace(/\s+aria-hidden="[^"]*"/g, "")
    .replace(/\s+shape-rendering="[^"]*"/g, "");
}

type Props = {
  seed: string;
  size: number;
};

export default function UserAvatar({ seed, size }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const reduceMotion = useReducedMotion();

  const svg = useMemo(
    () =>
      sanitizeSvg(
        new Avatar(glassStyle, {
          seed,
          size,
          animationVariant: "medium",
          backgroundColor: [colors.secondary[500], colors.tertiary[500]],
          waveColorFill: ["linear"],
          waveColor: [colors.primary[800], colors.primary[500]],
        }).toString(),
      ),
    [seed, size],
  );

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = withTiming(1, { duration: 150 });
      scale.value = withTiming(1, { duration: 150 });
      translateY.value = 0;
      return;
    }
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    translateY.value = withRepeat(
      withTiming(-size * 0.05, {
        duration: 2600,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [reduceMotion, size, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary[100],
        },
        animatedStyle,
      ]}
    >
      <SvgXml width={size} height={size} xml={svg} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
