import { useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import LoadingSpinner from "../../src/components/ui/loading-spinner";
import { useProducts } from "../../src/hooks/use-products";
import { Product, ProductCategory } from "../../src/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ProductCard from "../../src/components/ui/product-card";

const categoryLabels: { key: "all" | ProductCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "skincare", label: "Skincare" },
  { key: "makeup", label: "Makeup" },
  { key: "haircare", label: "Haircare" },
];

export default function VanityScreen() {
  const { products, loading, refetch } = useProducts();
  const [selectedCategories, setSelectedCategories] = useState<
    ProductCategory[]
  >([]);
  const colorScheme = useColorScheme();
  const router = useRouter();
  const colors = Colors[getTheme(colorScheme)];
  const bgColor = colors.background;
  const filteredProducts =
    selectedCategories.length === 0
      ? products
      : products.filter(
          (p) => p.category && selectedCategories.includes(p.category),
        );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (products.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <View style={{ alignItems: "center" }}>
          <ThemedText type="h1">Your vanity is empty</ThemedText>
          <ThemedText type="bodyLarge">
            Scan your first product to start tracking
          </ThemedText>
        </View>
        <ThemedButton
          LeftIconComponent={MaterialCommunityIcons}
          leftIconName="qrcode-scan"
          text="Scan Product"
          onPress={() => router.push("/(main)/scanner")}
          alignment="center"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View>
        <ThemedText type="h1">My vanity</ThemedText>
        <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
          Organize and monitor your cosmetics.
        </ThemedText>
      </View>

      <View style={styles.chipRow}>
        {categoryLabels.map((cat) => {
          const isAll = cat.key === "all";
          const catKey = cat.key as ProductCategory;
          const active = isAll
            ? selectedCategories.length === 0
            : selectedCategories.includes(catKey);
          return (
            <ThemedButton
              key={cat.key}
              text={cat.label}
              textType="bodySmall"
              color={active ? colors.primary[600] : colors.primary[500]}
              outlined={!active}
              onPress={() => {
                if (isAll) {
                  setSelectedCategories([]);
                } else {
                  setSelectedCategories((prev) => {
                    if (prev.includes(catKey)) {
                      return prev.filter((c) => c !== catKey);
                    }
                    return prev.length === 2 ? [] : [...prev, catKey];
                  });
                }
              }}
            />
          );
        })}
      </View>

      {filteredProducts.length === 0 ? (
        <View style={styles.emptyFilter}>
          <ThemedText style={{ color: colors.neutral[700] }}>
            No products in this category
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item: Product) => item.id.toString()}
          renderItem={({ item }: { item: Product }) => (
            <ProductCard product={item} onDelete={refetch} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} />
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.secondary[500] }]}
        onPress={() => router.push("/(main)/scanner")}
      >
        <MaterialCommunityIcons size={32} name="plus" color={bgColor} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  chipRow: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 24,
  },
  emptyFilter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  listContent: {
    paddingBottom: 96,
    gap: 12,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
