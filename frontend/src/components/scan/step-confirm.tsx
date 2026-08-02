import { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { createProduct, updateScanResult, analyzeIngredients } from "../../api/products";
import type { ProductCategory, ProductType, NameBrandMethod } from "../../types";
import { useScanContext } from "../../contexts/ScanContext";
import ProductForm, { ProductFormData } from "../ui/product-form";
import { DEFAULT_ICON } from "../ui/icon-selector";
import { ThemedText } from "../ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "../ui/themed-button";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface StepConfirmProps {
  returnTo?: string;
  returnParams?: { templateId: string; stepId: string; stepType: string };
}

export default function StepConfirm({ returnTo, returnParams }: StepConfirmProps) {
  const {
    scanResult,
    paoMonths,
    setPaoMonths,
    frontFileKey,
    ingredientAnalysis,
    analyzingIngredients,
    setIngredientAnalysis,
    setAnalyzingIngredients,
    reset,
  } = useScanContext();
  const initialName = scanResult?.product_name || "";
  const initialBrand = scanResult?.brand || "";
  const initialCategory = (scanResult?.category as ProductCategory) || "";
  const initialProductType = (scanResult?.product_type as ProductType) || null;
  const initialMethod = scanResult?.name_brand_method as NameBrandMethod | null;

  const [formData, setFormData] = useState<ProductFormData>({
    name: initialName,
    brand: initialBrand,
    category: initialCategory,
    productType: initialProductType,
    paoMonths: paoMonths !== null ? `${paoMonths}` : "",
    icon: DEFAULT_ICON,
    openedDate: null,
    expiryDate: scanResult?.expiry_date
      ? scanResult.expiry_date.slice(0, 7)
      : null,
  });
  const [saving, setSaving] = useState(false);
  const [showFlags, setShowFlags] = useState(false);
  const hasTriggeredAnalysis = useRef(false);

  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const bgColor = colors.background;

  useEffect(() => {
    if (hasTriggeredAnalysis.current) return;
    if (!scanResult?.raw_ocr_text) return;
    if (ingredientAnalysis || analyzingIngredients) return;

    hasTriggeredAnalysis.current = true;
    setAnalyzingIngredients(true);
    analyzeIngredients(scanResult.raw_ocr_text)
      .then((result) => setIngredientAnalysis(result))
      .catch(() => {})
      .finally(() => setAnalyzingIngredients(false));
  }, [scanResult?.raw_ocr_text]);

  const normalizePao = (input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/(\d+)/);
    if (!match) return null;
    const months = parseInt(match[1], 10);
    if (months < 1 || months > 120) return null;
    return months;
  };

  const paoHint =
    paoMonths !== null
      ? `Currently set to ${paoMonths} months — edit if incorrect`
      : "PAO was not detected — enter it manually";

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Product name is required",
        position: "top",
      });
      return;
    }

    setSaving(true);
    try {
      const scanId = scanResult?.scan_id;
      const paoValue = formData.paoMonths
        ? normalizePao(formData.paoMonths)
        : null;

      const nameChanged =
        formData.name !== initialName || formData.brand !== initialBrand;
      const paoChanged = paoValue !== null && paoValue !== paoMonths;

      if ((nameChanged || paoChanged) && scanId) {
        await updateScanResult(scanId, {
          product_name: formData.name.trim() || undefined,
          brand: formData.brand.trim() || undefined,
          name_brand_method: nameChanged ? "manual" : undefined,
          pao_months: paoChanged ? paoValue : undefined,
        });
      }

      if (paoValue !== null) {
        setPaoMonths(paoValue);
      }

      const expiryComplete =
        !!formData.expiryDate && /^\d{4}-\d{2}$/.test(formData.expiryDate);

      await createProduct({
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        category: formData.category || undefined,
        product_type: formData.productType || undefined,
        icon: formData.icon || undefined,
        pao_months: expiryComplete ? null : (paoValue ?? undefined),
        expiry_date: expiryComplete
          ? `${formData.expiryDate}-01`
          : undefined,
        opened_date: formData.openedDate || undefined,
        image_s3_key: frontFileKey || undefined,
        scan_id: scanId || null,
      });

      reset();
      Toast.show({
        type: "success",
        text1: "Added",
        text2: `${formData.name.trim()} saved to your shelf`,
        position: "top",
      });
      if (returnTo && returnParams) {
        router.dismissAll();
        router.push({ pathname: returnTo, params: returnParams });
      } else {
        router.replace("/(main)/products");
      }
    } catch {
      // interceptor shows toast
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: bgColor }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <ThemedText type="h2">Confirm Product Details</ThemedText>
            <ThemedText
              type="bodySmall"
              style={{ color: colors.secondary[600] }}
            >
              Double-check and add product to your shelf!
            </ThemedText>
          </View>

          {analyzingIngredients && scanResult?.raw_ocr_text && (
            <View style={[styles.flagBadge, { borderColor: colors.neutral[400] }]}>
              <ThemedText
                type="captionLarge"
                style={{ color: colors.neutral[600] }}
              >
                Analyzing ingredients...
              </ThemedText>
            </View>
          )}

          {!analyzingIngredients && ingredientAnalysis && ingredientAnalysis.flags.length > 0 && (
            <View>
              <TouchableOpacity
                style={[styles.flagBadge, { borderColor: colors.secondary[500] }]}
                onPress={() => setShowFlags((prev) => !prev)}
                activeOpacity={0.7}
              >
                <ThemedText
                  type="captionLarge"
                  weight="medium"
                  style={{ color: colors.secondary[600] }}
                >
                  {ingredientAnalysis.flags.length} flagged ingredient{ingredientAnalysis.flags.length !== 1 ? "s" : ""}
                </ThemedText>
                <MaterialCommunityIcons
                  name={showFlags ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.secondary[600]}
                />
              </TouchableOpacity>
              {showFlags && (
                <View style={styles.flagList}>
                  {ingredientAnalysis.flags.map((flag, i) => (
                    <View key={i} style={styles.flagRow}>
                      <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={14}
                        color={colors.secondary[600]}
                      />
                      <ThemedText
                        type="caption"
                        style={{ color: colors.neutral[700], flex: 1 }}
                      >
                        {flag}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {!analyzingIngredients && ingredientAnalysis && ingredientAnalysis.flags.length === 0 && scanResult?.raw_ocr_text && (
            <View style={[styles.flagBadge, { borderColor: colors.primary[400] }]}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={16}
                color={colors.primary[600]}
              />
              <ThemedText
                type="captionLarge"
                style={{ color: colors.primary[600] }}
              >
                No flagged ingredients
              </ThemedText>
            </View>
          )}

          <ProductForm
            value={formData}
            onChange={setFormData}
            disabled={saving}
            showPaoInput
            showOpenedDate
            paoHint={paoHint}
            sourceMethod={initialMethod}
          />

          <View style={styles.buttons}>
            <ThemedButton
              alignment="center"
              onPress={handleSave}
              disabled={saving}
              loading={saving}
              color={colors.primary[600]}
              text="Store In My Shelf"
            />
            <ThemedButton
              link
              textType="caption"
              onPress={handleCancel}
              disabled={saving}
              color={colors.secondary[700]}
              text="Cancel Scan"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    gap: 4,
    alignItems: "center",
  },
  buttons: {
    alignItems: "center",
    gap: 8,
  },
  scrollContent: { padding: 24, paddingTop: 16 },
  flagBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "center",
  },
  flagList: {
    marginTop: 8,
    gap: 6,
    paddingHorizontal: 4,
  },
  flagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
