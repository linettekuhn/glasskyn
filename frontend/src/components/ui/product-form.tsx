import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  Platform,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
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
import GlassSurface from "./glass-surface";
import { Colors, getTheme } from "@/constants/theme";
import Pao12 from "@/../assets/icons/pao12.svg";
import ThemedButton from "./themed-button";
import IconSelector from "./icon-selector";
import ProductCard from "./product-card";
import IconButton from "./icon-button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Tooltip from "react-native-walkthrough-tooltip";

export interface ProductFormData {
  name: string;
  brand: string;
  category: ProductCategory | null;
  productType: ProductType | null;
  paoMonths: string;
  icon: string;
  openedDate: string | null;
  expiryDate: string | null;
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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOpenedDate(iso: string | null): string {
  if (!iso) return "Not opened";
  const date = new Date(`${iso}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

const MONTH_OPTIONS = MONTHS.map((label, i) => ({
  label,
  value: String(i + 1).padStart(2, "0"),
  displayText: String(i + 1),
}));

function buildYearOptions(): { label: string; value: string }[] {
  const current = new Date().getFullYear();
  const options: { label: string; value: string }[] = [];
  for (let y = current; y <= current + 20; y++) {
    options.push({ label: String(y), value: String(y) });
  }
  return options;
}

const YEAR_OPTIONS = buildYearOptions();

function splitExpiryDate(iso: string | null): {
  month: string | null;
  year: string | null;
} {
  if (!iso) return { month: null, year: null };
  const parts = iso.split("-");
  if (parts.length === 2) {
    return { month: parts[1] ?? null, year: parts[0] ?? null };
  }
  if (parts.length === 1) {
    const value = parts[0];
    if (/^\d{4}$/.test(value)) return { month: null, year: value };
    if (/^\d{2}$/.test(value)) return { month: value, year: null };
  }
  return { month: null, year: null };
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
  const [showPaoTooltip, setShowPaoTooltip] = useState(false);
  const [expiryMode, setExpiryMode] = useState(!!value.expiryDate);
  const openedDateDefaulted = useRef(false);

  const expiryComplete =
    !!value.expiryDate && /^\d{4}-\d{2}$/.test(value.expiryDate);
  const paoFilled = value.paoMonths.trim() !== "";
  const showOpenedDateSection = showOpenedDate && (expiryComplete || paoFilled);

  useEffect(() => {
    if (
      showOpenedDateSection &&
      !value.openedDate &&
      !openedDateDefaulted.current
    ) {
      openedDateDefaulted.current = true;
      onChange({ ...value, openedDate: toISODate(new Date()) });
    }
  }, [showOpenedDateSection, value, onChange]);

  const handleSwitchToExpiry = () => {
    setExpiryMode(true);
    onChange({ ...value, paoMonths: "" });
  };

  const handleSwitchToPao = () => {
    setExpiryMode(false);
    onChange({ ...value, expiryDate: null });
  };

  const handleExpiryPartChange = (
    part: "month" | "year",
    partValue: string,
  ) => {
    const { month, year } = splitExpiryDate(value.expiryDate);
    const nextMonth = part === "month" ? partValue : month;
    const nextYear = part === "year" ? partValue : year;
    if (nextMonth && nextYear) {
      onChange({ ...value, expiryDate: `${nextYear}-${nextMonth}` });
    } else if (nextMonth) {
      onChange({ ...value, expiryDate: nextMonth });
    } else if (nextYear) {
      onChange({ ...value, expiryDate: nextYear });
    }
  };

  const pickerValue = (() => {
    const parsed = value.openedDate
      ? new Date(`${value.openedDate}T00:00:00`)
      : new Date();
    return parsed;
  })();

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
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

      {showPaoInput && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ alignItems: "flex-start" }}>
              {expiryMode ? (
                <ThemedText
                  type="caption"
                  weight="bold"
                  style={{ color: colors.primary[700] }}
                >
                  EXPIRATION DATE
                </ThemedText>
              ) : (
                <Tooltip
                  isVisible={showPaoTooltip}
                  content={
                    <View style={styles.paoTooltipContent}>
                      <Pao12
                        width={32}
                        height={32}
                        color={colors.neutral[800]}
                      />
                      <ThemedText type="caption" style={{ color: colors.text }}>
                        The PAO symbol (an open-jar icon) shows how many months
                        a product stays safe and effective after opening.
                      </ThemedText>
                    </View>
                  }
                  contentStyle={{
                    backgroundColor: colors.background,
                    borderRadius: 10,
                  }}
                  placement="top"
                  onClose={() => setShowPaoTooltip(false)}
                >
                  <Pressable
                    style={styles.paoLabelRow}
                    onPress={() => setShowPaoTooltip(true)}
                    disabled={disabled}
                  >
                    <ThemedText
                      type="caption"
                      weight="bold"
                      style={{ color: colors.primary[700] }}
                    >
                      PAO
                    </ThemedText>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={14}
                      color={colors.primary[700]}
                    />
                  </Pressable>
                </Tooltip>
              )}
              <ThemedButton
                link
                textType="caption"
                onPress={expiryMode ? handleSwitchToPao : handleSwitchToExpiry}
                disabled={disabled}
                color={colors.secondary[700]}
                text={expiryMode ? "Use PAO instead" : "No PAO? Use expiy date"}
                alignment="flex-start"
              />
            </View>
            {!expiryMode ? (
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <ThemedTextInput
                  value={value.paoMonths}
                  onChangeText={(text) =>
                    onChange({ ...value, paoMonths: text })
                  }
                  placeholder="Enter PAO in months"
                  autoCapitalize="none"
                  editable={!disabled}
                  keyboardType="number-pad"
                />
              </View>
            ) : (
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <View style={styles.expiryRow}>
                  <ThemedDropdown
                    textType="body"
                    options={MONTH_OPTIONS}
                    value={splitExpiryDate(value.expiryDate).month}
                    onChange={(v) => handleExpiryPartChange("month", v)}
                    placeholder="Month"
                    disabled={disabled}
                    style={styles.expiryMonth}
                  />
                  <ThemedDropdown
                    textType="body"
                    options={YEAR_OPTIONS}
                    value={splitExpiryDate(value.expiryDate).year}
                    onChange={(v) => handleExpiryPartChange("year", v)}
                    placeholder="Year"
                    disabled={disabled}
                    style={styles.expiryYear}
                  />
                </View>
              </View>
            )}
          </View>
          {showOpenedDateSection && (
            <View
              style={[styles.inputWrapper, { justifyContent: "space-between" }]}
            >
              <View style={{ alignItems: "flex-start" }}>
                <ThemedText
                  type="caption"
                  weight="bold"
                  style={{ color: colors.primary[700] }}
                >
                  OPENED DATE
                </ThemedText>
                <ThemedButton
                  link
                  textType="caption"
                  onPress={() =>
                    onChange({ ...value, openedDate: toISODate(new Date()) })
                  }
                  disabled={disabled}
                  color={colors.secondary[700]}
                  text="Mark as opened today"
                />
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <ThemedButton
                  outlined
                  alignment="center"
                  textType="body"
                  onPress={() => setShowDatePicker(true)}
                  disabled={disabled}
                  color={colors.neutral[700]}
                  text={formatOpenedDate(value.openedDate)}
                />
                {value.openedDate && (
                  <TouchableOpacity
                    onPress={() => onChange({ ...value, openedDate: null })}
                    disabled={disabled}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name="undo-variant"
                      size={20}
                      color={colors.neutral[600]}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <Pressable
                  style={styles.dateModalBackdrop}
                  onPress={() => setShowDatePicker(false)}
                >
                  <GlassSurface
                    style={styles.dateModalCard}
                    radius={12}
                    border={false}
                    onPress={() => {}}
                  >
                    <DateTimePicker
                      value={pickerValue}
                      mode="date"
                      display={Platform.OS === "ios" ? "inline" : "calendar"}
                      maximumDate={new Date()}
                      onChange={handleDateChange}
                      accentColor={colors.tertiary[400]}
                    />
                    <ThemedButton
                      onPress={() => setShowDatePicker(false)}
                      textType="body"
                      text="Done"
                      color={colors.secondary[600]}
                    />
                  </GlassSurface>
                </Pressable>
              </Modal>
            </View>
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
  paoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paoTooltipContent: {
    alignItems: "center",
    maxWidth: 250,
    gap: 8,
    padding: 4,
  },
  segmentedControl: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
    marginRight: "auto",
  },
  expiryRow: {
    flexDirection: "row",
    gap: 4,
  },
  expiryMonth: {
    flex: 0.8,
  },
  expiryYear: {
    flex: 1,
  },
  dateModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  dateModalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  form: {
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
});
