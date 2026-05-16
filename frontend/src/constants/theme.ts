import { Platform } from "react-native";

export type ThemeKey = keyof typeof Colors;

export function getTheme(colorScheme: string | null | undefined): ThemeKey {
  return colorScheme === "dark" ? "dark" : "light";
}

export const Colors = {
  light: {
    primary: {
      100: "#E7ECEB",
      200: "#CCD5D3",
      300: "#AFBDB9",
      400: "#92A3A0",
      500: "#66807A",
      600: "#526862",
      700: "#3D4E4A",
      800: "#293532",
      900: "#151C1A",
    },

    secondary: {
      100: "#F5ECEA",
      200: "#EBD7D1",
      300: "#E0C1B6",
      400: "#D2A89A",
      500: "#BF8C7B",
      600: "#996E60",
      700: "#735246",
      800: "#4D362E",
      900: "#271B17",
    },

    neutral: {
      100: "#FCFBFB",
      200: "#FAF7F7",
      300: "#F3EFEE",
      400: "#EAE6E5",
      500: "#E2DCDB",
      600: "#BCB4B2",
      700: "#928988",
      800: "#655D5B",
      900: "#333232",
    },

    background: "#F5ECEA",
    text: "#151C1A",
    tabBackground: "#271B17",
    error: "#A10000",
  },

  dark: {
    primary: {
      100: "#E7ECEB",
      200: "#CCD5D3",
      300: "#AFBDB9",
      400: "#92A3A0",
      500: "#66807A",
      600: "#526862",
      700: "#3D4E4A",
      800: "#293532",
      900: "#151C1A",
    },

    secondary: {
      100: "#F5ECEA",
      200: "#EBD7D1",
      300: "#E0C1B6",
      400: "#D2A89A",
      500: "#BF8C7B",
      600: "#996E60",
      700: "#735246",
      800: "#4D362E",
      900: "#271B17",
    },

    neutral: {
      100: "#FCFBFB",
      200: "#FAF7F7",
      300: "#F3EFEE",
      400: "#EAE6E5",
      500: "#E2DCDB",
      600: "#BCB4B2",
      700: "#928988",
      800: "#655D5B",
      900: "#333232",
    },

    background: "#271B17",
    text: "#F5ECEA",
    tabBackground: "#F5ECEA",
    error: "#FF5C5C",
  },
};

export const Fonts = {
  sans: "DM-Sans",
  serif: "DM-Serif-Display",
  serifItalic: "DM-Serif-Display-Italic",
};