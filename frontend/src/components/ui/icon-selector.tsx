import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useColorScheme,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  MaterialCommunityIcons,
  MaterialIcons,
  FontAwesome6,
} from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";

export interface IconConfig {
  family: "MaterialCommunityIcons" | "MaterialIcons" | "FontAwesome6";
  name: string;
}

const ICON_OPTIONS: IconConfig[] = [
  { family: "MaterialCommunityIcons", name: "hand-wash-outline" },
  { family: "MaterialCommunityIcons", name: "lipstick" },
  { family: "MaterialCommunityIcons", name: "face-woman-shimmer" },
  { family: "MaterialCommunityIcons", name: "bottle-tonic-outline" },
  { family: "MaterialCommunityIcons", name: "lotion-plus-outline" },
  { family: "MaterialIcons", name: "medication-liquid" },
  { family: "FontAwesome6", name: "spray-can-sparkles" },
  { family: "FontAwesome6", name: "pump-soap" },
  { family: "MaterialIcons", name: "soap" },
  { family: "MaterialCommunityIcons", name: "eyedropper" },
  { family: "MaterialCommunityIcons", name: "brush-outline" },
  { family: "MaterialCommunityIcons", name: "spray" },
];

function toValue(icon: IconConfig): string {
  return `${icon.family}/${icon.name}`;
}

function fromValue(value: string): IconConfig | null {
  const idx = value.indexOf("/");
  if (idx === -1) return null;
  const family = value.slice(0, idx) as IconConfig["family"];
  const name = value.slice(idx + 1);
  return (
    ICON_OPTIONS.find((o) => o.family === family && o.name === name) ?? null
  );
}

export const DEFAULT_ICON = toValue({
  family: "MaterialCommunityIcons",
  name: "lotion-plus-outline",
});

interface IconSelectorProps {
  value: string;
  onChange: (icon: string) => void;
}

function IconComponent({
  icon,
  size,
  color,
}: {
  icon: IconConfig;
  size: number;
  color: string;
}) {
  switch (icon.family) {
    case "MaterialIcons":
      return (
        <MaterialIcons name={icon.name as any} size={size} color={color} />
      );
    case "FontAwesome6":
      return <FontAwesome6 name={icon.name as any} size={size} color={color} />;
    default:
      return (
        <MaterialCommunityIcons
          name={icon.name as any}
          size={size}
          color={color}
        />
      );
  }
}

export default function IconSelector({ value, onChange }: IconSelectorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const selected = fromValue(value) ?? fromValue(DEFAULT_ICON)!;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {ICON_OPTIONS.map((icon) => {
          const isSelected =
            icon.family === selected.family && icon.name === selected.name;
          return (
            <TouchableOpacity
              key={`${icon.family}/${icon.name}`}
              style={[
                styles.cell,
                {
                  borderColor: isSelected
                    ? colors.secondary[500]
                    : colors.secondary[700],
                  backgroundColor: isSelected
                    ? colors.secondary[500]
                    : "transparent",
                },
              ]}
              onPress={() => onChange(toValue(icon))}
              activeOpacity={0.7}
            >
              <IconComponent
                icon={icon}
                size={24}
                color={isSelected ? colors.text : colors.neutral[800]}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <LinearGradient
        colors={[`${colors.background}00`, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fadeRight}
        pointerEvents="none"
      />
    </View>
  );
}

export { ICON_OPTIONS, toValue, fromValue };

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 4,
    paddingRight: 40,
  },
  cell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
  },
});
