import { useRef, useEffect } from "react";
import { StyleSheet, Text, type TextProps, Pressable } from "react-native";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Fonts } from "@/constants/theme";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | "displayLarge"
    | "displayMedium"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "body"
    | "bodyLarge"
    | "bodySmall"
    | "caption"
    | "captionLarge"
    | "captionSmall"
    | "overline";
  italic?: boolean;
  link?: boolean;
  onPressWhenLink?: () => void;
};

const ANIMATION_DURATION = 200;

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "body",
  italic = false,
  link = false,
  onPressWhenLink,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  const underlineWidth = useSharedValue(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handlePress = () => {
    if (onPressWhenLink) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      underlineWidth.value = withTiming(1, { duration: ANIMATION_DURATION });
      timeoutRef.current = setTimeout(() => {
        onPressWhenLink();
        timeoutRef.current = null;
      }, ANIMATION_DURATION);
    }
  };

  const animatedUnderlineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: underlineWidth.value }],
    opacity: underlineWidth.value,
  }));

  const baseStyle = typeStyles[type] || typeStyles.body;

  if (link) {
    return (
      <Pressable
        onPress={onPressWhenLink ? handlePress : undefined}
        disabled={!onPressWhenLink}
        style={{ alignItems: "center" }}
      >
        <Text
          style={[{ color }, baseStyle, italic && styles.italic, style]}
          {...rest}
        />
        <Animated.View
          style={[
            styles.underline,
            { backgroundColor: color },
            animatedUnderlineStyle,
          ]}
        />
      </Pressable>
    );
  }

  return (
    <Text
      style={[{ color }, baseStyle, italic && styles.italic, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  italic: {
    fontFamily: Fonts.serifItalic,
  },
  underline: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 1,
  },
});

const typeStyles = StyleSheet.create({
  displayLarge: {
    fontFamily: Fonts.serif,
    fontSize: 48,
    lineHeight: 48 * 1.2,
    letterSpacing: 0.015,
  },
  displayMedium: {
    fontFamily: Fonts.serif,
    fontSize: 40,
    lineHeight: 40 * 1.2,
    letterSpacing: 0.015,
  },
  h1: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 32 * 1.2,
    letterSpacing: 0.02,
  },
  h2: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 24 * 1.2,
    letterSpacing: 0.02,
  },
  h3: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 22 * 1.6,
    letterSpacing: 0.025,
  },
  h4: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    lineHeight: 20 * 1.6,
    letterSpacing: 0.025,
  },
  h5: {
    fontFamily: Fonts.sans,
    fontSize: 18.91,
    lineHeight: 18.91 * 1.6,
    letterSpacing: 0.03,
  },
  h6: {
    fontFamily: Fonts.sans,
    fontSize: 17.89,
    lineHeight: 17.89 * 1.6,
    letterSpacing: 0.03,
  },
  bodyLarge: {
    fontFamily: Fonts.sans,
    fontSize: 16.92,
    lineHeight: 16.92 * 1.6,
    letterSpacing: 0.03,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 16 * 1.6,
    letterSpacing: 0.03,
  },
  bodySmall: {
    fontFamily: Fonts.sans,
    fontSize: 15.13,
    lineHeight: 15.13 * 1.65,
    letterSpacing: 0.03,
  },
  captionLarge: {
    fontFamily: Fonts.sans,
    fontSize: 14.31,
    lineHeight: 14.31 * 1.65,
    letterSpacing: 0.03,
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: 13.53,
    lineHeight: 13.53 * 1.65,
    letterSpacing: 0.03,
  },
  captionSmall: {
    fontFamily: Fonts.sans,
    fontSize: 12.8,
    lineHeight: 12.8 * 1.65,
    letterSpacing: 0.03,
  },
  overline: {
    fontFamily: Fonts.sans,
    fontSize: 13.53,
    lineHeight: 13.53 * 1.65,
    letterSpacing: 0.03,
    textTransform: "uppercase",
  },
});
