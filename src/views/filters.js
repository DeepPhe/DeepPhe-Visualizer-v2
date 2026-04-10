import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  GlobalStyles,
  IconButton,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  ThemeProvider,
  alpha,
  createTheme,
  darken,
  getContrastRatio,
  lighten,
} from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ContrastIcon from "@mui/icons-material/Contrast";
import MotionPhotosOffIcon from "@mui/icons-material/MotionPhotosOff";
import RemoveIcon from "@mui/icons-material/Remove";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { Link as RouterLink } from "react-router-dom";
import { getSummary as getOmopSummary } from "../controllers/omap";
import { getSummary as getAttributesSummary } from "../controllers/attributes";
import {
  fetchDeepPheFilterCount,
  fetchDeepPheFilterSummary,
  fetchPatientDocuments,
} from "../clients/deepphe-data-api";
import HorizontalBarFilter from "../components/HorizontalBarFilter";
import PatientGrid from "../components/PatientGrid";
import { useBatchDataLoader } from "../hooks/useBatchDataLoader";
import { MONOSPACE_STACK, THEME_OPTIONS, getThemeByKey } from "../themes";
import { getAgeDecileLabel } from "../utils/dataProcessing";
import { toDisplayName } from "../utils/displayNames";
import {
  FILTER_ENTRY_BY_TYPE_CLASS,
  resolveFilterSetsWithExtras,
} from "./filterSets";
import { buildFilterSectionLayout } from "./filterLayout";
import {
  buildChildChartData,
  buildRollupInstanceMap,
  buildRolledUpChartData,
  hasRollup,
  isExpandable,
  resolveRollupSelections,
} from "./rollup";

const SLOW_QUERY_THRESHOLD_MS = 100;
const PATIENT_GRID_PAGE_SIZE = 10;
const INLINE_PATIENT_IDS_THRESHOLD = 20;
const AGE_AT_DX_CLASS = "AGE_AT_DX";
const AGE_SELECTION_MODE = {
  DECILE: "decile",
};
const OMOP_CLASS_DISPLAY_NAME_MAP = {
  AGE_AT_DX: "Age at Dx",
  ETHNICITY: "Ethnicity",
  GENDER: "Gender",
  RACE: "Race",
  CANCER: "Cancer",
};
const FILTER_LAYOUT_MODE = {
  STACKED: "stacked",
  PER_CARD_COLUMN: "per-card-column",
};
const FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT = Object.freeze({
  xs: 1,
  sm: 2,
  md: 3,
  lg: 6,
  xl: 6,
});
const CONTEXT_HEADER_SX = { fontWeight: 700, letterSpacing: 0.2 };
const FILTER_VALUE_SORT_MODES = ["value-desc", "value-asc", "alpha-asc", "alpha-desc"];
const DEFAULT_FILTER_VALUE_SORT_MODE = "alpha-asc";
const FILTER_SORT_DIMENSION = {
  COUNT: "count",
  LABEL: "label",
};
const FILTER_SORT_DIRECTION = {
  ASC: "asc",
  DESC: "desc",
};

const THEME_STORAGE_KEY = "filterPageTheme";
const FONT_SCALE_STORAGE_KEY = "filterPageFontScale";
const FONT_FAMILY_STORAGE_KEY = "filterPageFontFamily";
const HIGH_CONTRAST_STORAGE_KEY = "filterPageHighContrast";
const REDUCED_MOTION_STORAGE_KEY = "filterPageReducedMotion";
const THEME_COLOR_OVERRIDES_STORAGE_KEY = "filterPageThemeColorOverrides";
const THEME_EDITOR_MENU_VALUE = "__theme-builder__";
const THEME_COLOR_VALUE_PATTERN =
  /#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:transparent|currentColor)\b/gi;
const THEME_COLOR_VALUE_EXACT_PATTERN =
  /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|currentColor)$/i;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const THEME_COLOR_ROOT_KEYS = ["palette", "custom", "components"];
const EMPTY_THEME_COLOR_OVERRIDES = Object.freeze({});
const FONT_SCALE_OPTIONS = [0.75, 0.9, 1, 1.1, 1.25, 1.5];
const FONT_FAMILY_OPTIONS = [
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
const OPEN_DYSLEXIC_FONT_LINK_ID = "open-dyslexic-font-link";
const OPEN_DYSLEXIC_FONT_LINK_HREF = "https://fonts.cdnfonts.com/css/opendyslexic";
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

const SHOULD_LOG_FILTERS_PERF = process.env.NODE_ENV !== "production";
const CANCER_TYPE_MAP = { B: "Breast", M: "Melanoma", O: "Ovarian Cancer" };
const GENDER_MAP = { M: "Male", F: "Female", U: "Unknown" };
const DOCUMENT_COUNT_EXCLUDE_PROPERTIES = [
  "name",
  "type",
  "date",
  "episode",
  "text",
  "mentions",
  "mentionRelations",
  "sections",
];

function toResolvedColumnCap(value, fallback = 1) {
  const numericValue = Number(value);
  const safeFallback = Math.max(1, Number(fallback) || 1);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.max(1, Math.floor(numericValue))
    : safeFallback;
}

function resolveResponsiveColumnCap(
  columnCapByBreakpoint = FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT,
  {
    isSmUp = false,
    isMdUp = false,
    isLgUp = false,
    isXlUp = false,
  } = {}
) {
  const xsCap = toResolvedColumnCap(columnCapByBreakpoint?.xs, 1);
  const smCap = toResolvedColumnCap(columnCapByBreakpoint?.sm, xsCap);
  const mdCap = toResolvedColumnCap(columnCapByBreakpoint?.md, smCap);
  const lgCap = toResolvedColumnCap(columnCapByBreakpoint?.lg, mdCap);
  const xlCap = toResolvedColumnCap(columnCapByBreakpoint?.xl, lgCap);

  if (isXlUp) {
    return xlCap;
  }
  if (isLgUp) {
    return lgCap;
  }
  if (isMdUp) {
    return mdCap;
  }
  if (isSmUp) {
    return smCap;
  }
  return xsCap;
}

function groupFilterSetsByRow(filterSets = []) {
  const normalizedSets = Array.isArray(filterSets) ? filterSets : [];
  const rowGroups = [];
  let activeRowGroup = null;

  normalizedSets.forEach((filterSet, index) => {
    const fallbackRow = String(filterSet?.id || `row-${index}`).trim() || `row-${index}`;
    const rowId = String(filterSet?.row || "").trim() || fallbackRow;

    if (!activeRowGroup || activeRowGroup.id !== rowId) {
      activeRowGroup = { id: rowId, filterSets: [] };
      rowGroups.push(activeRowGroup);
    }

    activeRowGroup.filterSets.push(filterSet);
  });

  return rowGroups;
}

function getColumnCapMaxWidthPx(columnCap, columnWidthPx, columnGapPx) {
  const resolvedColumnCap = toResolvedColumnCap(columnCap, 1);
  const resolvedColumnWidth = Math.max(1, Number(columnWidthPx) || 1);
  const resolvedColumnGap = Math.max(0, Number(columnGapPx) || 0);
  return (
    resolvedColumnCap * resolvedColumnWidth +
    Math.max(0, resolvedColumnCap - 1) * resolvedColumnGap
  );
}

function getInitialThemeKey() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEME_OPTIONS.some((option) => option.key === stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "obsidian";
  }
  return "govuk";
}

function getInitialFontScale() {
  try {
    const stored = Number.parseFloat(localStorage.getItem(FONT_SCALE_STORAGE_KEY) || "");
    const hasMatch = FONT_SCALE_OPTIONS.some((scale) => Math.abs(scale - stored) < 0.001);
    if (hasMatch) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return 1;
}

function getInitialFontFamilyKey() {
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

function getInitialBooleanPref(storageKey) {
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    // localStorage unavailable
  }
  return false;
}

function normalizeThemeColorOverridesByTheme(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }

  const validThemeKeys = new Set(THEME_OPTIONS.map((option) => option.key));
  const normalized = {};

  Object.entries(rawValue).forEach(([themeKey, rawOverrides]) => {
    if (!validThemeKeys.has(themeKey) || !rawOverrides || typeof rawOverrides !== "object") {
      return;
    }

    const normalizedThemeOverrides = {};
    Object.entries(rawOverrides).forEach(([entryId, entryValue]) => {
      if (typeof entryId !== "string" || typeof entryValue !== "string") {
        return;
      }
      const normalizedValue = entryValue.trim();
      if (normalizedValue) {
        normalizedThemeOverrides[entryId] = normalizedValue;
      }
    });

    if (Object.keys(normalizedThemeOverrides).length > 0) {
      normalized[themeKey] = normalizedThemeOverrides;
    }
  });

  return normalized;
}

function getInitialThemeColorOverridesByTheme() {
  try {
    const stored = localStorage.getItem(THEME_COLOR_OVERRIDES_STORAGE_KEY);
    if (!stored) {
      return {};
    }
    return normalizeThemeColorOverridesByTheme(JSON.parse(stored));
  } catch {
    // localStorage unavailable
  }
  return {};
}

function toThemeColorPathKey(pathSegments) {
  return pathSegments.join("\u0001");
}

function isArrayIndexPathSegment(segment) {
  return /^\d+$/.test(String(segment || ""));
}

function setObjectValueAtPath(target, pathSegments, nextValue) {
  if (!target || typeof target !== "object" || !Array.isArray(pathSegments) || pathSegments.length === 0) {
    return;
  }

  let cursor = target;
  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    const nextSegment = pathSegments[index + 1];
    const shouldCreateArray = isArrayIndexPathSegment(nextSegment);
    const existingValue = cursor[segment];

    if (!existingValue || typeof existingValue !== "object") {
      cursor[segment] = shouldCreateArray ? [] : {};
    }
    cursor = cursor[segment];
  }

  const lastSegment = pathSegments[pathSegments.length - 1];
  cursor[lastSegment] = nextValue;
}

function collectThemeColorEntries(theme) {
  const entries = [];
  const visited = new WeakSet();

  const visitValue = (value, pathSegments) => {
    if (typeof value === "string") {
      const tokenPattern = new RegExp(THEME_COLOR_VALUE_PATTERN.source, "gi");
      const tokenMatches = [...value.matchAll(tokenPattern)];
      if (tokenMatches.length === 0) {
        return;
      }

      const pathKey = toThemeColorPathKey(pathSegments);
      const pathLabel = pathSegments.join(".");
      const trimmedValue = value.trim();
      const isDirectColor =
        tokenMatches.length === 1 && THEME_COLOR_VALUE_EXACT_PATTERN.test(trimmedValue);

      if (isDirectColor) {
        entries.push({
          id: pathKey,
          kind: "direct",
          pathKey,
          pathLabel,
          pathSegments,
          defaultValue: trimmedValue,
          sourceValue: trimmedValue,
          tokenIndex: 0,
          tokenStart: 0,
          tokenEnd: trimmedValue.length,
        });
        return;
      }

      tokenMatches.forEach((match, tokenIndex) => {
        const tokenValue = String(match[0] || "").trim();
        if (!tokenValue) {
          return;
        }
        const tokenStart = Number(match.index) || 0;
        entries.push({
          id: `${pathKey}::token:${tokenIndex}`,
          kind: "token",
          pathKey,
          pathLabel,
          pathSegments,
          defaultValue: tokenValue,
          sourceValue: value,
          tokenIndex,
          tokenStart,
          tokenEnd: tokenStart + tokenValue.length,
        });
      });
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((nestedValue, index) => {
        visitValue(nestedValue, [...pathSegments, String(index)]);
      });
      return;
    }

    Object.entries(value).forEach(([key, nestedValue]) => {
      if (typeof nestedValue === "function") {
        return;
      }
      visitValue(nestedValue, [...pathSegments, key]);
    });
  };

  THEME_COLOR_ROOT_KEYS.forEach((rootKey) => {
    visitValue(theme?.[rootKey], [rootKey]);
  });

  return entries.sort((leftEntry, rightEntry) => {
    const pathCompare = leftEntry.pathLabel.localeCompare(rightEntry.pathLabel, undefined, {
      sensitivity: "base",
      numeric: true,
    });
    if (pathCompare !== 0) {
      return pathCompare;
    }
    return leftEntry.tokenIndex - rightEntry.tokenIndex;
  });
}

function buildThemeColorOverridePatch(entries, overridesByEntryId) {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const normalizedOverrides =
    overridesByEntryId && typeof overridesByEntryId === "object"
      ? overridesByEntryId
      : EMPTY_THEME_COLOR_OVERRIDES;
  const entriesByPath = new Map();

  normalizedEntries.forEach((entry) => {
    if (!entry?.pathKey) {
      return;
    }
    if (!entriesByPath.has(entry.pathKey)) {
      entriesByPath.set(entry.pathKey, []);
    }
    entriesByPath.get(entry.pathKey).push(entry);
  });

  const overridePatch = {};
  entriesByPath.forEach((entriesForPath) => {
    const directEntry = entriesForPath.find((entry) => entry.kind === "direct");
    if (directEntry) {
      const overriddenValue = normalizedOverrides[directEntry.id];
      if (
        typeof overriddenValue === "string" &&
        overriddenValue.length > 0 &&
        overriddenValue !== directEntry.defaultValue
      ) {
        setObjectValueAtPath(overridePatch, directEntry.pathSegments, overriddenValue);
      }
      return;
    }

    const tokenEntries = entriesForPath
      .filter((entry) => entry.kind === "token")
      .sort((leftEntry, rightEntry) => leftEntry.tokenIndex - rightEntry.tokenIndex);
    if (tokenEntries.length === 0) {
      return;
    }

    const templateValue = String(tokenEntries[0].sourceValue || "");
    let hasOverride = false;
    let cursor = 0;
    const rebuiltParts = [];

    tokenEntries.forEach((entry) => {
      const overriddenToken = normalizedOverrides[entry.id];
      const nextToken =
        typeof overriddenToken === "string" && overriddenToken.length > 0
          ? overriddenToken
          : entry.defaultValue;
      if (nextToken !== entry.defaultValue) {
        hasOverride = true;
      }
      rebuiltParts.push(templateValue.slice(cursor, entry.tokenStart));
      rebuiltParts.push(nextToken);
      cursor = entry.tokenEnd;
    });

    rebuiltParts.push(templateValue.slice(cursor));
    if (hasOverride) {
      setObjectValueAtPath(overridePatch, tokenEntries[0].pathSegments, rebuiltParts.join(""));
    }
  });

  return overridePatch;
}

function toColorInputHexValue(colorValue) {
  const normalizedValue = String(colorValue || "").trim();
  if (!HEX_COLOR_PATTERN.test(normalizedValue)) {
    return null;
  }
  if (normalizedValue.length === 4) {
    const [r, g, b] = normalizedValue.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return normalizedValue.toLowerCase();
}

const REDUCED_MOTION_STYLES = (
  <GlobalStyles
    styles={{
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          transitionDuration: "0.01ms !important",
          animationDuration: "0.01ms !important",
        },
      },
    }}
  />
);

const TOGGLED_REDUCED_MOTION_STYLES = (
  <GlobalStyles
    styles={{
      "*, *::before, *::after": {
        transitionDuration: "0.01ms !important",
        animationDuration: "0.01ms !important",
      },
    }}
  />
);

function findClosestFontScaleIndex(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return FONT_SCALE_OPTIONS.indexOf(1);
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  FONT_SCALE_OPTIONS.forEach((option, index) => {
    const distance = Math.abs(option - numericValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
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

function getScaledCustomThemeValues(custom = {}, multiplier = 1) {
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

function applyHighContrast(theme) {
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

function normalizeClassName(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeClassLookupKey(value) {
  return normalizeClassName(value).replace(/[^A-Z0-9]+/g, "");
}

function prettifyClassName(className, type = "") {
  const rawValue = String(className || "").trim();
  if (!rawValue) {
    return "";
  }

  const normalizedClass = normalizeClassName(rawValue);
  if (OMOP_CLASS_DISPLAY_NAME_MAP[normalizedClass]) {
    return OMOP_CLASS_DISPLAY_NAME_MAP[normalizedClass];
  }

  const normalizedType = String(type || "").trim().toLowerCase();
  const shouldTitleCase = normalizedType === "omop" || rawValue.includes("_") || rawValue === normalizedClass;

  if (!shouldTitleCase) {
    return rawValue;
  }

  return rawValue
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function getFilterEntry(type, className) {
  const normalizedType = String(type || "").trim().toLowerCase();
  const rawClassName = String(className || "").trim();
  if (!normalizedType || !rawClassName) {
    return null;
  }

  const exactMatch = FILTER_ENTRY_BY_TYPE_CLASS.get(`${normalizedType}:${rawClassName}`);
  if (exactMatch) {
    return exactMatch;
  }

  const targetLookupKey = normalizeClassLookupKey(rawClassName);
  for (const filterEntry of FILTER_ENTRY_BY_TYPE_CLASS.values()) {
    if (filterEntry.type !== normalizedType) {
      continue;
    }

    if (normalizeClassLookupKey(filterEntry.key) === targetLookupKey) {
      return filterEntry;
    }
  }

  return null;
}

function getFilterDisplayName(type, className) {
  return getFilterEntry(type, className)?.displayName || prettifyClassName(className, type);
}

function getFilterDefaultSortMode(type, className) {
  return normalizeChartSortMode(
    getFilterEntry(type, className)?.defaultSortMode || DEFAULT_FILTER_VALUE_SORT_MODE
  );
}

function getFilterCustomSortOrder(type, className) {
  const configuredOrder = getFilterEntry(type, className)?.customSortOrder;
  return Array.isArray(configuredOrder) ? configuredOrder : [];
}

function getFilterMaxHeightPx(type, className) {
  const numericMaxHeight = Number(getFilterEntry(type, className)?.maxHeightPx);
  if (!Number.isFinite(numericMaxHeight) || numericMaxHeight <= 0) {
    return null;
  }

  return Math.max(1, Math.round(numericMaxHeight));
}

function isAttributeRollupClass(className) {
  const configuredFilter = getFilterEntry("attributes", className);
  if (configuredFilter) {
    return Boolean(configuredFilter.hasRollup);
  }
  return hasRollup(className);
}

function toDisplayInstanceValue(type, className, value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const normalizedType = String(type || "").trim().toLowerCase();
  const source =
    normalizedType === "omop"
      ? String(className || "")
          .trim()
          .toLowerCase()
          .replace(/[\s_]+/g, "_")
      : String(className || "").trim();

  const displayValue = toDisplayName(rawValue, source);
  const normalizedClass = normalizeClassName(className);
  const isTnmStageClass =
    normalizedType === "attributes" &&
    (normalizedClass === "T STAGE" ||
      normalizedClass === "N STAGE" ||
      normalizedClass === "M STAGE");

  if (isTnmStageClass) {
    return displayValue.replace(/^([cp]?)([TNM])\s+([0-9X].*)$/i, "$1$2$3");
  }

  return displayValue;
}

function toChartData(summaryRows, type, className) {
  if (!Array.isArray(summaryRows)) {
    return [];
  }

  const normalizePatientIds = (rawValue) => {
    if (Array.isArray(rawValue)) {
      return rawValue;
    }

    if (typeof rawValue === "string") {
      return [
        ...new Set(
          rawValue
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ];
    }

    if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
      return [String(rawValue).trim()].filter(Boolean);
    }

    return [];
  };

  return summaryRows
    .map((row) => {
      const rawLabel = String(row?.value ?? "").trim();
      const patientIds = normalizePatientIds(
        row?.patientIds ?? row?.patient_ids ?? row?.patientId ?? row?.patient_id
      );

      return {
        label: rawLabel,
        displayLabel: toDisplayInstanceValue(type, className, rawLabel),
        value: Number(row?.count ?? 0),
        patientIds,
      };
    })
    .filter((row) => row.label.length > 0);
}

function normalizeInstanceValues(values) {
  return Array.isArray(values)
    ? [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
}

function getAgeDecileSortRank(label) {
  const rawLabel = String(label || "").trim();
  if (rawLabel === "90+") {
    return 90;
  }
  const rangeMatch = rawLabel.match(/^(\d+)\s*-\s*\d+$/);
  if (rangeMatch) {
    return Number.parseInt(rangeMatch[1], 10);
  }
  return Number.MAX_SAFE_INTEGER;
}

function buildAgeDecileChartData(rows) {
  const totalsByDecile = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const decileLabel = getAgeDecileLabel(row?.label);
    if (!decileLabel) {
      return;
    }

    const existingSummary = totalsByDecile.get(decileLabel) || {
      count: 0,
      patientIds: new Set(),
    };
    const rowCount = Number(row?.value);
    if (Number.isFinite(rowCount)) {
      existingSummary.count += rowCount;
    }

    if (Array.isArray(row?.patientIds)) {
      row.patientIds.forEach((patientId) => {
        const normalizedId = String(patientId || "").trim();
        if (normalizedId) {
          existingSummary.patientIds.add(normalizedId);
        }
      });
    }

    totalsByDecile.set(decileLabel, existingSummary);
  });

  return [...totalsByDecile.entries()]
    .map(([label, summary]) => ({
      label,
      displayLabel: label,
      value: summary.count,
      patientIds: [...summary.patientIds].sort((leftId, rightId) =>
        leftId.localeCompare(rightId, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    }))
    .filter((row) => Number(row.value) > 0)
    .sort((leftRow, rightRow) => {
      const leftRank = getAgeDecileSortRank(leftRow.label);
      const rightRank = getAgeDecileSortRank(rightRow.label);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return leftRow.label.localeCompare(rightRow.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function buildAgeDecileInstanceMap(rows) {
  const valuesByDecile = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rawLabel = String(row?.label || "").trim();
    if (!rawLabel) {
      return;
    }

    const decileLabel = getAgeDecileLabel(rawLabel);
    if (!decileLabel) {
      return;
    }

    if (!valuesByDecile.has(decileLabel)) {
      valuesByDecile.set(decileLabel, new Set());
    }
    valuesByDecile.get(decileLabel).add(rawLabel);
  });

  const nextMap = {};
  [...valuesByDecile.entries()].forEach(([decileLabel, valueSet]) => {
    nextMap[decileLabel] = [...valueSet].sort((leftValue, rightValue) =>
      leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  });

  return nextMap;
}

function formatSelectionText(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "None";
  }
  return values.join(", ");
}

function joinWithConjunction(values, conjunction = "or") {
  const normalized = Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (normalized.length === 0) {
    return "";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  if (normalized.length === 2) {
    return `${normalized[0]} ${conjunction} ${normalized[1]}`;
  }

  return `${normalized.slice(0, -1).join(", ")}, ${conjunction} ${normalized[normalized.length - 1]}`;
}

function toNarrativeLabel(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^[A-Z0-9+\-−/]+$/.test(text) && text.length <= 6) {
    return text;
  }

  return text.toLowerCase();
}

function joinCohortConditions(conditions) {
  const normalized = Array.isArray(conditions)
    ? conditions.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (normalized.length === 0) {
    return "";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  if (normalized.length === 2) {
    return `${normalized[0]}, and ${normalized[1]}`;
  }

  return `${normalized.slice(0, -1).join(", ")}, and ${normalized[normalized.length - 1]}`;
}

function getDisplayInstances(filter) {
  if (!filter || !Array.isArray(filter.instances)) {
    return [];
  }

  return filter.instances
    .map((value) => toDisplayInstanceValue(filter.type, filter.class, value))
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function formatCancerValue(value) {
  const rawLabel = String(value || "").trim();
  if (!rawLabel) {
    return "";
  }
  if (/cancer/i.test(rawLabel)) {
    return rawLabel;
  }
  return `${rawLabel} cancer`;
}

function formatAgeValues(values) {
  const normalizedValues = Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (normalizedValues.length === 0) {
    return "";
  }

  const uniqueValues = [...new Set(normalizedValues)];
  const allWholeNumbers = uniqueValues.every((value) => /^\d+$/.test(value));
  if (allWholeNumbers) {
    const numbers = uniqueValues
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value))
      .sort((leftValue, rightValue) => leftValue - rightValue);

    const ranges = [];
    let rangeStart = numbers[0];
    let rangeEnd = numbers[0];

    for (let index = 1; index < numbers.length; index += 1) {
      const value = numbers[index];
      if (value === rangeEnd + 1) {
        rangeEnd = value;
      } else {
        ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
        rangeStart = value;
        rangeEnd = value;
      }
    }
    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

    return joinWithConjunction(ranges, "or");
  }

  const allAgeRanges = uniqueValues.every((value) => /^\d+\s*-\s*\d+$/.test(value));
  if (allAgeRanges) {
    return joinWithConjunction(uniqueValues, "or");
  }

  return joinWithConjunction(uniqueValues, "or");
}

function buildIdentifiedSummary(filters, count) {
  const normalizedFilters = Array.isArray(filters) ? filters : [];
  const numericCount = Number(count);

  if (normalizedFilters.length === 0 || !Number.isFinite(numericCount)) {
    return "";
  }

  const safeCount = Math.max(0, Math.round(numericCount));
  if (safeCount === 0) {
    return "No patients matched these criteria.";
  }

  const omopFiltersByClass = {};
  const attributeFiltersByClass = {};

  normalizedFilters.forEach((filter) => {
    const filterType = String(filter?.type || "").toLowerCase();
    const classKey = normalizeClassName(filter?.class);
    if (!classKey) {
      return;
    }
    if (filterType === "omop") {
      omopFiltersByClass[classKey] = filter;
      return;
    }
    if (filterType === "attributes") {
      attributeFiltersByClass[classKey] = filter;
    }
  });

  const ageValues = getDisplayInstances(omopFiltersByClass.AGE_AT_DX);
  const raceValues = getDisplayInstances(omopFiltersByClass.RACE).map((value) =>
    toNarrativeLabel(value)
  );
  const ethnicityValues = getDisplayInstances(omopFiltersByClass.ETHNICITY).map((value) =>
    toNarrativeLabel(value)
  );
  const genderValues = getDisplayInstances(omopFiltersByClass.GENDER).map((value) =>
    toNarrativeLabel(value)
  );
  const cancerValues = getDisplayInstances(omopFiltersByClass.CANCER).map((value) =>
    formatCancerValue(value)
  );

  const subjectDescriptors = [];
  const conditionClauses = [];

  const ageText = formatAgeValues(ageValues);
  if (ageText) {
    subjectDescriptors.push(`${ageText} year old`);
  }

  const raceText = joinWithConjunction(raceValues, "or");
  if (raceText) {
    subjectDescriptors.push(raceText);
  }

  const genderText = joinWithConjunction(genderValues, "or");
  if (genderText) {
    subjectDescriptors.push(genderText);
  }

  const ethnicityText = joinWithConjunction(ethnicityValues, "or");
  if (ethnicityText) {
    conditionClauses.push(`ethnicity ${ethnicityText}`);
  }

  const cancerText = joinWithConjunction(
    cancerValues.map((value) => toNarrativeLabel(value)),
    "or"
  );
  if (cancerText) {
    conditionClauses.push(cancerText);
  }

  const behaviorValues = getDisplayInstances(attributeFiltersByClass.BEHAVIOR).map((value) =>
    toNarrativeLabel(value)
  );
  if (behaviorValues.length > 0) {
    conditionClauses.push(`${joinWithConjunction(behaviorValues, "or")} neoplasm behavior`);
  }

  const gradeValues = getDisplayInstances(attributeFiltersByClass.GRADE_NUMERIC).map((value) =>
    toNarrativeLabel(String(value || "").replace(/^grade[_\s]*(numeric)?\s*/i, "").trim())
  );
  if (gradeValues.length > 0) {
    conditionClauses.push(`grade ${joinWithConjunction(gradeValues, "or")}`);
  }

  const tStageValues = getDisplayInstances(attributeFiltersByClass["T STAGE"]);
  if (tStageValues.length > 0) {
    conditionClauses.push(`T stage ${joinWithConjunction(tStageValues, "or")}`);
  }

  const nStageValues = getDisplayInstances(attributeFiltersByClass["N STAGE"]);
  if (nStageValues.length > 0) {
    conditionClauses.push(`N stage ${joinWithConjunction(nStageValues, "or")}`);
  }

  const mStageValues = getDisplayInstances(attributeFiltersByClass["M STAGE"]);
  if (mStageValues.length > 0) {
    conditionClauses.push(`M stage ${joinWithConjunction(mStageValues, "or")}`);
  }

  const handledAttributeClasses = new Set(["BEHAVIOR", "GRADE_NUMERIC", "T STAGE", "N STAGE", "M STAGE"]);
  normalizedFilters
    .filter((filter) => String(filter?.type || "").toLowerCase() === "attributes")
    .forEach((filter) => {
      const classKey = normalizeClassName(filter.class);
      if (!classKey || handledAttributeClasses.has(classKey)) {
        return;
      }

      const values = getDisplayInstances(filter).map((value) => toNarrativeLabel(value));
      if (values.length === 0) {
        return;
      }

      const classLabel = prettifyClassName(filter.class, "attributes").toLowerCase();
      conditionClauses.push(`${classLabel} ${joinWithConjunction(values, "or")}`);
    });

}

function toFilterItem(type, className, values) {
  const instances = normalizeInstanceValues(values);

  if (instances.length === 0) {
    return null;
  }

  return {
    type,
    class: className,
    instances,
  };
}

function getFilterClassKey(type, className) {
  return `${String(type || "").trim().toLowerCase()}:${String(className || "").trim()}`;
}

function getFilterRowKey(type, className, rowLabel) {
  return `${getFilterClassKey(type, className)}:${String(rowLabel || "").trim()}`;
}

function isSameFilterClass(filter, type, className) {
  return getFilterClassKey(filter?.type, filter?.class) === getFilterClassKey(type, className);
}

function getRowInstancesForClass({
  type,
  className,
  rowLabel,
  ageAtDxSelectionMode,
  ageDecileInstanceMap,
  rollupInstanceMapByClass,
}) {
  const normalizedType = String(type || "").toLowerCase();
  const isAgeAtDxDecileClass =
    normalizedType === "omop" &&
    normalizeClassName(className) === AGE_AT_DX_CLASS &&
    ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE;
  const isAttributeRollupFilter =
    normalizedType === "attributes" && isAttributeRollupClass(className);

  if (isAgeAtDxDecileClass) {
    const mappedInstances = ageDecileInstanceMap?.[rowLabel];
    if (Array.isArray(mappedInstances) && mappedInstances.length > 0) {
      return mappedInstances;
    }
  }

  if (isAttributeRollupFilter) {
    return resolveRollupSelections(
      [rowLabel],
      className,
      rollupInstanceMapByClass?.[className]
    );
  }

  return [rowLabel];
}

function buildActiveFilters({
  selectedOmopValuesByClass,
  omopClasses,
  selectedAttributeValuesByClass,
  attributeClasses,
}) {
  const omopFilters = Array.isArray(omopClasses)
    ? omopClasses
        .map((className) =>
          toFilterItem("omop", className, selectedOmopValuesByClass?.[className])
        )
        .filter(Boolean)
    : [];
  const attributeFilters = Array.isArray(attributeClasses)
    ? attributeClasses
        .map((className) =>
          toFilterItem("attributes", className, selectedAttributeValuesByClass?.[className])
        )
        .filter(Boolean)
    : [];

  return [...omopFilters, ...attributeFilters];
}

function resolveRequestFilters({
  filters,
  ageAtDxSelectionMode,
  ageDecileInstanceMap,
  rollupInstanceMapByClass,
}) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map((filter) => {
      const normalizedFilterType = String(filter?.type || "").toLowerCase();
      const isAgeAtDxFilter =
        normalizedFilterType === "omop" &&
        normalizeClassName(filter?.class) === AGE_AT_DX_CLASS;
      const isAttributeRollupFilter =
        normalizedFilterType === "attributes" && isAttributeRollupClass(filter?.class);

      if (!isAgeAtDxFilter && !isAttributeRollupFilter) {
        return {
          type: filter.type,
          class: filter.class,
          instances: normalizeInstanceValues(filter.instances),
        };
      }

      if (isAgeAtDxFilter && ageAtDxSelectionMode !== AGE_SELECTION_MODE.DECILE) {
        return {
          type: filter.type,
          class: filter.class,
          instances: normalizeInstanceValues(filter.instances),
        };
      }

      let expandedInstances = normalizeInstanceValues(filter.instances);

      if (isAgeAtDxFilter && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE) {
        expandedInstances = normalizeInstanceValues(
          expandedInstances.flatMap((selectedValue) => {
            const mappedInstances = ageDecileInstanceMap?.[selectedValue];
            if (Array.isArray(mappedInstances) && mappedInstances.length > 0) {
              return mappedInstances;
            }
            return [selectedValue];
          })
        );
      }

      if (isAttributeRollupFilter) {
        expandedInstances = resolveRollupSelections(
          expandedInstances,
          filter.class,
          rollupInstanceMapByClass?.[filter.class]
        );
      }

      expandedInstances = normalizeInstanceValues(expandedInstances).sort((leftValue, rightValue) =>
        leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );

      return {
        type: filter.type,
        class: filter.class,
        instances: expandedInstances,
      };
    })
    .filter((filter) => filter.instances.length > 0);
}

function syncSelectionByClass(previousSelections, classes) {
  const nextSelections = {};

  classes.forEach((className) => {
    const existingValues = Array.isArray(previousSelections?.[className])
      ? previousSelections[className]
      : [];
    nextSelections[className] = [
      ...new Set(existingValues.map((value) => String(value).trim()).filter(Boolean)),
    ];
  });

  return nextSelections;
}

function syncExpandedParentsByClass(previousState, classes, rolledUpChartDataByClass) {
  const nextState = {};

  classes.forEach((className) => {
    if (!isAttributeRollupClass(className)) {
      nextState[className] = [];
      return;
    }

    const existingParents = Array.isArray(previousState?.[className])
      ? previousState[className]
      : [];
    const availableParents = new Set(
      (rolledUpChartDataByClass?.[className] || [])
        .map((row) => String(row?.label || "").trim())
        .filter(Boolean)
    );

    nextState[className] = [
      ...new Set(existingParents.map((value) => String(value || "").trim()).filter(Boolean)),
    ].filter((parentKey) => availableParents.has(parentKey));
  });

  return nextState;
}

function formatMs(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0.0";
  }
  return numericValue.toFixed(1);
}

function formatItemCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }
  return numericValue.toLocaleString();
}

function normalizeCountResponse(payload) {
  const rawCount = payload?.count;
  let count = Number(rawCount);
  if (!Number.isFinite(count) && typeof rawCount === "string") {
    const parsedValue = Number(String(rawCount).replace(/,/g, "").trim());
    if (Number.isFinite(parsedValue)) {
      count = parsedValue;
    }
  }
  const rawPatientIds = Array.isArray(payload?.patient_ids)
    ? payload.patient_ids
    : Array.isArray(payload?.patientIds)
      ? payload.patientIds
      : [];
  const patientIds = rawPatientIds.map((id) => String(id));
  const timing = {
    queryMs: Number(payload?.timing?.queryMs || 0),
    bitmapMs: Number(payload?.timing?.bitmapMs || 0),
    resolveMs: Number(payload?.timing?.resolveMs || 0),
    totalMs: Number(payload?.timing?.totalMs || 0),
    itemCounts: Array.isArray(payload?.timing?.itemCounts) ? payload.timing.itemCounts : [],
  };

  return {
    count: Number.isFinite(count) ? count : 0,
    patientIds,
    timing,
  };
}

function normalizePatientIds(patientIds = []) {
  return [...new Set((Array.isArray(patientIds) ? patientIds : []).map((id) => String(id || "").trim()))]
    .filter(Boolean)
    .sort((leftId, rightId) =>
      leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: "base" })
    );
}

function normalizeSummaryRecordForGrid(summary) {
  const parsedSummary =
    parsePatientSummaryJson(summary?.json_text ?? summary?.jsonText) ||
    parsePatientSummaryJson(summary?.summary_json ?? summary?.summaryJson) ||
    parsePatientSummaryJson(summary);

  if (!parsedSummary || typeof parsedSummary !== "object") {
    return null;
  }

  const demographics =
    parsedSummary?.demographics && typeof parsedSummary.demographics === "object"
      ? parsedSummary.demographics
      : parsedSummary?.demographic && typeof parsedSummary.demographic === "object"
        ? parsedSummary.demographic
      : summary?.demographics && typeof summary.demographics === "object"
        ? summary.demographics
        : summary?.demographic && typeof summary.demographic === "object"
          ? summary.demographic
        : {};

  const normalizeAttributeValue = (value) => {
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "string" || typeof value === "number") {
      return String(value).trim();
    }

    if (typeof value === "object") {
      const primitiveCandidate =
        value?.value ??
        value?.name ??
        value?.label ??
        value?.display ??
        value?.displayLabel ??
        value?.instance ??
        value?.instance_label;

      if (
        primitiveCandidate !== undefined &&
        primitiveCandidate !== null &&
        typeof primitiveCandidate !== "object"
      ) {
        return String(primitiveCandidate).trim();
      }
    }

    return "";
  };

  const collectAttributeValues = (rawValue, accumulator) => {
    if (rawValue === undefined || rawValue === null) {
      return;
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach((item) => collectAttributeValues(item, accumulator));
      return;
    }

    if (typeof rawValue === "object") {
      const nestedLists = [rawValue?.instances, rawValue?.values, rawValue?.items, rawValue?.data];
      nestedLists.forEach((list) => {
        if (Array.isArray(list)) {
          list.forEach((item) => collectAttributeValues(item, accumulator));
        }
      });

      const normalizedValue = normalizeAttributeValue(rawValue);
      if (normalizedValue) {
        accumulator.push(normalizedValue);
      }
      return;
    }

    const normalizedValue = normalizeAttributeValue(rawValue);
    if (normalizedValue) {
      accumulator.push(normalizedValue);
    }
  };

  const pushAttributeValues = (targetMap, rawClassName, rawValue) => {
    const classKey = normalizeClassName(rawClassName);
    if (!classKey) {
      return;
    }

    const nextValues = [];
    collectAttributeValues(rawValue, nextValues);
    if (nextValues.length === 0) {
      return;
    }

    const existingValues = Array.isArray(targetMap[classKey]) ? targetMap[classKey] : [];
    targetMap[classKey] = [...new Set([...existingValues, ...nextValues])];
  };

  const attributeValuesByClass = {};
  const attributeMapSources = [
    parsedSummary?.attributesByClass,
    parsedSummary?.attributes_by_class,
    parsedSummary?.attributeValuesByClass,
    parsedSummary?.attribute_values_by_class,
    parsedSummary?.instancesByClass,
    parsedSummary?.instances_by_class,
    summary?.attributesByClass,
    summary?.attributes_by_class,
    summary?.attributeValuesByClass,
    summary?.attribute_values_by_class,
    summary?.instancesByClass,
    summary?.instances_by_class,
  ];

  attributeMapSources.forEach((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return;
    }

    Object.entries(source).forEach(([className, values]) => {
      pushAttributeValues(attributeValuesByClass, className, values);
    });
  });

  const attributeListSources = [
    parsedSummary?.attributes,
    parsedSummary?.attribute_values,
    parsedSummary?.attributeValues,
    summary?.attributes,
    summary?.attribute_values,
    summary?.attributeValues,
  ];

  attributeListSources.forEach((source) => {
    if (!Array.isArray(source)) {
      return;
    }

    source.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      const className =
        item?.class ??
        item?.className ??
        item?.groupname ??
        item?.group_name ??
        item?.attributeClass ??
        item?.attribute_class;

      if (!className) {
        return;
      }

      const values =
        item?.instances ??
        item?.values ??
        item?.items ??
        item?.value ??
        item?.label ??
        item?.display ??
        item?.displayLabel ??
        item?.instance;

      pushAttributeValues(attributeValuesByClass, className, values);
    });
  });

  return {
    ...parsedSummary,
    patient_id: String(
      parsedSummary?.patient_id ??
        parsedSummary?.patientId ??
        summary?.patient_id ??
        summary?.patientId ??
        ""
    ).trim(),
    demographics,
    diagnoses: Array.isArray(parsedSummary?.diagnoses) ? parsedSummary.diagnoses : [],
    staging: Array.isArray(parsedSummary?.staging) ? parsedSummary.staging : [],
    grading: Array.isArray(parsedSummary?.grading) ? parsedSummary.grading : [],
    biomarkers: Array.isArray(parsedSummary?.biomarkers) ? parsedSummary.biomarkers : [],
    procedures: Array.isArray(parsedSummary?.procedures) ? parsedSummary.procedures : [],
    treatments: Array.isArray(parsedSummary?.treatments) ? parsedSummary.treatments : [],
    findings: Array.isArray(parsedSummary?.findings) ? parsedSummary.findings : [],
    behavior: Array.isArray(parsedSummary?.behavior) ? parsedSummary.behavior : [],
    attributeValuesByClass,
  };
}

function transformSummaryToGridRow(summary) {
  const normalizedSummary = normalizeSummaryRecordForGrid(summary);
  const demographics = normalizedSummary?.demographics || {};
  const staging = Array.isArray(normalizedSummary?.staging) ? normalizedSummary.staging : [];
  const gradingFromNlp = (Array.isArray(normalizedSummary?.grading) ? normalizedSummary.grading : [])[0];
  const normalizeGradeLabel = (value) =>
    String(value || "")
      .replace(/^grade[_\s]*(numeric)?\s*/i, "")
      .trim();
  const getFirstNonEmptyGrade = (rawValues) => {
    const values = Array.isArray(rawValues) ? rawValues : [rawValues];
    for (const value of values) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        const nestedValue = getFirstNonEmptyGrade(value);
        if (nestedValue) {
          return nestedValue;
        }
        continue;
      }
      if (typeof value === "object") {
        const nestedObjectValue = getFirstNonEmptyGrade([
          value?.name,
          value?.value,
          value?.label,
          value?.display,
          value?.displayLabel,
        ]);
        if (nestedObjectValue) {
          return nestedObjectValue;
        }
        continue;
      }

      const normalizedValue = normalizeGradeLabel(value);
      if (normalizedValue) {
        return normalizedValue;
      }
    }
    return "";
  };
  const gradingFromAttributes = getFirstNonEmptyGrade([
    normalizedSummary?.attributeValuesByClass?.GRADE_NUMERIC,
    normalizedSummary?.GRADE_NUMERIC,
    normalizedSummary?.grade_numeric,
    normalizedSummary?.gradeNumeric,
    summary?.GRADE_NUMERIC,
    summary?.grade_numeric,
    summary?.gradeNumeric,
  ]);
  const grading = getFirstNonEmptyGrade([
    gradingFromNlp?.name,
    gradingFromNlp?.value,
    gradingFromAttributes,
  ]) || "—";
  const diagnoses = Array.isArray(normalizedSummary?.diagnoses) ? normalizedSummary.diagnoses : [];
  const STAGE_GROUP_RANK = {
    "0": 0,
    IA: 1,
    IB: 2,
    IC: 3,
    IIA: 4,
    IIB: 5,
    IIC: 6,
    IIIA: 7,
    IIIB: 8,
    IIIC: 9,
    IIID: 10,
    IV: 11,
    IVA: 12,
    IVB: 13,
    IVC: 14,
  };
  const CANCER_KEYWORDS =
    /carcinoma|melanoma|neoplasm|lymphoma|leukemia|sarcoma|tumou?r|cancer|adenocarcinoma|myeloma|mesothelioma|glioma|blastoma|dcis|in\ssitu/i;

  const normalizeStageName = (value) => String(value || "").trim();
  const getStageNames = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((entry) => normalizeStageName(entry?.name ?? entry?.value))
      .filter(Boolean);
  const getTnmScore = (value, prefix) => {
    const normalized = normalizeStageName(value).replace(/\s+/g, "");
    const upperPrefix = String(prefix || "").toUpperCase();
    if (!normalized.toUpperCase().startsWith(upperPrefix)) {
      return Number.NEGATIVE_INFINITY;
    }

    const remainder = normalized.slice(upperPrefix.length);
    if (!remainder) {
      return -1;
    }

    if (/^X/i.test(remainder)) {
      return -1;
    }
    if (/^is/i.test(remainder)) {
      return 0.2;
    }
    if (/^mi/i.test(remainder)) {
      return 0.3;
    }

    const numberMatch = remainder.match(/^(\d+)/);
    const base = numberMatch ? Number.parseInt(numberMatch[1], 10) : 0;
    const suffix = numberMatch ? remainder.slice(numberMatch[1].length) : remainder;
    const letter = suffix.match(/^([A-D])/i)?.[1]?.toUpperCase();
    const letterBoost = letter ? (letter.charCodeAt(0) - 64) / 10 : 0;

    return base + letterBoost;
  };
  const pickHighestByScore = (names, prefix) => {
    let bestName = "";
    let bestScore = Number.NEGATIVE_INFINITY;

    names.forEach((name) => {
      const score = getTnmScore(name, prefix);
      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      }
    });

    return { name: bestName, score: bestScore };
  };
  const pickDisplayStage = (rows) => {
    const names = getStageNames(rows);
    if (names.length === 0) {
      return { label: "—", rank: Number.NEGATIVE_INFINITY };
    }

    const overallGroups = names.filter((name) => /^Stage\s+/i.test(name));
    if (overallGroups.length > 0) {
      const bestGroup = overallGroups.reduce((best, current) => {
        const bestKey = best.replace(/^Stage\s+/i, "").toUpperCase();
        const currentKey = current.replace(/^Stage\s+/i, "").toUpperCase();
        const bestRank = STAGE_GROUP_RANK[bestKey] ?? -1;
        const currentRank = STAGE_GROUP_RANK[currentKey] ?? -1;
        return currentRank > bestRank ? current : best;
      });
      const bestKey = bestGroup.replace(/^Stage\s+/i, "").toUpperCase();

      return {
        label: bestGroup,
        rank: 1000 + (STAGE_GROUP_RANK[bestKey] ?? -1),
      };
    }

    const pathologicT = pickHighestByScore(names.filter((name) => /^pT/i.test(name)), "pT");
    if (pathologicT.name) {
      return { label: pathologicT.name, rank: 800 + pathologicT.score };
    }

    const clinicalT = pickHighestByScore(
      names.filter((name) => /^T\d/i.test(name) && !/^pT/i.test(name)),
      "T"
    );
    if (clinicalT.name) {
      return { label: clinicalT.name, rank: 700 + clinicalT.score };
    }

    const nStage = pickHighestByScore(names.filter((name) => /^N/i.test(name)), "N");
    if (nStage.name) {
      return { label: nStage.name, rank: 600 + nStage.score };
    }

    const mStage = pickHighestByScore(names.filter((name) => /^M/i.test(name)), "M");
    if (mStage.name) {
      return { label: mStage.name, rank: 500 + mStage.score };
    }

    return { label: names[0], rank: 0 };
  };
  const pickActiveDx = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    const nonNegated = items.filter((item) => !item?.negated);
    if (nonNegated.length === 0) {
      return null;
    }

    const tier1 = nonNegated.find(
      (item) =>
        !item?.historic &&
        (String(item?.source || "").toLowerCase() === "cancer" ||
          String(item?.source || "").toLowerCase() === "tumor")
    );
    if (tier1) {
      return tier1;
    }

    const tier2 = nonNegated.find(
      (item) => !item?.historic && CANCER_KEYWORDS.test(String(item?.name || ""))
    );
    if (tier2) {
      return tier2;
    }

    const tier3 = nonNegated.find((item) =>
      ["cancer", "tumor"].includes(String(item?.source || "").toLowerCase())
    );
    if (tier3) {
      return tier3;
    }

    const tier4 = nonNegated.find((item) => CANCER_KEYWORDS.test(String(item?.name || "")));
    if (tier4) {
      return tier4;
    }

    return nonNegated[0] || null;
  };
  const stageSelection = pickDisplayStage(staging);
  const activeDxEntry = pickActiveDx(diagnoses);
  const activeDxName = String(activeDxEntry?.name || "").trim() || "—";
  const activeDxHistoric = Boolean(activeDxEntry?.historic);
  const activeDxUncertain = Boolean(activeDxEntry?.uncertain);
  const activeDxDisplayText =
    activeDxName === "—"
      ? "—"
      : `${activeDxName}${activeDxHistoric ? " (historic)" : ""}${activeDxUncertain ? " (uncertain)" : ""}`;
  const rawAge = demographics?.age_at_dx;
  const parsedAge =
    rawAge != null && rawAge !== "" && String(rawAge) !== "0" ? Number(rawAge) : null;
  const ageAtDx =
    parsedAge != null && Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : null;

  const normalizeCancerType = (value) => {
    const rawCancerType = String(value || "").trim();
    if (!rawCancerType) {
      return "";
    }

    const normalizedCode = rawCancerType.toUpperCase();
    return CANCER_TYPE_MAP[normalizedCode] || rawCancerType;
  };

  const inferCancerTypeFromDiagnoses = (items) => {
    const diagnosisNames = (Array.isArray(items) ? items : [])
      .map((item) => String(item?.name || "").trim().toLowerCase())
      .filter(Boolean);

    if (diagnosisNames.some((name) => name.includes("melanoma"))) {
      return "Melanoma";
    }
    if (diagnosisNames.some((name) => name.includes("ovar"))) {
      return "Ovarian Cancer";
    }
    if (diagnosisNames.some((name) => name.includes("breast"))) {
      return "Breast";
    }

    return "";
  };

  const resolvedCancerType =
    normalizeCancerType(
      demographics?.cancer_type ??
        demographics?.cancerType ??
        demographics?.cancer ??
        normalizedSummary?.cancer_type ??
        normalizedSummary?.cancerType ??
        normalizedSummary?.cancer
    ) || inferCancerTypeFromDiagnoses(diagnoses);

  const summarizeArray = (items, cap = 3, excludeItem = null) => {
    if (!Array.isArray(items)) {
      return { display: "—", full: "" };
    }

    const nonNegatedNames = items
      .filter((item) => !item?.negated)
      .filter((item) => (excludeItem ? item !== excludeItem : true))
      .map((item) => String(item?.name || "").trim())
      .filter(Boolean);

    if (nonNegatedNames.length === 0) {
      return { display: "—", full: "" };
    }

    const full = nonNegatedNames.join(", ");
    if (nonNegatedNames.length <= cap) {
      return { display: full, full };
    }

    return {
      display: nonNegatedNames.slice(0, cap).join(", "),
      overflow: nonNegatedNames.length - cap,
      full,
    };
  };

  return {
    patientId: String(
      normalizedSummary?.patient_id ??
        normalizedSummary?.patientId ??
        summary?.patient_id ??
        summary?.patientId ??
        ""
    ).trim(),
    ageAtDx,
    gender: GENDER_MAP[demographics?.gender] || demographics?.gender || "Unknown",
    race: demographics?.race || "Unknown",
    ethnicity: demographics?.ethnicity || "Unknown",
    cancerType: resolvedCancerType || "—",
    stage: stageSelection.label || "—",
    stageSortRank: stageSelection.rank,
    grade: String(grading || "—"),
    activeDx: activeDxDisplayText,
    activeDxMeta: {
      name: activeDxName,
      historic: activeDxHistoric,
      uncertain: activeDxUncertain,
    },
    diagnosesSummary: summarizeArray(normalizedSummary?.diagnoses, 3, activeDxEntry),
    biomarkersSummary: summarizeArray(normalizedSummary?.biomarkers, 3),
    treatmentsSummary: summarizeArray(normalizedSummary?.treatments, 2),
    proceduresSummary: summarizeArray(normalizedSummary?.procedures, 2),
    findingsSummary: summarizeArray(normalizedSummary?.findings, 2),
    _raw: normalizedSummary || summary,
  };
}

function createEmptyPatientSummary(patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  return {
    patientId: normalizedPatientId,
    docCount: 0,
    activeDx: [],
    negatedDx: [],
    staging: [],
    biomarkers: [],
    procedures: [],
    treatments: [],
    activeFindings: [],
    negatedFindings: [],
  };
}

function normalizePatientSummaryRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.summaries)) {
    return payload.summaries;
  }

  return [];
}

function parsePatientSummaryJson(value) {
  let nextValue = value;

  for (let parsePass = 0; parsePass < 3; parsePass += 1) {
    if (!nextValue) {
      return null;
    }

    if (typeof nextValue === "object") {
      return nextValue;
    }

    if (typeof nextValue === "string") {
      const trimmedValue = nextValue.trim();
      if (!trimmedValue) {
        return null;
      }

      try {
        nextValue = JSON.parse(trimmedValue);
        continue;
      } catch {
        return null;
      }
    }

    return null;
  }

  return typeof nextValue === "object" && nextValue ? nextValue : null;
}

function normalizeSummaryList(items, { includeUncertain = false } = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = String(item?.name ?? item?.label ?? item?.value ?? "").trim();
      if (!name) {
        return null;
      }

      const docFreq = Number(item?.docFreq ?? item?.doc_freq);
      const summaryItem = { name };
      if (includeUncertain) {
        summaryItem.uncertain = Boolean(item?.uncertain);
      }
      if (Number.isFinite(docFreq) && docFreq > 0) {
        summaryItem.docFreq = docFreq;
      }
      return summaryItem;
    })
    .filter(Boolean);
}

function buildPatientSummaryFromFilterSummary(payload, patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  const summaryRows = normalizePatientSummaryRows(payload);
  const matchingRow =
    summaryRows.find((row) => {
      const rowPatientId = String(row?.patient_id ?? row?.patientId ?? "").trim();
      return rowPatientId && rowPatientId === normalizedPatientId;
    }) || summaryRows[0];

  if (!matchingRow) {
    return createEmptyPatientSummary(normalizedPatientId);
  }

  const summaryPayload =
    parsePatientSummaryJson(matchingRow?.json_text ?? matchingRow?.jsonText) ||
    parsePatientSummaryJson(matchingRow);

  if (!summaryPayload || typeof summaryPayload !== "object") {
    return createEmptyPatientSummary(normalizedPatientId);
  }

  const summaryPatientId = String(
    summaryPayload?.patient_id ??
      summaryPayload?.patientId ??
      matchingRow?.patient_id ??
      matchingRow?.patientId ??
      normalizedPatientId
  ).trim();

  const diagnosisItems = Array.isArray(summaryPayload?.diagnoses) ? summaryPayload.diagnoses : [];
  const findingItems = Array.isArray(summaryPayload?.findings) ? summaryPayload.findings : [];
  const docCountField = Number(
    summaryPayload?.doc_count ??
      summaryPayload?.docCount ??
      summaryPayload?.document_count ??
      summaryPayload?.documentCount ??
      summaryPayload?.note_count ??
      summaryPayload?.noteCount
  );
  const docCountArrayFallback =
    (Array.isArray(summaryPayload?.documents) && summaryPayload.documents.length) ||
    (Array.isArray(summaryPayload?.docs) && summaryPayload.docs.length) ||
    (Array.isArray(summaryPayload?.notes) && summaryPayload.notes.length) ||
    (Array.isArray(summaryPayload?.note_ids) && summaryPayload.note_ids.length) ||
    (Array.isArray(summaryPayload?.noteIds) && summaryPayload.noteIds.length) ||
    (Array.isArray(summaryPayload?.document_ids) && summaryPayload.document_ids.length) ||
    (Array.isArray(summaryPayload?.documentIds) && summaryPayload.documentIds.length) ||
    0;

  return {
    patientId: summaryPatientId || normalizedPatientId,
    docCount: Number.isFinite(docCountField) && docCountField > 0 ? docCountField : docCountArrayFallback,
    activeDx: normalizeSummaryList(
      diagnosisItems.filter((item) => !Boolean(item?.negated)),
      { includeUncertain: true }
    ),
    negatedDx: normalizeSummaryList(diagnosisItems.filter((item) => Boolean(item?.negated))),
    staging: normalizeSummaryList(summaryPayload?.staging),
    biomarkers: normalizeSummaryList(summaryPayload?.biomarkers),
    procedures: normalizeSummaryList(summaryPayload?.procedures),
    treatments: normalizeSummaryList(summaryPayload?.treatments),
    activeFindings: normalizeSummaryList(
      findingItems.filter((item) => !Boolean(item?.negated))
    ),
    negatedFindings: normalizeSummaryList(
      findingItems.filter((item) => Boolean(item?.negated))
    ),
  };
}

function resolveDocumentCountFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (Array.isArray(payload?.documents)) {
    return payload.documents.length;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data.length;
  }

  const numericCount = Number(payload?.count);
  if (Number.isFinite(numericCount) && numericCount >= 0) {
    return numericCount;
  }

  return 0;
}

function getZeroResultHint(filters, itemCounts) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return "";
  }

  if (Array.isArray(itemCounts)) {
    const firstZeroMatchIndex = itemCounts.findIndex((value) => Number(value) === 0);
    if (firstZeroMatchIndex >= 0 && firstZeroMatchIndex < filters.length) {
      const filter = filters[firstZeroMatchIndex];
      return `${prettifyClassName(filter.class, filter.type)} matched 0 patients before intersection. Check spelling and selected values.`;
    }
  }

  return "Each filter matches patients independently, but their overlap is 0. Try broadening one filter.";
}

function normalizeChartSortMode(sortMode) {
  const normalizedSortMode = String(sortMode || "").trim();
  if (FILTER_VALUE_SORT_MODES.includes(normalizedSortMode)) {
    return normalizedSortMode;
  }
  return DEFAULT_FILTER_VALUE_SORT_MODE;
}

function getSortDimensionFromMode(sortMode) {
  return String(sortMode || "").startsWith("alpha")
    ? FILTER_SORT_DIMENSION.LABEL
    : FILTER_SORT_DIMENSION.COUNT;
}

function getSortDirectionFromMode(sortMode) {
  return String(sortMode || "").endsWith("asc")
    ? FILTER_SORT_DIRECTION.ASC
    : FILTER_SORT_DIRECTION.DESC;
}

function toSortMode(sortDimension, sortDirection) {
  const nextDirection =
    sortDirection === FILTER_SORT_DIRECTION.ASC
      ? FILTER_SORT_DIRECTION.ASC
      : FILTER_SORT_DIRECTION.DESC;

  if (sortDimension === FILTER_SORT_DIMENSION.LABEL) {
    return nextDirection === FILTER_SORT_DIRECTION.ASC ? "alpha-asc" : "alpha-desc";
  }

  return nextDirection === FILTER_SORT_DIRECTION.ASC ? "value-asc" : "value-desc";
}

function filterRowsByQuery(data, searchQuery) {
  const query = String(searchQuery || "")
    .trim()
    .toLowerCase();
  if (!query) {
    return Array.isArray(data) ? data : [];
  }

  return (Array.isArray(data) ? data : []).filter((row) => {
    const displayLabel = String(row?.displayLabel || "").trim().toLowerCase();
    const rawLabel = String(row?.label || "").trim().toLowerCase();
    return displayLabel.includes(query) || rawLabel.includes(query);
  });
}

function FiltersView() {
  const [themeKey, setThemeKey] = useState(getInitialThemeKey);
  const [fontScale, setFontScale] = useState(getInitialFontScale);
  const [fontFamilyKey] = useState(getInitialFontFamilyKey);
  const [highContrast, setHighContrast] = useState(() => getInitialBooleanPref(HIGH_CONTRAST_STORAGE_KEY));
  const [reducedMotion, setReducedMotion] = useState(() => getInitialBooleanPref(REDUCED_MOTION_STORAGE_KEY));
  const [isThemeBuilderOpen, setIsThemeBuilderOpen] = useState(false);
  const [themeBuilderThemeKey, setThemeBuilderThemeKey] = useState(getInitialThemeKey);
  const [themeBuilderSearchQuery, setThemeBuilderSearchQuery] = useState("");
  const [themeColorOverridesByTheme, setThemeColorOverridesByTheme] = useState(
    getInitialThemeColorOverridesByTheme
  );
  const selectedBaseTheme = useMemo(() => getThemeByKey(themeKey), [themeKey]);
  const activeThemeColorEntries = useMemo(
    () => collectThemeColorEntries(selectedBaseTheme),
    [selectedBaseTheme]
  );
  const activeThemeColorOverrides = themeColorOverridesByTheme[themeKey] || EMPTY_THEME_COLOR_OVERRIDES;
  const activeThemeColorPatch = useMemo(
    () => buildThemeColorOverridePatch(activeThemeColorEntries, activeThemeColorOverrides),
    [activeThemeColorEntries, activeThemeColorOverrides]
  );
  const activeTheme = useMemo(() => {
    let theme = selectedBaseTheme;

    if (Object.keys(activeThemeColorPatch).length > 0) {
      theme = createTheme(theme, activeThemeColorPatch);
    }

    const selectedFontFamily = FONT_FAMILY_OPTIONS.find((option) => option.key === fontFamilyKey);

    if (selectedFontFamily?.stack) {
      theme = createTheme(theme, {
        typography: {
          fontFamily: selectedFontFamily.stack,
        },
      });
    }

    if (highContrast) {
      theme = applyHighContrast(theme);
    }

    if (fontScale !== 1) {
      theme = createTheme(theme, {
        custom: getScaledCustomThemeValues(theme.custom || {}, fontScale),
      });
    }

    return theme;
  }, [activeThemeColorPatch, fontFamilyKey, fontScale, highContrast, selectedBaseTheme]);
  const isSmUp = useMediaQuery(activeTheme.breakpoints.up("sm"), { noSsr: true });
  const isMdUp = useMediaQuery(activeTheme.breakpoints.up("md"), { noSsr: true });
  const isLgUp = useMediaQuery(activeTheme.breakpoints.up("lg"), { noSsr: true });
  const isXlUp = useMediaQuery(activeTheme.breakpoints.up("xl"), { noSsr: true });
  const resolvedSectionColumnCap = useMemo(
    () =>
      resolveResponsiveColumnCap(FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT, {
        isSmUp,
        isMdUp,
        isLgUp,
        isXlUp,
      }),
    [isLgUp, isMdUp, isSmUp, isXlUp]
  );
  const custom = activeTheme.custom || {};
  const initialLoadStartRef = useRef(
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now()
  );
  const hasLoggedInitialLoadRef = useRef(false);

  const handleThemeChange = useCallback((event) => {
    const nextKey = String(event?.target?.value || "");
    if (nextKey === THEME_EDITOR_MENU_VALUE) {
      setThemeBuilderThemeKey(themeKey);
      setThemeBuilderSearchQuery("");
      setIsThemeBuilderOpen(true);
      return;
    }
    if (!THEME_OPTIONS.some((option) => option.key === nextKey)) {
      return;
    }
    setThemeKey(nextKey);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextKey);
    } catch {
      // localStorage unavailable
    }
  }, [themeKey]);

  const themeBuilderTheme = useMemo(() => getThemeByKey(themeBuilderThemeKey), [themeBuilderThemeKey]);
  const themeBuilderColorEntries = useMemo(
    () => collectThemeColorEntries(themeBuilderTheme),
    [themeBuilderTheme]
  );
  const themeBuilderThemeOverrides =
    themeColorOverridesByTheme[themeBuilderThemeKey] || EMPTY_THEME_COLOR_OVERRIDES;
  const filteredThemeBuilderColorEntries = useMemo(() => {
    const normalizedQuery = String(themeBuilderSearchQuery || "")
      .trim()
      .toLowerCase();
    if (!normalizedQuery) {
      return themeBuilderColorEntries;
    }
    return themeBuilderColorEntries.filter((entry) => {
      const pathText = String(entry?.pathLabel || "").toLowerCase();
      const valueText = String(entry?.defaultValue || "").toLowerCase();
      return pathText.includes(normalizedQuery) || valueText.includes(normalizedQuery);
    });
  }, [themeBuilderColorEntries, themeBuilderSearchQuery]);
  const hasThemeBuilderOverrides = Object.keys(themeBuilderThemeOverrides).length > 0;
  const hasAnyThemeColorOverrides = Object.keys(themeColorOverridesByTheme).length > 0;

  useEffect(() => {
    try {
      localStorage.setItem(
        THEME_COLOR_OVERRIDES_STORAGE_KEY,
        JSON.stringify(normalizeThemeColorOverridesByTheme(themeColorOverridesByTheme))
      );
    } catch {
      // localStorage unavailable
    }
  }, [themeColorOverridesByTheme]);

  const handleThemeBuilderClose = useCallback(() => {
    setIsThemeBuilderOpen(false);
  }, []);

  const handleThemeBuilderThemeChange = useCallback((event) => {
    const nextThemeKey = String(event?.target?.value || "");
    if (!THEME_OPTIONS.some((option) => option.key === nextThemeKey)) {
      return;
    }
    setThemeBuilderThemeKey(nextThemeKey);
    setThemeBuilderSearchQuery("");
  }, []);

  const handleThemeBuilderEntryChange = useCallback((entry, rawNextValue) => {
    if (!entry?.id || !entry?.defaultValue) {
      return;
    }

    const normalizedNextValue = String(rawNextValue ?? "").trim();
    setThemeColorOverridesByTheme((previousOverridesByTheme) => {
      const previousThemeOverrides =
        previousOverridesByTheme[themeBuilderThemeKey] || EMPTY_THEME_COLOR_OVERRIDES;
      const nextThemeOverrides = { ...previousThemeOverrides };

      if (!normalizedNextValue || normalizedNextValue === entry.defaultValue) {
        delete nextThemeOverrides[entry.id];
      } else {
        nextThemeOverrides[entry.id] = normalizedNextValue;
      }

      const nextOverridesByTheme = { ...previousOverridesByTheme };
      if (Object.keys(nextThemeOverrides).length === 0) {
        delete nextOverridesByTheme[themeBuilderThemeKey];
      } else {
        nextOverridesByTheme[themeBuilderThemeKey] = nextThemeOverrides;
      }
      return nextOverridesByTheme;
    });
  }, [themeBuilderThemeKey]);

  const handleThemeBuilderThemeReset = useCallback(() => {
    setThemeColorOverridesByTheme((previousOverridesByTheme) => {
      if (!previousOverridesByTheme[themeBuilderThemeKey]) {
        return previousOverridesByTheme;
      }
      const nextOverridesByTheme = { ...previousOverridesByTheme };
      delete nextOverridesByTheme[themeBuilderThemeKey];
      return nextOverridesByTheme;
    });
  }, [themeBuilderThemeKey]);

  const handleThemeBuilderResetAll = useCallback(() => {
    setThemeColorOverridesByTheme({});
  }, []);

  const handleThemeBuilderApplyTheme = useCallback(() => {
    if (!THEME_OPTIONS.some((option) => option.key === themeBuilderThemeKey)) {
      return;
    }
    setThemeKey(themeBuilderThemeKey);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeBuilderThemeKey);
    } catch {
      // localStorage unavailable
    }
  }, [themeBuilderThemeKey]);

  const handleFontScaleChange = useCallback((delta) => {
    setFontScale((previousScale) => {
      if (!Number.isFinite(delta) || delta === 0) {
        return previousScale;
      }

      const currentIndex = findClosestFontScaleIndex(previousScale);
      const nextIndex = Math.max(
        0,
        Math.min(FONT_SCALE_OPTIONS.length - 1, currentIndex + Math.sign(delta))
      );
      const nextScale = FONT_SCALE_OPTIONS[nextIndex];

      try {
        localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(nextScale));
      } catch {
        // localStorage unavailable
      }

      return nextScale;
    });
  }, []);

  const handleHighContrastToggle = useCallback(() => {
    setHighContrast((previousValue) => {
      const nextValue = !previousValue;
      try {
        localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(nextValue));
      } catch {
        // localStorage unavailable
      }
      return nextValue;
    });
  }, []);

  const handleReducedMotionToggle = useCallback(() => {
    setReducedMotion((previousValue) => {
      const nextValue = !previousValue;
      try {
        localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(nextValue));
      } catch {
        // localStorage unavailable
      }
      return nextValue;
    });
  }, []);
  const getOmopSummaryForFilters = useCallback(
    () => getOmopSummary({ includePatientIds: false }),
    []
  );
  const getAttributesSummaryForFilters = useCallback(
    () => getAttributesSummary({ includePatientIds: false }),
    []
  );
  const omopData = useBatchDataLoader(getOmopSummaryForFilters, "OMOP");
  const attributeData = useBatchDataLoader(getAttributesSummaryForFilters, "Attributes");
  const [selectedOmopValuesByClass, setSelectedOmopValuesByClass] = useState({});
  const [selectedAttributeValuesByClass, setSelectedAttributeValuesByClass] = useState({});
  const [expandedParentsByClass, setExpandedParentsByClass] = useState({});
  const [omopSortModeByClass, setOmopSortModeByClass] = useState({});
  const [attributeSortModeByClass, setAttributeSortModeByClass] = useState({});
  const [activeFilterModal, setActiveFilterModal] = useState(null);
  const [activeFilterSearchQuery, setActiveFilterSearchQuery] = useState("");
  const ageAtDxSelectionMode = AGE_SELECTION_MODE.DECILE;
  const [countResult, setCountResult] = useState(null);
  const [includedCountByRowKey, setIncludedCountByRowKey] = useState({});
  const [includedPatientIdsByRowKey, setIncludedPatientIdsByRowKey] = useState({});
  const includedPatientIdsByRowKeyRef = useRef({});
  const [countError, setCountError] = useState("");
  const [isCountLoading, setIsCountLoading] = useState(false);
  const [currentPatientGridPage, setCurrentPatientGridPage] = useState(0);
  const [patientGridPageCache, setPatientGridPageCache] = useState(() => new Map());
  const [isPatientGridPageLoading, setIsPatientGridPageLoading] = useState(false);
  const [patientGridPageError, setPatientGridPageError] = useState("");
  const [patientGridPageRetryToken, setPatientGridPageRetryToken] = useState(0);
  const [isPatientGridDockExpanded, setIsPatientGridDockExpanded] = useState(true);
  const [filterLayoutMode, setFilterLayoutMode] = useState(FILTER_LAYOUT_MODE.PER_CARD_COLUMN);
  const isPerCardColumnLayout = filterLayoutMode === FILTER_LAYOUT_MODE.PER_CARD_COLUMN;
  const [cardNaturalHeightByKey, setCardNaturalHeightByKey] = useState({});
  const cardMeasureRefs = useRef({});
  const patientSummaryCacheRef = useRef(new Map());

  useEffect(() => {
    if (fontFamilyKey !== "open-dyslexic" || typeof document === "undefined") {
      return;
    }

    if (!document.getElementById(OPEN_DYSLEXIC_FONT_LINK_ID)) {
      const linkElement = document.createElement("link");
      linkElement.id = OPEN_DYSLEXIC_FONT_LINK_ID;
      linkElement.rel = "stylesheet";
      linkElement.href = OPEN_DYSLEXIC_FONT_LINK_HREF;
      document.head.appendChild(linkElement);
    }
  }, [fontFamilyKey]);

  useEffect(() => {
    includedPatientIdsByRowKeyRef.current = includedPatientIdsByRowKey;
  }, [includedPatientIdsByRowKey]);

  useEffect(() => {
    if (hasLoggedInitialLoadRef.current) {
      return;
    }

    if (omopData.isLoading || attributeData.isLoading) {
      return;
    }

    hasLoggedInitialLoadRef.current = true;
    const loadEndTime =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    if (SHOULD_LOG_FILTERS_PERF) {
      // eslint-disable-next-line no-console
      console.log("[FiltersView] initial data ready", {
        totalMs: Math.round(loadEndTime - initialLoadStartRef.current),
        omopClasses: omopData.classes.length,
        attributeClasses: attributeData.classes.length,
        omopError: omopData.errorMessage || "",
        attributeError: attributeData.errorMessage || "",
      });
    }
  }, [
    attributeData.classes.length,
    attributeData.errorMessage,
    attributeData.isLoading,
    omopData.classes.length,
    omopData.errorMessage,
    omopData.isLoading,
  ]);

  const omopFilterSets = useMemo(
    () =>
      resolveFilterSetsWithExtras(omopData.classes, "omop").filter(
        (filterSet) => filterSet.display !== false
      ),
    [omopData.classes]
  );
  const attributeFilterSets = useMemo(
    () =>
      resolveFilterSetsWithExtras(attributeData.classes, "attributes").filter(
        (filterSet) => filterSet.display !== false
      ),
    [attributeData.classes]
  );
  const omopFilterSetRows = useMemo(() => groupFilterSetsByRow(omopFilterSets), [omopFilterSets]);
  const attributeFilterSetRows = useMemo(
    () => groupFilterSetsByRow(attributeFilterSets),
    [attributeFilterSets]
  );
  const orderedOmopClasses = useMemo(
    () => omopFilterSets.flatMap((filterSet) => filterSet.filters.map((filter) => filter.key)),
    [omopFilterSets]
  );
  const orderedAttributeFilterClasses = useMemo(
    () =>
      attributeFilterSets.flatMap((filterSet) =>
        filterSet.filters.map((filter) => filter.key)
      ),
    [attributeFilterSets]
  );
  const chartDataByClass = useMemo(() => {
    const next = {};
    orderedOmopClasses.forEach((className) => {
      next[className] = toChartData(omopData.summaryByClass[className], "omop", className);
    });
    return next;
  }, [orderedOmopClasses, omopData.summaryByClass]);
  const attributeChartDataByClass = useMemo(() => {
    const next = {};
    orderedAttributeFilterClasses.forEach((className) => {
      next[className] = toChartData(
        attributeData.summaryByClass[className],
        "attributes",
        className
      );
    });
    return next;
  }, [orderedAttributeFilterClasses, attributeData.summaryByClass]);
  const rolledUpChartDataByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];
      next[className] = isAttributeRollupClass(className)
        ? buildRolledUpChartData(classData, className)
        : classData;
    });

    return next;
  }, [attributeChartDataByClass, orderedAttributeFilterClasses]);
  const rollupInstanceMapByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];
      next[className] = isAttributeRollupClass(className)
        ? buildRollupInstanceMap(classData, className)
        : {};
    });

    return next;
  }, [attributeChartDataByClass, orderedAttributeFilterClasses]);
  const attributeDisplayChartDataByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];

      if (!isAttributeRollupClass(className)) {
        next[className] = classData;
        return;
      }

      const rolledRows = rolledUpChartDataByClass[className] || [];
      const expandedParentSet = new Set(expandedParentsByClass[className] || []);
      const displayRows = [];

      rolledRows.forEach((row) => {
        const rowLabel = String(row?.label || "").trim();
        const rowIsExpandable = Boolean(row?._expandable);
        const rowIsExpanded = rowIsExpandable && expandedParentSet.has(rowLabel);

        displayRows.push({
          ...row,
          _isExpandedParent: rowIsExpanded,
        });

        if (!rowIsExpanded || !isExpandable(classData, className, rowLabel)) {
          return;
        }

        const childRows = buildChildChartData(classData, className, rowLabel);
        displayRows.push(...childRows);
      });

      next[className] = displayRows;
    });

    return next;
  }, [
    attributeChartDataByClass,
    expandedParentsByClass,
    orderedAttributeFilterClasses,
    rolledUpChartDataByClass,
  ]);
  const ageAtDxClassName = useMemo(
    () =>
      orderedOmopClasses.find(
        (className) => normalizeClassName(className) === AGE_AT_DX_CLASS
      ) || "",
    [orderedOmopClasses]
  );
  const ageAtDxRawChartData = useMemo(() => {
    if (!ageAtDxClassName) {
      return [];
    }
    return chartDataByClass[ageAtDxClassName] || [];
  }, [ageAtDxClassName, chartDataByClass]);
  const ageAtDxDecileChartData = useMemo(
    () => buildAgeDecileChartData(ageAtDxRawChartData),
    [ageAtDxRawChartData]
  );
  const ageDecileInstanceMap = useMemo(
    () => buildAgeDecileInstanceMap(ageAtDxRawChartData),
    [ageAtDxRawChartData]
  );
  const chartClassRows = useMemo(() => {
    const rows = [];

    orderedOmopClasses.forEach((className) => {
      const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
      const data =
        isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
          ? ageAtDxDecileChartData
          : chartDataByClass[className] || [];

      rows.push({
        type: "omop",
        className,
        data,
      });
    });

    orderedAttributeFilterClasses.forEach((className) => {
      rows.push({
        type: "attributes",
        className,
        data: attributeDisplayChartDataByClass[className] || [],
      });
    });

    return rows;
  }, [
    ageAtDxDecileChartData,
    ageAtDxSelectionMode,
    attributeDisplayChartDataByClass,
    chartDataByClass,
    orderedAttributeFilterClasses,
    orderedOmopClasses,
  ]);
  const isLoading = omopData.isLoading;
  const isAttributeLoading = attributeData.isLoading;
  const rootError = omopData.errorMessage;
  const attributeRootError = attributeData.errorMessage;
  const activeFilters = useMemo(
    () =>
      buildActiveFilters({
        selectedOmopValuesByClass,
        omopClasses: orderedOmopClasses,
        selectedAttributeValuesByClass,
        attributeClasses: orderedAttributeFilterClasses,
      }),
    [
      orderedAttributeFilterClasses,
      orderedOmopClasses,
      selectedAttributeValuesByClass,
      selectedOmopValuesByClass,
    ]
  );
  const requestFilters = useMemo(
    () =>
      resolveRequestFilters({
        filters: activeFilters,
        ageAtDxSelectionMode,
        ageDecileInstanceMap,
        rollupInstanceMapByClass,
      }),
    [activeFilters, ageAtDxSelectionMode, ageDecileInstanceMap, rollupInstanceMapByClass]
  );
  const hasSelections = activeFilters.length > 0;
  const getPatientSummary = useCallback(async (patientId) => {
    const normalizedPatientId = String(patientId || "").trim();
    if (!normalizedPatientId) {
      return null;
    }

    const cache = patientSummaryCacheRef.current;
    if (cache.has(normalizedPatientId)) {
      return cache.get(normalizedPatientId);
    }

    const summaryPromise = (async () => {
      const summaryPayload = await fetchDeepPheFilterSummary([normalizedPatientId]).catch(() => []);
      const summary = buildPatientSummaryFromFilterSummary(summaryPayload, normalizedPatientId);
      if (summary.docCount > 0) {
        return summary;
      }

      const documentsPayload = await fetchPatientDocuments(normalizedPatientId, {
        excludeProperties: DOCUMENT_COUNT_EXCLUDE_PROPERTIES,
      }).catch(() => null);
      const resolvedDocCount = resolveDocumentCountFromPayload(documentsPayload);
      if (resolvedDocCount > 0) {
        return { ...summary, docCount: resolvedDocCount };
      }

      return summary;
    })();

    cache.set(normalizedPatientId, summaryPromise);
    return summaryPromise;
  }, []);

  useEffect(() => {
    let isActive = true;

    const staticCountsByRowKey = {};
    const staticPatientIdsByRowKey = {};
    const countRequests = [];

    chartClassRows.forEach(({ type, className, data }) => {
      const classData = Array.isArray(data) ? data : [];
      const filtersExcludingClass = activeFilters.filter(
        (filter) => !isSameFilterClass(filter, type, className)
      );
      const shouldQueryIncludedCounts = hasSelections && filtersExcludingClass.length > 0;

      classData.forEach((row) => {
        const rowLabel = String(row?.label || "").trim();
        const rowTotalCount = Number(row?.value);
        if (!rowLabel || !Number.isFinite(rowTotalCount)) {
          return;
        }

        const rowKey = getFilterRowKey(type, className, rowLabel);
        const fallbackCount = Math.max(0, Math.round(rowTotalCount));
        const rowPatientIds = normalizeInstanceValues(row?.patientIds);
        const cachedRowPatientIds = normalizeInstanceValues(
          includedPatientIdsByRowKeyRef.current?.[rowKey]
        );
        const effectiveRowPatientIds =
          rowPatientIds.length > 0 ? rowPatientIds : cachedRowPatientIds;
        const shouldRequestPatientIdsForDots =
          fallbackCount > 0 &&
          fallbackCount <= INLINE_PATIENT_IDS_THRESHOLD &&
          effectiveRowPatientIds.length < fallbackCount;

        if (effectiveRowPatientIds.length > 0) {
          staticPatientIdsByRowKey[rowKey] = effectiveRowPatientIds;
        }

        const shouldQueueCountRequest = shouldQueryIncludedCounts || shouldRequestPatientIdsForDots;

        if (!shouldQueueCountRequest) {
          staticCountsByRowKey[rowKey] = fallbackCount;
          return;
        }

        const rowInstances = getRowInstancesForClass({
          type,
          className,
          rowLabel,
          ageAtDxSelectionMode,
          ageDecileInstanceMap,
          rollupInstanceMapByClass,
        });
        const rowFilter = toFilterItem(type, className, rowInstances);
        if (!rowFilter) {
          staticCountsByRowKey[rowKey] = 0;
          return;
        }

        const rowRequestFilters = resolveRequestFilters({
          filters: [...filtersExcludingClass, rowFilter],
          ageAtDxSelectionMode,
          ageDecileInstanceMap,
          rollupInstanceMapByClass,
        });

        if (rowRequestFilters.length === 0) {
          return;
        }

        countRequests.push({
          rowKey,
          rowRequestFilters,
          fallbackCount,
          includePatientIds: shouldRequestPatientIdsForDots,
        });
      });
    });

    setIncludedCountByRowKey((previousCountsByRowKey) => {
      const nextCountsByRowKey = { ...staticCountsByRowKey };

      countRequests.forEach(({ rowKey }) => {
        const previousCount = Number(previousCountsByRowKey?.[rowKey]);
        if (Number.isFinite(previousCount)) {
          nextCountsByRowKey[rowKey] = Math.max(0, Math.round(previousCount));
        }
      });

      return nextCountsByRowKey;
    });
    setIncludedPatientIdsByRowKey((previousPatientIdsByRowKey) => {
      const nextPatientIdsByRowKey = { ...staticPatientIdsByRowKey };

      countRequests.forEach(({ rowKey, includePatientIds }) => {
        if (!includePatientIds) {
          return;
        }

        const previousPatientIds = normalizeInstanceValues(previousPatientIdsByRowKey?.[rowKey]);
        if (previousPatientIds.length > 0) {
          nextPatientIdsByRowKey[rowKey] = previousPatientIds;
        }
      });

      return nextPatientIdsByRowKey;
    });

    if (countRequests.length > 0 && SHOULD_LOG_FILTERS_PERF) {
      // eslint-disable-next-line no-console
      console.log("[FiltersView] queued row-level count requests", {
        requestCount: countRequests.length,
        hasSelections,
      });
    }

    if (countRequests.length === 0) {
      return () => {
        isActive = false;
      };
    }

    const loadIncludedCounts = async () => {
      const nextCountsByRowKey = { ...staticCountsByRowKey };
      const nextPatientIdsByRowKey = { ...staticPatientIdsByRowKey };

      await Promise.all(
        countRequests.map(async ({ rowKey, rowRequestFilters, fallbackCount, includePatientIds }) => {
          try {
            const countPayload = await fetchDeepPheFilterCount({
              filters: rowRequestFilters,
              includePatientIds,
            });
            const normalizedCountPayload = normalizeCountResponse(countPayload);
            const resolvedCount = normalizedCountPayload.count;
            nextCountsByRowKey[rowKey] = Number.isFinite(resolvedCount)
              ? Math.max(0, Math.round(resolvedCount))
              : fallbackCount;

            if (includePatientIds) {
              const resolvedPatientIds = normalizeInstanceValues(normalizedCountPayload.patientIds);
              if (resolvedPatientIds.length > 0) {
                nextPatientIdsByRowKey[rowKey] = resolvedPatientIds;
              }
            }
          } catch {
            nextCountsByRowKey[rowKey] = fallbackCount;
          }
        })
      );

      if (isActive) {
        setIncludedCountByRowKey(nextCountsByRowKey);
        setIncludedPatientIdsByRowKey((previousPatientIdsByRowKey) => {
          const mergedPatientIdsByRowKey = { ...nextPatientIdsByRowKey };

          countRequests.forEach(({ rowKey, includePatientIds }) => {
            if (!includePatientIds) {
              return;
            }

            const resolvedPatientIds = normalizeInstanceValues(mergedPatientIdsByRowKey[rowKey]);
            if (resolvedPatientIds.length > 0) {
              return;
            }

            const previousPatientIds = normalizeInstanceValues(previousPatientIdsByRowKey?.[rowKey]);
            if (previousPatientIds.length > 0) {
              mergedPatientIdsByRowKey[rowKey] = previousPatientIds;
            }
          });

          return mergedPatientIdsByRowKey;
        });
      }
    };

    loadIncludedCounts();

    return () => {
      isActive = false;
    };
  }, [
    activeFilters,
    ageAtDxSelectionMode,
    ageDecileInstanceMap,
    chartClassRows,
    hasSelections,
    rollupInstanceMapByClass,
  ]);

  useEffect(() => {
    setSelectedOmopValuesByClass((previousSelections) =>
      syncSelectionByClass(previousSelections, orderedOmopClasses)
    );
  }, [orderedOmopClasses]);
  useEffect(() => {
    setSelectedAttributeValuesByClass((previousSelections) =>
      syncSelectionByClass(previousSelections, orderedAttributeFilterClasses)
    );
  }, [orderedAttributeFilterClasses]);
  useEffect(() => {
    setExpandedParentsByClass((previousState) =>
      syncExpandedParentsByClass(
        previousState,
        orderedAttributeFilterClasses,
        rolledUpChartDataByClass
      )
    );
  }, [orderedAttributeFilterClasses, rolledUpChartDataByClass]);
  useEffect(() => {
    setOmopSortModeByClass((previousModes) => {
      const nextModes = {};
      orderedOmopClasses.forEach((className) => {
        nextModes[className] = normalizeChartSortMode(
          previousModes?.[className] || getFilterDefaultSortMode("omop", className)
        );
      });
      return nextModes;
    });
  }, [orderedOmopClasses]);
  useEffect(() => {
    setAttributeSortModeByClass((previousModes) => {
      const nextModes = {};
      orderedAttributeFilterClasses.forEach((className) => {
        nextModes[className] = normalizeChartSortMode(
          previousModes?.[className] || getFilterDefaultSortMode("attributes", className)
        );
      });
      return nextModes;
    });
  }, [orderedAttributeFilterClasses]);

  const getCardMeasureKey = (type, className) => `${type}:${className}`;
  const setCardMeasureRef = (type, className) => (node) => {
    const key = getCardMeasureKey(type, className);
    if (node) {
      cardMeasureRefs.current[key] = node;
      return;
    }
    delete cardMeasureRefs.current[key];
  };

  useLayoutEffect(() => {
    const entries = Object.entries(cardMeasureRefs.current);
    if (entries.length === 0) {
      return undefined;
    }

    const nextHeights = {};
    entries.forEach(([key, node]) => {
      if (isPerCardColumnLayout) {
        const contentNode = node?.querySelector?.(".filter-card-content");
        const contentScrollHeight = Number(contentNode?.scrollHeight);
        const chartViewportNode = node?.querySelector?.(
          ".horizontal-bar-filter-chart-viewport"
        );
        const chartViewportClientHeight = Number(chartViewportNode?.clientHeight);
        const chartSvgNode = node?.querySelector?.(".horizontal-bar-filter-svg");
        const chartSvgHeight = Number(chartSvgNode?.getAttribute?.("height"));
        const computedStyles =
          typeof window !== "undefined" ? window.getComputedStyle(node) : null;
        const chartHeightCapValue = String(
          computedStyles?.getPropertyValue?.("--filter-card-chart-height-cap") || ""
        ).trim();
        const chartHeightCapPx = Number.parseFloat(chartHeightCapValue);
        const targetViewportHeight =
          Number.isFinite(chartSvgHeight) && chartSvgHeight > 0
            ? Number.isFinite(chartHeightCapPx) && chartHeightCapPx > 0
              ? Math.min(chartSvgHeight, chartHeightCapPx)
              : chartSvgHeight
            : 0;
        const chartHiddenOverflowHeight =
          Number.isFinite(targetViewportHeight) &&
          targetViewportHeight > 0 &&
          Number.isFinite(chartViewportClientHeight) &&
          chartViewportClientHeight > 0
            ? Math.max(0, targetViewportHeight - chartViewportClientHeight)
            : 0;
        const adjustedContentHeight =
          Number.isFinite(contentScrollHeight) && contentScrollHeight > 0
            ? contentScrollHeight + chartHiddenOverflowHeight
            : 0;
        const cardHeightCap = Number(node?.getAttribute?.("data-card-height-cap"));
        const boundedContentHeight =
          Number.isFinite(adjustedContentHeight) && adjustedContentHeight > 0
            ? Number.isFinite(cardHeightCap) && cardHeightCap > 0
              ? Math.min(adjustedContentHeight, cardHeightCap)
              : adjustedContentHeight
            : 0;
        if (boundedContentHeight > 0) {
          nextHeights[key] = boundedContentHeight;
          return;
        }
      }

      if (node?.hasAttribute?.("data-card-height-override")) {
        const previousHeight = Number(cardNaturalHeightByKey[key]);
        if (Number.isFinite(previousHeight) && previousHeight > 0) {
          nextHeights[key] = previousHeight;
        }
        return;
      }

      const rect = node?.getBoundingClientRect?.();
      const height = Number(rect?.height);
      if (Number.isFinite(height) && height > 0) {
        nextHeights[key] = height;
      }
    });

    setCardNaturalHeightByKey((previousHeights) => {
      const previousEntries = Object.entries(previousHeights);
      const nextEntries = Object.entries(nextHeights);
      if (previousEntries.length === nextEntries.length) {
        let hasDiff = false;
        for (const [key, value] of nextEntries) {
          const previousValue = Number(previousHeights[key]);
          if (!Number.isFinite(previousValue) || Math.abs(previousValue - value) > 1) {
            hasDiff = true;
            break;
          }
        }
        if (!hasDiff) {
          return previousHeights;
        }
      }
      return nextHeights;
    });

    return undefined;
  }, [
    ageAtDxDecileChartData,
    attributeDisplayChartDataByClass,
    attributeFilterSets,
    cardNaturalHeightByKey,
    chartDataByClass,
    isPerCardColumnLayout,
    omopFilterSets,
  ]);

  useEffect(() => {
    let isActive = true;

    if (!hasSelections) {
      setCountResult(null);
      setCountError("");
      setIsCountLoading(false);
      setCurrentPatientGridPage(0);
      setPatientGridPageCache(new Map());
      setPatientGridPageError("");
      setIsPatientGridPageLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsCountLoading(true);
    setCountError("");
    setCountResult(null);
    setCurrentPatientGridPage(0);
    setPatientGridPageCache(new Map());
    setPatientGridPageError("");
    setIsPatientGridPageLoading(false);

    const loadCount = async () => {
      try {
        let nextResult = normalizeCountResponse(
          await fetchDeepPheFilterCount({
            filters: requestFilters,
            includePatientIds: false,
          })
        );

        const shouldAutoResolvePatientIds =
          nextResult.count > 0 &&
          nextResult.patientIds.length === 0;

        if (shouldAutoResolvePatientIds) {
          nextResult = normalizeCountResponse(
            await fetchDeepPheFilterCount({
              filters: requestFilters,
              includePatientIds: true,
            })
          );
        }

        if (!isActive) {
          return;
        }
        setCountResult(nextResult);
      } catch (error) {
        if (!isActive) {
          return;
        }
        setCountResult(null);
        setCountError(error?.message || "Failed to fetch filter count.");
      } finally {
        if (isActive) {
          setIsCountLoading(false);
        }
      }
    };

    loadCount();

    return () => {
      isActive = false;
    };
  }, [hasSelections, requestFilters]);

  const timing = countResult?.timing || {};
  const isSlowQuery = Number(timing.totalMs || 0) > SLOW_QUERY_THRESHOLD_MS;
  const zeroResultHint = countResult?.count === 0 ? getZeroResultHint(activeFilters, timing.itemCounts) : "";
  const identifiedSummary = useMemo(
    () => buildIdentifiedSummary(activeFilters, countResult?.count),
    [activeFilters, countResult?.count]
  );
  const cohortSize = Number(countResult?.count || 0);
  const patientIdsForResult = useMemo(
    () => normalizePatientIds(countResult?.patientIds),
    [countResult?.patientIds]
  );
  const patientIdsForResultKey = useMemo(
    () => patientIdsForResult.join(","),
    [patientIdsForResult]
  );
  const totalPatientGridPages = useMemo(
    () => Math.ceil(patientIdsForResult.length / PATIENT_GRID_PAGE_SIZE),
    [patientIdsForResult.length]
  );
  const currentPatientGridPageIds = useMemo(() => {
    if (cohortSize <= 0) {
      return [];
    }

    const startIndex = currentPatientGridPage * PATIENT_GRID_PAGE_SIZE;
    const endIndex = Math.min(
      startIndex + PATIENT_GRID_PAGE_SIZE,
      patientIdsForResult.length
    );

    return patientIdsForResult.slice(startIndex, endIndex);
  }, [cohortSize, currentPatientGridPage, patientIdsForResult]);
  const patientGridRows = useMemo(
    () => patientGridPageCache.get(currentPatientGridPage) || [],
    [currentPatientGridPage, patientGridPageCache]
  );
  const shouldShowPatientDetailGrid = Boolean(countResult);
  const isPatientGridDockVisible = Boolean(
    hasSelections && (isCountLoading || Boolean(countResult) || Boolean(countError) || patientGridPageCache.size > 0)
  );
  const patientGridDrawerPanelId = "patient-grid-drawer-panel";
  const patientGridDrawerStatusText = isCountLoading
    ? "Updating matched patients…"
    : cohortSize > 0
      ? `Showing page ${(currentPatientGridPage + 1).toLocaleString()} of ${Math.max(
          1,
          totalPatientGridPages
        ).toLocaleString()} · ${cohortSize.toLocaleString()} matched patient${cohortSize === 1 ? "" : "s"}.`
      : "No matched patients.";
  const patientGridCollapsedHeaderSummary = useMemo(() => {
    const hasFilterSummaries = activeFilters.length > 0;
    const hasPerfSummary = SHOULD_LOG_FILTERS_PERF && Boolean(countResult);
    const hasSlowWarning = Boolean(countResult) && isSlowQuery;
    const hasZeroHint = Boolean(countResult) && Boolean(zeroResultHint);
    const hasIdentifiedSummary = Boolean(countResult && identifiedSummary);
    const hasStatusCopy =
      isCountLoading ||
      Boolean(countError) ||
      hasIdentifiedSummary ||
      hasFilterSummaries ||
      hasSlowWarning ||
      hasZeroHint ||
      hasPerfSummary;

    if (!hasStatusCopy) {
      return null;
    }

    return (
      <Stack spacing={0.75}>
        {isCountLoading ? (
          <Typography variant="body2" color="text.secondary">
            Querying patient count...
          </Typography>
        ) : null}
        {countError ? <Alert severity="error">{countError}</Alert> : null}
        {hasIdentifiedSummary ? (
          <Typography variant="body2" color="text.secondary">
            {identifiedSummary}
          </Typography>
        ) : null}
        {hasFilterSummaries ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {activeFilters.map((filter, index) => (
              <Box
                key={`${filter.class}-${index}`}
                sx={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 0.75,
                  px: 0.75,
                  py: 0.3,
                  border: custom.chipInactiveBorder || "1px solid",
                  borderColor: custom.chipInactiveBorder ? undefined : "divider",
                  borderRadius: custom.chipRadius || "4px",
                  bgcolor: custom.chipActiveBg || "grey.50",
                  color: custom.chipActiveText || "text.primary",
                  boxShadow: custom.chipActiveGlow || "none",
                  maxWidth: "100%",
                  transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                }}
              >
                <Typography variant="body2" sx={{ color: "inherit", opacity: 0.9 }}>
                  {prettifyClassName(filter.class, filter.type)} (
                  {formatSelectionText(
                    filter.instances.map((value) =>
                      toDisplayInstanceValue(filter.type, filter.class, value)
                    )
                  )}
                  )
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    color: "inherit",
                    fontFamily: custom.countFontFamily || "inherit",
                  }}
                >
                  {formatItemCount(timing.itemCounts?.[index])}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}
        {hasSlowWarning ? (
          <Alert severity="warning">
            Query took {formatMs(timing.totalMs)} ms. Consider narrowing selections for faster response.
          </Alert>
        ) : null}
        {hasZeroHint ? <Alert severity="info">{zeroResultHint}</Alert> : null}
        {hasPerfSummary ? (
          <Typography
            variant="caption"
            sx={{
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              color: custom.statsColor || "text.secondary",
              fontFamily: custom.countFontFamily || "inherit",
              pt: 0.25,
            }}
          >
            Query {formatMs(timing.queryMs)} ms | Bitmap {formatMs(timing.bitmapMs)} ms | Resolve{" "}
            {formatMs(timing.resolveMs)} ms | Total {formatMs(timing.totalMs)} ms
          </Typography>
        ) : null}
      </Stack>
    );
  }, [
    activeFilters,
    countError,
    countResult,
    custom,
    identifiedSummary,
    isCountLoading,
    isSlowQuery,
    timing,
    zeroResultHint,
  ]);
  const patientGridDrawerBottomPadding = isPatientGridDockVisible
    ? {
        xs: isPatientGridDockExpanded ? "56vh" : "104px",
        md: isPatientGridDockExpanded ? "min(64vh, 640px)" : "116px",
      }
    : 0;
  const patientGridDrawerTableLoading = isCountLoading || isPatientGridPageLoading;

  useEffect(() => {
    setCurrentPatientGridPage(0);
    setPatientGridPageCache(new Map());
    setPatientGridPageError("");
    setIsPatientGridPageLoading(false);
  }, [patientIdsForResultKey, shouldShowPatientDetailGrid]);

  useEffect(() => {
    if (totalPatientGridPages <= 0) {
      return;
    }

    if (currentPatientGridPage >= totalPatientGridPages) {
      setCurrentPatientGridPage(Math.max(0, totalPatientGridPages - 1));
    }
  }, [currentPatientGridPage, totalPatientGridPages]);

  useEffect(() => {
    let isActive = true;

    if (!shouldShowPatientDetailGrid || cohortSize <= 0) {
      setIsPatientGridPageLoading(false);
      setPatientGridPageError("");
      return () => {
        isActive = false;
      };
    }

    if (currentPatientGridPageIds.length === 0) {
      setIsPatientGridPageLoading(false);
      setPatientGridPageError("Failed to load patient details.");
      return () => {
        isActive = false;
      };
    }

    if (patientGridPageCache.has(currentPatientGridPage)) {
      setIsPatientGridPageLoading(false);
      setPatientGridPageError("");
      return () => {
        isActive = false;
      };
    }

    setIsPatientGridPageLoading(true);
    setPatientGridPageError("");

    const loadPatientPage = async () => {
      try {
        const summaryPayload = await fetchDeepPheFilterSummary(currentPatientGridPageIds);
        const summaryRowsRaw = Array.isArray(summaryPayload)
          ? summaryPayload
          : Array.isArray(summaryPayload?.data)
            ? summaryPayload.data
            : Array.isArray(summaryPayload?.summaries)
              ? summaryPayload.summaries
              : [];
        const pageRows = summaryRowsRaw
          .map(transformSummaryToGridRow)
          .filter((row) => row.patientId)
          .sort((leftRow, rightRow) =>
            String(leftRow.patientId).localeCompare(String(rightRow.patientId), undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );

        if (!isActive) {
          return;
        }

        setPatientGridPageCache((previousCache) => {
          const nextCache = new Map(previousCache);
          nextCache.set(currentPatientGridPage, pageRows);
          return nextCache;
        });
        setPatientGridPageError("");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setPatientGridPageError(error?.message || "Failed to load patient details.");
      } finally {
        if (isActive) {
          setIsPatientGridPageLoading(false);
        }
      }
    };

    loadPatientPage();

    return () => {
      isActive = false;
    };
  }, [
    cohortSize,
    currentPatientGridPage,
    currentPatientGridPageIds,
    patientGridPageCache,
    patientGridPageRetryToken,
    shouldShowPatientDetailGrid,
  ]);

  const handleRetryPatientSummary = useCallback(() => {
    setPatientGridPageCache((previousCache) => {
      const nextCache = new Map(previousCache);
      nextCache.delete(currentPatientGridPage);
      return nextCache;
    });
    setPatientGridPageRetryToken((previous) => previous + 1);
  }, [currentPatientGridPage]);

  const omopChartDataWithIncludedByClass = useMemo(() => {
    const next = {};

    orderedOmopClasses.forEach((className) => {
      const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
      const classData =
        isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
          ? ageAtDxDecileChartData
          : chartDataByClass[className] || [];

      next[className] = classData.map((row) => {
        const rowKey = getFilterRowKey("omop", className, String(row?.label || "").trim());
        const includedPatientIds = normalizeInstanceValues(includedPatientIdsByRowKey[rowKey]);

        return {
          ...row,
          includedValue: includedCountByRowKey[rowKey],
          patientIds:
            includedPatientIds.length > 0
              ? includedPatientIds
              : normalizeInstanceValues(row?.patientIds),
        };
      });
    });

    return next;
  }, [
    ageAtDxDecileChartData,
    ageAtDxSelectionMode,
    chartDataByClass,
    includedCountByRowKey,
    includedPatientIdsByRowKey,
    orderedOmopClasses,
  ]);
  const attributeChartDataWithIncludedByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeDisplayChartDataByClass[className] || [];
      next[className] = classData.map((row) => {
        const rowKey = getFilterRowKey(
          "attributes",
          className,
          String(row?.label || "").trim()
        );
        const includedPatientIds = normalizeInstanceValues(includedPatientIdsByRowKey[rowKey]);

        return {
          ...row,
          includedValue: includedCountByRowKey[rowKey],
          patientIds:
            includedPatientIds.length > 0
              ? includedPatientIds
              : normalizeInstanceValues(row?.patientIds),
        };
      });
    });

    return next;
  }, [
    attributeDisplayChartDataByClass,
    includedCountByRowKey,
    includedPatientIdsByRowKey,
    orderedAttributeFilterClasses,
  ]);
  const handleSelectionChange = (setter, className) => (nextValues) => {
    const normalizedValues = Array.isArray(nextValues)
      ? [...new Set(nextValues.map((value) => String(value || "").trim()).filter(Boolean))]
      : [];
    setter((previousSelections) => ({
      ...previousSelections,
      [className]: normalizedValues,
    }));
  };
  const handleAttributeParentExpansionChange = (className) => (rowLabel, nextExpanded, row) => {
    if (!isAttributeRollupClass(className)) {
      return;
    }

    const parentKey = String(row?.label || rowLabel || "").trim();
    const isRowExpandable = Boolean(row?._expandable || row?.isExpandable);
    if (!parentKey || !isRowExpandable) {
      return;
    }

    setExpandedParentsByClass((previousState) => {
      const existingParents = new Set(previousState?.[className] || []);
      if (nextExpanded) {
        existingParents.add(parentKey);
      } else {
        existingParents.delete(parentKey);
      }

      return {
        ...previousState,
        [className]: [...existingParents],
      };
    });
  };
  const setFilterSortMode = useCallback((filterType, className, nextSortMode) => {
    const normalizedType = String(filterType || "").toLowerCase();
    const normalizedSortMode = normalizeChartSortMode(nextSortMode);

    const setter =
      normalizedType === "attributes" ? setAttributeSortModeByClass : setOmopSortModeByClass;

    setter((previousModes) => {
      if (previousModes?.[className] === normalizedSortMode) {
        return previousModes;
      }
      return {
        ...previousModes,
        [className]: normalizedSortMode,
      };
    });
  }, []);
  const handleOpenFilterModal = useCallback((filterType, className, classDisplayName) => {
    setActiveFilterModal({
      type: String(filterType || "omop").toLowerCase() === "attributes" ? "attributes" : "omop",
      className,
      classDisplayName: String(classDisplayName || className || "").trim() || String(className || ""),
    });
    setActiveFilterSearchQuery("");
  }, []);
  const handleCloseFilterModal = useCallback(() => {
    setActiveFilterModal(null);
    setActiveFilterSearchQuery("");
  }, []);
  const activeFilterDetail = useMemo(() => {
    if (!activeFilterModal?.className) {
      return null;
    }

    const { type, className, classDisplayName } = activeFilterModal;
    const normalizedType = String(type || "").toLowerCase() === "attributes" ? "attributes" : "omop";
    const chartData =
      normalizedType === "attributes"
        ? attributeChartDataWithIncludedByClass[className] ||
          attributeDisplayChartDataByClass[className] ||
          []
        : omopChartDataWithIncludedByClass[className] || chartDataByClass[className] || [];
    const selectedValues =
      normalizedType === "attributes"
        ? selectedAttributeValuesByClass[className] || []
        : selectedOmopValuesByClass[className] || [];
    const sortModeByClass =
      normalizedType === "attributes" ? attributeSortModeByClass : omopSortModeByClass;
    const classError =
      normalizedType === "attributes"
        ? attributeData.errorsByClass[className] || ""
        : omopData.errorsByClass[className] || "";
    const sortMode =
      sortModeByClass[className] || getFilterDefaultSortMode(normalizedType, className);

    return {
      type: normalizedType,
      className,
      classDisplayName,
      chartData: Array.isArray(chartData) ? chartData : [],
      selectedValues,
      classError,
      sortMode,
    };
  }, [
    activeFilterModal,
    attributeChartDataWithIncludedByClass,
    attributeData.errorsByClass,
    attributeDisplayChartDataByClass,
    attributeSortModeByClass,
    chartDataByClass,
    omopChartDataWithIncludedByClass,
    omopData.errorsByClass,
    omopSortModeByClass,
    selectedAttributeValuesByClass,
    selectedOmopValuesByClass,
  ]);
  const activeFilterSortDimension = useMemo(
    () => getSortDimensionFromMode(activeFilterDetail?.sortMode),
    [activeFilterDetail?.sortMode]
  );
  const activeFilterSortDirection = useMemo(
    () => getSortDirectionFromMode(activeFilterDetail?.sortMode),
    [activeFilterDetail?.sortMode]
  );
  const filteredModalChartData = useMemo(
    () => filterRowsByQuery(activeFilterDetail?.chartData, activeFilterSearchQuery),
    [activeFilterDetail?.chartData, activeFilterSearchQuery]
  );
  const handleModalSortDimensionChange = useCallback(
    (event) => {
      if (!activeFilterDetail) {
        return;
      }

      const requestedDimension = String(event?.target?.value || "").trim().toLowerCase();
      const nextDimension =
        requestedDimension === FILTER_SORT_DIMENSION.LABEL
          ? FILTER_SORT_DIMENSION.LABEL
          : FILTER_SORT_DIMENSION.COUNT;
      const nextSortMode = toSortMode(nextDimension, activeFilterSortDirection);
      setFilterSortMode(activeFilterDetail.type, activeFilterDetail.className, nextSortMode);
    },
    [activeFilterDetail, activeFilterSortDirection, setFilterSortMode]
  );
  const handleModalSortDirectionToggle = useCallback(() => {
    if (!activeFilterDetail) {
      return;
    }

    const nextDirection =
      activeFilterSortDirection === FILTER_SORT_DIRECTION.ASC
        ? FILTER_SORT_DIRECTION.DESC
        : FILTER_SORT_DIRECTION.ASC;
    const nextSortMode = toSortMode(activeFilterSortDimension, nextDirection);
    setFilterSortMode(activeFilterDetail.type, activeFilterDetail.className, nextSortMode);
  }, [activeFilterDetail, activeFilterSortDimension, activeFilterSortDirection, setFilterSortMode]);
  const handleResetAllFilters = useCallback(() => {
    setSelectedOmopValuesByClass(syncSelectionByClass({}, orderedOmopClasses));
    setSelectedAttributeValuesByClass(syncSelectionByClass({}, orderedAttributeFilterClasses));
    setExpandedParentsByClass(
      syncExpandedParentsByClass({}, orderedAttributeFilterClasses, rolledUpChartDataByClass)
    );

    const nextOmopSortModes = {};
    orderedOmopClasses.forEach((className) => {
      nextOmopSortModes[className] = getFilterDefaultSortMode("omop", className);
    });
    setOmopSortModeByClass(nextOmopSortModes);

    const nextAttributeSortModes = {};
    orderedAttributeFilterClasses.forEach((className) => {
      nextAttributeSortModes[className] = getFilterDefaultSortMode("attributes", className);
    });
    setAttributeSortModeByClass(nextAttributeSortModes);

    setActiveFilterModal(null);
    setActiveFilterSearchQuery("");
  }, [orderedAttributeFilterClasses, orderedOmopClasses, rolledUpChartDataByClass]);
  const toggleFilterLayoutMode = () => {
    setFilterLayoutMode((previousMode) =>
      previousMode === FILTER_LAYOUT_MODE.PER_CARD_COLUMN
        ? FILTER_LAYOUT_MODE.STACKED
        : FILTER_LAYOUT_MODE.PER_CARD_COLUMN
    );
  };
  const filterLayoutToggleTooltip = isPerCardColumnLayout
    ? "Switch to stacked layout"
    : "Switch to one-card-per-column layout";
  const hasExpandedParentFilters = useMemo(
    () =>
      Object.values(expandedParentsByClass).some(
        (parentValues) => Array.isArray(parentValues) && parentValues.length > 0
      ),
    [expandedParentsByClass]
  );
  const hasNonDefaultOmopSortMode = useMemo(
    () =>
      orderedOmopClasses.some(
        (className) =>
          normalizeChartSortMode(omopSortModeByClass[className]) !==
          getFilterDefaultSortMode("omop", className)
      ),
    [omopSortModeByClass, orderedOmopClasses]
  );
  const hasNonDefaultAttributeSortMode = useMemo(
    () =>
      orderedAttributeFilterClasses.some(
        (className) =>
          normalizeChartSortMode(attributeSortModeByClass[className]) !==
          getFilterDefaultSortMode("attributes", className)
      ),
    [attributeSortModeByClass, orderedAttributeFilterClasses]
  );
  const canResetAllFilters =
    hasSelections ||
    hasExpandedParentFilters ||
    hasNonDefaultOmopSortMode ||
    hasNonDefaultAttributeSortMode ||
    Boolean(activeFilterModal) ||
    Boolean(String(activeFilterSearchQuery || "").trim());
  const CARD_COLUMN_WIDTH = 350;
  const CARD_COLUMN_GAP_PX = 24;
  const FILTER_SECTION_HEIGHT_CAP_PX = 700;
  const FILTER_CARD_CHART_HEIGHT_OFFSET_PX = 150;
  const PER_CARD_COLUMN_CHART_HEIGHT_CAP_PX = 340;
  const ROW_HEIGHT_ESTIMATE = 36;
  const CARD_OVERHEAD_ESTIMATE = 120;
  const NATURAL_STACK_GAP_PX = 24;
  const CARD_BOTTOM_MARGIN = 24;
  const resolveSectionHeightCapPx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const numericHeightCap = Number(sectionHeightCap);
    if (!Number.isFinite(numericHeightCap) || numericHeightCap <= 0) {
      return FILTER_SECTION_HEIGHT_CAP_PX;
    }
    return Math.max(1, Math.round(numericHeightCap));
  };
  const resolveCardChartHeightCapPx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    const naturalChartCapPx = Math.max(
      220,
      resolvedSectionHeightCapPx - FILTER_CARD_CHART_HEIGHT_OFFSET_PX
    );
    return isPerCardColumnLayout
      ? Math.min(naturalChartCapPx, PER_CARD_COLUMN_CHART_HEIGHT_CAP_PX)
      : naturalChartCapPx;
  };
  const toSectionHeightPx = (
    sectionHeight,
    sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX
  ) => {
    const numericSectionHeight = Number(sectionHeight);
    if (!Number.isFinite(numericSectionHeight) || numericSectionHeight <= 0) {
      return "auto";
    }
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    return `${Math.min(Math.round(numericSectionHeight), resolvedSectionHeightCapPx)}px`;
  };
  const getFilterSetSx = (sectionHeight, sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    const resolvedCardChartHeightCapPx = resolveCardChartHeightCapPx(resolvedSectionHeightCapPx);
    return {
      "--filter-section-height": toSectionHeightPx(sectionHeight, resolvedSectionHeightCapPx),
      "--filter-section-height-cap": `${resolvedSectionHeightCapPx}px`,
      "--filter-card-chart-height-cap": `${resolvedCardChartHeightCapPx}px`,
      "& > .filter-section-grid": {
        maxHeight: { xs: "none", md: "var(--filter-section-height-cap)" },
      },
    };
  };
  const getFilterSetRowSx = () => ({
    display: "flex",
    flexWrap: "wrap",
    gap: 2,
    alignItems: "flex-start",
    width: "100%",
    "& > .filter-set": {
      flex: { xs: "1 1 100%", lg: "0 1 auto" },
      minWidth: 0,
      alignSelf: "flex-start",
    },
  });
  const getCardContentAreaSx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    return {
      display: "flex",
      flexDirection: "column",
      gap: 0,
      minHeight: 0,
      height: "100%",
      maxHeight: `var(--filter-section-height-cap, ${resolvedSectionHeightCapPx}px)`,
      overflowY: "hidden",
      overflowX: "hidden",
      pr: 0,
      "& .filter-card-body": {
        display: "flex",
        flexDirection: "column",
        gap: 0,
        flex: 1,
        minHeight: 0,
      },
      "& .filter-card-chart": {
        flex: 1,
        minHeight: 0,
        maxHeight: `var(--filter-card-chart-height-cap, ${resolveCardChartHeightCapPx(
          resolvedSectionHeightCapPx
        )}px)`,
        overflowY: "hidden",
        overflowX: "hidden",
      },
      "& .filter-card-chart .horizontal-bar-filter-chart-region": {
        minHeight: 0,
      },
      "& .filter-card-chart .horizontal-bar-filter-chart-viewport": {
        maxHeight: "100%",
        overflowY: "auto",
        overflowX: "hidden",
      },
    };
  };
  const buildSectionLayout = (type, filters, classChartDataByClass) => {
    const sectionHeightCap = resolveSectionHeightCapPx();
    const classNames = filters.map((filter) => filter.key);
    const resolvedSectionMaxColumns = isPerCardColumnLayout
      ? Math.max(1, classNames.length)
      : resolvedSectionColumnCap;
    const measuredCardHeightByClass = Object.fromEntries(
      classNames.map((className) => [
        className,
        cardNaturalHeightByKey[getCardMeasureKey(type, className)],
      ])
    );
    const rowCountByClass = Object.fromEntries(
      classNames.map((className) => {
        const classChartData = classChartDataByClass[className];
        return [className, Array.isArray(classChartData) ? classChartData.length : 0];
      })
    );

    const sectionLayout = buildFilterSectionLayout({
      classNames,
      rowCountByClass,
      measuredCardHeightByClass,
      naturalGapPx: NATURAL_STACK_GAP_PX,
      maxColumns: resolvedSectionMaxColumns,
      categoryMaxHeight: sectionHeightCap,
      cardBottomMargin: CARD_BOTTOM_MARGIN,
      rowHeightEstimate: ROW_HEIGHT_ESTIMATE,
      cardOverheadEstimate: CARD_OVERHEAD_ESTIMATE,
    });

    if (!isPerCardColumnLayout) {
      return {
        ...sectionLayout,
        sectionHeightCap,
      };
    }

    const perCardColumnGroups = classNames.map((className) => [className]);
    const perCardMarginBottomByClass = Object.fromEntries(
      classNames.map((className) => [className, 0])
    );
    const maxPerCardHeight = classNames.reduce((maxHeight, className) => {
      const resolvedCardHeight = Number(sectionLayout.resolvedCardHeightByClass?.[className]) || 0;
      return Math.max(maxHeight, resolvedCardHeight);
    }, 0);
    const perCardSectionHeight = classNames.length
      ? Math.min(sectionHeightCap, maxPerCardHeight + CARD_BOTTOM_MARGIN)
      : 0;

    return {
      ...sectionLayout,
      columnGroups: perCardColumnGroups,
      cardHeightOverrideByClass: {},
      cardMarginBottomByClass: perCardMarginBottomByClass,
      sectionHeight: perCardSectionHeight,
      sectionHeightCap,
    };
  };
  const getFilterGridSx = (
    sectionHeight,
    columnCapByBreakpoint,
    sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX
  ) => {
    const shouldStretchColumns = !isPerCardColumnLayout;
    return {
      "--filter-section-height": toSectionHeightPx(sectionHeight, sectionHeightCap),
      "--filter-section-height-cap": `${resolveSectionHeightCapPx(sectionHeightCap)}px`,
      "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(sectionHeightCap)}px`,
      width: "100%",
      maxWidth: {
        xs: `${getColumnCapMaxWidthPx(
          columnCapByBreakpoint?.xs,
          CARD_COLUMN_WIDTH,
          CARD_COLUMN_GAP_PX
        )}px`,
        sm: `${getColumnCapMaxWidthPx(
          columnCapByBreakpoint?.sm,
          CARD_COLUMN_WIDTH,
          CARD_COLUMN_GAP_PX
        )}px`,
        md: `${getColumnCapMaxWidthPx(
          columnCapByBreakpoint?.md,
          CARD_COLUMN_WIDTH,
          CARD_COLUMN_GAP_PX
        )}px`,
        lg: `${getColumnCapMaxWidthPx(
          columnCapByBreakpoint?.lg,
          CARD_COLUMN_WIDTH,
          CARD_COLUMN_GAP_PX
        )}px`,
        xl: `${getColumnCapMaxWidthPx(
          columnCapByBreakpoint?.xl,
          CARD_COLUMN_WIDTH,
          CARD_COLUMN_GAP_PX
        )}px`,
      },
      display: "flex",
      alignItems: shouldStretchColumns ? "stretch" : "flex-start",
      gap: 3,
      flexWrap: "wrap",
      minHeight: {
        xs: "auto",
        md: shouldStretchColumns ? "var(--filter-section-height)" : "auto",
      },
      maxHeight: {
        xs: "none",
        md: "var(--filter-section-height-cap)",
      },
      overflowY: {
        xs: "visible",
        md: "auto",
      },
      overflowX: "hidden",
      "& > .filter-section-column": {
        display: "flex",
        flexDirection: "column",
        alignSelf: shouldStretchColumns ? "stretch" : "flex-start",
        minHeight: {
          xs: "auto",
          md: shouldStretchColumns ? "var(--filter-section-height)" : "auto",
        },
        height: {
          xs: "auto",
          md: shouldStretchColumns ? "var(--filter-section-height)" : "auto",
        },
        maxHeight: {
          xs: "none",
          md: shouldStretchColumns ? "var(--filter-section-height-cap)" : "none",
        },
        overflow: shouldStretchColumns ? "hidden" : "visible",
      },
    };
  };
  const getFilterSectionColumnSx = () => ({
    flex: { xs: "1 1 100%", sm: `0 0 ${CARD_COLUMN_WIDTH}px` },
    maxWidth: { xs: "100%", sm: `${CARD_COLUMN_WIDTH}px` },
  });
  const getCardSx = (cardIndex = 0) => {
    void cardIndex;
    const base = {
      width: "100%",
      display: "inline-block",
      verticalAlign: "top",
      breakInside: "avoid",
      mb: 3,
      p: custom.cardPadding || 0,
      position: "relative",
      overflow: "visible",
      boxSizing: "border-box",
      transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.2s ease",
    };
    if (custom.cardBeforePseudo === "vapor-glass") {
      base["&::before"] = {
        content: '""',
        position: "absolute",
        top: 0,
        left: 16,
        right: 16,
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
        borderRadius: "16px 16px 0 0",
        pointerEvents: "none",
      };
    }
    return base;
  };
  const fontScaleIndex = findClosestFontScaleIndex(fontScale);
  const canDecreaseFontScale = fontScaleIndex > 0;
  const canIncreaseFontScale = fontScaleIndex < FONT_SCALE_OPTIONS.length - 1;
  const fontScalePercentLabel = `${Math.round(fontScale * 100)}%`;
  const getToggleButtonSx = (isActive) => (theme) => ({
    height: 32,
    width: 32,
    border: "1px solid",
    borderColor: isActive ? theme.palette.primary.main : theme.palette.divider,
    borderRadius: 1,
    color: isActive ? theme.palette.primary.main : custom.iconDefault || theme.palette.text.secondary,
    backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.15) : theme.palette.background.paper,
    "&:hover": {
      backgroundColor: isActive
        ? alpha(theme.palette.primary.main, 0.24)
        : custom.iconHoverBg || theme.palette.action.hover,
    },
  });

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      {REDUCED_MOTION_STYLES}
      {reducedMotion ? TOGGLED_REDUCED_MOTION_STYLES : null}
      <Box
        sx={{
          minHeight: "100vh",
          fontSize: fontScalePercentLabel,
          bgcolor: "background.default",
          background: custom.pageBgExtra
            ? `${custom.pageBgExtra}, ${activeTheme.palette.background.default}`
            : undefined,
          p: { xs: 2, md: 4 },
          transition: "background-color 0.2s ease",
        }}
      >
        <Box component="main" aria-labelledby="filters-page-title">
          <Stack spacing={2} sx={{ pb: patientGridDrawerBottomPadding }}>
        <Box
          sx={{
            position: "sticky",
            top: { xs: 8, md: 12 },
            zIndex: 10,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr" },
              alignItems: "start",
            }}
          >
            <Paper
              elevation={0}
              data-testid="identified-patients-panel"
              sx={{ p: 1, border: 1, borderColor: "divider" }}
            >
              <Stack spacing={0.5}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.25,
                    flexWrap: "wrap",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                      flexWrap: "wrap",
                      minWidth: 0,
                      flex: "1 1 260px",
                    }}
                  >
                    <Box component="nav" aria-label="Primary navigation" sx={{ display: "inline-flex", flexShrink: 0 }}>
	                      <MuiLink
	                        component={RouterLink}
	                        to="/"
	                        underline="none"
	                        sx={{
	                          display: "inline-flex",
	                          alignItems: "center",
	                          gap: 0.5,
	                          color: "text.primary",
	                          "&:hover": {
	                            color: "text.primary",
	                            textDecoration: "underline",
	                          },
	                        }}
	                      >
                        <ArrowBackIcon fontSize="small" />
                        <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                          Home
                        </Typography>
                      </MuiLink>
                    </Box>
                    <Typography
                      id="filters-page-title"
                      component="h1"
                      variant="subtitle1"
                      data-testid="filters-page-heading"
                      sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}
                    >
                      Patient Cohort Explorer
                    </Typography>
                  </Box>
                  {countResult ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 1,
                        flexWrap: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                    </Box>
                  ) : null}
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                      maxWidth: "100%",
                    }}
                  >
                    <Box
                      role="group"
                      aria-label="Font size"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.25,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        height: 32,
                        pl: 0.5,
                        pr: 0.25,
                        bgcolor: "background.paper",
                      }}
	                    >
	                      <Typography
	                        variant="caption"
	                        sx={{ color: "text.primary", fontWeight: 600, letterSpacing: 0.2, userSelect: "none" }}
	                      >
	                        Aa
	                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleFontScaleChange(-1)}
                        disabled={!canDecreaseFontScale}
                        aria-label="Decrease font size"
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography
                        variant="caption"
                        sx={{
                          minWidth: 40,
                          textAlign: "center",
                          fontVariantNumeric: "tabular-nums",
                          userSelect: "none",
                        }}
                      >
                        {fontScalePercentLabel}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleFontScaleChange(1)}
                        disabled={!canIncreaseFontScale}
                        aria-label="Increase font size"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Tooltip title={highContrast ? "High contrast (on)" : "High contrast"}>
                      <IconButton
                        size="small"
                        onClick={handleHighContrastToggle}
                        aria-label={highContrast ? "Disable high contrast" : "Enable high contrast"}
                        aria-pressed={highContrast}
                        sx={getToggleButtonSx(highContrast)}
                      >
                        <ContrastIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={reducedMotion ? "Reduce motion (on)" : "Reduce motion"}>
                      <IconButton
                        size="small"
                        onClick={handleReducedMotionToggle}
                        aria-label={reducedMotion ? "Disable reduced motion" : "Enable reduced motion"}
                        aria-pressed={reducedMotion}
                        sx={getToggleButtonSx(reducedMotion)}
                      >
                        <MotionPhotosOffIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleResetAllFilters}
                      data-testid="reset-all-filters-button"
                      disabled={!canResetAllFilters}
                      sx={{
                        height: 32,
                        textTransform: "none",
                        whiteSpace: "nowrap",
                        bgcolor: "background.paper",
                      }}
                    >
                      Reset filters
                    </Button>
                    <Tooltip title={filterLayoutToggleTooltip}>
                      <IconButton
                        size="small"
                        aria-label={filterLayoutToggleTooltip}
                        data-testid="filter-layout-mode-toggle"
                        onClick={toggleFilterLayoutMode}
                        sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper" }}
                      >
                        {isPerCardColumnLayout ? (
                          <ViewColumnIcon fontSize="small" />
                        ) : (
                          <ViewStreamIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      <PaletteOutlinedIcon
                        fontSize="small"
                        sx={{ color: "text.secondary", flexShrink: 0 }}
                      />
                      <FormControl
                        size="small"
                        sx={{
                          minWidth: 130,
                          fontSize: "0.75rem",
                          height: 32,
                          bgcolor: "background.paper",
	                        }}
	                      >
	                        <InputLabel
	                          id="theme-select-label"
	                          htmlFor="theme-select-input"
	                          sx={{ "&.MuiInputLabel-shrink": { color: "text.primary" } }}
	                        >
	                          Theme
	                        </InputLabel>
	                        <Select
	                          labelId="theme-select-label"
	                          id="theme-select"
	                          value={themeKey}
	                          onChange={handleThemeChange}
	                          label="Theme"
	                          inputProps={{
	                            id: "theme-select-input",
	                            "aria-label": "Theme",
	                            "aria-labelledby": "theme-select-label",
	                          }}
	                          sx={{
	                            height: 32,
	                            "& .MuiSelect-select": { py: 0.5 },
                          }}
                        >
                          {THEME_OPTIONS.map((option) => (
                            <MenuItem key={option.key} value={option.key} sx={{ fontSize: "0.8rem" }}>
                              {option.label}
                            </MenuItem>
                          ))}
                          <MenuItem
                            value={THEME_EDITOR_MENU_VALUE}
                            sx={{ fontSize: "0.8rem", fontStyle: "italic", borderTop: 1, borderColor: "divider" }}
                          >
                            Theme Builder...
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                </Box>

              </Stack>
            </Paper>
          </Box>
        </Box>

        {isLoading || isAttributeLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading filters...
          </Typography>
        ) : null}

        {rootError ? <Alert severity="error">{rootError}</Alert> : null}
        {attributeRootError ? <Alert severity="error">{attributeRootError}</Alert> : null}

        {!isLoading && !isAttributeLoading && !rootError && !attributeRootError ? (
          <Stack spacing={2.5}>
            {omopFilterSets.length > 0 ? (
              <Stack spacing={2}>
                {omopFilterSetRows.map((rowGroup, rowIndex) => (
                  <Box
                    key={`omop-row:${rowGroup.id}:${rowIndex}`}
                    className="filter-set-row"
                    data-filter-set-row={rowGroup.id}
                    sx={getFilterSetRowSx()}
                  >
                {rowGroup.filterSets.map((filterSet) => {
                  const sectionHasData = filterSet.filters.some((filter) => {
                    const className = filter.key;
                    const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
                    const classData =
                      isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
                        ? ageAtDxDecileChartData
                        : chartDataByClass[className] || [];
                    const classChartData =
                      omopChartDataWithIncludedByClass[className] || classData;
                    return Array.isArray(classChartData) && classChartData.length > 0;
                  });
                  const classChartDataByClass = {};
                  filterSet.filters.forEach((filter) => {
                    const className = filter.key;
                    const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
                    const classData =
                      isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
                        ? ageAtDxDecileChartData
                        : chartDataByClass[className] || [];
                    classChartDataByClass[className] =
                      omopChartDataWithIncludedByClass[className] || classData;
                  });
                  const {
                    columnGroups,
                    measuredCardHeightByClass,
                    cardHeightOverrideByClass,
                    cardMarginBottomByClass,
                    sectionHeight,
                    sectionHeightCap,
                  } = buildSectionLayout(
                    "omop",
                    filterSet.filters,
                    classChartDataByClass
                  );
                  const filterByClassName = Object.fromEntries(
                    filterSet.filters.map((filter) => [filter.key, filter])
                  );
                  const orderedClassGroups =
                    Array.isArray(columnGroups) && columnGroups.length > 0
                      ? columnGroups
                      : [filterSet.filters.map((filter) => filter.key)];

                  return (
                    <Stack
                      key={filterSet.id}
                      spacing={1}
                      className="filter-set"
                      data-section-height-cap={sectionHeightCap}
                      sx={getFilterSetSx(sectionHeight, sectionHeightCap)}
                    >
                      <Typography component="h2" variant="subtitle1" sx={CONTEXT_HEADER_SX}>
                        {filterSet.label}
                      </Typography>
                      {cohortSize > 0 && sectionHasData ? (
                        <Typography variant="caption" color="text.secondary">
                          Showing filter values for {cohortSize.toLocaleString()} matched patient
                          {cohortSize === 1 ? "" : "s"}
                        </Typography>
                      ) : null}
                      <Box
                        className="filter-section-grid"
                        data-column-cap={
                          isPerCardColumnLayout ? Math.max(1, filterSet.filters.length) : resolvedSectionColumnCap
                        }
                        data-section-height-cap={sectionHeightCap}
                        sx={getFilterGridSx(
                          sectionHeight,
                          FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT,
                          sectionHeightCap
                        )}
                      >
                        {orderedClassGroups.map((classGroup, columnIndex) => (
                          <Box
                            key={`${filterSet.id}:column:${columnIndex}`}
                            className="filter-section-column"
                            sx={getFilterSectionColumnSx()}
                          >
                          {classGroup.map((className, classIndex) => {
                        const filter = filterByClassName[className];
                        if (!filter) {
                          return null;
                        }
                        const classError = omopData.errorsByClass[className] || "";
                        const classChartData = classChartDataByClass[className] || [];
                        const classDisplayName =
                          filter.displayName || getFilterDisplayName("omop", className);
                        const selectedValuesForClass = selectedOmopValuesByClass[className] || [];
                        const onSelectionChangeForClass = handleSelectionChange(
                          setSelectedOmopValuesByClass,
                          className
                        );
                        const sortMode =
                          omopSortModeByClass[className] || getFilterDefaultSortMode("omop", className);
                        const customSortOrder = getFilterCustomSortOrder("omop", className);
                        const selectedCount = selectedValuesForClass.length;
                        const cardHeightOverride = cardHeightOverrideByClass[className];
                        const measuredCardHeight =
                          Number(measuredCardHeightByClass[className]) || 0;
                        const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
                        const configuredCardHeightCapPx = getFilterMaxHeightPx("omop", className);
                        const resolvedCardHeightCapPx =
                          configuredCardHeightCapPx == null
                            ? resolvedSectionHeightCapPx
                            : Math.min(resolvedSectionHeightCapPx, configuredCardHeightCapPx);
                        const boundedCardHeightOverride = Math.min(
                          resolvedCardHeightCapPx,
                          Math.max(0, Number(cardHeightOverride) || 0)
                        );
                        const shouldApplyCardHeightOverride =
                          boundedCardHeightOverride > 0 && measuredCardHeight > 0;
                        const cardMarginBottom = Math.max(
                          0,
                          Number(cardMarginBottomByClass[className]) || 0
                        );
                        const cardOuterStyle = {
                          "--filter-section-height-cap": `${resolvedCardHeightCapPx}px`,
                          "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(
                            resolvedCardHeightCapPx
                          )}px`,
                          maxHeight: `${resolvedCardHeightCapPx}px`,
                          ...(shouldApplyCardHeightOverride
                            ? { minHeight: `${Math.round(boundedCardHeightOverride)}px` }
                            : {}),
                        };
                        return (
                          <Paper
                            key={`${filterSet.id}:${className}`}
                            elevation={0}
                            className="filter-card"
                            ref={setCardMeasureRef("omop", className)}
                            style={cardOuterStyle}
                            data-card-margin-bottom={Math.round(cardMarginBottom)}
                            data-card-height-cap={resolvedCardHeightCapPx}
                            data-card-height-override={
                              shouldApplyCardHeightOverride
                                ? Math.round(boundedCardHeightOverride)
                                : undefined
                            }
                            sx={{
                              ...getCardSx(classIndex),
                              mb: { xs: 3, md: `${cardMarginBottom}px` },
                            }}
                          >
                            <Box
                              className="filter-card-content"
                              sx={getCardContentAreaSx(sectionHeightCap)}
                            >
                              <Box
                                className="filter-card-body"
                                sx={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, minHeight: 0 }}
                              >
                                <Button
                                  className="filter-card-open-button"
                                  type="button"
                                  variant={selectedCount > 0 ? "contained" : "outlined"}
                                  onClick={() => handleOpenFilterModal("omop", className, classDisplayName)}
                                  aria-label={`Open ${classDisplayName} filter`}
                                  sx={{
                                    justifyContent: "space-between",
                                    textTransform: "none",
                                    fontWeight: 700,
                                    minHeight: 44,
                                    px: 1.25,
                                  }}
                                >
                                  <span>{classDisplayName}</span>
                                  <span>{selectedCount > 0 ? `${selectedCount} selected` : "Details"}</span>
                                </Button>
                                {classError ? <Alert severity="error">{classError}</Alert> : null}
                                <HorizontalBarFilter
                                  key={`inline:omop:${className}:${sortMode}`}
                                  className="filter-card-chart"
                                  title={classDisplayName}
                                  showTitle={false}
                                  allowCollapse={false}
                                  showSortDimensionToggle={false}
                                  showSortCycleButton={false}
                                  fillContainer
                                  data={classChartData}
                                  selectedValues={selectedValuesForClass}
                                  onSelectionChange={onSelectionChangeForClass}
                                  fontScale={fontScale}
                                  defaultSort={sortMode}
                                  customSortOrder={customSortOrder}
                                  inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
                                  getPatientSummary={getPatientSummary}
                                />
                              </Box>
                            </Box>
                          </Paper>
                        );
                        })}
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                  );
                })}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No OMOP classes returned.
              </Typography>
            )}

            {attributeFilterSets.length > 0 ? (
              <Stack spacing={2}>
                {attributeFilterSetRows.map((rowGroup, rowIndex) => (
                  <Box
                    key={`attributes-row:${rowGroup.id}:${rowIndex}`}
                    className="filter-set-row"
                    data-filter-set-row={rowGroup.id}
                    sx={getFilterSetRowSx()}
                  >
                {rowGroup.filterSets.map((filterSet) => {
                  const sectionHasData = filterSet.filters.some((filter) => {
                    const classChartData =
                      attributeChartDataWithIncludedByClass[filter.key] ||
                      attributeDisplayChartDataByClass[filter.key] ||
                      [];
                    return Array.isArray(classChartData) && classChartData.length > 0;
                  });
                  const classChartDataByClass = {};
                  filterSet.filters.forEach((filter) => {
                    const className = filter.key;
                    const classData = attributeDisplayChartDataByClass[className] || [];
                    classChartDataByClass[className] =
                      attributeChartDataWithIncludedByClass[className] || classData;
                  });
                  const {
                    columnGroups,
                    measuredCardHeightByClass,
                    cardHeightOverrideByClass,
                    cardMarginBottomByClass,
                    sectionHeight,
                    sectionHeightCap,
                  } = buildSectionLayout(
                    "attributes",
                    filterSet.filters,
                    classChartDataByClass
                  );
                  const filterByClassName = Object.fromEntries(
                    filterSet.filters.map((filter) => [filter.key, filter])
                  );
                  const orderedClassGroups =
                    Array.isArray(columnGroups) && columnGroups.length > 0
                      ? columnGroups
                      : [filterSet.filters.map((filter) => filter.key)];

                  return (
                    <Stack
                      key={filterSet.id}
                      spacing={1}
                      className="filter-set"
                      data-section-height-cap={sectionHeightCap}
                      sx={getFilterSetSx(sectionHeight, sectionHeightCap)}
                    >
                      <Typography component="h2" variant="subtitle1" sx={CONTEXT_HEADER_SX}>
                        {filterSet.label}
                      </Typography>
                      {cohortSize > 0 && sectionHasData ? (
                        <Typography variant="caption" color="text.secondary">
                          Showing filter values for {cohortSize.toLocaleString()} matched patient
                          {cohortSize === 1 ? "" : "s"}
                        </Typography>
                      ) : null}
                      <Box
                        className="filter-section-grid"
                        data-column-cap={
                          isPerCardColumnLayout ? Math.max(1, filterSet.filters.length) : resolvedSectionColumnCap
                        }
                        data-section-height-cap={sectionHeightCap}
                        sx={getFilterGridSx(
                          sectionHeight,
                          FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT,
                          sectionHeightCap
                        )}
                      >
                        {orderedClassGroups.map((classGroup, columnIndex) => (
                          <Box
                            key={`${filterSet.id}:column:${columnIndex}`}
                            className="filter-section-column"
                            sx={getFilterSectionColumnSx()}
                          >
                          {classGroup.map((className, classIndex) => {
                        const filter = filterByClassName[className];
                        if (!filter) {
                          return null;
                        }
                        const classError = attributeData.errorsByClass[className] || "";
                        const classChartData = classChartDataByClass[className] || [];
                        const classDisplayName =
                          filter.displayName || getFilterDisplayName("attributes", className);
                        const selectedValuesForClass = selectedAttributeValuesByClass[className] || [];
                        const onSelectionChangeForClass = handleSelectionChange(
                          setSelectedAttributeValuesByClass,
                          className
                        );
                        const sortMode =
                          attributeSortModeByClass[className] ||
                          getFilterDefaultSortMode("attributes", className);
                        const customSortOrder = getFilterCustomSortOrder("attributes", className);
                        const selectedCount = selectedValuesForClass.length;
                        const cardHeightOverride = cardHeightOverrideByClass[className];
                        const measuredCardHeight =
                          Number(measuredCardHeightByClass[className]) || 0;
                        const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
                        const configuredCardHeightCapPx = getFilterMaxHeightPx("attributes", className);
                        const resolvedCardHeightCapPx =
                          configuredCardHeightCapPx == null
                            ? resolvedSectionHeightCapPx
                            : Math.min(resolvedSectionHeightCapPx, configuredCardHeightCapPx);
                        const boundedCardHeightOverride = Math.min(
                          resolvedCardHeightCapPx,
                          Math.max(0, Number(cardHeightOverride) || 0)
                        );
                        const shouldApplyCardHeightOverride =
                          boundedCardHeightOverride > 0 && measuredCardHeight > 0;
                        const cardMarginBottom = Math.max(
                          0,
                          Number(cardMarginBottomByClass[className]) || 0
                        );
                        const cardOuterStyle = {
                          "--filter-section-height-cap": `${resolvedCardHeightCapPx}px`,
                          "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(
                            resolvedCardHeightCapPx
                          )}px`,
                          maxHeight: `${resolvedCardHeightCapPx}px`,
                          ...(shouldApplyCardHeightOverride
                            ? { minHeight: `${Math.round(boundedCardHeightOverride)}px` }
                            : {}),
                        };
                        return (
                          <Paper
                            key={`${filterSet.id}:${className}`}
                            elevation={0}
                            className="filter-card"
                            ref={setCardMeasureRef("attributes", className)}
                            style={cardOuterStyle}
                            data-card-margin-bottom={Math.round(cardMarginBottom)}
                            data-card-height-cap={resolvedCardHeightCapPx}
                            data-card-height-override={
                              shouldApplyCardHeightOverride
                                ? Math.round(boundedCardHeightOverride)
                                : undefined
                            }
                            sx={{
                              ...getCardSx(classIndex),
                              mb: { xs: 3, md: `${cardMarginBottom}px` },
                            }}
                          >
                            <Box
                              className="filter-card-content"
                              sx={getCardContentAreaSx(sectionHeightCap)}
                            >
                              <Box
                                className="filter-card-body"
                                sx={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, minHeight: 0 }}
                              >
                                <Button
                                  className="filter-card-open-button"
                                  type="button"
                                  variant={selectedCount > 0 ? "contained" : "outlined"}
                                  onClick={() =>
                                    handleOpenFilterModal("attributes", className, classDisplayName)
                                  }
                                  aria-label={`Open ${classDisplayName} filter`}
                                  sx={{
                                    justifyContent: "space-between",
                                    textTransform: "none",
                                    fontWeight: 700,
                                    minHeight: 44,
                                    px: 1.25,
                                  }}
                                >
                                  <span>{classDisplayName}</span>
                                  <span>{selectedCount > 0 ? `${selectedCount} selected` : "Details"}</span>
                                </Button>
                                {classError ? <Alert severity="error">{classError}</Alert> : null}
                                <HorizontalBarFilter
                                  key={`inline:attributes:${className}:${sortMode}`}
                                  className="filter-card-chart"
                                  title={classDisplayName}
                                  showTitle={false}
                                  allowCollapse={false}
                                  showSortDimensionToggle={false}
                                  showSortCycleButton={false}
                                  fillContainer
                                  data={classChartData}
                                  selectedValues={selectedValuesForClass}
                                  onSelectionChange={onSelectionChangeForClass}
                                  onRowToggleExpand={handleAttributeParentExpansionChange(className)}
                                  fontScale={fontScale}
                                  defaultSort={sortMode}
                                  customSortOrder={customSortOrder}
                                  inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
                                  getPatientSummary={getPatientSummary}
                                />
                              </Box>
                            </Box>
                          </Paper>
                        );
                        })}
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                  );
                })}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No Attribute classes returned.
              </Typography>
            )}
          </Stack>
        ) : null}
        {isPatientGridDockVisible ? (
          <Box
            sx={{
              position: "fixed",
              left: { xs: 8, md: 16 },
              right: { xs: 8, md: 16 },
              bottom: { xs: 8, md: 16 },
              zIndex: (theme) => theme.zIndex.modal - 1,
              pointerEvents: "none",
            }}
          >
            <Paper
              elevation={10}
              data-testid="patient-grid-drawer"
              onKeyDown={(event) => {
                if (event.key === "Escape" && isPatientGridDockExpanded) {
                  setIsPatientGridDockExpanded(false);
                }
              }}
              sx={{
                pointerEvents: "auto",
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: alpha(activeTheme.palette.background.paper, 0.9),
                opacity: 0.9,
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                boxShadow: (theme) => theme.shadows[12],
                maxHeight: { xs: "60vh", md: "min(64vh, 640px)" },
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
            >
              <Box sx={{ px: 1.5, py: 1.25, minHeight: 0 }}>
                <PatientGrid
                  data={patientGridRows}
                  cohortSize={cohortSize}
                  totalCohortCount={cohortSize}
                  totalPages={totalPatientGridPages}
                  currentPage={currentPatientGridPage}
                  pageSize={PATIENT_GRID_PAGE_SIZE}
                  onPageChange={setCurrentPatientGridPage}
                  isLoading={patientGridDrawerTableLoading}
                  error={patientGridPageError}
                  onRetry={handleRetryPatientSummary}
                  embedded
                  title="Selected Patients"
                  subtitle={isPatientGridDockExpanded ? patientGridDrawerStatusText : ""}
                  collapsible
                  expanded={isPatientGridDockExpanded}
                  onToggleExpanded={() => setIsPatientGridDockExpanded((previousValue) => !previousValue)}
                  compactHeader
                  toggleButtonTestId="patient-grid-drawer-toggle"
                  collapsiblePanelId={patientGridDrawerPanelId}
                  collapsedHeaderSummary={patientGridCollapsedHeaderSummary}
                />
              </Box>
            </Paper>
          </Box>
        ) : null}
        <Dialog
          open={isThemeBuilderOpen}
          onClose={handleThemeBuilderClose}
          fullWidth
          maxWidth="lg"
          aria-labelledby="theme-builder-modal-title"
        >
          <DialogTitle id="theme-builder-modal-title">Theme Builder</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                <FormControl size="small" sx={{ minWidth: 190 }}>
                  <InputLabel id="theme-builder-theme-select-label">Theme</InputLabel>
                  <Select
                    labelId="theme-builder-theme-select-label"
                    value={themeBuilderThemeKey}
                    label="Theme"
                    onChange={handleThemeBuilderThemeChange}
                  >
                    {THEME_OPTIONS.map((option) => (
                      <MenuItem key={option.key} value={option.key}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleThemeBuilderApplyTheme}
                  disabled={themeBuilderThemeKey === themeKey}
                >
                  {themeBuilderThemeKey === themeKey ? "Active Theme" : "Use This Theme"}
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  onClick={handleThemeBuilderThemeReset}
                  disabled={!hasThemeBuilderOverrides}
                >
                  Reset Theme Colors
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  onClick={handleThemeBuilderResetAll}
                  disabled={!hasAnyThemeColorOverrides}
                >
                  Reset All Themes
                </Button>
              </Stack>
              <TextField
                size="small"
                label="Search color paths"
                placeholder="palette.primary.main or #00619E"
                value={themeBuilderSearchQuery}
                onChange={(event) => setThemeBuilderSearchQuery(event.target.value)}
              />
              <Typography variant="caption" color="text.secondary">
                Showing {filteredThemeBuilderColorEntries.length.toLocaleString()} of{" "}
                {themeBuilderColorEntries.length.toLocaleString()} color entries ·{" "}
                {Object.keys(themeBuilderThemeOverrides).length.toLocaleString()} overrides for this theme
              </Typography>
              <Box
                sx={{
                  maxHeight: { xs: "52vh", md: "60vh" },
                  overflowY: "auto",
                  pr: 0.5,
                }}
              >
                <Stack spacing={1}>
                  {filteredThemeBuilderColorEntries.length > 0 ? (
                    filteredThemeBuilderColorEntries.map((entry) => {
                      const overriddenValue = themeBuilderThemeOverrides[entry.id];
                      const displayValue = overriddenValue ?? entry.defaultValue;
                      const colorPickerValue = toColorInputHexValue(displayValue);
                      const hasEntryOverride =
                        typeof overriddenValue === "string" && overriddenValue.length > 0;

                      return (
                        <Paper key={entry.id} variant="outlined" sx={{ p: 1 }}>
                          <Stack spacing={0.75}>
                            <Typography
                              variant="caption"
                              sx={{ color: "text.secondary", fontFamily: MONOSPACE_STACK, wordBreak: "break-word" }}
                            >
                              {entry.pathLabel}
                              {entry.kind === "token" ? ` [color ${entry.tokenIndex + 1}]` : ""}
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                              {colorPickerValue ? (
                                <TextField
                                  size="small"
                                  type="color"
                                  label="Pick"
                                  value={colorPickerValue}
                                  onChange={(event) =>
                                    handleThemeBuilderEntryChange(entry, event.target.value)
                                  }
                                  sx={{ width: 96, flexShrink: 0 }}
                                  inputProps={{
                                    "aria-label": `${entry.pathLabel} color picker`,
                                  }}
                                />
                              ) : null}
                              <TextField
                                size="small"
                                fullWidth
                                label={entry.kind === "direct" ? "Color value" : "Color token"}
                                value={displayValue}
                                onChange={(event) =>
                                  handleThemeBuilderEntryChange(entry, event.target.value)
                                }
                                inputProps={{
                                  "aria-label": `${entry.pathLabel} color value`,
                                }}
                              />
                              <Button
                                size="small"
                                onClick={() => handleThemeBuilderEntryChange(entry, entry.defaultValue)}
                                disabled={!hasEntryOverride}
                              >
                                Reset
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      );
                    })
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No matching color entries for this query.
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleThemeBuilderClose}>Close</Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={Boolean(activeFilterDetail)}
          onClose={handleCloseFilterModal}
          fullWidth
          maxWidth="md"
          aria-labelledby="filter-modal-title"
        >
          <DialogTitle id="filter-modal-title">
            {activeFilterDetail?.classDisplayName || "Filter details"}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems="center">
                <TextField
                  label="Search values"
                  placeholder="Type to filter labels"
                  size="small"
                  fullWidth
                  value={activeFilterSearchQuery}
                  onChange={(event) => setActiveFilterSearchQuery(event.target.value)}
                  inputProps={{
                    "aria-label": "Search filter values",
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="filter-modal-sort-by-label">Sort by</InputLabel>
                  <Select
                    labelId="filter-modal-sort-by-label"
                    value={activeFilterSortDimension}
                    label="Sort by"
                    onChange={handleModalSortDimensionChange}
                  >
                    <MenuItem value={FILTER_SORT_DIMENSION.COUNT}>Count</MenuItem>
                    <MenuItem value={FILTER_SORT_DIMENSION.LABEL}>Label</MenuItem>
                  </Select>
                </FormControl>
                <Tooltip
                  title={
                    activeFilterSortDirection === FILTER_SORT_DIRECTION.ASC
                      ? "Ascending"
                      : "Descending"
                  }
                >
                  <IconButton
                    onClick={handleModalSortDirectionToggle}
                    aria-label={
                      activeFilterSortDirection === FILTER_SORT_DIRECTION.ASC
                        ? "Sort ascending"
                        : "Sort descending"
                    }
                    sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
                  >
                    {activeFilterSortDirection === FILTER_SORT_DIRECTION.ASC ? (
                      <ArrowUpwardIcon fontSize="small" />
                    ) : (
                      <ArrowDownwardIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
              {activeFilterDetail?.classError ? (
                <Alert severity="error">{activeFilterDetail.classError}</Alert>
              ) : null}
              {filteredModalChartData.length > 0 ? (
                <HorizontalBarFilter
                  key={
                    activeFilterDetail
                      ? `modal:${activeFilterDetail.type}:${activeFilterDetail.className}:${activeFilterDetail.sortMode}`
                      : "modal:chart"
                  }
                  className={
                    activeFilterDetail?.type === "attributes"
                      ? "filter-modal-chart filter-modal-chart-attributes"
                      : "filter-modal-chart filter-modal-chart-omop"
                  }
                  title={activeFilterDetail?.classDisplayName || "Filter details"}
                  showTitle={false}
                  allowCollapse={false}
                  showSortDimensionToggle={false}
                  showSortCycleButton={false}
                  data={filteredModalChartData}
                  selectedValues={activeFilterDetail?.selectedValues || []}
                  onSelectionChange={
                    activeFilterDetail
                      ? activeFilterDetail.type === "attributes"
                        ? handleSelectionChange(
                            setSelectedAttributeValuesByClass,
                            activeFilterDetail.className
                          )
                        : handleSelectionChange(setSelectedOmopValuesByClass, activeFilterDetail.className)
                      : undefined
                  }
                  onRowToggleExpand={
                    activeFilterDetail?.type === "attributes"
                      ? handleAttributeParentExpansionChange(activeFilterDetail.className)
                      : undefined
                  }
                  fontScale={fontScale}
                  fillContainer={false}
                  defaultSort={activeFilterDetail?.sortMode || DEFAULT_FILTER_VALUE_SORT_MODE}
                  customSortOrder={
                    activeFilterDetail
                      ? getFilterCustomSortOrder(activeFilterDetail.type, activeFilterDetail.className)
                      : []
                  }
                  inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
                  getPatientSummary={getPatientSummary}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No matching values.
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseFilterModal}>Close</Button>
          </DialogActions>
        </Dialog>
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default FiltersView;
