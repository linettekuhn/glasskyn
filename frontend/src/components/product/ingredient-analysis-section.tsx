import { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  useColorScheme,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "../ui/themed-text";
import type { FlaggedIngredient } from "../../types";

if (
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface IngredientAnalysisSectionProps {
  ingredients: string[] | null;
  flaggedIngredients: FlaggedIngredient[] | null;
  isLoading: boolean;
  onRetry?: () => void;
}

export default function IngredientAnalysisSection({
  ingredients,
  flaggedIngredients,
  isLoading,
  onRetry,
}: IngredientAnalysisSectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

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

  if (ingredients === null) {
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
  const hasFlags = flagged.length > 0;

  const findFlag = (name: string): FlaggedIngredient | undefined => {
    const lower = name.toLowerCase();
    return flagged.find(
      (f) =>
        lower.includes(f.name.toLowerCase()) ||
        f.name.toLowerCase().includes(lower),
    );
  };

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
          {ingredients.length} ingredient{ingredients.length !== 1 ? "s" : ""}
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

      <View style={styles.ingredientList}>
        {ingredients.map((name, i) => {
          const flag = findFlag(name);
          const isExpanded = flag ? expanded.has(i) : false;
          const hasRisks = flag && flag.known_risks.length > 0;

          return (
            <View key={i}>
              <TouchableOpacity
                activeOpacity={hasRisks ? 0.6 : 1}
                onPress={hasRisks ? () => toggleExpand(i) : undefined}
                style={styles.ingredientRow}
              >
                {flag ? (
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={14}
                    color={colors.secondary[600]}
                  />
                ) : (
                  <View style={styles.spacer} />
                )}
                <View style={styles.ingredientContent}>
                  <ThemedText
                    type="bodySmall"
                    weight={flag ? "medium" : undefined}
                    style={{
                      color: flag ? colors.secondary[700] : colors.neutral[700],
                    }}
                  >
                    {name}
                  </ThemedText>
                  {flag && (
                    <ThemedText
                      type="caption"
                      style={{ color: colors.neutral[600] }}
                    >
                      {flag.reason}
                    </ThemedText>
                  )}
                </View>
                {hasRisks && (
                  <MaterialCommunityIcons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.neutral[500]}
                  />
                )}
              </TouchableOpacity>

              {isExpanded && flag && flag.known_risks.length > 0 && (
                <View style={styles.riskPanel}>
                  {flag.known_risks.map((risk, j) => (
                    <View key={j} style={styles.riskRow}>
                      <View
                        style={[
                          styles.riskDot,
                          { backgroundColor: colors.secondary[600] },
                        ]}
                      />
                      <ThemedText
                        type="caption"
                        style={{
                          color: colors.neutral[700],
                          flex: 1,
                        }}
                      >
                        {risk}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
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
  ingredientList: {
    gap: 6,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  spacer: {
    width: 14,
  },
  ingredientContent: {
    flex: 1,
    gap: 2,
  },
  riskPanel: {
    marginLeft: 22,
    marginTop: 4,
    gap: 4,
    paddingLeft: 8,
    paddingVertical: 6,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  riskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});
