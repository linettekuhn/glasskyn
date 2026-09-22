import { ReactNode } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "../ui/themed-text";
import { FactsHeading, FactsRow, useFactsColors } from "./facts-label";
import ChatMarkdown from "../chat/chat-markdown";
import type {
  FlaggedIngredient,
  IngredientAnalysisResponse,
  MatchedIngredient,
} from "../../types";

interface IngredientAnalysisSectionProps {
  result: IngredientAnalysisResponse | null;
  isLoading: boolean;
  onRetry?: () => void;
}

const HIGHLIGHT_LIMIT = 5;

function displayScore(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  return Math.max(0, Math.min(10, 10 - raw));
}

export default function IngredientAnalysisSection({
  result,
  isLoading,
  onRetry,
}: IngredientAnalysisSectionProps) {
  const colorScheme = useColorScheme();
  const colors = useFactsColors();

  const statusColors = {
    green: colorScheme === "dark" ? "#4DCC7A" : "#1F7A3D",
    amber: colorScheme === "dark" ? "#FBBF24" : "#B45309",
    red: colorScheme === "dark" ? "#FF6B6B" : "#B00020",
    gray: colorScheme === "dark" ? "#9A9A9A" : "#666666",
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={colors.ink} />
        <ThemedText type="bodySmall" style={{ color: colors.muted }}>
          Analyzing ingredients...
        </ThemedText>
      </View>
    );
  }

  if (result === null) {
    if (!onRetry) return null;
    return (
      <View style={styles.centered}>
        <ThemedText type="bodySmall" style={{ color: colors.muted }}>
          Ingredients not available
        </ThemedText>
        <TouchableOpacity
          onPress={onRetry}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ThemedText
            type="captionLarge"
            weight="medium"
            style={{ color: colors.ink }}
          >
            Retry
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  const { stats, matched, flags, analysis } = result;
  const hasData = stats.total > 0;

  const rawScore =
    result.overall_safety_score ?? (hasData ? stats.avg_safety_score : null);
  const avg = rawScore === null ? null : displayScore(rawScore);
  const status = (() => {
    if (avg === null) {
      return {
        color: statusColors.gray,
        label: "No safety data available",
        emoji: "•",
      };
    }
    if (avg >= 7) {
      return {
        color: statusColors.green,
        label: "Generally favorable",
        emoji: "🟢",
      };
    }
    if (avg >= 5) {
      return {
        color: statusColors.amber,
        label: "Some ingredients to be aware of",
        emoji: "🟡",
      };
    }
    return {
      color: statusColors.red,
      label: "Potential concerns detected",
      emoji: "🔴",
    };
  })();

  const highlights = matched
    .slice()
    .sort(
      (a, b) => displayScore(b.safety_score)! - displayScore(a.safety_score)!,
    )
    .slice(0, HIGHLIGHT_LIMIT);

  const flaggedList: FlaggedIngredient[] = flags.map((f) => {
    const name = f.split(":")[0] || f;
    const reason = f.includes(":")
      ? f.split(":").slice(1).join(":").trim()
      : "Flagged by analysis";
    const matchedEntry = matched.find(
      (m) =>
        m.raw_text.toLowerCase() === name.toLowerCase() ||
        m.ingredient_name.toLowerCase() === name.toLowerCase(),
    );
    return { name, reason, known_risks: matchedEntry?.known_risks ?? [] };
  });

  if (!hasData) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FactsHeading title="Ingredient Analysis" />

      {!hasData ? (
        <ThemedText type="bodySmall" style={{ color: colors.muted }}>
          No ingredient list provided.
        </ThemedText>
      ) : (
        <>
          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <TextValue color={colors.ink}>{stats.total}</TextValue>
              <TextLabel color={colors.muted}>Detected</TextLabel>
            </View>
            <View style={styles.statCell}>
              <TextValue color={colors.ink}>{stats.matched}</TextValue>
              <TextLabel color={colors.muted}>Matched</TextLabel>
            </View>
            <View style={styles.statCell}>
              <TextValue color={colors.ink}>{stats.not_found}</TextValue>
              <TextLabel color={colors.muted}>Not Found</TextLabel>
            </View>
          </View>

          <View style={[styles.rule, { backgroundColor: colors.softRule }]} />

          <View style={styles.score}>
            <View style={styles.scoreBlock}>
              <TextLabel color={colors.muted}>AVERAGE SAFETY SCORE</TextLabel>
            </View>
            <View style={[styles.statusPill, { borderColor: status.color }]}>
              <TextValue color={status.color}>
                {status.emoji} {avg !== null ? `${avg.toFixed(1)} / 10` : "—"}
              </TextValue>
            </View>
          </View>

          <FactsRow label="Known risks" value={stats.total_known_risks} />

          {analysis ? (
            <>
              <View
                style={[styles.rule, { backgroundColor: colors.softRule }]}
              />
              <TextLabel color={colors.muted}>SUMMARY</TextLabel>
              <ChatMarkdown content={analysis} />
            </>
          ) : null}

          {highlights.length > 0 && (
            <>
              <View style={[styles.rule, { backgroundColor: colors.rule }]} />
              <View style={styles.tableHeader}>
                <TextLabel color={colors.muted} style={styles.tableIngredient}>
                  INGREDIENT
                </TextLabel>
                <TextLabel color={colors.muted} style={styles.tableRole}>
                  ROLE
                </TextLabel>
                <TextLabel color={colors.muted} style={styles.tableScore}>
                  SCORE
                </TextLabel>
              </View>
              {highlights.map((item, i) => (
                <HighlightRow
                  key={i}
                  item={item}
                  scoreColor={scoreColor(item.safety_score, statusColors)}
                />
              ))}
            </>
          )}

          {flaggedList.length > 0 && (
            <>
              <View style={[styles.rule, { backgroundColor: colors.rule }]} />
              <TextLabel color={colors.muted}>FLAGGED INGREDIENTS</TextLabel>
              {flaggedList.map((flag, i) => (
                <View key={i} style={styles.flagRow}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={14}
                    color={statusColors.amber}
                    style={{ marginTop: 4 }}
                  />
                  <View style={styles.flagContent}>
                    <TextValue color={colors.ink}>{flag.name}</TextValue>
                    <TextLabel color={colors.muted}>{flag.reason}</TextLabel>
                    {flag.known_risks.length > 0 && (
                      <View style={styles.riskList}>
                        {flag.known_risks.map((risk, j) => (
                          <View key={j} style={styles.riskRow}>
                            <View
                              style={[
                                styles.riskDot,
                                { backgroundColor: colors.muted },
                              ]}
                            />
                            <TextLabel color={colors.muted}>{risk}</TextLabel>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}

function scoreColor(
  raw: number,
  statusColors: { green: string; amber: string; red: string; gray: string },
): string {
  const s = displayScore(raw);
  if (s === null) return statusColors.gray;
  if (s >= 7) return statusColors.green;
  if (s >= 5) return statusColors.amber;
  return statusColors.red;
}

function HighlightRow({
  item,
  scoreColor: sc,
}: {
  item: MatchedIngredient;
  scoreColor: string;
}) {
  const colors = useFactsColors();
  const score = displayScore(item.safety_score);
  const role = item.benefits[0] ?? "—";
  return (
    <View style={styles.highlightRow}>
      <TextValue
        color={colors.ink}
        numberOfLines={1}
        style={styles.tableIngredient}
      >
        {item.ingredient_name}
      </TextValue>
      <TextLabel
        color={colors.muted}
        numberOfLines={1}
        style={styles.tableRole}
      >
        {role}
      </TextLabel>
      <TextValue color={sc} style={styles.tableScore}>
        {score !== null ? score.toFixed(1) : "—"}
      </TextValue>
    </View>
  );
}

function TextValue({
  children,
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  color: string;
  style?: object;
  numberOfLines?: number;
}) {
  return (
    <ThemedText
      numberOfLines={numberOfLines}
      type="captionSmall"
      weight="semiBold"
      style={[{ color }, style]}
    >
      {children}
    </ThemedText>
  );
}

function TextLabel({
  children,
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  color: string;
  style?: object;
  numberOfLines?: number;
}) {
  return (
    <ThemedText
      numberOfLines={numberOfLines}
      type="overline"
      weight="medium"
      style={[{ fontSize: 11.5, letterSpacing: 0.6, color }, style]}
    >
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  centered: {
    gap: 8,
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  statGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statCell: {
    flex: 1,
    gap: 2,
  },
  rule: {
    height: 1,
    marginVertical: 2,
  },
  score: {
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  scoreBlock: {
    gap: 2,
  },
  statusPill: {
    borderWidth: 1.5,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  tableIngredient: {
    flex: 1,
  },
  tableRole: {
    flex: 1,
  },
  tableScore: {
    width: 56,
    textAlign: "right",
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
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
  riskList: {
    gap: 3,
    marginTop: 4,
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
    marginTop: 8,
  },
});
