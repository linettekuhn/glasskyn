import { ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  useColorScheme,
} from "react-native";
import { BlurView } from "expo-blur";
import { Colors, getTheme } from "@/constants/theme";

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

interface GlassSurfaceProps {
  intensity?: number;
  alpha?: number;
  radius?: number;
  border?: boolean;
  blur?: boolean;
  clipsContent?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export default function GlassSurface({
  intensity = 40,
  alpha = 0.55,
  radius = 16,
  border = true,
  blur = true,
  clipsContent = true,
  onPress,
  style,
  children,
}: GlassSurfaceProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const tint = colorScheme === "dark" ? "dark" : "light";
  const borderColor = colors.neutral[200];

  const containerStyle = [
    style,
    { borderRadius: radius },
    clipsContent ? { overflow: "hidden" as const } : null,
  ];

  const tintLayer = (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: withAlpha(colors.background, alpha),
          borderRadius: radius,
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          borderColor,
        },
      ]}
    />
  );

  const blurClip = (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, overflow: "hidden" as const },
      ]}
    >
      {blur && (
        <BlurView
          tint={tint}
          intensity={intensity}
          experimentalBlurMethod={
            Platform.OS === "android" ? "dimezisBlurView" : undefined
          }
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );

  const inner = (
    <>
      {blurClip}
      {tintLayer}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={containerStyle}>
        {inner}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{inner}</View>;
}
