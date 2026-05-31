import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import type { ProductCategory, NameBrandMethod } from "../../types";
import { ThemedText } from "./themed-text";
import ThemedTextInput from "./themed-text-input";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "./themed-button";

export interface ProductFormData {
  name: string;
  brand: string;
  category: ProductCategory | "";
  paoMonths: string;
}

interface ProductFormProps {
  value: ProductFormData;
  onChange: (data: ProductFormData) => void;
  disabled?: boolean;
  showPaoInput?: boolean;
  paoHint?: string;
  sourceMethod?: NameBrandMethod | null;
}

const CATEGORIES: ProductCategory[] = ["skincare", "makeup", "haircare"];

export default function ProductForm({
  value,
  onChange,
  disabled,
  showPaoInput,
  paoHint,
  sourceMethod,
}: ProductFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  return (
    <View style={styles.form}>
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
              value={value.brand}
              onChangeText={(text) => onChange({ ...value, paoMonths: text })}
              placeholder="Enter PAO in months here"
              autoCapitalize="none"
              editable={!disabled}
            />
          </View>
        </>
      )}

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
                  category: value.category === cat ? "" : cat,
                })
              }
              disabled={disabled}
            />
          ))}
        </View>
      </View>
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
    marginVertical: 12,
    gap: 8,
  },
});
