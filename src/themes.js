import { createTheme } from "@mui/material/styles";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------
export const MONOSPACE_STACK =
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
    MuiButton: {
      styleOverrides: {
        outlinedPrimary: {
          color: "#60A5FA",          // primary.light — ~5.7:1 on #1A2332
          borderColor: "#2563EB",
          "&:hover": {
            color: "#93C5FD",        // even lighter on hover
            borderColor: "#3B82F6",
            backgroundColor: "rgba(59, 130, 246, 0.08)",
          },
        },
      },
    },
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
    barTrack: "rgba(59, 130, 246, 0.18)",
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

    cardPadding: "0px",
    cardBeforePseudo: null,

    pageBgExtra: null,

    countFontFamily: MONOSPACE_STACK,
    headerTransform: "uppercase",
    headerLetterSpacing: "0.1em",
    headerFontSize: "0.7rem",
    headerFontWeight: 500,
    headerColor: "#94A3B8",
    categoryLabelColor: "#CBD5E1",
    patientCountWeight: 600,
    patientCountColor: "#E2E8F0",
    patientCountSize: "2rem",
    statsColor: "#475569",
  },
});

// ---------------------------------------------------------------------------
// Theme 2 — Vapor
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
    barTrack: "rgba(13, 148, 136, 0.20)",
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

    cardPadding: "0px",
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
    patientCountWeight: 600,
    patientCountColor: "#2DD4BF",
    patientCountSize: "2.25rem",
    statsColor: "#64748B",
  },
});

// Theme 3 — GOV.UK
// ---------------------------------------------------------------------------
const govukTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#F3F2F1",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#0B0C0C",
      secondary: "#505A5F",
    },
    primary: {
      main: "#1D70B8",
      light: "#D2E2F1",
      dark: "#0B0C0C",
    },
    secondary: {
      main: "#00703C",
    },
    success: {
      main: "#00703C",
    },
    info: {
      main: "#1D70B8",
    },
    divider: "#B1B4B6",
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily:
        '"GDS Transport", Arial, "Helvetica Neue", Helvetica, sans-serif',
  },
  components: {
    MuiSelect: {
      styleOverrides: {
        nativeInput: {
          color: "#0B0C0C !important",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #B1B4B6",
          borderRadius: 0,
          boxShadow: "none",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: "#505A5F",
        },
        root: {
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#0B0C0C",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#0B0C0C",
            borderWidth: "2px",
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#505A5F",
          "&.Mui-focused": {
            color: "#0B0C0C",
          },
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "3px solid #FFDD00",
            outlineOffset: "0px",
            boxShadow: "inset 0 0 0 2px #0B0C0C",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#505A5F",
          "&.Mui-checked": { color: "#1D70B8" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#0B0C0C",
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#0B0C0C",
            backgroundColor: "#D2E2F1",
            borderRadius: 0,
          },
          "&:focus-visible": {
            outline: "3px solid #FFDD00",
            outlineOffset: "0px",
            boxShadow: "inset 0 0 0 2px #0B0C0C",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#0B0C0C",
          borderColor: "#B1B4B6",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#0B0C0C",
            backgroundColor: "#D2E2F1",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "rgba(29, 112, 184, 0.15)",
    barFill: "#1D70B8",
    barHover: "#1D70B8",
    barActive: "#00703C",
    barActiveAccent: "3px solid #00703C",
    barActiveGlow: "none",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(29, 112, 184, 0.08)",

    selectedLabelWeight: 700,
    selectedCountColor: "#00703C",

    focusRing: "#FFDD00",
    focusRingOffset: "0px",

    chipActiveBg: "#1D70B8",
    chipActiveText: "#FFFFFF",
    chipActiveGlow: "none",
    chipInactiveBg: "#FFFFFF",
    chipInactiveText: "#0B0C0C",
    chipInactiveBorder: "1px solid #505A5F",
    chipRadius: "0px",

    iconDefault: "#0B0C0C",
    iconHover: "#0B0C0C",
    iconHoverBg: "#D2E2F1",
    iconHoverRadius: "0px",

    cardPadding: "0px",
    cardBeforePseudo: null,

    pageBgExtra: "linear-gradient(180deg, #F4F8FB 0%, #F3F2F1 100%)",

    countFontFamily: "inherit",
    headerTransform: "none",
    headerLetterSpacing: "0.01em",
    headerFontSize: "0.84rem",
    headerFontWeight: 700,
    headerColor: "#0B0C0C",
    categoryLabelColor: "#0B0C0C",
    patientCountWeight: 700,
    patientCountColor: "#0B0C0C",
    patientCountSize: "2rem",
    statsColor: "#505A5F",
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const THEME_OPTIONS = [
  { key: "obsidian", label: "Obsidian" },
  { key: "vapor", label: "Vapor" },
  { key: "govuk", label: "Standard" },
];

const THEME_MAP = {
  obsidian: obsidianTheme,
  vapor: vaporTheme,
  govuk: govukTheme,
};

export function getThemeByKey(key) {
  return THEME_MAP[key] || govukTheme;
}

export {
  obsidianTheme,
  vaporTheme,
  govukTheme,
};
