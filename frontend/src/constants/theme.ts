import { Platform } from "react-native";

export type ThemeKey = keyof typeof Colors;

export function getTheme(colorScheme: string | null | undefined): ThemeKey {
  return colorScheme === "dark" ? "dark" : "light";
}

// ---------------------------------------------------------------------------
// Color scale generation
//
// Change BASE_COLORS below and every shade (100-900) for that color is
// recalculated automatically. 500 is always exactly the base color you set.
// Light-mode shades tint toward white as they go from 500 -> 100 and shade
// toward black as they go from 500 -> 900. Dark mode is the same scale with
// the steps mirrored (100 <-> 900, 200 <-> 800, etc).
// ---------------------------------------------------------------------------

type Shade = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type ColorScale = Record<Shade, string>;
type Rgb = [number, number, number];

const BASE_COLORS = {
  primary: "#7caba6",
  secondary: "#a0bf71",
  tertiary: "#4d837f",
  neutral: "#9c9c9a",
};

// How far each shade blends toward white (100-400) or black (600-900).
// Tweak these if you want a lighter/darker or more/less saturated ramp.
const TINT_RATIOS: Record<number, number> = {
  100: 0.9,
  200: 0.72,
  300: 0.52,
  400: 0.28,
};
const SHADE_RATIOS: Record<number, number> = {
  600: 0.16,
  700: 0.36,
  800: 0.58,
  900: 0.8,
};

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(c1: Rgb, c2: Rgb, t: number): Rgb {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t,
  ];
}

function generateScale(base500: string): ColorScale {
  const base = hexToRgb(base500);
  const scale = { 500: base500.toUpperCase() } as ColorScale;

  for (const [step, t] of Object.entries(TINT_RATIOS)) {
    scale[Number(step) as Shade] = rgbToHex(mix(base, WHITE, t));
  }
  for (const [step, t] of Object.entries(SHADE_RATIOS)) {
    scale[Number(step) as Shade] = rgbToHex(mix(base, BLACK, t));
  }
  return scale;
}

function reverseScale(scale: ColorScale): ColorScale {
  return {
    100: scale[900],
    200: scale[800],
    300: scale[700],
    400: scale[600],
    500: scale[500],
    600: scale[400],
    700: scale[300],
    800: scale[200],
    900: scale[100],
  };
}

const lightScales = {
  primary: generateScale(BASE_COLORS.primary),
  secondary: generateScale(BASE_COLORS.secondary),
  tertiary: generateScale(BASE_COLORS.tertiary),
  neutral: generateScale(BASE_COLORS.neutral),
};

const darkScales = {
  primary: reverseScale(lightScales.primary),
  secondary: reverseScale(lightScales.secondary),
  tertiary: reverseScale(lightScales.tertiary),
  neutral: reverseScale(lightScales.neutral),
};

const palettes = {
  light: {
    primary: lightScales.primary,
    secondary: lightScales.secondary,
    tertiary: lightScales.tertiary,
    neutral: lightScales.neutral,

    success: {
      100: "#EAF3EC",
      200: "#CBE3D0",
      300: "#A6CDAF",
      400: "#7FB68C",
      500: "#5E9E6E",
      600: "#4A7E57",
      700: "#385E42",
      800: "#263F2D",
      900: "#131F17",
    },

    background: "#FCFBFB",
    text: "#151C1A",
    tabBackground: "#271B17",
    error: "#A10000",
    warning: "#B45309",
  },

  dark: {
    primary: darkScales.primary,
    secondary: darkScales.secondary,
    tertiary: darkScales.tertiary,
    neutral: darkScales.neutral,

    success: {
      100: "#131F17",
      200: "#263F2D",
      300: "#385E42",
      400: "#4A7E57",
      500: "#5E9E6E",
      600: "#7FB68C",
      700: "#A6CDAF",
      800: "#CBE3D0",
      900: "#EAF3EC",
    },

    background: "#333232",
    text: "#F5ECEA",
    tabBackground: "#F5ECEA",
    error: "#FF5C5C",
    warning: "#FBBF24",
  },
};

export const Colors = {
  light: {
    ...palettes.light,
    bg: {
      gradient: [
        palettes.light.secondary[200],
        palettes.light.secondary[300],
        palettes.light.primary[300],
        palettes.light.primary[200],
      ] as const,
      gradientLocations: [0, 0.2, 0.4, 0.7] as const,
      oval: palettes.light.neutral[100],
    },
  },
  dark: {
    ...palettes.dark,
    bg: {
      gradient: [
        palettes.dark.secondary[200],
        palettes.dark.secondary[300],
        palettes.dark.primary[300],
        palettes.dark.primary[200],
      ] as const,
      gradientLocations: [0, 0.2, 0.4, 0.7] as const,
      oval: palettes.dark.neutral[100],
    },
  },
};

export const Fonts = {
  sans: "DM-Sans",
  sansThin: "DM-Sans-Thin",
  sansExtraLight: "DM-Sans-ExtraLight",
  sansLight: "DM-Sans-Light",
  sansMedium: "DM-Sans-Medium",
  sansSemiBold: "DM-Sans-SemiBold",
  sansBold: "DM-Sans-Bold",
  sansExtraBold: "DM-Sans-ExtraBold",
  sansBlack: "DM-Sans-Black",
  serif: "DM-Serif-Display",
  serifItalic: "DM-Serif-Display-Italic",
};
