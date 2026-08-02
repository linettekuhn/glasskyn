import { useState } from "react";
import { View, StyleSheet, useColorScheme, Platform } from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type {
  ProductCategory,
  ProductType,
  NameBrandMethod,
} from "../../types";
import { ThemedText } from "./themed-text";
import ThemedTextInput from "./themed-text-input";
import ThemedDropdown from "./themed-dropdown";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "./themed-button";
import IconSelector from "./icon-selector";
import ProductCard from "./product-card";

export interface ProductFormData {
  name: string;
  brand: string;
  category: ProductCategory | null;
  productType: ProductType | null;
  paoMonths: string;
  icon: string;
  openedDate: string | null;
}

interface ProductFormProps {
  value: ProductFormData;
  onChange: (data: ProductFormData) => void;
  disabled?: boolean;
  showPaoInput?: boolean;
  showOpenedDate?: boolean;
  showProductType?: boolean;
  paoHint?: string;
  sourceMethod?: NameBrandMethod | null;
}

const CATEGORIES: ProductCategory[] = ["skincare", "makeup", "haircare"];

const MONTHS = [
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

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOpenedDate(iso: string | null): string {
  if (!iso) return "Not opened yet";
  const date = new Date(`${iso}T00:00:00`);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

const PRODUCT_TYPES: { key: ProductType; label: string }[] = [
  { key: "cleanser", label: "Cleanser" },
  { key: "toner", label: "Toner" },
  { key: "serum", label: "Serum" },
  { key: "moisturizer", label: "Moisturizer" },
  { key: "exfoliant", label: "Exfoliant" },
  { key: "mask", label: "Mask" },
  { key: "spot_treatment", label: "Spot Treatment" },
  { key: "spf", label: "SPF" },
  { key: "oil", label: "Oil" },
  { key: "other", label: "Other" },
];

export default function ProductForm({
  value,
  onChange,
  disabled,
  showPaoInput,
  showOpenedDate,
  showProductType = true,
  paoHint,
  sourceMethod,
}: ProductFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [showDatePicker, setShowDatePicker] = useState(false);

  const pickerValue = (() => {
    const parsed = value.openedDate ? new Date(`${value.openedDate}T00:00:00`) : new Date();
    return parsed;
  })();

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }
    if (event.type === "dismissed" || !date) return;
    onChange({ ...value, openedDate: toISODate(date) });
  };

  return (
    <View style={styles.form}>
      <View style={styles.inputWrapper}>
        <ThemedText
          type="caption"
          weight="bold"
          style={{ color: colors.primary[700] }}
        >
          CATEGORY
        </ThemedText>
        <View style={styles.segmentedControl}>
          {CATEGORIES.map((cat) => (
            <ThemedButton
              key={cat}
              text={cat.charAt(0).toUpperCase() + cat.slice(1)}
              textType="bodySmall"
              color={
                value.category === cat
                  ? colors.secondary[500]
                  : colors.secondary[700]
              }
              outlined={!(value.category === cat)}
              onPress={() =>
                onChange({
                  ...value,
                  category: value.category === cat ? null : cat,
                })
              }
              disabled={disabled}
            />
          ))}
        </View>
      </View>
      <View style={styles.inputWrapper}>
        <ThemedText
          type="caption"
          weight="bold"
          style={{ color: colors.primary[700] }}
        >
          ICON
        </ThemedText>
        <IconSelector
          value={value.icon}
          onChange={(icon) => onChange({ ...value, icon })}
        />
      </View>
      <View style={styles.inputWrapper}>
        <ThemedText
          type="caption"
          weight="bold"
          style={{ color: colors.primary[700] }}
        >
          PRODUCT NAME
        </ThemedText>
        <ThemedTextInput
          value={value.name}
          onChangeText={(text) => onChange({ ...value, name: text })}
          placeholder="Enter product name here"
          autoCapitalize="none"
          editable={!disabled}
        />
      </View>

      <View style={styles.inputWrapper}>
        <ThemedText
          type="caption"
          weight="bold"
          style={{ color: colors.primary[700] }}
        >
          BRAND
        </ThemedText>
        <ThemedTextInput
          value={value.brand}
          onChangeText={(text) => onChange({ ...value, brand: text })}
          placeholder="Enter brand here"
          autoCapitalize="none"
          editable={!disabled}
        />
      </View>
      {showProductType && value.category === "skincare" && (
        <View style={styles.inputWrapper}>
          <ThemedText
            type="caption"
            weight="bold"
            style={{ color: colors.primary[700] }}
          >
            PRODUCT TYPE
          </ThemedText>
          <ThemedDropdown
            options={PRODUCT_TYPES.map((pt) => ({
              label: pt.label,
              value: pt.key,
            }))}
            value={value.productType}
            onChange={(v) =>
              onChange({ ...value, productType: v as ProductType })
            }
            placeholder="Select product type"
            disabled={disabled}
          />
        </View>
      )}
      {sourceMethod === "barcode_lookup" && (
        <ThemedText type="caption">
          Name & brand extracted from barcode data
        </ThemedText>
      )}
      {sourceMethod === "llm_extraction" && (
        <ThemedText type="caption">
          Name & brand extracted from label
        </ThemedText>
      )}

      {showPaoInput && (
        <>
          <View style={styles.inputWrapper}>
            <ThemedText
              type="caption"
              weight="bold"
              style={{ color: colors.primary[700] }}
            >
              PAO (PERIOD AFTER OPENING)
            </ThemedText>
            <ThemedTextInput
              value={value.paoMonths}
              onChangeText={(text) => onChange({ ...value, paoMonths: text })}
              placeholder="Enter PAO in months here"
              autoCapitalize="none"
              editable={!disabled}
            />
          </View>
        </>
      )}

      {showOpenedDate && (
        <View style={styles.inputWrapper}>
          <ThemedText
            type="caption"
            weight="bold"
            style={{ color: colors.primary[700] }}
          >
            OPENED DATE
          </ThemedText>
          <ThemedButton
            outlined
            alignment="center"
            onPress={() => setShowDatePicker(true)}
            disabled={disabled}
            color={colors.secondary[700]}
            text={formatOpenedDate(value.openedDate)}
          />
          {value.openedDate && (
            <ThemedButton
              link
              textType="caption"
              onPress={() => onChange({ ...value, openedDate: null })}
              disabled={disabled}
              color={colors.secondary[700]}
              text="Clear opened date"
            />
          )}
          <ThemedButton
            link
            textType="caption"
            onPress={() => onChange({ ...value, openedDate: toISODate(new Date()) })}
            disabled={disabled}
            color={colors.primary[600]}
            text="Mark as opened today"
          />
          {showDatePicker && (
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    gap: 8,
  },
  segmentedControl: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
    marginRight: "auto",
  },
  form: {
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
});
