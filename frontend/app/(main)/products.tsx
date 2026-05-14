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
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Toast from "react-native-toast-message";
import LoadingSpinner from "../../src/components/LoadingSpinner";
import { getProducts, deleteProduct } from "../../src/api/products";
import { Product } from "../../src/types";

export default function MyShelfScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No products yet</Text>
        <Text style={styles.emptySubtitle}>
          Scan a product to add it to your shelf
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(main)/scanner")}
        >
          <Text style={styles.addButtonText}>Scan Product</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(main)/scanner")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  addButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
    backgroundColor: "#6c63ff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "400",
  },
});