import { createTheme, darken, getContrastRatio, lighten } from "@mui/material/styles";
import { MONOSPACE_STACK } from "../../themes";

const FONT_FAMILY_STORAGE_KEY = "filterPageFontFamily";
export const FONT_FAMILY_OPTIONS = [
  { key: "wcag-sans", label: "WCAG Sans", stack: 'Inter, Roboto, "Open Sans", sans-serif' },
  { key: "theme-default", label: "Theme Default", stack: null },
  {
    key: "system-sans",
    label: "System Sans",
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  { key: "inter", label: "Inter", stack: '"Inter", sans-serif' },
  { key: "monospace", label: "Monospace", stack: MONOSPACE_STACK },
  { key: "serif", label: "Serif", stack: 'Georgia, "Times New Roman", Times, serif' },
  { key: "open-dyslexic", label: "OpenDyslexic", stack: '"OpenDyslexic", sans-serif' },
];
const CUSTOM_SIZE_KEYS_TO_SCALE = [
  "barActiveAccent",
  "barMinWidth",
  "barHeight",
  "focusRingOffset",
  "chipInactiveBorder",
  "chipRadius",
  "iconHoverRadius",
  "cardPadding",
  "headerLetterSpacing",
  "headerFontSize",
  "patientCountSize",
];

export function getInitialFontFamilyKey() {
  try {
    const stored = localStorage.getItem(FONT_FAMILY_STORAGE_KEY);
    if (stored && FONT_FAMILY_OPTIONS.some((option) => option.key === stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return "wcag-sans";
}

function scaleCssLengthValue(value, multiplier) {
  if (!Number.isFinite(multiplier) || multiplier === 1) {
    return value;
  }
  if (typeof value === "number") {
    return Math.round(value * multiplier * 1000) / 1000;
  }
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/(-?\d*\.?\d+)(px|rem|em)\b/g, (_, rawNumber, unit) => {
    const scaled = Math.round(Number.parseFloat(rawNumber) * multiplier * 1000) / 1000;
    return `${scaled}${unit}`;
  });
}

export function getScaledCustomThemeValues(custom = {}, multiplier = 1) {
  if (!custom || !Number.isFinite(multiplier) || multiplier === 1) {
    return custom;
  }

  const nextCustom = { ...custom };
  CUSTOM_SIZE_KEYS_TO_SCALE.forEach((key) => {
    if (nextCustom[key] !== undefined) {
      nextCustom[key] = scaleCssLengthValue(nextCustom[key], multiplier);
    }
  });
  return nextCustom;
}

function getSolidPaperColor(theme, isDark) {
  const paperColor = theme?.palette?.background?.paper;
  if (typeof paperColor === "string") {
    const normalizedColor = paperColor.trim().toLowerCase();
    const isTranslucent =
      normalizedColor.includes("rgba(") || normalizedColor.includes("hsla(") || normalizedColor === "transparent";
    if (!isTranslucent) {
      return paperColor;
    }
  }
  return isDark ? "#1E1E2E" : "#FFFFFF";
}

function getAAASecondaryTextColor(backgroundDefault, isDark) {
  const fallbackBackground = isDark ? "#101219" : "#FFFFFF";
  const background = backgroundDefault || fallbackBackground;
  let color = isDark ? "#D0D8E0" : "#3A3A3A";

  for (let index = 0; index < 10; index += 1) {
    if (getContrastRatio(color, background) >= 7) {
      return color;
    }
    color = isDark ? lighten(color, 0.08) : darken(color, 0.08);
  }
  return color;
}

export function applyHighContrast(theme) {
  const isDark = theme.palette.mode === "dark";
  const backgroundDefault = theme.palette.background.default;
  const boostedTextSecondary = getAAASecondaryTextColor(backgroundDefault, isDark);
  const solidDivider = isDark ? "#3A3A4A" : "#5A5A5A";
  const solidPaperBorderColor = isDark ? "#4A4A5A" : "#444444";
  const solidPaperBackground = getSolidPaperColor(theme, isDark);
  const custom = theme.custom || {};
  const focusRingColor = custom.focusRing || theme.palette.primary.light || theme.palette.primary.main;

  return createTheme(theme, {
    palette: {
      background: {
        paper: solidPaperBackground,
      },
      text: {
        secondary: boostedTextSecondary,
      },
      divider: solidDivider,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: solidPaperBackground,
            backgroundImage: "none",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            border: `2px solid ${solidPaperBorderColor}`,
            boxShadow: "none",
          },
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            "&:focus-visible": {
              outline: `3px solid ${focusRingColor}`,
              outlineOffset: custom.focusRingOffset || "2px",
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            "&:focus-visible": {
              outline: `3px solid ${focusRingColor}`,
              outlineOffset: custom.focusRingOffset || "2px",
            },
          },
        },
      },
    },
    custom: {
      ...custom,
      focusRingWidth: 3,
      barTrack: isDark ? "#252839" : "#D0D0D0",
      barActiveGlow: "none",
      chipActiveGlow: "none",
      chipInactiveBorder: `2px solid ${solidPaperBorderColor}`,
      cardBeforePseudo: null,
      pageBgExtra: null,
    },
  });
}
