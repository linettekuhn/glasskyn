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
import GlassSurface from "./glass-surface";

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
    const expiry = product.expiry_date
      ? new Date(`${product.expiry_date}T00:00:00`)
      : null;
    if (!expiry) {
      if (product.pao_months && product.created_at) {
        const created = new Date(product.created_at);
        const fallback = new Date(created);
        fallback.setMonth(fallback.getMonth() + product.pao_months);
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
          `${months[fallback.getMonth()]} ${fallback.getDate()} ${fallback.getFullYear()}`,
        );
      } else {
        setExpiryLabel(null);
      }
      return;
    }
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
  }, [product.expiry_date, product.pao_months, product.created_at]);

  const expiryStatus =
    product.days_until_expiry === null ||
    product.days_until_expiry === undefined
      ? null
      : product.days_until_expiry < 0
        ? "expired"
        : product.days_until_expiry <= 30
          ? "expiring"
          : "ok";

  const expiryColor = (() => {
    if (expiryStatus === "expired") return "#A10000";
    if (expiryStatus === "expiring") return colors.secondary[500];
    return colors.neutral[700];
  })();

  const handleEdit = () => {
    router.push({
      pathname: "/(modals)/add-product",
      params: {
        editId: String(product.id),
        name: product.name,
        brand: product.brand || "",
        category: product.category || "",
        product_type: product.product_type || "",
        icon: product.icon || "",
        pao_months: product.pao_months ? String(product.pao_months) : "",
        opened_date: product.opened_date || "",
        expiry_date: product.expiry_date || "",
        imageUrl: product.image_url || "",
        imageS3Key: product.image_s3_key || "",
      },
    });
  };

  const handleSeeMore = () => {
    router.push({
      pathname: "/(modals)/product-detail",
      params: {
        productId: String(product.id),
        name: product.name,
        brand: product.brand || "",
        category: product.category || "",
        productType: product.product_type || "",
        icon: product.icon || "",
        paoMonths: product.pao_months ? String(product.pao_months) : "",
        openedDate: product.opened_date || "",
        expiryDate: product.expiry_date || "",
        daysUntilExpiry: product.days_until_expiry
          ? String(product.days_until_expiry)
          : "",
        imageUrl: product.image_url || "",
        createdAt: product.created_at,
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
    <GlassSurface style={styles.card}>
      {renderIcon()}
      <View style={styles.cardBody}>
        <ThemedText type="bodyLarge" weight="semiBold" numberOfLines={1}>
          {product.name ? product.name : "Product Name"}
        </ThemedText>
        <ThemedText type="bodySmall" style={{ color: colors.neutral[700] }}>
          {product.brand ? product.brand : "Brand"}
        </ThemedText>
        {expiryLabel && (
          <ThemedText
            type="captionSmall"
            weight="extraLight"
            style={{ color: expiryColor }}
          >
            Expires {expiryLabel}
          </ThemedText>
        )}
        {!isPreview && (
          <TouchableOpacity
            onPress={handleSeeMore}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={styles.seeMoreRow}
          >
            <ThemedText
              type="captionSmall"
              weight="medium"
              style={{ color: colors.primary[600] }}
            >
              See more
            </ThemedText>
            <MaterialCommunityIcons
              name="chevron-right"
              size={14}
              color={colors.primary[600]}
            />
          </TouchableOpacity>
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
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
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
  seeMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
});
