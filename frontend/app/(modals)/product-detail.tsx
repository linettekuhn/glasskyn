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
import IngredientAnalysisSection from "../../src/components/product/ingredient-analysis-section";
import { analyzeIngredients, getProductScanText } from "../../src/api/products";
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
    imageUrl: string;
    createdAt: string;
  }>();

  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [rawOcrText, setRawOcrText] = useState<string | null>(null);
  const [flaggedIngredients, setFlaggedIngredients] = useState<FlaggedIngredient[] | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);

  const paoMonths = params.paoMonths ? parseInt(params.paoMonths, 10) : null;

  const expiryLabel = (() => {
    if (!paoMonths || !params.createdAt) return null;
    const created = new Date(params.createdAt);
    const expiry = new Date(created);
    expiry.setMonth(expiry.getMonth() + paoMonths);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[expiry.getMonth()]} ${expiry.getDate()} ${expiry.getFullYear()}`;
  })();

  const fetchAndAnalyze = useCallback(async () => {
    const productId = params.productId ? parseInt(params.productId, 10) : null;
    if (!productId) {
      setIsLoadingAnalysis(false);
      return;
    }

    setIsLoadingAnalysis(true);
    try {
      const { raw_ocr_text } = await getProductScanText(productId);
      setRawOcrText(raw_ocr_text);
      if (raw_ocr_text) {
        const result = await analyzeIngredients(raw_ocr_text);
        const flags: FlaggedIngredient[] = result.flags.map((f) => ({
          name: f.split(":")[0] || f,
          reason: f.includes(":") ? f.split(":").slice(1).join(":").trim() : "Flagged by analysis",
        }));
        setFlaggedIngredients(flags.length > 0 ? flags : []);
      }
    } catch {
      setFlaggedIngredients(null);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, [params.productId]);

  useEffect(() => {
    fetchAndAnalyze();
  }, [fetchAndAnalyze]);

  const iconConfig = params.icon ? fromValue(params.icon) : null;

  const categoryLabel = params.category
    ? params.category.charAt(0).toUpperCase() + params.category.slice(1)
    : null;

  const productTypeLabel = params.productType
    ? params.productType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      edges={["top", "bottom"]}
    >
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
            <Image source={{ uri: params.imageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : iconConfig ? (
            <View style={[styles.iconBox, { backgroundColor: colors.secondary[200] }]}>
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
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.neutral[600] }}
            >
              {params.brand}
            </ThemedText>
          )}

          <View style={styles.metaRow}>
            {categoryLabel && (
              <View style={[styles.chip, { backgroundColor: colors.primary[100] }]}>
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
              <View style={[styles.chip, { backgroundColor: colors.secondary[100] }]}>
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

          {paoMonths && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color={colors.neutral[600]}
              />
              <ThemedText type="bodySmall" style={{ color: colors.neutral[700] }}>
                PAO: {paoMonths} month{paoMonths !== 1 ? "s" : ""}
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
              <ThemedText type="bodySmall" style={{ color: colors.neutral[700] }}>
                Expires: {expiryLabel}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.neutral[300] }]} />

        <View style={styles.section}>
          <ThemedText type="h3" weight="semiBold">
            Ingredient Analysis
          </ThemedText>
          <IngredientAnalysisSection
            rawIngredientText={rawOcrText}
            flaggedIngredients={flaggedIngredients}
            isLoading={isLoadingAnalysis}
            onRetry={fetchAndAnalyze}
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
  divider: {
    height: 1,
    marginBottom: 24,
  },
  section: {
    gap: 16,
  },
});
