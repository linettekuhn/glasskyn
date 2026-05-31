import { Colors, getTheme } from "@/constants/theme";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { ThemedText } from "../ui/themed-text";

type BlurStatus = "checking" | "sharp" | "blurry";

type Props = {
  status: BlurStatus;
};

const BADGE_CONFIG: Record<
  BlurStatus,
  { icon: string | null; color: string | null; label: string }
> = {
  checking: { icon: null, color: null, label: "Checking sharpness..." },
  sharp: { icon: "✓", color: "#4CAF50", label: "Looks sharp" },
  blurry: { icon: "⚠", color: "#FF9800", label: "Might be blurry" },
};

export default function ScanBadge({ status }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { icon, color, label } = BADGE_CONFIG[status];
  const textColor = color ?? colors.neutral[100];

  return (
    <View
      style={[styles.badge, color && { borderWidth: 1, borderColor: color }]}
    >
      {status === "checking" ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <ThemedText
          style={{ color: textColor }}
          type="captionLarge"
          weight="medium"
        >
          {icon}
        </ThemedText>
      )}
      <ThemedText
        style={{ color: textColor }}
        type="captionLarge"
        weight="medium"
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});
