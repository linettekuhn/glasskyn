import { Colors, getTheme } from "@/constants/theme";
import { ComponentType, useRef } from "react";
import {
  ActivityIndicator,
  FlexAlignType,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "./themed-text";
import tinyColor from "tinycolor2";

const ANIMATION_DURATION = 200;

type Props = {
  text: string;
  onPress: () => void;
  color?: string;
  textType?:
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
  alignment?: "auto" | FlexAlignType;
  outlined?: boolean;
  link?: boolean;
  disabled?: boolean;
  loading?: boolean;
  LeftIconComponent?: ComponentType<any>;
  leftIconName?: string;
  RightIconComponent?: ComponentType<any>;
  rightIconName?: string;
};

export default function ThemedButton({
  text,
  onPress,
  color,
  textType = "bodyLarge",
  alignment,
  outlined = false,
  link = false,
  disabled = false,
  loading = false,
  LeftIconComponent,
  leftIconName,
  RightIconComponent,
  rightIconName,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const underlineWidth = useSharedValue(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animatedUnderlineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: underlineWidth.value }],
    opacity: underlineWidth.value,
  }));

  const handleLinkPress = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    underlineWidth.value = withTiming(1, { duration: ANIMATION_DURATION });

    timeoutRef.current = setTimeout(() => {
      onPress();
      underlineWidth.value = withTiming(0, { duration: ANIMATION_DURATION });
      timeoutRef.current = null;
    }, ANIMATION_DURATION);
  };

  if (link) {
    const linkColor = color ?? colors.primary[500];
    return (
      <TouchableOpacity
        disabled={disabled}
        onPress={handleLinkPress}
        style={{
          alignSelf: alignment ?? "center",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <View style={styles.content}>
          {LeftIconComponent && leftIconName && (
            <LeftIconComponent
              name={leftIconName}
              size={17}
              color={linkColor}
            />
          )}
          <ThemedText
            type={textType}
            weight="medium"
            style={{ color: linkColor }}
          >
            {text}
          </ThemedText>
          {RightIconComponent && rightIconName && (
            <RightIconComponent
              name={rightIconName}
              size={17}
              color={linkColor}
            />
          )}
        </View>
        <Animated.View
          style={[
            styles.underline,
            { backgroundColor: linkColor },
            animatedUnderlineStyle,
          ]}
        />
      </TouchableOpacity>
    );
  }

  const c = color ?? colors.primary[500];
  const bgColor = disabled
    ? colors.neutral[500]
    : outlined
      ? colors.background
      : c;
  const tiny = tinyColor(bgColor);
  const txtColor = outlined
    ? colors.text
    : tiny.isDark()
      ? colors.neutral[100]
      : colors.neutral[900];

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.button,
        {
          opacity: disabled ? 0.6 : 1,
          backgroundColor: bgColor,
          borderColor: outlined ? c : bgColor,
          alignSelf: alignment ?? "stretch",
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size={26} color={txtColor} />
      ) : (
        <View style={styles.content}>
          {LeftIconComponent && leftIconName && (
            <LeftIconComponent
              name={leftIconName}
              size={17}
              color={txtColor ?? color}
            />
          )}
          <ThemedText
            type={textType}
            weight="medium"
            style={{ color: txtColor ?? color }}
          >
            {text}
          </ThemedText>
          {RightIconComponent && rightIconName && (
            <RightIconComponent
              name={rightIconName}
              size={17}
              color={txtColor ?? color}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  linkButton: {
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  underline: {
    bottom: 0,
    height: 1,
  },
});
