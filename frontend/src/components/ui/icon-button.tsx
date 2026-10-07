import { Colors, getTheme } from "@/constants/theme";
import { ComponentType } from "react";
import {
  Insets,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";

type Props = {
  onPress: () => void;
  IconComponent: ComponentType<any>;
  iconName: string;
  iconSize?: number;
  iconColor?: string;
  active?: boolean;
  activeColor?: string;
  backgroundColor?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  hitSlop?: Insets | number;
};

export default function IconButton({
  onPress,
  IconComponent,
  iconName,
  iconSize = 24,
  iconColor,
  active = false,
  activeColor = "rgba(255,200,0,0.6)",
  backgroundColor = "rgba(0,0,0,0.5)",
  disabled = false,
  accessibilityLabel,
  hitSlop,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "button" : undefined}
      hitSlop={hitSlop}
      style={[
        styles.button,
        { backgroundColor },
        active && { backgroundColor: activeColor },
        disabled && { opacity: 0.4 },
      ]}
    >
      <IconComponent
        name={iconName}
        size={iconSize}
        color={iconColor ?? colors.neutral[100]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 6,
    borderRadius: "50%",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
});
