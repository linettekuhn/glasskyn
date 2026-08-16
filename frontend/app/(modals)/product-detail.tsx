import { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Colors, Fonts, getTheme } from "../../src/constants/theme";
import ThemedButton from "../../src/components/ui/themed-button";
import { ThemedText } from "../../src/components/ui/themed-text";
import { fromValue } from "../../src/components/ui/icon-selector";
import {
  FactsLabel,
  FactsHeading,
  FactsRow,
  FactsRule,
} from "../../src/components/product/facts-label";
import IngredientAnalysisSection from "../../src/components/product/ingredient-analysis-section";
import { getProductAnalysis, getProductScanText } from "../../src/api/products";
import { getSkinProfile } from "../../src/api/routines";
import type { IngredientAnalysisResponse } from "../../src/types";
import Divider from "@/components/ui/divider";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const SKIN_TYPE_LABELS: Record<string, string> = {
  dry: "Dry",
  oily: "Oily",
  combination: "Combination",
  normal: "Normal",
  sensitive: "Sensitive",
};

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return null;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function skinTypeLabel(value: string | null | undefined): string {
  if (!value) return "Not set";
  return SKIN_TYPE_LABELS[value] ?? value;
}

function titleCase(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{
    productId: string;
    name: string;
    brand: string;
    category: string;
    productType: string;
    icon: string;
    paoMonths: string;
    openedDate: string;
    expiryDate: string;
    daysUntilExpiry: string;
    imageUrl: string;
    createdAt: string;
  }>();

  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [analysisResult, setAnalysisResult] =
    useState<IngredientAnalysisResponse | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [scanText, setScanText] = useState<string | null>(null);
  const [scanDate, setScanDate] = useState<string | null>(null);
  const [scanExpanded, setScanExpanded] = useState(false);
  const [skinType, setSkinType] = useState<string | null>(null);
  const [isSensitive, setIsSensitive] = useState<boolean | null>(null);

  const paoMonths = params.paoMonths ? parseInt(params.paoMonths, 10) : null;
  const daysUntilExpiry = params.daysUntilExpiry
    ? parseInt(params.daysUntilExpiry, 10)
    : null;

  const expiryLabel = (() => {
    const fromExpiry = formatDate(params.expiryDate);
    if (fromExpiry) return fromExpiry;
    if (!paoMonths || !params.createdAt) return null;
    const created = new Date(params.createdAt);
    const expiry = new Date(created);
    expiry.setMonth(expiry.getMonth() + paoMonths);
    if (isNaN(expiry.getTime())) return null;
    return `${MONTHS[expiry.getMonth()]} ${expiry.getDate()} ${expiry.getFullYear()}`;
  })();

  const openedLabel = formatDate(params.openedDate);

  const expiryStatus =
    daysUntilExpiry === null
      ? null
      : daysUntilExpiry < 0
        ? "expired"
        : daysUntilExpiry <= 30
          ? "expiring"
          : "ok";

  const fetchAndAnalyze = useCallback(
    async (refresh = false) => {
      const productId = params.productId
        ? parseInt(params.productId, 10)
        : null;
      if (!productId) {
        setIsLoadingAnalysis(false);
        return;
      }

      setIsLoadingAnalysis(true);
      try {
        const result = await getProductAnalysis(productId, refresh);
        setAnalysisResult(result);
      } catch {
        setAnalysisResult(null);
      } finally {
        setIsLoadingAnalysis(false);
      }
    },
    [params.productId],
  );

  useEffect(() => {
    fetchAndAnalyze();

    const productId = params.productId ? parseInt(params.productId, 10) : null;
    if (productId) {
      getProductScanText(productId)
        .then((res) => {
          setScanText(res.raw_ocr_text ?? null);
          setScanDate(res.scan_date ?? null);
        })
        .catch(() => {
          setScanText(null);
          setScanDate(null);
        });
    }

    getSkinProfile()
      .then((profile) => {
        setSkinType(profile.skin_type ?? null);
        setIsSensitive(profile.is_sensitive ?? null);
      })
      .catch(() => {
        setSkinType(null);
        setIsSensitive(null);
      });
  }, [fetchAndAnalyze, params.productId]);

  const iconConfig = params.icon ? fromValue(params.icon) : null;
  const categoryLabel = titleCase(params.category);
  const productTypeLabel = titleCase(params.productType);

  const statusColor = (() => {
    if (expiryStatus === "expired") return "#B00020";
    if (expiryStatus === "expiring") return "#B45309";
    return "#1F7A3D";
  })();

  const statusBanner = (() => {
    if (daysUntilExpiry === null) return null;
    if (daysUntilExpiry < 0) {
      const ago = -daysUntilExpiry;
      return {
        title: "EXPIRED",
        sub: ago === 1 ? "Expired 1 day ago" : `Expired ${ago} days ago`,
      };
    }
    if (daysUntilExpiry === 0) {
      return { title: "EXPIRES TODAY", sub: "Use before the end of today" };
    }
    return {
      title: `${daysUntilExpiry} DAY${daysUntilExpiry !== 1 ? "S" : ""} REMAINING`,
      sub: expiryLabel ? `Until ${expiryLabel}` : undefined,
    };
  })();

  const analysis = analysisResult?.stats.total ? analysisResult : null;
  const avgScore = (() => {
    const raw =
      analysis?.overall_safety_score ??
      (analysis ? analysis.stats.avg_safety_score : null);
    if (raw === null || raw === undefined) return null;
    return Math.max(0, Math.min(10, 10 - raw));
  })();
  const flags = analysis?.flags ?? [];
  const notFoundCount = analysis?.stats.not_found ?? 0;
  const riskFlags = flags.filter((f) => !f.includes("no verified safety data"));
  const suitableCount =
    analysis?.matched.filter((m) => 10 - m.safety_score >= 7).length ?? 0;

  const personalized = (() => {
    if (!skinType) return null;
    let verdict: { label: string; color: string } = {
      label: "GOOD",
      color: "#1F7A3D",
    };
    if (avgScore === null) {
      verdict = { label: "NO DATA", color: "#666666" };
    } else if (avgScore < 5) {
      verdict = { label: "CONCERN DETECTED", color: "#B00020" };
    } else if (avgScore < 7 || flags.length > 0 || notFoundCount > 0) {
      verdict = { label: "CAUTION", color: "#B45309" };
    }

    const bullets: { icon: string; text: string; color: string }[] = [];
    if (suitableCount > 0) {
      bullets.push({
        icon: "✓",
        text: `${suitableCount} suitable ingredient${suitableCount !== 1 ? "s" : ""} detected`,
        color: "#1F7A3D",
      });
    }
    if (flags.length === 0 && notFoundCount === 0) {
      bullets.push({
        icon: "✓",
        text: "No major conflicts detected",
        color: "#1F7A3D",
      });
    }
    if (riskFlags.length > 0) {
      bullets.push({
        icon: "⚠",
        text: `${riskFlags.length} ingredient${riskFlags.length !== 1 ? "s" : ""} may cause irritation`,
        color: "#B45309",
      });
    }
    if (isSensitive) {
      bullets.push({
        icon: "⚠",
        text: "Sensitive skin detected. Review with caution",
        color: "#B45309",
      });
    }
    if (notFoundCount > 0) {
      bullets.push({
        icon: "⚠",
        text: `${notFoundCount} ingredient${notFoundCount !== 1 ? "s" : ""} couldn't be identified`,
        color: "#B45309",
      });
    }
    return { verdict, bullets };
  })();

  const warnings = (() => {
    if (flags.length === 0 && notFoundCount === 0) {
      return [
        "No significant concerns detected from the available ingredient information.",
      ];
    }
    const list: string[] = flags.map((f) => {
      const name = f.split(":")[0] || f;
      const reason = f.includes(":")
        ? f.split(":").slice(1).join(":").trim()
        : "flagged by analysis";
      return `${name} — ${reason}`;
    });
    if (notFoundCount > 0) {
      list.push(
        `${notFoundCount} ingredient${notFoundCount !== 1 ? "s" : ""} could not be identified from the scan.`,
      );
    }
    return list;
  })();

  const headerTagline = [params.brand, categoryLabel, productTypeLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <ThemedButton
            link
            text="Go Back"
            leftIconName="arrow-back"
            LeftIconComponent={MaterialIcons}
            onPress={() => router.back()}
            color={colors.neutral[800]}
          />
        </View>

        <View style={styles.infoSection}>
          <ThemedText type="h2">{params.name || "Product"}</ThemedText>
          {params.brand && (
            <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
              {params.brand}
            </ThemedText>
          )}

          <View style={styles.metaRow}>
            {categoryLabel && (
              <View
                style={[styles.chip, { backgroundColor: colors.primary[100] }]}
              >
                <ThemedText
                  type="caption"
                  weight="medium"
                  style={{ color: colors.primary[700] }}
                >
                  {categoryLabel}
                </ThemedText>
              </View>
            )}
            {productTypeLabel && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: colors.secondary[100] },
                ]}
              >
                <ThemedText
                  type="caption"
                  weight="medium"
                  style={{ color: colors.secondary[700] }}
                >
                  {productTypeLabel}
                </ThemedText>
              </View>
            )}
          </View>
        </View>

        <FactsLabel>
          <View style={styles.headerBlock}>
            <ThemedText weight="extraBold" type="h3" sansItalic>
              Product Facts
            </ThemedText>
            <Divider color={colors.neutral[500]} />
            {productTypeLabel && (
              <FactsRow label="Product Type" value={productTypeLabel} />
            )}
            {categoryLabel && (
              <FactsRow label="Category" value={categoryLabel} />
            )}
            {openedLabel && <FactsRow label="Opened" value={openedLabel} />}
            {paoMonths && (
              <FactsRow
                label="Use Within"
                value={`${paoMonths} month${paoMonths !== 1 ? "s" : ""}`}
              />
            )}
            {expiryLabel && (
              <FactsRow label="Estimated Expiry" value={expiryLabel} />
            )}
          </View>

          {!isLoadingAnalysis &&
            analysisResult &&
            analysisResult.stats.total > 0 && (
              <>
                <FactsRule />
                <IngredientAnalysisSection
                  result={analysisResult}
                  isLoading={isLoadingAnalysis}
                  onRetry={() => fetchAndAnalyze(true)}
                />
              </>
            )}

          {personalized && avgScore && (
            <>
              <FactsRule />
              <FactsHeading title="Personalized Check" />
              <FactsRow
                label={`For ${skinTypeLabel(skinType).toLowerCase()} skin`}
                value={personalized.verdict.label}
              />
              <View style={styles.bulletList}>
                {personalized.bullets.map((b, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <ThemedText
                      weight="bold"
                      style={[styles.bulletIcon, { color: b.color }]}
                    >
                      {b.icon}
                    </ThemedText>
                    <ThemedText
                      style={[styles.bulletText, { color: colors.text }]}
                    >
                      {b.text}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </>
          )}

          <FactsRule />

          <FactsHeading title="Warnings" />
          <View style={styles.bulletList}>
            {warnings.map((w, i) => (
              <View key={i} style={styles.bulletRow}>
                <ThemedText
                  weight="bold"
                  style={[styles.bulletIcon, { color: "#B45309" }]}
                >
                  ⚠
                </ThemedText>
                <ThemedText style={[styles.bulletText, { color: colors.text }]}>
                  {w}
                </ThemedText>
              </View>
            ))}
          </View>

          <FactsRule />

          <FactsHeading title="Use & Storage" />
          {openedLabel && <FactsRow label="Opened" value={openedLabel} />}
          {paoMonths && (
            <FactsRow
              label="Period After Opening"
              value={`${paoMonths} months`}
            />
          )}
          {expiryLabel && (
            <FactsRow label="Estimated Expiry" value={expiryLabel} />
          )}
          {statusBanner && (
            <View style={[styles.statusBanner, { borderColor: statusColor }]}>
              <ThemedText type="overline" weight="extraBold">
                {statusBanner.title}
              </ThemedText>
              {statusBanner.sub && (
                <ThemedText type="caption">{statusBanner.sub}</ThemedText>
              )}
            </View>
          )}

          <FactsRule />

          <FactsHeading title="Scan Information" />
          <FactsRow label="Source" value="Product label scan" />
          <FactsRow
            label="Latest scan"
            value={formatDate(scanDate) ?? formatDate(params.createdAt) ?? "—"}
          />
          {scanText ? (
            <>
              <TouchableOpacity
                style={styles.expandRow}
                onPress={() => setScanExpanded((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8 }}
              >
                <ThemedText weight="medium">
                  {scanExpanded ? "Hide detected text" : "View detected text"}
                </ThemedText>
                <MaterialCommunityIcons
                  name={scanExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.text}
                />
              </TouchableOpacity>
              {scanExpanded && <ThemedText>{scanText}</ThemedText>}
            </>
          ) : (
            <ThemedText weight="medium">
              No scanned text available for this product.
            </ThemedText>
          )}
        </FactsLabel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 8 },
  infoSection: {
    gap: 8,
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 4,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerBlock: {
    gap: 10,
  },
  bulletList: {
    gap: 6,
    flex: 1,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
  },
  bulletIcon: {
    fontSize: 13,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  statusBanner: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    gap: 2,
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
});
