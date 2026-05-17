import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Image,
  useColorScheme,
} from "react-native";
import { router, useFocusEffect, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import LoadingSpinner from "../../src/components/ui/loading-spinner";
import { getProducts, deleteProduct } from "../../src/api/products";
import { Product, ProductCategory } from "../../src/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const categoryLabels: { key: "all" | ProductCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "skincare", label: "Skincare" },
  { key: "makeup", label: "Makeup" },
  { key: "haircare", label: "Haircare" },
];

export default function MyShelfScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load products",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts]),
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (products.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: bgColor }]}>
        <View style={{ alignItems: "center" }}>
          <ThemedText type="h1">Your shelf is empty</ThemedText>
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
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View>
        <ThemedText type="h1">My shelf</ThemedText>
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
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.thumbnail}
                />
              ) : null}
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.brand || item.category ? (
                  <Text style={styles.cardMeta}>
                    {[item.brand, item.category].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() =>
                    router.push({
                      pathname: "/(modals)/add-product",
                      params: {
                        editId: String(item.id),
                        name: item.name,
                        brand: item.brand || "",
                        category: item.category || "",
                        imageUrl: item.image_url || "",
                        imageS3Key: item.image_s3_key || "",
                      },
                    })
                  }
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() =>
                    Alert.alert("Delete", `Delete "${item.name}"?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await deleteProduct(item.id);
                            fetchProducts();
                          } catch {
                            // toast shown by interceptor
                          }
                        },
                      },
                    ])
                  }
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchProducts} />
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
    paddingTop: 32,
    paddingHorizontal: 20,
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
    padding: 16,
    paddingBottom: 96,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#f0f0f0",
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 14,
    color: "#888",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6c63ff",
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fef0f0",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e74c3c",
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
