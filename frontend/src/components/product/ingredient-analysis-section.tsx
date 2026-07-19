import { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "../ui/themed-text";
import type { FlaggedIngredient } from "../../types";

interface IngredientAnalysisSectionProps {
  rawIngredientText: string | null;
  flaggedIngredients: FlaggedIngredient[] | null;
  isLoading: boolean;
  onRetry?: () => void;
}

export default function IngredientAnalysisSection({
  rawIngredientText,
  flaggedIngredients,
  isLoading,
  onRetry,
}: IngredientAnalysisSectionProps) {
  const [showFullList, setShowFullList] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <ThemedText
            type="bodySmall"
            style={{ color: colors.neutral[600] }}
          >
            Analyzing ingredients...
          </ThemedText>
        </View>
      </View>
    );
  }

  if (rawIngredientText === null) {
    if (!onRetry) return null;
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText
            type="bodySmall"
            style={{ color: colors.neutral[600] }}
          >
            Ingredients not available
          </ThemedText>
          <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ThemedText
              type="captionLarge"
              weight="medium"
              style={{ color: colors.primary[600] }}
            >
              Retry
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const flagged = flaggedIngredients ?? [];
  const ingredientCount = rawIngredientText
    ? rawIngredientText.split(/[,;]\s*/).filter(Boolean).length
    : 0;
  const hasFlags = flagged.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons
          name={hasFlags ? "alert-circle-outline" : "check-circle-outline"}
          size={16}
          color={hasFlags ? colors.secondary[600] : colors.primary[600]}
        />
        <ThemedText
          type="bodySmall"
          weight="medium"
          style={{ color: colors.neutral[700] }}
        >
          {ingredientCount} ingredient{ingredientCount !== 1 ? "s" : ""}
        </ThemedText>
        <ThemedText type="bodySmall" style={{ color: colors.neutral[500] }}>
          {" "}·{" "}
        </ThemedText>
        <ThemedText
          type="bodySmall"
          weight="medium"
          style={{ color: hasFlags ? colors.secondary[600] : colors.primary[600] }}
        >
          {hasFlags
            ? `${flagged.length} flagged`
            : "No flagged ingredients"}
        </ThemedText>
      </View>

      {hasFlags && (
        <View style={styles.flagList}>
          {flagged.map((item, i) => (
            <View key={i} style={styles.flagRow}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={14}
                color={colors.secondary[600]}
              />
              <View style={styles.flagContent}>
                <ThemedText
                  type="bodySmall"
                  weight="medium"
                  style={{ color: colors.neutral[800] }}
                >
                  {item.name}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: colors.neutral[600] }}
                >
                  {item.reason}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => setShowFullList((prev) => !prev)}
        activeOpacity={0.7}
      >
        <ThemedText
          type="captionLarge"
          weight="medium"
          style={{ color: colors.primary[600] }}
        >
          {showFullList ? "Hide full ingredient list" : "Show full ingredient list"}
        </ThemedText>
        <MaterialCommunityIcons
          name={showFullList ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.primary[600]}
        />
      </TouchableOpacity>

      {showFullList && (
        <ThemedText
          type="caption"
          style={{ color: colors.neutral[700], lineHeight: 20 }}
        >
          {rawIngredientText}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flagList: {
    gap: 8,
  },
  flagRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  flagContent: {
    flex: 1,
    gap: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
