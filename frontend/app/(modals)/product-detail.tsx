import { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "../../src/constants/theme";
import { ThemedText } from "../../src/components/ui/themed-text";
import ThemedButton from "../../src/components/ui/themed-button";
import Divider from "../../src/components/ui/divider";
import IngredientAnalysisSection from "../../src/components/product/ingredient-analysis-section";
import { getProductAnalysis } from "../../src/api/products";
import { fromValue } from "../../src/components/ui/icon-selector";
import type { FlaggedIngredient } from "../../src/types";

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

  const [allIngredients, setAllIngredients] = useState<string[] | null>(null);
  const [flaggedIngredients, setFlaggedIngredients] = useState<
    FlaggedIngredient[] | null
  >(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [safetyScore, setSafetyScore] = useState<number | null>(null);

  const paoMonths = params.paoMonths ? parseInt(params.paoMonths, 10) : null;
  const daysUntilExpiry = params.daysUntilExpiry
    ? parseInt(params.daysUntilExpiry, 10)
    : null;

  const expiryLabel = (() => {
    if (params.expiryDate) {
      const expiry = new Date(`${params.expiryDate}T00:00:00`);
      const months = [
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
      return `${months[expiry.getMonth()]} ${expiry.getDate()} ${expiry.getFullYear()}`;
    }
    if (!paoMonths || !params.createdAt) return null;
    const created = new Date(params.createdAt);
    const expiry = new Date(created);
    expiry.setMonth(expiry.getMonth() + paoMonths);
    const months = [
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
    return `${months[expiry.getMonth()]} ${expiry.getDate()} ${expiry.getFullYear()}`;
  })();

  const expiryStatus =
    daysUntilExpiry === null
      ? null
      : daysUntilExpiry < 0
        ? "expired"
        : daysUntilExpiry <= 30
          ? "expiring"
          : "ok";

  const expiryColor = (() => {
    if (expiryStatus === "expired") return "#A10000";
    if (expiryStatus === "expiring") return colors.secondary[500];
    return colors.neutral[700];
  })();

  const fetchAndAnalyze = useCallback(
    async (refresh = false) => {
      const productId = params.productId ? parseInt(params.productId, 10) : null;
      if (!productId) {
        setIsLoadingAnalysis(false);
        return;
      }

      setIsLoadingAnalysis(true);
      try {
        const result = await getProductAnalysis(productId, refresh);
        const ingredients = [
          ...result.matched.map((m) => m.raw_text),
          ...result.not_found.map((n) => n.raw_text),
        ];
        setAllIngredients(ingredients.length > 0 ? ingredients : null);
        setSafetyScore(result.overall_safety_score);
        const flags: FlaggedIngredient[] = result.flags.map((f) => {
          const flagName = f.split(":")[0] || f;
          const reason = f.includes(":")
            ? f.split(":").slice(1).join(":").trim()
            : "Flagged by analysis";
          const matched = result.matched.find(
            (m) =>
              m.raw_text.toLowerCase() === flagName.toLowerCase() ||
              m.ingredient_name.toLowerCase() === flagName.toLowerCase(),
          );
          return {
            name: flagName,
            reason,
            known_risks: matched?.known_risks ?? [],
          };
        });
        setFlaggedIngredients(flags.length > 0 ? flags : []);
      } catch {
        setFlaggedIngredients(null);
      } finally {
        setIsLoadingAnalysis(false);
      }
    },
    [params.productId],
  );

  useEffect(() => {
    fetchAndAnalyze();
  }, [fetchAndAnalyze]);

  const iconConfig = params.icon ? fromValue(params.icon) : null;

  const categoryLabel = params.category
    ? params.category.charAt(0).toUpperCase() + params.category.slice(1)
    : null;

  const productTypeLabel = params.productType
    ? params.productType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <ThemedButton
            link
            onPress={() => router.back()}
            color={colors.primary[600]}
            text="Back"
          />
        </View>

        <View style={styles.hero}>
          {params.imageUrl ? (
            <Image
              source={{ uri: params.imageUrl }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : iconConfig ? (
            <View
              style={[
                styles.iconBox,
                { backgroundColor: colors.secondary[200] },
              ]}
            >
              <MaterialCommunityIcons
                name={iconConfig.name as any}
                size={40}
                color={colors.secondary[700]}
              />
            </View>
          ) : null}
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
            {safetyScore !== null && (
              <View
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      safetyScore <= 2
                        ? colors.primary[100]
                        : safetyScore <= 4
                          ? colors.neutral[300]
                          : safetyScore <= 6
                            ? colors.secondary[100]
                            : "#A10000",
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  weight="medium"
                  style={{
                    color:
                      safetyScore <= 2
                        ? colors.primary[700]
                        : safetyScore <= 4
                          ? colors.neutral[700]
                          : safetyScore <= 6
                            ? colors.secondary[700]
                            : "#FFFFFF",
                  }}
                >
                  {safetyScore.toFixed(1)}
                </ThemedText>
              </View>
            )}
          </View>

          {paoMonths && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color={colors.neutral[600]}
              />
              <ThemedText
                type="bodySmall"
                style={{ color: colors.neutral[700] }}
              >
                PAO: {paoMonths} month{paoMonths !== 1 ? "s" : ""}
              </ThemedText>
            </View>
          )}

          {params.openedDate && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={16}
                color={colors.neutral[600]}
              />
              <ThemedText
                type="bodySmall"
                style={{ color: colors.neutral[700] }}
              >
                Opened: {params.openedDate}
              </ThemedText>
            </View>
          )}

          {expiryLabel && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="calendar-outline"
                size={16}
                color={colors.neutral[600]}
              />
              <ThemedText
                type="bodySmall"
                style={{ color: expiryColor }}
              >
                Expires: {expiryLabel}
              </ThemedText>
            </View>
          )}
        </View>

        <Divider style={{ marginBottom: 24 }} />

        <View style={styles.section}>
          <ThemedText type="h3" weight="semiBold">
            Ingredient Analysis
          </ThemedText>
          <IngredientAnalysisSection
            ingredients={allIngredients}
            flaggedIngredients={flaggedIngredients}
            isLoading={isLoadingAnalysis}
            onRetry={() => fetchAndAnalyze(true)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 8 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
  },
  productImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  iconBox: {
    width: 160,
    height: 160,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
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
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  section: {
    gap: 16,
  },
});
