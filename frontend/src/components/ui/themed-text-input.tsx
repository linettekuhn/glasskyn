import { Colors, Fonts, getTheme } from "@/constants/theme";
import { ComponentType, ReactNode, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  useColorScheme,
  View,
  ViewStyle,
} from "react-native";

type Props = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
  textColor?: string;
  placeholder?: string;
  IconComponent?: ComponentType<any>;
  iconName?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function ThemedTextInput({
  value,
  onChangeText,
  textColor,
  placeholder,
  IconComponent,
  iconName,
  children,
  style,
  ...rest
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const bgDefault = colors.background;
  const defaultColor = colors.neutral[700];
  const focusColor = colors.secondary[500];
  const color = colors.text;
  const inputRef = useRef<TextInput>(null);

  const [focused, setFocused] = useState(false);

  return (
    <Pressable style={style} onPress={() => inputRef.current?.focus()}>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: bgDefault,
            borderColor: focused ? focusColor : defaultColor,
          },
        ]}
      >
        {IconComponent && iconName && (
          <IconComponent name={iconName} size={17} color={color + "88"} />
        )}
        <TextInput
          ref={inputRef}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.textInput, { color: textColor ?? color }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color + "88"}
          {...rest}
        />
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.sans,
  },
});
