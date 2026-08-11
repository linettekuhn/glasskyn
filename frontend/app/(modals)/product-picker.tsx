import { useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useTemplateSelection } from "@/contexts/TemplateContext";
import { useProducts } from "@/hooks/use-products";
import type { Product } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { STEP_TO_PRODUCT_TYPES } from "@/constants/routine";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import GlassSurface, { withAlpha } from "@/components/ui/glass-surface";
import { MaterialIcons } from "@expo/vector-icons";

export default function ProductPickerScreen() {
  const { stepId, stepType } = useLocalSearchParams<{
    stepId: string;
    stepType: string;
  }>();
  const { setPendingProduct } = useTemplateSelection();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { products: allProducts, loading } = useProducts();

  const products = useMemo(() => {
    const allowed = STEP_TO_PRODUCT_TYPES[stepType ?? "other"] ?? ["other"];
    return allProducts.filter(
      (p: Product) => p.product_type && allowed.includes(p.product_type),
    );
  }, [allProducts, stepType]);

  const handleSelect = (product: Product) => {
    if (!stepId) return;
    setPendingProduct(Number(stepId), product.id);
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <ThemedText type="h2">Choose a Product</ThemedText>
        <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
          Compatible products from your vanity
        </ThemedText>
      </View>

      {products.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="inbox" size={48} color={colors.neutral[400]} />
          <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
            No compatible products found
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: colors.neutral[500] }}>
            Add a product to your vanity first
          </ThemedText>
          <ThemedButton
            text="Scan a Product"
            onPress={() => router.push("/(modals)/scan")}
            leftIconName="camera"
            LeftIconComponent={MaterialIcons}
          />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.productRow,
                {
                  borderColor: colors.neutral[300],
                  backgroundColor: withAlpha(colors.background, 0.4),
                },
              ]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <View style={styles.productInfo}>
                <ThemedText type="bodyLarge" weight="medium">
                  {item.name}
                </ThemedText>
                {item.brand && (
                  <ThemedText
                    type="bodySmall"
                    style={{ color: colors.neutral[600] }}
                  >
                    {item.brand}
                  </ThemedText>
                )}
              </View>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.neutral[500]}
              />
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <ThemedButton
              text="Scan a Product"
              onPress={() => router.push("/(modals)/scan")}
              leftIconName="camera"
              LeftIconComponent={MaterialIcons}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <GlassSurface
        style={[styles.bottomBar, { borderTopColor: colors.neutral[300] }]}
        radius={0}
        border={false}
      >
        <ThemedButton text="Cancel" outlined onPress={() => router.back()} />
      </GlassSurface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 16,
    gap: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  listContent: {
    paddingBottom: 40,
    gap: 8,
    paddingTop: 16,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  bottomBar: {
    paddingVertical: 16,
    borderTopWidth: 1,
  },
});
