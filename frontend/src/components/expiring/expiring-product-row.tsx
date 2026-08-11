import { useState } from "react";
import {
  View,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  useColorScheme,
  Platform,
} from "react-native";
import { router } from "expo-router";
import {
  MaterialCommunityIcons,
  MaterialIcons,
  FontAwesome6,
} from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type { Product } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { fromValue, DEFAULT_ICON } from "@/components/ui/icon-selector";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import GlassSurface from "@/components/ui/glass-surface";
import {
  getExpiryTier,
  expirySubtext,
  tierColor,
  type ExpiryTier,
} from "@/utils/expiry";

interface ExpiringProductRowProps {
  product: Product;
  onMarkReplaced: (product: Product, expiryDate?: string) => void;
  onRemove: (product: Product) => void;
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ExpiringProductRow({
  product,
  onMarkReplaced,
  onRemove,
}: ExpiringProductRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState(new Date());

  const tier: ExpiryTier | null = getExpiryTier(product.days_until_expiry);
  const accent = tier ? tierColor(tier, colors) : colors.neutral[600];
  const subtext =
    product.days_until_expiry !== null &&
    product.days_until_expiry !== undefined
      ? expirySubtext(product.days_until_expiry)
      : null;

  const iconConfig = product.icon
    ? fromValue(product.icon)
    : fromValue(DEFAULT_ICON);

  const openDetail = () => {
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
        daysUntilExpiry:
          product.days_until_expiry !== null &&
          product.days_until_expiry !== undefined
            ? String(product.days_until_expiry)
            : "",
        imageUrl: product.image_url || "",
        createdAt: product.created_at,
      },
    });
  };

  const handleMarkReplacedOption = () => {
    setMenuOpen(false);
    if (product.pao_months !== null && product.pao_months !== undefined) {
      onMarkReplaced(product);
      return;
    }
    setPickedDate(new Date());
    setPickerOpen(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "ios") {
      if (date) setPickedDate(date);
      return;
    }
    setPickerOpen(false);
    if (event.type === "dismissed" || !date) return;
    onMarkReplaced(product, toISODate(date));
  };

  const confirmExpiryDate = () => {
    setPickerOpen(false);
    onMarkReplaced(product, toISODate(pickedDate));
  };

  const handleRemove = () => {
    setMenuOpen(false);
    Alert.alert(
      "Remove from vanity",
      `Remove "${product.name}" from your vanity?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onRemove(product),
        },
      ],
    );
  };

  const renderThumbnail = () => {
    if (product.image_url) {
      return (
        <Image
          source={{ uri: product.image_url }}
          style={[styles.thumbnail, { backgroundColor: colors.neutral[200] }]}
          resizeMode="cover"
        />
      );
    }
    if (!iconConfig) return null;
    const IconComponent =
      iconConfig.family === "MaterialIcons"
        ? MaterialIcons
        : iconConfig.family === "FontAwesome6"
          ? FontAwesome6
          : MaterialCommunityIcons;
    return (
      <View
        style={[styles.thumbnail, { backgroundColor: colors.secondary[200] }]}
      >
        <IconComponent
          name={iconConfig.name as any}
          size={20}
          color={colors.secondary[700]}
        />
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.row, { borderLeftColor: accent }]}
        activeOpacity={0.7}
        onPress={openDetail}
      >
        {renderThumbnail()}
        <View style={styles.body}>
          <ThemedText
            type="bodySmall"
            weight="semiBold"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {product.name || "Product Name"}
          </ThemedText>
          {subtext && (
            <ThemedText type="captionSmall" style={{ color: accent }}>
              {subtext}
            </ThemedText>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={20}
            color={colors.neutral[700]}
          />
        </TouchableOpacity>
      </TouchableOpacity>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <GlassSurface
            style={styles.menuCard}
            radius={10}
            border={false}
            onPress={() => {}}
          >
            <ThemedText
              type="overline"
              style={[styles.menuLabel, { color: colors.neutral[600] }]}
            >
              {product.name || "Product"}
            </ThemedText>

            <TouchableOpacity
              style={styles.option}
              onPress={handleMarkReplacedOption}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={20}
                color={colors.text}
              />
              <ThemedText type="body" style={styles.optionText}>
                Mark as replaced
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleRemove}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={20}
                color={colors.error}
              />
              <ThemedText type="body" style={{ color: colors.error }}>
                Remove from vanity
              </ThemedText>
            </TouchableOpacity>
          </GlassSurface>
        </Pressable>
      </Modal>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setPickerOpen(false)}
        >
          <GlassSurface
            style={styles.sheetCard}
            radius={0}
            border={false}
            blur
            onPress={() => {}}
          >
            <ThemedText type="overline" style={{ color: colors.neutral[600] }}>
              Mark as replaced
            </ThemedText>
            <ThemedText type="h4" weight="semiBold" style={styles.sheetTitle}>
              Replacement expiration date
            </ThemedText>
            <ThemedText type="caption" style={{ color: colors.neutral[600] }}>
              "{product.name}" has no vanity life (PAO) set. When does the
              replacement expire?
            </ThemedText>

            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={pickedDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={handleDateChange}
                themeVariant={colorScheme === "dark" ? "dark" : "light"}
                locale="en"
              />
            </View>

            {Platform.OS === "ios" && (
              <View style={styles.sheetButtons}>
                <View style={{ flex: 1 }}>
                  <ThemedButton
                    text="Cancel"
                    outlined
                    alignment="center"
                    onPress={() => setPickerOpen(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedButton
                    text="Set expiration"
                    alignment="center"
                    onPress={confirmExpiryDate}
                  />
                </View>
              </View>
            )}
          </GlassSurface>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  thumbnail: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  body: {
    flex: 1,
    gap: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menuCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
  },
  menuLabel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionText: {
    flex: 1,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 6,
  },
  sheetTitle: {
    marginTop: 2,
  },
  pickerWrap: {
    alignItems: "center",
    marginTop: 8,
  },
  sheetButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
