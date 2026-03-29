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
    patientCountWeight: 600,
    patientCountColor: "#E2E8F0",
    patientCountSize: "2rem",
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
    patientCountWeight: 600,
    patientCountColor: "#1C1412",
    patientCountSize: "1.85rem",
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
    patientCountWeight: 600,
    patientCountColor: "#2DD4BF",
    patientCountSize: "2.25rem",
    statsColor: "#64748B",
  },
});

// ---------------------------------------------------------------------------
// Theme 4 — Harvard
// ---------------------------------------------------------------------------
const harvardTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#1A1014",
      paper: "#24171D",
    },
    text: {
      primary: "#F9F7F3",
      secondary: "#B5AAA5",
    },
    primary: {
      main: "#A51C30",
      light: "#C4283C",
      dark: "#7C2112",
    },
    divider: "#4C3E45",
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily:
      '"Iowan Old Style", Georgia, "Times New Roman", Times, serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "none",
          border: "1px solid #4C3E45",
          borderRadius: 4,
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "2px solid #6578B4",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#68666F",
          "&.Mui-checked": { color: "#A51C30" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#8A7C84",
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#D5D0CA",
            backgroundColor: "rgba(165, 28, 48, 0.12)",
            borderRadius: 4,
          },
          "&:focus-visible": {
            outline: "2px solid #6578B4",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#B5AAA5",
          borderColor: "#4C3E45",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#F9F7F3",
            backgroundColor: "rgba(165, 28, 48, 0.18)",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "#2A1A21",
    barFill: "#A51C30",
    barHover: "#C4283C",
    barActive: "#3B2883",
    barActiveAccent: "3px solid #3B2883",
    barActiveGlow: "none",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(165, 28, 48, 0.08)",

    selectedLabelWeight: 700,
    selectedCountColor: "#6578B4",

    focusRing: "#6578B4",
    focusRingOffset: "2px",

    chipActiveBg: "#A51C30",
    chipActiveText: "#F9F7F3",
    chipActiveGlow: "none",
    chipInactiveBg: "transparent",
    chipInactiveText: "#B5AAA5",
    chipInactiveBorder: "1px solid #68666F",
    chipRadius: "4px",

    iconDefault: "#8A7C84",
    iconHover: "#D5D0CA",
    iconHoverBg: "rgba(165, 28, 48, 0.12)",
    iconHoverRadius: "4px",

    cardPadding: "12px 16px",
    cardBeforePseudo: null,

    pageBgExtra: null,

    countFontFamily: MONOSPACE_STACK,
    headerTransform: "uppercase",
    headerLetterSpacing: "0.11em",
    headerFontSize: "0.7rem",
    headerFontWeight: 600,
    headerColor: "#D5D0CA",
    categoryLabelColor: "#E8DDD7",
    patientCountWeight: 600,
    patientCountColor: "#F9F7F3",
    patientCountSize: "2rem",
    statsColor: "#9B8B93",
  },
});

// ---------------------------------------------------------------------------
// Theme 5 — Pitt
// ---------------------------------------------------------------------------
const pittTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#000F2E",
      paper: "#001A4A",
    },
    text: {
      primary: "#EAF2FF",
      secondary: "#9EB3D1",
    },
    primary: {
      main: "#003594",
      light: "#1A5BC4",
      dark: "#00205B",
    },
    divider: "rgba(0, 53, 148, 0.35)",
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      'Inter, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "none",
          border: "1px solid rgba(0, 53, 148, 0.35)",
          borderRadius: 8,
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "2px solid #FFB81C",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#66B2E3",
          "&.Mui-checked": { color: "#FFB81C" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#66B2E3",
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#FFB81C",
            backgroundColor: "rgba(255, 184, 28, 0.14)",
            borderRadius: "50%",
          },
          "&:focus-visible": {
            outline: "2px solid #FFB81C",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#C4D5ED",
          borderColor: "rgba(102, 178, 227, 0.35)",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#EAF2FF",
            backgroundColor: "rgba(255, 184, 28, 0.18)",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "#00183F",
    barFill: "#003594",
    barHover: "#1A5BC4",
    barActive: "#FFB81C",
    barActiveAccent: "3px solid #FFB81C",
    barActiveGlow: "0 0 10px rgba(255, 184, 28, 0.2)",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(255, 184, 28, 0.08)",

    selectedLabelWeight: 700,
    selectedCountColor: "#FFB81C",

    focusRing: "#FFB81C",
    focusRingOffset: "2px",

    chipActiveBg: "#003594",
    chipActiveText: "#FFFFFF",
    chipActiveGlow: "0 0 8px rgba(255, 184, 28, 0.22)",
    chipInactiveBg: "rgba(0, 53, 148, 0.12)",
    chipInactiveText: "#C4D5ED",
    chipInactiveBorder: "1px solid rgba(102, 178, 227, 0.35)",
    chipRadius: "18px",

    iconDefault: "#66B2E3",
    iconHover: "#FFB81C",
    iconHoverBg: "rgba(255, 184, 28, 0.14)",
    iconHoverRadius: "50%",

    cardPadding: "16px 20px",
    cardBeforePseudo: null,

    pageBgExtra:
      "radial-gradient(ellipse at 82% 8%, rgba(255, 184, 28, 0.08) 0%, rgba(255, 184, 28, 0) 52%)",

    countFontFamily: MONOSPACE_STACK,
    headerTransform: "uppercase",
    headerLetterSpacing: "0.1em",
    headerFontSize: "0.72rem",
    headerFontWeight: 700,
    headerColor: "#DBEEFF",
    categoryLabelColor: "#DBEEFF",
    patientCountWeight: 600,
    patientCountColor: "#FFB81C",
    patientCountSize: "2rem",
    statsColor: "#A9B8CC",
  },
});

// ---------------------------------------------------------------------------
// Theme 6 — Brown
// ---------------------------------------------------------------------------
const brownTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#FAF5F0",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#2E2019",
      secondary: "#6F655E",
    },
    primary: {
      main: "#4E3629",
      light: "#6B4D3D",
      dark: "#3A271D",
    },
    divider: "#D9CBBD",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      '"Iowan Old Style", Georgia, "Times New Roman", Times, serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #E1D6CA",
          borderRadius: 10,
          boxShadow: "0 2px 10px rgba(58, 39, 29, 0.06)",
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "2px solid #ED1C24",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#98A4AE",
          "&.Mui-checked": { color: "#4E3629" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#6F655E",
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#4E3629",
            backgroundColor: "#F3E9DF",
            borderRadius: "10px",
          },
          "&:focus-visible": {
            outline: "2px solid #ED1C24",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#6F655E",
          borderColor: "#D9CBBD",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#3A271D",
            backgroundColor: "rgba(237, 28, 36, 0.1)",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "#EDE2D7",
    barFill: "#4E3629",
    barHover: "#6B4D3D",
    barActive: "#ED1C24",
    barActiveAccent: "3px solid #ED1C24",
    barActiveGlow: "none",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(78, 54, 41, 0.06)",

    selectedLabelWeight: 700,
    selectedCountColor: "#C00404",

    focusRing: "#ED1C24",
    focusRingOffset: "2px",

    chipActiveBg: "#4E3629",
    chipActiveText: "#FFFFFF",
    chipActiveGlow: "none",
    chipInactiveBg: "#FAF5F0",
    chipInactiveText: "#6F655E",
    chipInactiveBorder: "1px solid #D9CBBD",
    chipRadius: "10px",

    iconDefault: "#6F655E",
    iconHover: "#4E3629",
    iconHoverBg: "#F3E9DF",
    iconHoverRadius: "10px",

    cardPadding: "16px 20px",
    cardBeforePseudo: null,

    pageBgExtra: null,

    countFontFamily: "inherit",
    headerTransform: "none",
    headerLetterSpacing: "0.02em",
    headerFontSize: "0.86rem",
    headerFontWeight: 700,
    headerColor: "#3A271D",
    categoryLabelColor: "#4E3629",
    patientCountWeight: 600,
    patientCountColor: "#C00404",
    patientCountSize: "1.95rem",
    statsColor: "#7A6D64",
  },
});

// ---------------------------------------------------------------------------
// Theme 7 — MGB
// ---------------------------------------------------------------------------
const mgbTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0A1628",
      paper: "rgba(0, 58, 150, 0.08)",
    },
    text: {
      primary: "#EAF1FA",
      secondary: "#9FB0C7",
    },
    primary: {
      main: "#003A96",
      light: "#1A5EC0",
      dark: "#002460",
    },
    divider: "rgba(0, 58, 150, 0.25)",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      'Inter, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(0, 58, 150, 0.28)",
          borderRadius: 10,
          boxShadow: "0 6px 20px rgba(0, 14, 39, 0.35)",
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "2px solid #009CA6",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#6B7A8D",
          "&.Mui-checked": { color: "#009CA6" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#6B7A8D",
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#B1E4E3",
            backgroundColor: "rgba(0, 156, 166, 0.14)",
            borderRadius: "50%",
          },
          "&:focus-visible": {
            outline: "2px solid #009CA6",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#B9C8D9",
          borderColor: "rgba(0, 156, 166, 0.35)",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#EAF1FA",
            backgroundColor: "rgba(0, 156, 166, 0.2)",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "#10233F",
    barFill: "#003A96",
    barHover: "#1A5EC0",
    barActive: "#009CA6",
    barActiveAccent: "3px solid #009CA6",
    barActiveGlow: "0 0 10px rgba(0, 191, 200, 0.18)",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(0, 156, 166, 0.08)",

    selectedLabelWeight: 700,
    selectedCountColor: "#00BFC8",

    focusRing: "#009CA6",
    focusRingOffset: "2px",

    chipActiveBg: "#003A96",
    chipActiveText: "#FFFFFF",
    chipActiveGlow: "0 0 8px rgba(0, 191, 200, 0.2)",
    chipInactiveBg: "rgba(0, 58, 150, 0.14)",
    chipInactiveText: "#B9C8D9",
    chipInactiveBorder: "1px solid rgba(0, 156, 166, 0.35)",
    chipRadius: "14px",

    iconDefault: "#6B7A8D",
    iconHover: "#B1E4E3",
    iconHoverBg: "rgba(0, 156, 166, 0.14)",
    iconHoverRadius: "50%",

    cardPadding: "16px 20px",
    cardBeforePseudo: null,

    pageBgExtra:
      "radial-gradient(ellipse at 78% 10%, rgba(177, 228, 227, 0.08) 0%, rgba(177, 228, 227, 0) 55%)",

    countFontFamily: MONOSPACE_STACK,
    headerTransform: "none",
    headerLetterSpacing: "0.04em",
    headerFontSize: "0.84rem",
    headerFontWeight: 600,
    headerColor: "#D9E7F7",
    categoryLabelColor: "#C9D9EA",
    patientCountWeight: 600,
    patientCountColor: "#00BFC8",
    patientCountSize: "2.1rem",
    statsColor: "#7F92AA",
  },
});

// ---------------------------------------------------------------------------
// Theme 8 — Mayo
// ---------------------------------------------------------------------------
const mayoTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#F9F8F5",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#231F20",
      secondary: "#6F6960",
    },
    primary: {
      main: "#0067B1",
      light: "#1A8AD4",
      dark: "#004A80",
    },
    divider: "#D8D4CE",
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      '"Iowan Old Style", Georgia, "Times New Roman", Times, serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #D8D4CE",
          borderRadius: 8,
          boxShadow: "0 2px 10px rgba(35, 31, 32, 0.06)",
          transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "2px solid #0067B1",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: "#8C857B",
          "&.Mui-checked": { color: "#0067B1" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: "#8C857B",
          transition: "background-color 0.2s ease, color 0.2s ease",
          "&:hover": {
            color: "#0067B1",
            backgroundColor: "rgba(0, 103, 177, 0.1)",
            borderRadius: "8px",
          },
          "&:focus-visible": {
            outline: "2px solid #0067B1",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: "#6F6960",
          borderColor: "#D8D4CE",
          fontSize: "0.65rem",
          padding: "2px 8px",
          "&.Mui-selected": {
            color: "#231F20",
            backgroundColor: "rgba(14, 50, 147, 0.1)",
          },
        },
      },
    },
  },
  custom: {
    barTrack: "#E9E5DF",
    barFill: "#0067B1",
    barHover: "#1A8AD4",
    barActive: "#0E3293",
    barActiveAccent: "3px solid #0E3293",
    barActiveGlow: "none",
    barMinWidth: "3px",
    barHeight: "18px",

    rowHoverBg: "rgba(0, 103, 177, 0.06)",

    selectedLabelWeight: 700,
    selectedCountColor: "#0E3293",

    focusRing: "#0067B1",
    focusRingOffset: "2px",

    chipActiveBg: "#0067B1",
    chipActiveText: "#FFFFFF",
    chipActiveGlow: "none",
    chipInactiveBg: "#F9F8F5",
    chipInactiveText: "#6F6960",
    chipInactiveBorder: "1px solid #D8D4CE",
    chipRadius: "8px",

    iconDefault: "#8C857B",
    iconHover: "#0067B1",
    iconHoverBg: "rgba(0, 103, 177, 0.1)",
    iconHoverRadius: "8px",

    cardPadding: "16px 20px",
    cardBeforePseudo: null,

    pageBgExtra: null,

    countFontFamily: "inherit",
    headerTransform: "none",
    headerLetterSpacing: "0.02em",
    headerFontSize: "0.88rem",
    headerFontWeight: 700,
    headerColor: "#231F20",
    categoryLabelColor: "#1F3D6B",
    patientCountWeight: 600,
    patientCountColor: "#0E3293",
    patientCountSize: "2rem",
    statsColor: "#6F6960",
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const THEME_OPTIONS = [
  { key: "obsidian", label: "Obsidian" },
  { key: "solstice", label: "Solstice" },
  { key: "vapor", label: "Vapor" },
  { key: "harvard", label: "Harvard" },
  { key: "pitt", label: "Pitt" },
  { key: "brown", label: "Brown" },
  { key: "mgb", label: "MGB" },
  { key: "mayo", label: "Mayo" },
];

const THEME_MAP = {
  obsidian: obsidianTheme,
  solstice: solsticeTheme,
  vapor: vaporTheme,
  harvard: harvardTheme,
  pitt: pittTheme,
  brown: brownTheme,
  mgb: mgbTheme,
  mayo: mayoTheme,
};

export function getThemeByKey(key) {
  return THEME_MAP[key] || solsticeTheme;
}

export {
  obsidianTheme,
  solsticeTheme,
  vaporTheme,
  harvardTheme,
  pittTheme,
  brownTheme,
  mgbTheme,
  mayoTheme,
};
