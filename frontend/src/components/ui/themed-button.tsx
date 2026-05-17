import { Colors, getTheme } from "@/constants/theme";
import { ComponentType } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { ThemedText } from "./themed-text";
import tinyColor from "tinycolor2";

type Props = {
  text: string;
  onPress: () => void;
  color?: string;
  outlined?: boolean;
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
  LeftIconComponent,
  leftIconName,
  RightIconComponent,
  rightIconName,
  outlined = false,
  disabled = false,
  loading = false,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const c = color ?? colors.primary[500];
  const bgColor = disabled
    ? colors.neutral[500]
    : outlined
      ? colors.background
      : c;
  const tiny = tinyColor(bgColor);
  const txtColor = tiny.isDark() ? colors.neutral[100] : colors.neutral[900];

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
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size={26} color={txtColor} />
      ) : (
        <View style={[styles.content]}>
          {LeftIconComponent && leftIconName && (
            <LeftIconComponent
              name={leftIconName}
              size={17}
              color={txtColor ?? color}
            />
          )}
          <ThemedText
            type="bodyLarge"
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "stretch",
    borderWidth: 1,
  },

  content: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
});
