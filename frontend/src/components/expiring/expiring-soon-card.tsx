import { useEffect, useState } from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import Animated, {
  FadeIn,
  FadeOutDown,
  LinearTransition,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useProducts } from "@/hooks/use-products";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import GlassSurface from "@/components/ui/glass-surface";
import ExpiringProductRow from "./expiring-product-row";
import { isExpiringSoon, sortByExpiry } from "@/utils/expiry";
import { markProductReplaced, deleteProduct } from "@/api/products";
import type { Product } from "@/types";

const MAX_ROWS = 3;

export default function ExpiringSoonCard() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { products, loading } = useProducts();
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    setItems(products.filter(isExpiringSoon).sort(sortByExpiry));
  }, [products]);

  const handleMarkReplaced = async (product: Product, expiryDate?: string) => {
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

  if (loading || items.length === 0) return null;

  return (
    <GlassSurface style={styles.card}>
      <ThemedText type="overline" weight="semiBold">
        Expiring Cosmetics
      </ThemedText>

      {items.length === 0 ? (
        <Animated.View entering={FadeIn}>
          <ThemedText type="caption" style={{ color: colors.neutral[600] }}>
            Nothing expiring soon, you're all set
          </ThemedText>
        </Animated.View>
      ) : (
        <>
          {items.slice(0, MAX_ROWS).map((product) => (
            <Animated.View
              key={product.id}
              layout={LinearTransition}
              exiting={FadeOutDown}
            >
              <ExpiringProductRow
                product={product}
                onMarkReplaced={handleMarkReplaced}
                onRemove={handleRemove}
              />
            </Animated.View>
          ))}

          {items.length > MAX_ROWS && (
            <ThemedButton
              link
              textType="bodySmall"
              alignment="flex-start"
              text={`See all (${items.length})`}
              onPress={() => router.push("/(modals)/expiring-products")}
              color={colors.primary[600]}
            />
          )}
        </>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 12,
  },
});
