import { Colors, getTheme } from "@/constants/theme";
import { ComponentType } from "react";
import { StyleSheet, TouchableOpacity, useColorScheme } from "react-native";

type Props = {
  onPress: () => void;
  IconComponent: ComponentType<any>;
  iconName: string;
  iconSize?: number;
  iconColor?: string;
  active?: boolean;
  activeColor?: string;
  backgroundColor?: string;
};

export default function IconButton({
  onPress,
  IconComponent,
  iconName,
  iconSize = 18,
  iconColor,
  active = false,
  activeColor = "rgba(255,200,0,0.6)",
  backgroundColor = "rgba(0,0,0,0.5)",
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor },
        active && { backgroundColor: activeColor },
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
