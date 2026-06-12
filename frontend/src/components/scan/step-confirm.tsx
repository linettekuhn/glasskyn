import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { createProduct, updateScanResult } from "../../api/products";
import type { ProductCategory, NameBrandMethod } from "../../types";
import { useScanContext } from "../../contexts/ScanContext";
import ProductForm, { ProductFormData } from "../ui/product-form";
import { DEFAULT_ICON } from "../ui/icon-selector";
import { ThemedText } from "../ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "../ui/themed-button";

export default function StepConfirm() {
  const { scanResult, paoMonths, setPaoMonths, frontFileKey, reset } =
    useScanContext();
  const initialName = scanResult?.product_name || "";
  const initialBrand = scanResult?.brand || "";
  const initialCategory = (scanResult?.category as ProductCategory) || "";
  const initialMethod = scanResult?.name_brand_method as NameBrandMethod | null;

  const [formData, setFormData] = useState<ProductFormData>({
    name: initialName,
    brand: initialBrand,
    category: initialCategory,
    paoMonths: paoMonths !== null ? `${paoMonths}` : "",
    icon: DEFAULT_ICON,
  });
  const [saving, setSaving] = useState(false);

  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const bgColor = colors.background;

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

      await createProduct({
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        category: formData.category || undefined,
        icon: formData.icon || undefined,
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
      router.replace("/(main)/products");
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
      style={[styles.container, { backgroundColor: bgColor }]}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.inner}
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

          <ProductForm
            value={formData}
            onChange={setFormData}
            disabled={saving}
            showPaoInput
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
  inner: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 16 },
});
