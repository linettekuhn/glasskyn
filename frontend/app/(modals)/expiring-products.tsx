import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useProducts } from "@/hooks/use-products";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import LoadingSpinner from "@/components/ui/loading-spinner";
import ExpiringProductRow from "@/components/expiring/expiring-product-row";
import { isExpiringSoon, sortByExpiry } from "@/utils/expiry";
import { markProductReplaced, deleteProduct } from "@/api/products";
import type { Product } from "@/types";

export default function ExpiringProductsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { products, loading } = useProducts();
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    setItems(products.filter(isExpiringSoon).sort(sortByExpiry));
  }, [products]);

  const handleMarkReplaced = async (
    product: Product,
    expiryDate?: string,
  ) => {
    const previous = items;
    setItems((cur) => cur.filter((p) => p.id !== product.id));
    try {
      await markProductReplaced(product.id, expiryDate);
    } catch {
      setItems(previous);
    }
  };

  const handleRemove = async (product: Product) => {
    const previous = items;
    setItems((cur) => cur.filter((p) => p.id !== product.id));
    try {
      await deleteProduct(product.id);
    } catch {
      setItems(previous);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <ThemedText type="h2">Expiring products</ThemedText>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText
            type="caption"
            style={{ color: colors.neutral[600] }}
          >
            Nothing expiring soon, you're all set
          </ThemedText>
        </View>
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          itemLayoutAnimation={LinearTransition}
          renderItem={({ item }) => (
            <ExpiringProductRow
              product={item}
              onMarkReplaced={handleMarkReplaced}
              onRemove={handleRemove}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 4,
  },
  empty: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
  },
});
