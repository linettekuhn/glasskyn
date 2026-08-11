import { View, useColorScheme } from "react-native";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import { withAlpha } from "./glass-surface";

interface ExpiryBadgeProps {
  status: "ok" | "expiring" | "expired" | null;
}

export default function ExpiryBadge({ status }: ExpiryBadgeProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  if (!status || status === "ok") return null;

  const config = (() => {
    if (status === "expiring")
      return {
        label: "Expires soon",
        color: colors.warning,
        bg: colors.warning,
      };
    return { label: "Expired", color: colors.error, bg: colors.error };
  })();

  return (
    <View
      style={{
        backgroundColor: withAlpha(config.bg, 0.2),
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        alignItems: "center",
      }}
    >
      <ThemedText
        type="captionSmall"
        weight="semiBold"
        style={{ color: config.color }}
      >
        {config.label}
      </ThemedText>
    </View>
  );
}
