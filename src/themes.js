import { createTheme } from "@mui/material/styles";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------
const MONOSPACE_STACK =
  "'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace";

// ---------------------------------------------------------------------------
// Theme 1 — Obsidian
// ---------------------------------------------------------------------------
const obsidianTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0F1419",
      paper: "#1A2332",
    },
    text: {
      primary: "#E2E8F0",
      secondary: "#94A3B8",
    },
    primary: {
      main: "#3B82F6",
      light: "#60A5FA",
      dark: "#2563EB",
    },
    divider: "#1E3A5F",
  },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "none",
          border: "1px solid #1E3A5F",
          borderRadius: 2,
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "2px solid #60A5FA",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#475569",
          "&.Mui-checked": { color: "#3B82F6" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#475569",
          borderRadius: 0,
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#94A3B8",
            backgroundColor: "rgba(148, 163, 184, 0.08)",
            borderRadius: 0,
          },
          "&:focus-visible": {
            outline: "2px solid #60A5FA",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#94A3B8",
          borderColor: "#1E3A5F",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#E2E8F0",
            backgroundColor: "rgba(59, 130, 246, 0.15)",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "#111D2E",
    barFill: "#3B82F6",
    barHover: "#60A5FA",
    barActive: "#22D3EE",
    barActiveAccent: "3px solid #22D3EE",
    barActiveGlow: "none",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(59, 130, 246, 0.06)",

    selectedLabelWeight: 600,
    selectedCountColor: "#22D3EE",

    focusRing: "#60A5FA",
    focusRingOffset: "2px",

    chipActiveBg: "#3B82F6",
    chipActiveText: "#FFFFFF",
    chipActiveGlow: "none",
    chipInactiveBg: "transparent",
    chipInactiveText: "#94A3B8",
    chipInactiveBorder: "1px solid #1E3A5F",
    chipRadius: "4px",

    iconDefault: "#475569",
    iconHover: "#94A3B8",
    iconHoverBg: "rgba(148, 163, 184, 0.08)",
    iconHoverRadius: "0px",

    cardPadding: "12px 16px",
    cardBeforePseudo: null,

    pageBgExtra: null,

    countFontFamily: MONOSPACE_STACK,
    headerTransform: "uppercase",
    headerLetterSpacing: "0.1em",
    headerFontSize: "0.7rem",
    headerFontWeight: 500,
    headerColor: "#94A3B8",
    categoryLabelColor: "#CBD5E1",
    patientCountWeight: 400,
    patientCountColor: "#E2E8F0",
    patientCountSize: "1.5rem",
    statsColor: "#475569",
  },
});

// ---------------------------------------------------------------------------
// Theme 2 — Solstice
// ---------------------------------------------------------------------------
const solsticeTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#FAF8F5",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1C1412",
      secondary: "#6B5C52",
    },
    primary: {
      main: "#C2410C",
      light: "#DC5B22",
      dark: "#7C2D12",
    },
    divider: "#D9CFC5",
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'Inter, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "none",
          borderRadius: 12,
          boxShadow:
            "0 1px 2px rgba(120, 80, 50, 0.06), 0 4px 16px rgba(120, 80, 50, 0.04)",
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "2px solid #C2410C",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#A89888",
          "&.Mui-checked": { color: "#C2410C" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#A89888",
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#6B5C52",
            backgroundColor: "#F0EBE4",
            borderRadius: "50%",
          },
          "&:focus-visible": {
            outline: "2px solid #C2410C",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#6B5C52",
          borderColor: "#D9CFC5",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#1C1412",
            backgroundColor: "rgba(194, 65, 12, 0.08)",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "#F0EBE4",
    barFill: "#C2410C",
    barHover: "#DC5B22",
    barActive: "#7C2D12",
    barActiveAccent: "3px solid #C2410C",
    barActiveGlow: "none",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(194, 65, 12, 0.04)",

    selectedLabelWeight: 700,
    selectedCountColor: "#9A3412",

    focusRing: "#C2410C",
    focusRingOffset: "2px",

    chipActiveBg: "#C2410C",
    chipActiveText: "#FFFFFF",
    chipActiveGlow: "none",
    chipInactiveBg: "#FAF8F5",
    chipInactiveText: "#6B5C52",
    chipInactiveBorder: "1px solid #D9CFC5",
    chipRadius: "20px",

    iconDefault: "#A89888",
    iconHover: "#6B5C52",
    iconHoverBg: "#F0EBE4",
    iconHoverRadius: "50%",

    cardPadding: "20px 24px",
    cardBeforePseudo: "solstice-underline",

    pageBgExtra: null,

    countFontFamily: "inherit",
    headerTransform: "none",
    headerLetterSpacing: "0.02em",
    headerFontSize: "0.85rem",
    headerFontWeight: 700,
    headerColor: "#1C1412",
    categoryLabelColor: "#44362D",
    patientCountWeight: 300,
    patientCountColor: "#1C1412",
    patientCountSize: "1.4rem",
    statsColor: "#6B5C52",
  },
});

// ---------------------------------------------------------------------------
// Theme 3 — Vapor
// ---------------------------------------------------------------------------
const vaporTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0C0A1D",
      paper: "rgba(255, 255, 255, 0.04)",
    },
    text: {
      primary: "#F1F5F9",
      secondary: "#94A3B8",
    },
    primary: {
      main: "#0D9488",
      light: "#14B8A6",
      dark: "#0F766E",
    },
    divider: "rgba(255, 255, 255, 0.07)",
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily:
      'Inter, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 16,
          border: "1px solid rgba(255, 255, 255, 0.07)",
          boxShadow:
            "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.05) inset",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          position: "relative",
          overflow: "visible",
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
          "@supports not (backdrop-filter: blur(16px))": {
            background: "#1A1830 !important",
          },
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "2px solid #2DD4BF",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#64748B",
          "&.Mui-checked": { color: "#14B8A6" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#64748B",
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#94A3B8",
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderRadius: "50%",
          },
          "&:focus-visible": {
            outline: "2px solid #2DD4BF",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#94A3B8",
          borderColor: "rgba(255, 255, 255, 0.1)",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#F1F5F9",
            backgroundColor: "rgba(45, 212, 191, 0.12)",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "rgba(255, 255, 255, 0.05)",
    barFill: "#0D9488",
    barHover: "#14B8A6",
    barActive: "#2DD4BF",
    barActiveAccent: "3px solid #2DD4BF",
    barActiveGlow: "0 0 12px rgba(45, 212, 191, 0.15)",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(45, 212, 191, 0.04)",

    selectedLabelWeight: 600,
    selectedCountColor: "#2DD4BF",

    focusRing: "#2DD4BF",
    focusRingOffset: "2px",

    chipActiveBg: "#0D9488",
    chipActiveText: "#FFFFFF",
    chipActiveGlow: "0 0 8px rgba(45, 212, 191, 0.25)",
    chipInactiveBg: "rgba(255, 255, 255, 0.06)",
    chipInactiveText: "#94A3B8",
    chipInactiveBorder: "1px solid rgba(255, 255, 255, 0.1)",
    chipRadius: "20px",

    iconDefault: "#64748B",
    iconHover: "#94A3B8",
    iconHoverBg: "rgba(255, 255, 255, 0.06)",
    iconHoverRadius: "50%",

    cardPadding: "16px 20px",
    cardBeforePseudo: "vapor-glass",

    pageBgExtra:
      "radial-gradient(ellipse at 80% 10%, rgba(45, 212, 191, 0.05) 0%, transparent 50%)",

    countFontFamily: "inherit",
    headerTransform: "none",
    headerLetterSpacing: "0.04em",
    headerFontSize: "0.85rem",
    headerFontWeight: 600,
    headerColor: "#F1F5F9",
    categoryLabelColor: "#94A3B8",
    patientCountWeight: 300,
    patientCountColor: "#2DD4BF",
    patientCountSize: "1.5rem",
    statsColor: "#64748B",
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const THEME_OPTIONS = [
  { key: "obsidian", label: "Obsidian" },
  { key: "solstice", label: "Solstice" },
  { key: "vapor", label: "Vapor" },
];

const THEME_MAP = {
  obsidian: obsidianTheme,
  solstice: solsticeTheme,
  vapor: vaporTheme,
};

export function getThemeByKey(key) {
  return THEME_MAP[key] || solsticeTheme;
}

export { obsidianTheme, solsticeTheme, vaporTheme };

