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
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import { createProduct, updateProduct } from "../../src/api/products";
import type { ProductCategory } from "../../src/types";
import ProductForm, {
  ProductFormData,
} from "../../src/components/ui/product-form";
import { DEFAULT_ICON } from "../../src/components/ui/icon-selector";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";

export default function AddProductScreen() {
  const params = useLocalSearchParams<{
    editId?: string;
    name?: string;
    brand?: string;
    category?: string;
    icon?: string;
    imageS3Key?: string;
    scanId?: string;
  }>();
  const editId = params.editId ? Number(params.editId) : null;

  const [formData, setFormData] = useState<ProductFormData>({
    name: params.name ?? "",
    brand: params.brand ?? "",
    category: (params.category as ProductCategory) || "",
    paoMonths: "",
    icon: params.icon || DEFAULT_ICON,
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const bgColor = colors.background;

  const isEditing = editId !== null;

  const resetForm = () => {
    setFormData({ name: "", brand: "", category: "", paoMonths: "", icon: DEFAULT_ICON });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Product name is required",
        position: "top",
      });
      return;
    }

    setSubmitLoading(true);
    try {
      const data: Parameters<typeof createProduct>[0] = {
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        category: formData.category || undefined,
        icon: formData.icon || undefined,
        image_s3_key: params.imageS3Key || undefined,
      };

      if (!isEditing) {
        const scanId = params.scanId ? Number(params.scanId) : null;
        if (scanId) {
          data.scan_id = scanId;
        }
      }

      if (isEditing) {
        await updateProduct(editId, data);
        Toast.show({
          type: "success",
          text1: "Updated",
          text2: `${formData.name.trim()} saved`,
          position: "top",
        });
        router.back();
      } else {
        await createProduct(data);
        Toast.show({
          type: "success",
          text1: "Added",
          text2: `${formData.name.trim()} saved`,
          position: "top",
        });
        router.replace("/(main)/products");
      }
    } catch {
      // interceptor shows toast
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bgColor }]}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.containerInner}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <ThemedText type="h2">
              {isEditing ? "Edit Product Details" : "Add a New Product"}
            </ThemedText>
            <ThemedText
              type="bodySmall"
              style={{ color: colors.secondary[600] }}
            >
              {isEditing
                ? "Tweak anything that needs a little fixing!"
                : "What's the new addition to your shelf?"}
            </ThemedText>
          </View>

          <ProductForm
            value={formData}
            onChange={setFormData}
            disabled={submitLoading}
          />

          <View style={styles.buttons}>
            <ThemedButton
              alignment="center"
              onPress={handleSubmit}
              disabled={submitLoading}
              loading={submitLoading}
              color={colors.primary[600]}
              text={isEditing ? "Store In My Shelf" : "Store In My Shelf"}
            />
            <ThemedButton
              link
              textType="caption"
              onPress={() => (isEditing ? router.back() : resetForm())}
              disabled={submitLoading}
              color={colors.secondary[700]}
              text={isEditing ? "Cancel Edit" : "Clear Details"}
            />
          </View>
        </ScrollView>
        <Toast />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerInner: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  header: {
    gap: 4,
    alignItems: "center",
  },
  buttons: {
    alignItems: "center",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#f0f0f0",
  },
  clearButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#6c63ff",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
