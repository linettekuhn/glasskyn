import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { router } from "expo-router";
import {
  MaterialCommunityIcons,
  MaterialIcons,
  FontAwesome6,
} from "@expo/vector-icons";
import { deleteProduct } from "../../api/products";
import type { Product } from "../../types";
import { Colors, getTheme } from "@/constants/theme";
import { fromValue } from "./icon-selector";
import { ThemedText } from "./themed-text";
import { useEffect, useState } from "react";

interface ProductCardProps {
  product: Product;
  onDelete: () => void;
  isPreview?: boolean;
}

export default function ProductCard({
  product,
  onDelete,
  isPreview,
}: ProductCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const iconConfig = product.icon ? fromValue(product.icon) : null;

  const [expiryLabel, setExpiryLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!product.pao_months) {
      setExpiryLabel(null);
      return;
    }
    const created = product.created_at
      ? new Date(product.created_at)
      : new Date();
    const expiry = new Date(created);
    expiry.setMonth(expiry.getMonth() + product.pao_months);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    setExpiryLabel(
      `${months[expiry.getMonth()]} ${expiry.getDate()} ${expiry.getFullYear()}`,
    );
  }, [product.pao_months, product.created_at]);

  const handleEdit = () => {
    router.push({
      pathname: "/(modals)/add-product",
      params: {
        editId: String(product.id),
        name: product.name,
        brand: product.brand || "",
        category: product.category || "",
        icon: product.icon || "",
        pao_months: product.pao_months ? String(product.pao_months) : "",
        imageUrl: product.image_url || "",
        imageS3Key: product.image_s3_key || "",
      },
    });
  };

  const handleDelete = () => {
    Alert.alert("Delete", `Delete "${product.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProduct(product.id);
            onDelete();
          } catch {
            // toast shown by interceptor
          }
        },
      },
    ]);
  };

  const renderIcon = () => {
    if (!iconConfig) {
      return null;
    }
    const IconComponent =
      iconConfig.family === "MaterialIcons"
        ? MaterialIcons
        : iconConfig.family === "FontAwesome6"
          ? FontAwesome6
          : MaterialCommunityIcons;
    return (
      <View
        style={[styles.iconBox, { backgroundColor: colors.secondary[200] }]}
      >
        <IconComponent
          name={iconConfig.name as any}
          size={24}
          color={colors.secondary[700]}
        />
      </View>
    );
  };

  return (
    <View style={[styles.card, { borderColor: colors.secondary[300] }]}>
      {renderIcon()}
      <View style={styles.cardBody}>
        <ThemedText type="bodyLarge" weight="semiBold">
          {product.name ? product.name : "Product Name"}
        </ThemedText>
        <ThemedText type="bodySmall" style={{ color: colors.neutral[700] }}>
          {product.brand ? product.brand : "Brand"}
        </ThemedText>
        {expiryLabel && (
          <ThemedText
            type="captionSmall"
            weight="extraLight"
            style={{ color: colors.neutral[700] }}
          >
            Expires {expiryLabel}
          </ThemedText>
        )}
      </View>
      {!isPreview && (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleEdit}
            style={[
              styles.actionButton,
              { borderColor: colors.secondary[300] },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={18}
              color={colors.secondary[700]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            style={[
              styles.actionButton,
              { borderColor: colors.secondary[300] },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color={colors.secondary[700]}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    gap: 16,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: {
    flex: 1,
  },
  actions: {
    justifyContent: "center",
    gap: 4,
    paddingVertical: 2,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
