import { Colors, getTheme } from "@/constants/theme";
import { ComponentType, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  useColorScheme,
  View,
  ViewStyle,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GlassSurface, { withAlpha } from "./glass-surface";
import { ThemedText } from "./themed-text";

export interface DropdownOption {
  label: string;
  value: string;
  displayText?: string;
}

interface ThemedDropdownProps {
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  IconComponent?: ComponentType<any>;
  iconName?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textType?:
    | "displayLarge"
    | "displayMedium"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "body"
    | "bodyLarge"
    | "bodySmall"
    | "caption"
    | "captionLarge"
    | "captionSmall"
    | "overline";
}

export default function ThemedDropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  IconComponent,
  iconName,
  disabled,
  style,
  textType = "body",
}: ThemedDropdownProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const bgDefault = withAlpha(colors.background, 0.4);
  const defaultColor = colors.neutral[700];
  const focusColor = colors.secondary[500];
  const color = colors.text;
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const displayText = selected
    ? (selected.displayText ?? selected.label)
    : placeholder;
  const hasValue = !!selected;

  return (
    <>
      <Pressable
        style={style}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
      >
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: bgDefault,
              borderColor: focused ? focusColor : defaultColor,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          {IconComponent && iconName && (
            <IconComponent name={iconName} size={17} color={color + "88"} />
          )}
          <ThemedText
            type={textType}
            numberOfLines={1}
            style={[
              styles.text,
              {
                color: hasValue ? color : color + "88",
              },
            ]}
          >
            {displayText}
          </ThemedText>
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color={color + "88"}
          />
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <GlassSurface
            style={styles.dropdownCard}
            radius={12}
            border={false}
            onPress={() => {}}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected
                          ? colors.secondary[500] + "18"
                          : "transparent",
                      },
                    ]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <ThemedText
                      type={textType}
                      weight={isSelected ? "semiBold" : "regular"}
                      numberOfLines={1}
                      style={[
                        styles.optionText,
                        {
                          color: isSelected ? colors.secondary[600] : color,
                        },
                      ]}
                    >
                      {item.label}
                    </ThemedText>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color={colors.secondary[600]}
                      />
                    )}
                  </Pressable>
                );
              }}
            />
          </GlassSurface>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 10,
  },
  text: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dropdownCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 10,
    maxHeight: "60%",
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionText: {
    flex: 1,
  },
});
