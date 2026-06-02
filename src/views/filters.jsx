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
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { ThemeProvider, alpha, createTheme, darken, getContrastRatio, lighten } from "@mui/material/styles";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import Masonry from "@mui/lab/Masonry";
import { getSummary as getOmopSummary } from "../controllers/omap";
import { getSummary as getAttributesSummary } from "../controllers/attributes";
import { getSummary as getConceptsSummary } from "../controllers/concepts";
import {
  fetchDeepPheFilterCount,
  fetchDeepPheFilterCountBatch,
  fetchDeepPheFilterSummary,
  fetchPatientDocuments,
} from "../clients/deepphe-data-api";
import HorizontalBarFilter from "../components/HorizontalBarFilter";
import { useBatchDataLoader } from "../hooks/useBatchDataLoader";
import {
  FONT_SCALE_OPTIONS,
  findClosestFontScaleIndex,
  useFilterPagePreferences,
} from "../hooks/useFilterPagePreferences";
import { MONOSPACE_STACK, THEME_OPTIONS, getThemeByKey } from "../themes";
import { getAgeDecileLabel, normalizeClassName } from "../utils/dataProcessing";
import { toDisplayName } from "../utils/displayNames";
import { endSpan, logMilestone, startSpan } from "../utils/perfTracker";
import {
  FILTER_ENTRY_BY_TYPE_CLASS,
  resolveFilterSetsWithExtras,
  resolveFilterSetsForAttributesAndConcepts,
} from "./filterSets";
import { buildFilterSectionLayout, estimateCardHeight } from "./filterLayout";
import FilterSectionCard from "./filters/FilterSectionCard";
import FiltersToolbar from "./filters/FiltersToolbar";
import {
  FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT,
  FILTER_SECTION_LABEL_SX,
  FILTER_SECTION_LAYOUT_COLUMNS,
  getFilterSetCardColumnsByBreakpoint,
  getFilterSetPriorityIndex,
  resolvePackedGridSpan,
  resolveResponsiveColumnCap,
} from "./filters/layoutConfig";
import PatientDrawer from "./filters/PatientDrawer";
import {
  buildChildChartData,
  buildRollupInstanceMap,
  buildRolledUpChartData,
  hasRollup,
  isExpandable,
  resolveRollupSelections,
} from "./rollup";

const SLOW_QUERY_THRESHOLD_MS = 100;
const PATIENT_GRID_DEFAULT_PAGE_SIZE = 10;
const PATIENT_GRID_MAXIMIZED_PAGE_SIZE = 40;
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

const FONT_FAMILY_STORAGE_KEY = "filterPageFontFamily";
const THEME_COLOR_OVERRIDES_STORAGE_KEY = "filterPageThemeColorOverrides";
const THEME_EDITOR_MENU_VALUE = "__theme-builder__";
const THEME_COLOR_VALUE_PATTERN =
  /#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:transparent|currentColor)\b/gi;
const THEME_COLOR_VALUE_EXACT_PATTERN =
  /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|currentColor)$/i;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const THEME_COLOR_ROOT_KEYS = ["palette", "custom", "components"];
const EMPTY_THEME_COLOR_OVERRIDES = Object.freeze({});
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

function toRowCountCacheKey(rowRequestFilters = [], includePatientIds = false) {
  return `${includePatientIds ? "withPatientIds" : "withoutPatientIds"}|${JSON.stringify(rowRequestFilters)}`;
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
      const isDirectColor = tokenMatches.length === 1 && THEME_COLOR_VALUE_EXACT_PATTERN.test(trimmedValue);

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
    overridesByEntryId && typeof overridesByEntryId === "object" ? overridesByEntryId : EMPTY_THEME_COLOR_OVERRIDES;
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
        typeof overriddenToken === "string" && overriddenToken.length > 0 ? overriddenToken : entry.defaultValue;
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
          animationIterationCount: "1 !important",
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
        animationIterationCount: "1 !important",
      },
    }}
  />
);

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

  const normalizedType = String(type || "")
    .trim()
    .toLowerCase();
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
  const normalizedType = String(type || "")
    .trim()
    .toLowerCase();
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
  return normalizeChartSortMode(getFilterEntry(type, className)?.defaultSortMode || DEFAULT_FILTER_VALUE_SORT_MODE);
}

function getFilterCustomSortOrder(type, className) {
  const configuredOrder = getFilterEntry(type, className)?.customSortOrder;
  return Array.isArray(configuredOrder) ? configuredOrder : [];
}

function getFilterCompactLabelStripPrefix(type, className) {
  const prefix = getFilterEntry(type, className)?.compactLabelStripPrefix;
  return typeof prefix === "string" && prefix.length > 0 ? prefix : null;
}

function stripCompactLabelPrefix(rawLabel, prefix) {
  const label = String(rawLabel || "").trim();
  const normalizedPrefix = String(prefix || "").trim();
  if (!label || !normalizedPrefix) {
    return label;
  }

  const escapedPrefix = normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const compactLabel = label.replace(new RegExp(`^${escapedPrefix}\\s*`, "i"), "").trim();
  return compactLabel || label;
}

function withCompactFilterLabels(rows, type, className, isCompact) {
  if (!isCompact || !Array.isArray(rows) || rows.length === 0) {
    return Array.isArray(rows) ? rows : [];
  }

  const prefix = getFilterCompactLabelStripPrefix(type, className);
  if (!prefix) {
    return rows;
  }

  return rows.map((row) => {
    const fallbackLabel = String(row?.displayLabel || row?.label || "").trim();
    if (!fallbackLabel) {
      return row;
    }

    const compactDisplayLabel = stripCompactLabelPrefix(fallbackLabel, prefix);
    if (!compactDisplayLabel || compactDisplayLabel === fallbackLabel) {
      return row;
    }

    return {
      ...row,
      displayLabel: compactDisplayLabel,
    };
  });
}

function withCompactCustomSortOrder(sortOrder, type, className, isCompact) {
  const normalizedSortOrder = Array.isArray(sortOrder) ? sortOrder : [];
  if (!isCompact || normalizedSortOrder.length === 0) {
    return normalizedSortOrder;
  }

  const prefix = getFilterCompactLabelStripPrefix(type, className);
  if (!prefix) {
    return normalizedSortOrder;
  }

  return normalizedSortOrder.map((value) => stripCompactLabelPrefix(value, prefix));
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

  const normalizedType = String(type || "")
    .trim()
    .toLowerCase();
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
    (normalizedClass === "T STAGE" || normalizedClass === "N STAGE" || normalizedClass === "M STAGE");

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
      const patientIds = normalizePatientIds(row?.patientIds ?? row?.patient_ids ?? row?.patientId ?? row?.patient_id);

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
  return Array.isArray(values) ? [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))] : [];
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
  const normalized = Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : [];

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
  const raceValues = getDisplayInstances(omopFiltersByClass.RACE).map((value) => toNarrativeLabel(value));
  const ethnicityValues = getDisplayInstances(omopFiltersByClass.ETHNICITY).map((value) => toNarrativeLabel(value));
  const genderValues = getDisplayInstances(omopFiltersByClass.GENDER).map((value) => toNarrativeLabel(value));
  const cancerValues = getDisplayInstances(omopFiltersByClass.CANCER).map((value) => formatCancerValue(value));

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

  const behaviorValues = getDisplayInstances(attributeFiltersByClass.BEHAVIOR).map((value) => toNarrativeLabel(value));
  if (behaviorValues.length > 0) {
    conditionClauses.push(`${joinWithConjunction(behaviorValues, "or")} neoplasm behavior`);
  }

  const gradeValues = getDisplayInstances(attributeFiltersByClass.GRADE_NUMERIC).map((value) =>
    toNarrativeLabel(
      String(value || "")
        .replace(/^grade[_\s]*(numeric)?\s*/i, "")
        .trim()
    )
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

  const subjectText = subjectDescriptors.length > 0 ? subjectDescriptors.join(" ") : "patients";
  const conditionsText = joinCohortConditions(conditionClauses);

  if (conditionsText) {
    return `${safeCount.toLocaleString()} ${subjectText} with ${conditionsText}.`;
  }

  return `${safeCount.toLocaleString()} ${subjectText} matched the selected filters.`;
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
  return `${String(type || "")
    .trim()
    .toLowerCase()}:${String(className || "").trim()}`;
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
  const isAttributeRollupFilter = normalizedType === "attributes" && isAttributeRollupClass(className);

  if (isAgeAtDxDecileClass) {
    const mappedInstances = ageDecileInstanceMap?.[rowLabel];
    if (Array.isArray(mappedInstances) && mappedInstances.length > 0) {
      return mappedInstances;
    }
  }

  if (isAttributeRollupFilter) {
    return resolveRollupSelections([rowLabel], className, rollupInstanceMapByClass?.[className]);
  }

  return [rowLabel];
}

function buildActiveFilters({
  selectedOmopValuesByClass,
  omopClasses,
  selectedAttributeValuesByClass,
  attributeClasses,
  selectedConceptValuesByClass,
  conceptClasses,
}) {
  const omopFilters = Array.isArray(omopClasses)
    ? omopClasses
        .map((className) => toFilterItem("omop", className, selectedOmopValuesByClass?.[className]))
        .filter(Boolean)
    : [];
  const attributeFilters = Array.isArray(attributeClasses)
    ? attributeClasses
        .map((className) => toFilterItem("attributes", className, selectedAttributeValuesByClass?.[className]))
        .filter(Boolean)
    : [];
  const conceptFilters = Array.isArray(conceptClasses)
    ? conceptClasses
        .map((className) => toFilterItem("concepts", className, selectedConceptValuesByClass?.[className]))
        .filter(Boolean)
    : [];

  return [...omopFilters, ...attributeFilters, ...conceptFilters];
}

function resolveRequestFilters({ filters, ageAtDxSelectionMode, ageDecileInstanceMap, rollupInstanceMapByClass }) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map((filter) => {
      const normalizedFilterType = String(filter?.type || "").toLowerCase();
      const isAgeAtDxFilter = normalizedFilterType === "omop" && normalizeClassName(filter?.class) === AGE_AT_DX_CLASS;
      const isAttributeRollupFilter = normalizedFilterType === "attributes" && isAttributeRollupClass(filter?.class);

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
    const existingValues = Array.isArray(previousSelections?.[className]) ? previousSelections[className] : [];
    nextSelections[className] = [...new Set(existingValues.map((value) => String(value).trim()).filter(Boolean))];
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

    const existingParents = Array.isArray(previousState?.[className]) ? previousState[className] : [];
    const availableParents = new Set(
      (rolledUpChartDataByClass?.[className] || []).map((row) => String(row?.label || "").trim()).filter(Boolean)
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
    .sort((leftId, rightId) => leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: "base" }));
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

      if (primitiveCandidate !== undefined && primitiveCandidate !== null && typeof primitiveCandidate !== "object") {
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
      parsedSummary?.patient_id ?? parsedSummary?.patientId ?? summary?.patient_id ?? summary?.patientId ?? ""
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
  const grading = getFirstNonEmptyGrade([gradingFromNlp?.name, gradingFromNlp?.value, gradingFromAttributes]) || "—";
  const diagnoses = Array.isArray(normalizedSummary?.diagnoses) ? normalizedSummary.diagnoses : [];
  const STAGE_GROUP_RANK = {
    0: 0,
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
    (Array.isArray(rows) ? rows : []).map((entry) => normalizeStageName(entry?.name ?? entry?.value)).filter(Boolean);
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

    const pathologicT = pickHighestByScore(
      names.filter((name) => /^pT/i.test(name)),
      "pT"
    );
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

    const nStage = pickHighestByScore(
      names.filter((name) => /^N/i.test(name)),
      "N"
    );
    if (nStage.name) {
      return { label: nStage.name, rank: 600 + nStage.score };
    }

    const mStage = pickHighestByScore(
      names.filter((name) => /^M/i.test(name)),
      "M"
    );
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
        (String(item?.source || "").toLowerCase() === "cancer" || String(item?.source || "").toLowerCase() === "tumor")
    );
    if (tier1) {
      return tier1;
    }

    const tier2 = nonNegated.find((item) => !item?.historic && CANCER_KEYWORDS.test(String(item?.name || "")));
    if (tier2) {
      return tier2;
    }

    const tier3 = nonNegated.find((item) => ["cancer", "tumor"].includes(String(item?.source || "").toLowerCase()));
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
  const parsedAge = rawAge != null && rawAge !== "" && String(rawAge) !== "0" ? Number(rawAge) : null;
  const ageAtDx = parsedAge != null && Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : null;

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
      .map((item) =>
        String(item?.name || "")
          .trim()
          .toLowerCase()
      )
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
      normalizedSummary?.patient_id ?? normalizedSummary?.patientId ?? summary?.patient_id ?? summary?.patientId ?? ""
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
    parsePatientSummaryJson(matchingRow?.json_text ?? matchingRow?.jsonText) || parsePatientSummaryJson(matchingRow);

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
    activeFindings: normalizeSummaryList(findingItems.filter((item) => !Boolean(item?.negated))),
    negatedFindings: normalizeSummaryList(findingItems.filter((item) => Boolean(item?.negated))),
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
      return `${prettifyClassName(
        filter.class,
        filter.type
      )} matched 0 patients before intersection. Check spelling and selected values.`;
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
  return String(sortMode || "").startsWith("alpha") ? FILTER_SORT_DIMENSION.LABEL : FILTER_SORT_DIMENSION.COUNT;
}

function getSortDirectionFromMode(sortMode) {
  return String(sortMode || "").endsWith("asc") ? FILTER_SORT_DIRECTION.ASC : FILTER_SORT_DIRECTION.DESC;
}

function toSortMode(sortDimension, sortDirection) {
  const nextDirection =
    sortDirection === FILTER_SORT_DIRECTION.ASC ? FILTER_SORT_DIRECTION.ASC : FILTER_SORT_DIRECTION.DESC;

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
    const displayLabel = String(row?.displayLabel || "")
      .trim()
      .toLowerCase();
    const rawLabel = String(row?.label || "")
      .trim()
      .toLowerCase();
    return displayLabel.includes(query) || rawLabel.includes(query);
  });
}

function FiltersView() {
  const {
    themeKey,
    fontScale,
    highContrast,
    reducedMotion,
    filterPanelDensityMode,
    isCompactDensity,
    isCompactPlusDensity,
    stackGapPx,
    slackDistributionMode,
    changeTheme,
    changeFontScale,
    toggleHighContrast,
    toggleReducedMotion,
    changeFilterPanelDensityMode,
    changeStackGapPx,
    changeSlackDistributionMode,
  } = useFilterPagePreferences();
  const [fontFamilyKey] = useState(getInitialFontFamilyKey);
  const [isThemeBuilderOpen, setIsThemeBuilderOpen] = useState(false);
  const [themeBuilderThemeKey, setThemeBuilderThemeKey] = useState(() => themeKey);
  const [themeBuilderSearchQuery, setThemeBuilderSearchQuery] = useState("");
  const [themeColorOverridesByTheme, setThemeColorOverridesByTheme] = useState(getInitialThemeColorOverridesByTheme);
  const selectedBaseTheme = useMemo(() => getThemeByKey(themeKey), [themeKey]);
  const activeThemeColorEntries = useMemo(() => collectThemeColorEntries(selectedBaseTheme), [selectedBaseTheme]);
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
  const resolvedFilterSectionLayoutColumns = useMemo(
    () =>
      resolveResponsiveColumnCap(
        isCompactDensity ? FILTER_SECTION_LAYOUT_COLUMNS.compact : FILTER_SECTION_LAYOUT_COLUMNS.standard,
        {
          isSmUp,
          isMdUp,
          isLgUp,
          isXlUp,
        }
      ),
    [isCompactDensity, isLgUp, isMdUp, isSmUp, isXlUp]
  );
  const custom = useMemo(() => activeTheme.custom || {}, [activeTheme.custom]);
  const initialLoadStartRef = useRef(
    typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()
  );
  const pageLoadSpanRef = useRef(null);
  if (!pageLoadSpanRef.current) {
    pageLoadSpanRef.current = startSpan("page_load:FiltersView", "page_load", {
      route: "/filters",
    });
  }
  const hasLoggedInitialLoadRef = useRef(false);

  const handleThemeChange = useCallback(
    (event) => {
      const nextKey = String(event?.target?.value || "");
      if (nextKey === THEME_EDITOR_MENU_VALUE) {
        setThemeBuilderThemeKey(themeKey);
        setThemeBuilderSearchQuery("");
        setIsThemeBuilderOpen(true);
        return;
      }
      changeTheme(nextKey);
    },
    [themeKey, changeTheme]
  );

  const themeBuilderTheme = useMemo(() => getThemeByKey(themeBuilderThemeKey), [themeBuilderThemeKey]);
  const themeBuilderColorEntries = useMemo(() => collectThemeColorEntries(themeBuilderTheme), [themeBuilderTheme]);
  const themeBuilderThemeOverrides = themeColorOverridesByTheme[themeBuilderThemeKey] || EMPTY_THEME_COLOR_OVERRIDES;
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

  const handleThemeBuilderEntryChange = useCallback(
    (entry, rawNextValue) => {
      if (!entry?.id || !entry?.defaultValue) {
        return;
      }

      const normalizedNextValue = String(rawNextValue ?? "").trim();
      setThemeColorOverridesByTheme((previousOverridesByTheme) => {
        const previousThemeOverrides = previousOverridesByTheme[themeBuilderThemeKey] || EMPTY_THEME_COLOR_OVERRIDES;
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
    },
    [themeBuilderThemeKey]
  );

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
    changeTheme(themeBuilderThemeKey);
  }, [themeBuilderThemeKey, changeTheme]);

  const handleFontScaleChange = changeFontScale;
  const handleHighContrastToggle = toggleHighContrast;
  const handleReducedMotionToggle = toggleReducedMotion;
  const handleFilterPanelDensityModeChange = useCallback(
    (event) => {
      changeFilterPanelDensityMode(
        String(event?.target?.value || "")
          .trim()
          .toLowerCase()
      );
    },
    [changeFilterPanelDensityMode]
  );
  const handleStackGapChange = useCallback(
    (event) => {
      changeStackGapPx(Number(event?.target?.value));
    },
    [changeStackGapPx]
  );
  const handleSlackModeChange = useCallback(
    (event) => {
      changeSlackDistributionMode(String(event?.target?.value || ""));
    },
    [changeSlackDistributionMode]
  );
  const getOmopSummaryForFilters = useCallback(() => getOmopSummary({ includePatientIds: false }), []);
  const getAttributesSummaryForFilters = useCallback(() => getAttributesSummary({ includePatientIds: false }), []);
  const getConceptsSummaryForFilters = useCallback(() => getConceptsSummary({ includePatientIds: false }), []);
  const omopData = useBatchDataLoader(getOmopSummaryForFilters, "OMOP");
  const attributeData = useBatchDataLoader(getAttributesSummaryForFilters, "Attributes");
  const conceptData = useBatchDataLoader(getConceptsSummaryForFilters, "Concepts");
  const [selectedOmopValuesByClass, setSelectedOmopValuesByClass] = useState({});
  const [selectedAttributeValuesByClass, setSelectedAttributeValuesByClass] = useState({});
  const [selectedConceptValuesByClass, setSelectedConceptValuesByClass] = useState({});
  const [expandedParentsByClass, setExpandedParentsByClass] = useState({});
  const [omopSortModeByClass, setOmopSortModeByClass] = useState({});
  const [attributeSortModeByClass, setAttributeSortModeByClass] = useState({});
  const [conceptSortModeByClass, setConceptSortModeByClass] = useState({});
  const [activeFilterModal, setActiveFilterModal] = useState(null);
  const [activeFilterSearchQuery, setActiveFilterSearchQuery] = useState("");
  const ageAtDxSelectionMode = AGE_SELECTION_MODE.DECILE;
  const [countResult, setCountResult] = useState(null);
  const [includedCountByRowKey, setIncludedCountByRowKey] = useState({});
  const [includedPatientIdsByRowKey, setIncludedPatientIdsByRowKey] = useState({});
  const [, setIsInitialIncludedCountsReady] = useState(false);
  const includedPatientIdsByRowKeyRef = useRef({});
  const hasCompletedInitialIncludedCountsLoadRef = useRef(false);
  const [countError, setCountError] = useState("");
  const [isCountLoading, setIsCountLoading] = useState(false);
  const [currentPatientGridPage, setCurrentPatientGridPage] = useState(0);
  const [openPatientIds, setOpenPatientIds] = useState([]);
  const [activeDrawerTab, setActiveDrawerTab] = useState(0);
  const [patientGridPageCache, setPatientGridPageCache] = useState(() => new Map());
  const patientGridPageCacheRef = useRef(new Map());
  const [isPatientGridPageLoading, setIsPatientGridPageLoading] = useState(false);
  const [patientGridPageError, setPatientGridPageError] = useState("");
  const [patientGridPageRetryToken, setPatientGridPageRetryToken] = useState(0);
  const [isPatientGridDockExpanded, setIsPatientGridDockExpanded] = useState(true);
  const [isPatientGridDockMaximized, setIsPatientGridDockMaximized] = useState(false);
  const [filterLayoutMode, setFilterLayoutMode] = useState(FILTER_LAYOUT_MODE.PER_CARD_COLUMN);
  const isPerCardColumnLayout = filterLayoutMode === FILTER_LAYOUT_MODE.PER_CARD_COLUMN;
  const [cardNaturalHeightByKey, setCardNaturalHeightByKey] = useState({});
  const cardMeasureRefs = useRef({});
  const patientSummaryCacheRef = useRef(new Map());
  const rowCountResultCacheRef = useRef(new Map());
  const markInitialIncludedCountsReady = useCallback(() => {
    if (hasCompletedInitialIncludedCountsLoadRef.current) {
      return;
    }

    hasCompletedInitialIncludedCountsLoadRef.current = true;
    setIsInitialIncludedCountsReady(true);
  }, []);

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
    if (!isPatientGridDockMaximized || typeof document === "undefined") {
      return undefined;
    }

    const panelId = `drawer-tabpanel-${activeDrawerTab}`;
    let frameId = null;

    const scrollPanelToTop = () => {
      const panelElement = document.getElementById(panelId);
      if (!panelElement) {
        return;
      }
      panelElement.scrollTop = 0;
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      frameId = window.requestAnimationFrame(scrollPanelToTop);
    } else {
      scrollPanelToTop();
    }

    return () => {
      if (frameId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [activeDrawerTab, isPatientGridDockMaximized]);

  useEffect(() => {
    if (hasLoggedInitialLoadRef.current) {
      return;
    }

    if (omopData.isLoading || attributeData.isLoading) {
      return;
    }

    hasLoggedInitialLoadRef.current = true;
    const loadEndTime =
      typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    if (pageLoadSpanRef.current) {
      endSpan(pageLoadSpanRef.current, "ok", {
        totalMs: Math.round(loadEndTime - initialLoadStartRef.current),
        omopClasses: omopData.classes.length,
        attributeClasses: attributeData.classes.length,
      });
      pageLoadSpanRef.current = null;
    }

    if (SHOULD_LOG_FILTERS_PERF) {
      logMilestone("Filters ready", Math.round(loadEndTime - initialLoadStartRef.current), {
        omopClasses: omopData.classes.length,
        attributeClasses: attributeData.classes.length,
        omopError: omopData.errorMessage || undefined,
        attributeError: attributeData.errorMessage || undefined,
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
    () => resolveFilterSetsWithExtras(omopData.classes, "omop").filter((filterSet) => filterSet.display !== false),
    [omopData.classes]
  );
  const attributeConceptFilterSets = useMemo(
    () =>
      resolveFilterSetsForAttributesAndConcepts({
        attributes: attributeData.classes,
        concepts: conceptData.classes,
      }),
    [attributeData.classes, conceptData.classes]
  );
  const omopFilterSetById = useMemo(
    () => new Map(omopFilterSets.map((filterSet) => [filterSet.id, filterSet])),
    [omopFilterSets]
  );
  const cohortOverviewInlineAttributeFilterSets = useMemo(() => {
    return attributeConceptFilterSets.filter((filterSet) => String(filterSet?.row || "").trim() === "cohort-overview");
  }, [attributeConceptFilterSets]);
  const attributeConceptFilterSetsOutsideCohortOverview = useMemo(
    () => attributeConceptFilterSets.filter((filterSet) => String(filterSet?.row || "").trim() !== "cohort-overview"),
    [attributeConceptFilterSets]
  );
  const shouldInjectCohortOverviewAttributes = useMemo(
    () => Boolean(omopFilterSetById.get("cancer-type")) && cohortOverviewInlineAttributeFilterSets.length > 0,
    [cohortOverviewInlineAttributeFilterSets.length, omopFilterSetById]
  );
  const filterSectionsForDisplay = useMemo(() => {
    const nextSections = omopFilterSets.map((filterSet) => ({
      id: filterSet.id,
      kind: "omop",
      filterSet,
    }));

    const sectionIdsInCohortOverview = new Set(
      cohortOverviewInlineAttributeFilterSets.map((filterSet) => filterSet.id)
    );
    const attributeSections = shouldInjectCohortOverviewAttributes
      ? attributeConceptFilterSetsOutsideCohortOverview
      : attributeConceptFilterSets;

    attributeSections.forEach((filterSet) => {
      if (shouldInjectCohortOverviewAttributes && sectionIdsInCohortOverview.has(filterSet.id)) {
        return;
      }
      nextSections.push({
        id: filterSet.id,
        kind: "attributes",
        filterSet,
      });
    });

    return nextSections.sort((leftSection, rightSection) => {
      const priorityDelta = getFilterSetPriorityIndex(leftSection.id) - getFilterSetPriorityIndex(rightSection.id);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return String(leftSection.id || "").localeCompare(String(rightSection.id || ""));
    });
  }, [
    attributeConceptFilterSets,
    attributeConceptFilterSetsOutsideCohortOverview,
    cohortOverviewInlineAttributeFilterSets,
    omopFilterSets,
    shouldInjectCohortOverviewAttributes,
  ]);
  const orderedOmopClasses = useMemo(
    () => omopFilterSets.flatMap((filterSet) => filterSet.filters.map((filter) => filter.key)),
    [omopFilterSets]
  );
  const orderedAttributeFilterClasses = useMemo(
    () =>
      attributeConceptFilterSets.flatMap((filterSet) =>
        filterSet.filters.filter((f) => f.type === "attributes").map((f) => f.key)
      ),
    [attributeConceptFilterSets]
  );
  const orderedConceptClasses = useMemo(
    () =>
      attributeConceptFilterSets.flatMap((filterSet) =>
        filterSet.filters.filter((f) => f.type === "concepts").map((f) => f.key)
      ),
    [attributeConceptFilterSets]
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
      next[className] = toChartData(attributeData.summaryByClass[className], "attributes", className);
    });
    return next;
  }, [orderedAttributeFilterClasses, attributeData.summaryByClass]);
  const rolledUpChartDataByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];
      next[className] = isAttributeRollupClass(className) ? buildRolledUpChartData(classData, className) : classData;
    });

    return next;
  }, [attributeChartDataByClass, orderedAttributeFilterClasses]);
  const rollupInstanceMapByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];
      next[className] = isAttributeRollupClass(className) ? buildRollupInstanceMap(classData, className) : {};
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
  }, [attributeChartDataByClass, expandedParentsByClass, orderedAttributeFilterClasses, rolledUpChartDataByClass]);
  const conceptChartDataByClass = useMemo(() => {
    const next = {};
    orderedConceptClasses.forEach((className) => {
      next[className] = toChartData(conceptData.summaryByClass[className], "concepts", className);
    });
    return next;
  }, [orderedConceptClasses, conceptData.summaryByClass]);
  const conceptDisplayChartDataByClass = useMemo(() => {
    const next = {};
    orderedConceptClasses.forEach((className) => {
      next[className] = conceptChartDataByClass[className] || [];
    });
    return next;
  }, [conceptChartDataByClass, orderedConceptClasses]);
  const ageAtDxClassName = useMemo(
    () => orderedOmopClasses.find((className) => normalizeClassName(className) === AGE_AT_DX_CLASS) || "",
    [orderedOmopClasses]
  );
  const ageAtDxRawChartData = useMemo(() => {
    if (!ageAtDxClassName) {
      return [];
    }
    return chartDataByClass[ageAtDxClassName] || [];
  }, [ageAtDxClassName, chartDataByClass]);
  const ageAtDxDecileChartData = useMemo(() => buildAgeDecileChartData(ageAtDxRawChartData), [ageAtDxRawChartData]);
  const ageDecileInstanceMap = useMemo(() => buildAgeDecileInstanceMap(ageAtDxRawChartData), [ageAtDxRawChartData]);
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

    orderedConceptClasses.forEach((className) => {
      rows.push({
        type: "concepts",
        className,
        data: conceptDisplayChartDataByClass[className] || [],
      });
    });

    return rows;
  }, [
    ageAtDxDecileChartData,
    ageAtDxSelectionMode,
    attributeDisplayChartDataByClass,
    chartDataByClass,
    conceptDisplayChartDataByClass,
    orderedAttributeFilterClasses,
    orderedConceptClasses,
    orderedOmopClasses,
  ]);
  const isLoading = omopData.isLoading;
  const isAttributeLoading = attributeData.isLoading;
  const isConceptLoading = conceptData.isLoading;
  const rootError = omopData.errorMessage;
  const attributeRootError = attributeData.errorMessage;
  const conceptRootError = conceptData.errorMessage;
  const hasDataErrors = !!(rootError || attributeRootError || conceptRootError);
  // Gate on whether all three batch loaders have completed — not on the async
  // per-row count pass (isInitialIncludedCountsReady). Waiting for the count
  // pass creates a window where the loading indicator disappears but the filter
  // sections haven't mounted yet, causing a visible blank flash. Showing
  // sections as soon as base data is loaded is strictly better: bars render
  // with total counts immediately, and included-count indicators appear once
  // `loadIncludedCounts` finishes its async work.
  const allBaseDataLoaded = !isLoading && !isAttributeLoading && !isConceptLoading;
  const shouldShowFilterLoadingState = !hasDataErrors && !allBaseDataLoaded;
  const canRenderFilterSections = !hasDataErrors && allBaseDataLoaded;
  const activeFilters = useMemo(
    () =>
      buildActiveFilters({
        selectedOmopValuesByClass,
        omopClasses: orderedOmopClasses,
        selectedAttributeValuesByClass,
        attributeClasses: orderedAttributeFilterClasses,
        selectedConceptValuesByClass,
        conceptClasses: orderedConceptClasses,
      }),
    [
      orderedAttributeFilterClasses,
      orderedConceptClasses,
      orderedOmopClasses,
      selectedAttributeValuesByClass,
      selectedConceptValuesByClass,
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

    if (isLoading || isAttributeLoading || isConceptLoading) {
      return () => {
        isActive = false;
      };
    }

    const staticCountsByRowKey = {};
    const staticPatientIdsByRowKey = {};
    const countRequests = [];

    chartClassRows.forEach(({ type, className, data }) => {
      const classData = Array.isArray(data) ? data : [];
      const filtersExcludingClass = activeFilters.filter((filter) => !isSameFilterClass(filter, type, className));
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
        const cachedRowPatientIds = normalizeInstanceValues(includedPatientIdsByRowKeyRef.current?.[rowKey]);
        const effectiveRowPatientIds = rowPatientIds.length > 0 ? rowPatientIds : cachedRowPatientIds;
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
      logMilestone("Row counts queued", null, { requests: countRequests.length });
    }

    if (countRequests.length === 0) {
      markInitialIncludedCountsReady();
      return () => {
        isActive = false;
      };
    }

    const loadIncludedCounts = async () => {
      const includedCountsStartTime =
        typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      const nextCountsByRowKey = { ...staticCountsByRowKey };
      const nextPatientIdsByRowKey = { ...staticPatientIdsByRowKey };

      // Separate cached rows from those that need a network request.
      const cachedResults = [];
      const uncachedRequests = [];
      for (const request of countRequests) {
        const { rowRequestFilters, includePatientIds } = request;
        const cacheKey = toRowCountCacheKey(rowRequestFilters, includePatientIds);
        const cached = rowCountResultCacheRef.current.get(cacheKey);
        if (cached) {
          cachedResults.push({ request, payload: cached });
        } else {
          uncachedRequests.push({ request, cacheKey });
        }
      }

      // Apply cached results immediately.
      for (const { request, payload } of cachedResults) {
        const { rowKey, fallbackCount, includePatientIds } = request;
        const resolvedCount = payload.count;
        nextCountsByRowKey[rowKey] = Number.isFinite(resolvedCount)
          ? Math.max(0, Math.round(resolvedCount))
          : fallbackCount;
        if (includePatientIds) {
          const resolvedPatientIds = normalizeInstanceValues(payload.patientIds);
          if (resolvedPatientIds.length > 0) {
            nextPatientIdsByRowKey[rowKey] = resolvedPatientIds;
          }
        }
      }

      // Fetch uncached rows: attempt batch endpoint first, fall back to
      // a concurrency-limited pool of individual requests if batch fails.
      if (uncachedRequests.length > 0) {
        let batchFailed = false;
        let batchResults = null;

        try {
          const batchQueries = uncachedRequests.map(({ request }) => ({
            filters: request.rowRequestFilters,
            includePatientIds: request.includePatientIds,
          }));
          batchResults = await fetchDeepPheFilterCountBatch(batchQueries);
        } catch {
          batchFailed = true;
        }

        if (!batchFailed && Array.isArray(batchResults)) {
          // Process batch results positionally.
          batchResults.forEach((result, index) => {
            const { request, cacheKey } = uncachedRequests[index];
            const { rowKey, fallbackCount, includePatientIds } = request;
            try {
              const normalizedCountPayload = normalizeCountResponse(result);
              if (rowCountResultCacheRef.current.size >= 2000) {
                rowCountResultCacheRef.current.clear();
              }
              rowCountResultCacheRef.current.set(cacheKey, normalizedCountPayload);
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
          });
        } else {
          // Batch unavailable — fall back to concurrency-limited individual requests.
          const CONCURRENCY = 8;
          let index = 0;
          const runNext = async () => {
            while (index < uncachedRequests.length) {
              const current = uncachedRequests[index++];
              const { request, cacheKey } = current;
              const { rowKey, rowRequestFilters, fallbackCount, includePatientIds } = request;
              try {
                const normalizedCountPayload = normalizeCountResponse(
                  await fetchDeepPheFilterCount({ filters: rowRequestFilters, includePatientIds })
                );
                if (rowCountResultCacheRef.current.size >= 2000) {
                  rowCountResultCacheRef.current.clear();
                }
                rowCountResultCacheRef.current.set(cacheKey, normalizedCountPayload);
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
            }
          };
          await Promise.all(Array.from({ length: Math.min(CONCURRENCY, uncachedRequests.length) }, runNext));
        }
      }

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
        markInitialIncludedCountsReady();
        if (SHOULD_LOG_FILTERS_PERF) {
          logMilestone(
            "Row counts ready",
            Math.round(
              ((typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : Date.now()) -
                includedCountsStartTime) *
                100
            ) / 100,
            { requests: countRequests.length }
          );
        }
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
    isAttributeLoading,
    isConceptLoading,
    isLoading,
    markInitialIncludedCountsReady,
    rollupInstanceMapByClass,
  ]);

  useEffect(() => {
    setSelectedOmopValuesByClass((previousSelections) => syncSelectionByClass(previousSelections, orderedOmopClasses));
  }, [orderedOmopClasses]);
  useEffect(() => {
    setSelectedAttributeValuesByClass((previousSelections) =>
      syncSelectionByClass(previousSelections, orderedAttributeFilterClasses)
    );
  }, [orderedAttributeFilterClasses]);
  useEffect(() => {
    setExpandedParentsByClass((previousState) =>
      syncExpandedParentsByClass(previousState, orderedAttributeFilterClasses, rolledUpChartDataByClass)
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
  useEffect(() => {
    setSelectedConceptValuesByClass((previousSelections) =>
      syncSelectionByClass(previousSelections, orderedConceptClasses)
    );
  }, [orderedConceptClasses]);
  useEffect(() => {
    setConceptSortModeByClass((previousModes) => {
      const nextModes = {};
      orderedConceptClasses.forEach((className) => {
        nextModes[className] = normalizeChartSortMode(
          previousModes?.[className] || getFilterDefaultSortMode("concepts", className)
        );
      });
      return nextModes;
    });
  }, [orderedConceptClasses]);

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
      // A card carrying data-card-height-override has had its size set by the
      // layout engine (e.g. compact-plus slack stretch). Re-measuring its DOM
      // height would capture the forced size, not the natural content height,
      // causing the layout to oscillate. Freeze the stored height instead.
      // This check must come before the per-card-column scroll-height path so
      // it fires even when isPerCardColumnLayout is true.
      if (node?.hasAttribute?.("data-card-height-override")) {
        const previousHeight = Number(cardNaturalHeightByKey[key]);
        if (Number.isFinite(previousHeight) && previousHeight > 0) {
          nextHeights[key] = previousHeight;
        }
        return;
      }

      if (isPerCardColumnLayout) {
        const contentNode = node?.querySelector?.(".filter-card-content");
        const contentScrollHeight = Number(contentNode?.scrollHeight);
        const chartViewportNode = node?.querySelector?.(".horizontal-bar-filter-chart-viewport");
        const chartViewportClientHeight = Number(chartViewportNode?.clientHeight);
        const chartSvgNode = node?.querySelector?.(".horizontal-bar-filter-svg");
        const chartSvgHeight = Number(chartSvgNode?.getAttribute?.("height"));
        const computedStyles = typeof window !== "undefined" ? window.getComputedStyle(node) : null;
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
    attributeConceptFilterSets,
    attributeDisplayChartDataByClass,
    cardNaturalHeightByKey,
    chartDataByClass,
    conceptDisplayChartDataByClass,
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
      patientGridPageCacheRef.current = new Map();
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
    patientGridPageCacheRef.current = new Map();
    setPatientGridPageCache(new Map());
    setPatientGridPageError("");
    setIsPatientGridPageLoading(false);

    const loadCount = async () => {
      const filterSpan = startSpan("filter_query", "filter_query", {
        filterCount: requestFilters?.length ?? 0,
        includePatientIds: false,
      });

      try {
        let nextResult = normalizeCountResponse(
          await fetchDeepPheFilterCount({
            filters: requestFilters,
            includePatientIds: false,
          })
        );

        const shouldAutoResolvePatientIds = nextResult.count > 0 && nextResult.patientIds.length === 0;

        if (shouldAutoResolvePatientIds) {
          nextResult = normalizeCountResponse(
            await fetchDeepPheFilterCount({
              filters: requestFilters,
              includePatientIds: true,
            })
          );
        }

        const successMeta = {
          resultCount: nextResult.count,
          queryMs: nextResult.timing?.queryMs,
          bitmapMs: nextResult.timing?.bitmapMs,
          resolveMs: nextResult.timing?.resolveMs,
          totalMs: nextResult.timing?.totalMs,
        };

        if (!isActive) {
          endSpan(filterSpan, "cancelled", successMeta);
          return;
        }
        endSpan(filterSpan, "ok", successMeta);
        if (SHOULD_LOG_FILTERS_PERF) {
          logMilestone("Filter query", successMeta.totalMs, { count: successMeta.resultCount });
        }
        setCountResult(nextResult);
      } catch (error) {
        if (!isActive) {
          endSpan(filterSpan, "cancelled", { errorMessage: error?.message || "" });
          return;
        }
        endSpan(filterSpan, "error", { errorMessage: error?.message || "" });
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

  const timing = useMemo(() => countResult?.timing || {}, [countResult?.timing]);
  const isSlowQuery = Number(timing.totalMs || 0) > SLOW_QUERY_THRESHOLD_MS;
  const zeroResultHint = countResult?.count === 0 ? getZeroResultHint(activeFilters, timing.itemCounts) : "";
  const identifiedSummary = useMemo(
    () => buildIdentifiedSummary(activeFilters, countResult?.count),
    [activeFilters, countResult?.count]
  );
  const cohortSize = Number(countResult?.count || 0);
  const patientGridPageSize = isPatientGridDockMaximized
    ? PATIENT_GRID_MAXIMIZED_PAGE_SIZE
    : PATIENT_GRID_DEFAULT_PAGE_SIZE;
  const patientIdsForResult = useMemo(() => normalizePatientIds(countResult?.patientIds), [countResult?.patientIds]);
  const patientIdsForResultKey = useMemo(() => patientIdsForResult.join(","), [patientIdsForResult]);
  const totalPatientGridPages = useMemo(
    () => Math.ceil(patientIdsForResult.length / patientGridPageSize),
    [patientGridPageSize, patientIdsForResult.length]
  );
  const currentPatientGridPageIds = useMemo(() => {
    if (cohortSize <= 0) {
      return [];
    }

    const startIndex = currentPatientGridPage * patientGridPageSize;
    const endIndex = Math.min(startIndex + patientGridPageSize, patientIdsForResult.length);

    return patientIdsForResult.slice(startIndex, endIndex);
  }, [cohortSize, currentPatientGridPage, patientGridPageSize, patientIdsForResult]);
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
  const patientGridDrawerFilterSummaryText = useMemo(() => {
    if (activeFilters.length === 0) {
      return "";
    }

    return activeFilters
      .map((filter) => {
        const classLabel = getFilterDisplayName(filter.type, filter.class);
        const selectedValues = formatSelectionText(
          filter.instances.map((value) => toDisplayInstanceValue(filter.type, filter.class, value))
        );
        return `${classLabel} (${selectedValues})`;
      })
      .join(", ");
  }, [activeFilters]);
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
                    filter.instances.map((value) => toDisplayInstanceValue(filter.type, filter.class, value))
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
        xs: isPatientGridDockMaximized ? "calc(100vh - 96px)" : isPatientGridDockExpanded ? "68vh" : "104px",
        md: isPatientGridDockMaximized
          ? "calc(100vh - 124px)"
          : isPatientGridDockExpanded
          ? "min(78vh, 820px)"
          : "116px",
      }
    : 0;
  const patientGridDrawerTableLoading = isCountLoading || isPatientGridPageLoading;

  useEffect(() => {
    setCurrentPatientGridPage(0);
    patientGridPageCacheRef.current = new Map();
    setPatientGridPageCache(new Map());
    setPatientGridPageError("");
    setIsPatientGridPageLoading(false);
  }, [patientGridPageSize, patientIdsForResultKey, shouldShowPatientDetailGrid]);

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

    if (patientGridPageCacheRef.current.has(currentPatientGridPage)) {
      setIsPatientGridPageLoading(false);
      setPatientGridPageError("");
      return () => {
        isActive = false;
      };
    }

    setIsPatientGridPageLoading(true);
    setPatientGridPageError("");

    const loadPatientPage = async () => {
      const pageLoadStartTime =
        typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      try {
        const fetchStartTime =
          typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
        const summaryPayload = await fetchDeepPheFilterSummary(currentPatientGridPageIds);
        const fetchMs =
          Math.round(
            ((typeof performance !== "undefined" && typeof performance.now === "function"
              ? performance.now()
              : Date.now()) -
              fetchStartTime) *
              100
          ) / 100;
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

        patientGridPageCacheRef.current.set(currentPatientGridPage, pageRows);
        setPatientGridPageCache((previousCache) => {
          const nextCache = new Map(previousCache);
          nextCache.set(currentPatientGridPage, pageRows);
          return nextCache;
        });
        if (SHOULD_LOG_FILTERS_PERF) {
          logMilestone(
            "Patient grid page loaded",
            Math.round(
              ((typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : Date.now()) -
                pageLoadStartTime) *
                100
            ) / 100,
            {
              page: currentPatientGridPage + 1,
              patients: pageRows.length,
              fetchMs,
            }
          );
        }
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
    patientGridPageRetryToken,
    shouldShowPatientDetailGrid,
  ]);

  const handleRetryPatientSummary = useCallback(() => {
    patientGridPageCacheRef.current.delete(currentPatientGridPage);
    setPatientGridPageCache((previousCache) => {
      const nextCache = new Map(previousCache);
      nextCache.delete(currentPatientGridPage);
      return nextCache;
    });
    setPatientGridPageRetryToken((previous) => previous + 1);
  }, [currentPatientGridPage]);

  const MAX_OPEN_PATIENT_TABS = 5;

  const handleOpenPatientTab = useCallback(
    (patientId) => {
      const normalizedId = String(patientId || "").trim();
      if (!normalizedId) return;

      setOpenPatientIds((previous) => {
        const existingIndex = previous.indexOf(normalizedId);
        if (existingIndex !== -1) {
          setActiveDrawerTab(existingIndex + 1);
          return previous;
        }

        const next = [...previous, normalizedId].slice(-MAX_OPEN_PATIENT_TABS);
        setActiveDrawerTab(next.length);
        return next;
      });

      setIsPatientGridDockExpanded(true);
    },
    [MAX_OPEN_PATIENT_TABS]
  );

  const handleClosePatientTab = useCallback((patientId, event) => {
    event.stopPropagation();
    setOpenPatientIds((previous) => {
      const index = previous.indexOf(patientId);
      if (index === -1) {
        return previous;
      }
      const next = previous.filter((id) => id !== patientId);

      setActiveDrawerTab((previousTab) => {
        const closingTabIndex = index + 1;
        if (previousTab === closingTabIndex) {
          return Math.max(0, closingTabIndex - 1);
        }
        if (previousTab > closingTabIndex) {
          return previousTab - 1;
        }
        return previousTab;
      });

      return next;
    });
  }, []);

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
          patientIds: includedPatientIds.length > 0 ? includedPatientIds : normalizeInstanceValues(row?.patientIds),
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
        const rowKey = getFilterRowKey("attributes", className, String(row?.label || "").trim());
        const includedPatientIds = normalizeInstanceValues(includedPatientIdsByRowKey[rowKey]);

        return {
          ...row,
          includedValue: includedCountByRowKey[rowKey],
          patientIds: includedPatientIds.length > 0 ? includedPatientIds : normalizeInstanceValues(row?.patientIds),
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
  const conceptChartDataWithIncludedByClass = useMemo(() => {
    const next = {};

    orderedConceptClasses.forEach((className) => {
      const classData = conceptDisplayChartDataByClass[className] || [];
      next[className] = classData.map((row) => {
        const rowKey = getFilterRowKey("concepts", className, String(row?.label || "").trim());
        const includedPatientIds = normalizeInstanceValues(includedPatientIdsByRowKey[rowKey]);

        return {
          ...row,
          includedValue: includedCountByRowKey[rowKey],
          patientIds: includedPatientIds.length > 0 ? includedPatientIds : normalizeInstanceValues(row?.patientIds),
        };
      });
    });

    return next;
  }, [conceptDisplayChartDataByClass, includedCountByRowKey, includedPatientIdsByRowKey, orderedConceptClasses]);
  const getChartDataForDensity = useCallback(
    (rows, filterType, className) => withCompactFilterLabels(rows, filterType, className, isCompactDensity),
    [isCompactDensity]
  );
  const getCustomSortOrderForDensity = useCallback(
    (filterType, className) =>
      withCompactCustomSortOrder(
        getFilterCustomSortOrder(filterType, className),
        filterType,
        className,
        isCompactDensity
      ),
    [isCompactDensity]
  );
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
      normalizedType === "attributes"
        ? setAttributeSortModeByClass
        : normalizedType === "concepts"
        ? setConceptSortModeByClass
        : setOmopSortModeByClass;

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
    const normalizedType = String(filterType || "omop").toLowerCase();
    setActiveFilterModal({
      type: normalizedType === "attributes" ? "attributes" : normalizedType === "concepts" ? "concepts" : "omop",
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
    const rawType = String(type || "").toLowerCase();
    const normalizedType = rawType === "attributes" ? "attributes" : rawType === "concepts" ? "concepts" : "omop";
    const chartData =
      normalizedType === "attributes"
        ? attributeChartDataWithIncludedByClass[className] || attributeDisplayChartDataByClass[className] || []
        : normalizedType === "concepts"
        ? conceptChartDataWithIncludedByClass[className] || conceptDisplayChartDataByClass[className] || []
        : omopChartDataWithIncludedByClass[className] || chartDataByClass[className] || [];
    const selectedValues =
      normalizedType === "attributes"
        ? selectedAttributeValuesByClass[className] || []
        : normalizedType === "concepts"
        ? selectedConceptValuesByClass[className] || []
        : selectedOmopValuesByClass[className] || [];
    const sortModeByClass =
      normalizedType === "attributes"
        ? attributeSortModeByClass
        : normalizedType === "concepts"
        ? conceptSortModeByClass
        : omopSortModeByClass;
    const classError =
      normalizedType === "attributes"
        ? attributeData.errorsByClass[className] || ""
        : normalizedType === "concepts"
        ? conceptData.errorsByClass[className] || ""
        : omopData.errorsByClass[className] || "";
    const sortMode = sortModeByClass[className] || getFilterDefaultSortMode(normalizedType, className);

    return {
      type: normalizedType,
      className,
      classDisplayName,
      chartData: getChartDataForDensity(Array.isArray(chartData) ? chartData : [], normalizedType, className),
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
    conceptChartDataWithIncludedByClass,
    conceptData.errorsByClass,
    conceptDisplayChartDataByClass,
    conceptSortModeByClass,
    getChartDataForDensity,
    omopChartDataWithIncludedByClass,
    omopData.errorsByClass,
    omopSortModeByClass,
    selectedAttributeValuesByClass,
    selectedConceptValuesByClass,
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

      const requestedDimension = String(event?.target?.value || "")
        .trim()
        .toLowerCase();
      const nextDimension =
        requestedDimension === FILTER_SORT_DIMENSION.LABEL ? FILTER_SORT_DIMENSION.LABEL : FILTER_SORT_DIMENSION.COUNT;
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
      activeFilterSortDirection === FILTER_SORT_DIRECTION.ASC ? FILTER_SORT_DIRECTION.DESC : FILTER_SORT_DIRECTION.ASC;
    const nextSortMode = toSortMode(activeFilterSortDimension, nextDirection);
    setFilterSortMode(activeFilterDetail.type, activeFilterDetail.className, nextSortMode);
  }, [activeFilterDetail, activeFilterSortDimension, activeFilterSortDirection, setFilterSortMode]);
  const handleResetAllFilters = useCallback(() => {
    setSelectedOmopValuesByClass(syncSelectionByClass({}, orderedOmopClasses));
    setSelectedAttributeValuesByClass(syncSelectionByClass({}, orderedAttributeFilterClasses));
    setSelectedConceptValuesByClass(syncSelectionByClass({}, orderedConceptClasses));
    setExpandedParentsByClass(syncExpandedParentsByClass({}, orderedAttributeFilterClasses, rolledUpChartDataByClass));

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

    const nextConceptSortModes = {};
    orderedConceptClasses.forEach((className) => {
      nextConceptSortModes[className] = getFilterDefaultSortMode("concepts", className);
    });
    setConceptSortModeByClass(nextConceptSortModes);

    setActiveFilterModal(null);
    setActiveFilterSearchQuery("");
  }, [orderedAttributeFilterClasses, orderedConceptClasses, orderedOmopClasses, rolledUpChartDataByClass]);
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
          normalizeChartSortMode(omopSortModeByClass[className]) !== getFilterDefaultSortMode("omop", className)
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
  const hasNonDefaultConceptSortMode = useMemo(
    () =>
      orderedConceptClasses.some(
        (className) =>
          normalizeChartSortMode(conceptSortModeByClass[className]) !== getFilterDefaultSortMode("concepts", className)
      ),
    [conceptSortModeByClass, orderedConceptClasses]
  );
  const canResetAllFilters =
    hasSelections ||
    hasExpandedParentFilters ||
    hasNonDefaultOmopSortMode ||
    hasNonDefaultAttributeSortMode ||
    hasNonDefaultConceptSortMode ||
    Boolean(activeFilterModal) ||
    Boolean(String(activeFilterSearchQuery || "").trim());
  const FILTER_PANEL_SPACING_PX = isCompactPlusDensity ? stackGapPx : isCompactDensity ? 8 : 16;
  const FILTER_PANEL_SPACING_UNITS = FILTER_PANEL_SPACING_PX / 8;
  // Hard cap every filter card. Anything taller scrolls inside the
  // chart viewport (overflowY: auto on .horizontal-bar-filter-chart-viewport)
  // so the page stays scannable even for cards with hundreds of values.
  const FILTER_CARD_MAX_HEIGHT_PX = isCompactPlusDensity ? 300 : 200;
  const FILTER_SECTION_HEIGHT_CAP_PX = 700;
  const FILTER_CARD_CHART_HEIGHT_OFFSET_PX = 150;
  const PER_CARD_COLUMN_CHART_HEIGHT_CAP_PX = 340;
  const ROW_HEIGHT_ESTIMATE = isCompactDensity ? 24 : 36;
  const CARD_OVERHEAD_ESTIMATE = isCompactDensity ? 60 : 120;
  const NATURAL_STACK_GAP_PX = isCompactDensity ? 8 : 24;
  const CARD_BOTTOM_MARGIN = isCompactDensity ? 12 : 24;
  const resolveSectionHeightCapPx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const numericHeightCap = Number(sectionHeightCap);
    if (!Number.isFinite(numericHeightCap) || numericHeightCap <= 0) {
      return FILTER_SECTION_HEIGHT_CAP_PX;
    }
    return Math.max(1, Math.round(numericHeightCap));
  };
  const resolveCardChartHeightCapPx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    const naturalChartCapPx = Math.max(220, resolvedSectionHeightCapPx - FILTER_CARD_CHART_HEIGHT_OFFSET_PX);
    return isPerCardColumnLayout ? Math.min(naturalChartCapPx, PER_CARD_COLUMN_CHART_HEIGHT_CAP_PX) : naturalChartCapPx;
  };
  const toSectionHeightPx = (sectionHeight, sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
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
      "& > .filter-section-grid": { maxHeight: "none" },
    };
  };
  const getCardContentAreaSx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    return {
      display: "flex",
      flexDirection: "column",
      gap: 0,
      minHeight: 0,
      height: "auto",
      maxHeight: "var(--filter-section-height-cap)",
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
        maxHeight: `min(44vh, ${resolveCardChartHeightCapPx(resolvedSectionHeightCapPx)}px)`,
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
  const buildSectionLayout = (type, filters, classChartDataByClass, options = {}) => {
    const { maxColumns: maxColumnsOverride } = options;
    const sectionHeightCap = resolveSectionHeightCapPx();
    const classNames = filters.map((filter) => filter.key);
    const filterByClassName = Object.fromEntries(filters.map((filter) => [filter.key, filter]));
    const getLayoutMeasureType = (className) =>
      String(filterByClassName[className]?.type || type || "attributes").toLowerCase();
    const numericMaxColumnsOverride = Number(maxColumnsOverride);
    const resolvedLayoutColumnCap =
      Number.isFinite(numericMaxColumnsOverride) && numericMaxColumnsOverride > 0
        ? Math.max(1, Math.floor(numericMaxColumnsOverride))
        : resolvedSectionColumnCap;
    const resolvedSectionMaxColumns =
      isPerCardColumnLayout && !isCompactPlusDensity ? Math.max(1, classNames.length) : resolvedLayoutColumnCap;
    const measuredCardHeightByClass = Object.fromEntries(
      classNames.map((className) => [
        className,
        cardNaturalHeightByKey[getCardMeasureKey(getLayoutMeasureType(className), className)],
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
      naturalGapPx: isCompactPlusDensity ? stackGapPx : NATURAL_STACK_GAP_PX,
      maxColumns: resolvedSectionMaxColumns,
      categoryMaxHeight: sectionHeightCap,
      cardBottomMargin: CARD_BOTTOM_MARGIN,
      rowHeightEstimate: ROW_HEIGHT_ESTIMATE,
      cardOverheadEstimate: CARD_OVERHEAD_ESTIMATE,
      stackableCardMaxHeight: FILTER_CARD_MAX_HEIGHT_PX,
      allowNonContiguousPacking: isCompactPlusDensity,
      slackDistributionMode,
    });
    const { scrollableCardStretchByClass } = sectionLayout;

    if (!isPerCardColumnLayout || isCompactPlusDensity) {
      return {
        ...sectionLayout,
        sectionHeightCap,
        // In compact-plus, supply stretch targets for scrollable cards so they
        // fill column slack up to the section cap. cardMarginBottomByClass is
        // cleared because Masonry handles column spacing via flex gap.
        // The measurement hook skips re-measuring cards that carry
        // data-card-height-override, so natural heights are preserved and the
        // layout converges within 2 passes.
        ...(isCompactPlusDensity
          ? {
              cardHeightOverrideByClass: scrollableCardStretchByClass,
              cardMarginBottomByClass: {},
            }
          : {}),
      };
    }

    const perCardColumnGroups = classNames.map((className) => [className]);
    const perCardMarginBottomByClass = Object.fromEntries(classNames.map((className) => [className, 0]));
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
  const getFilterGridSx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => ({
    "--filter-section-height": toSectionHeightPx(0, sectionHeightCap),
    "--filter-section-height-cap": `${resolveSectionHeightCapPx(sectionHeightCap)}px`,
    "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(sectionHeightCap)}px`,
    m: 0,
    width: "auto",
    maxWidth: "none",
    alignContent: "flex-start",
    "& > .filter-section-column": {
      display: "block",
      minWidth: 0,
      breakInside: "avoid",
      pageBreakInside: "avoid",
      WebkitColumnBreakInside: "avoid",
      boxSizing: "border-box",
    },
  });
  const getFilterGridColumnCount = (filterCount, filterSetId = "") => {
    const normalizedFilterCount = Math.max(1, Number(filterCount) || 1);
    const sectionColumnCaps = getFilterSetCardColumnsByBreakpoint(filterSetId, normalizedFilterCount, {
      isSmUp,
      isMdUp,
      isLgUp,
      isXlUp,
    });
    if (isPerCardColumnLayout && !isCompactPlusDensity) {
      return sectionColumnCaps;
    }
    return Math.min(sectionColumnCaps, Math.max(1, Number(resolvedSectionColumnCap) || 1));
  };
  const getFilterSectionColumnSx = (span = null) => {
    void span;
    return {
      minWidth: 0,
    };
  };
  const getCardSx = (cardIndex = 0) => {
    void cardIndex;
    const base = {
      width: "100%",
      display: "inline-block",
      verticalAlign: "top",
      breakInside: "avoid",
      mb: 0,
      position: "relative",
      overflow: "hidden",
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
  const getFilterSetLaneSx = (kind = "attributes") => {
    const laneColor =
      kind === "omop"
        ? activeTheme.palette.primary.main
        : activeTheme.palette.secondary?.main || activeTheme.palette.primary.main;
    const laneTintOpacity = activeTheme.palette.mode === "dark" ? 0.05 : 0.025;
    const laneRuleOpacity = activeTheme.palette.mode === "dark" ? 0.62 : 0.44;

    return {
      minWidth: 0,
      position: "relative",
      pl: isCompactDensity ? 0.75 : 1,
      pr: isCompactDensity ? 0.25 : 0.5,
      py: isCompactDensity ? 0.25 : 0.5,
      borderLeft: "2px solid",
      borderLeftColor: alpha(laneColor, laneRuleOpacity),
      background: `linear-gradient(90deg, ${alpha(laneColor, laneTintOpacity)} 0, ${alpha(laneColor, 0)} 40px)`,
      breakInside: "avoid",
      pageBreakInside: "avoid",
      WebkitColumnBreakInside: "avoid",
      boxSizing: "border-box",
      "& .filter-set > h2": {
        minHeight: isCompactDensity ? 18 : 22,
        lineHeight: 1.15,
        mb: isCompactDensity ? 0.25 : 0.5,
        color: "text.secondary",
      },
      "& .filter-card-open-button": {
        borderColor: alpha(laneColor, activeTheme.palette.mode === "dark" ? 0.38 : 0.28),
      },
    };
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
  // Helper: render the inner attribute cards (the children of the
  // .filter-section-grid Box) for a given attribute filter-set. Used both by
  // renderAttributeFilterSet (which wraps these in a Stack with its own
  // header) and by the omop renderer when injecting cohort-overview attribute
  // filters inline into a sibling omop section's grid.
  const renderAttributeFilterCards = (filterSet, keyPrefix, options = {}) => {
    const { sectionHeightCap: overrideSectionHeightCap } = options;
    const renderedFilters = filterSet.filters;
    const classChartDataByClass = {};
    renderedFilters.forEach((filter) => {
      const className = filter.key;
      const filterType = String(filter.type || "attributes").toLowerCase();
      if (filterType === "concepts") {
        const classData = conceptDisplayChartDataByClass[className] || [];
        classChartDataByClass[className] = conceptChartDataWithIncludedByClass[className] || classData;
      } else {
        const classData = attributeDisplayChartDataByClass[className] || [];
        classChartDataByClass[className] = attributeChartDataWithIncludedByClass[className] || classData;
      }
    });
    const layoutColumnCap = getFilterGridColumnCount(renderedFilters.length, filterSet.id);
    const {
      columnGroups,
      measuredCardHeightByClass,
      cardHeightOverrideByClass,
      cardMarginBottomByClass,
      sectionHeightCap: computedSectionHeightCap,
    } = buildSectionLayout("attributes", renderedFilters, classChartDataByClass, {
      maxColumns: layoutColumnCap,
    });
    const sectionHeightCap = overrideSectionHeightCap ?? computedSectionHeightCap;
    const filterByClassName = Object.fromEntries(renderedFilters.map((filter) => [filter.key, filter]));
    const orderedClassNames = renderedFilters.map((filter) => filter.key);

    const renderAttributeCard = (className, classIndex) => {
      const filter = filterByClassName[className];
      if (!filter) {
        return null;
      }
      const filterType = String(filter.type || "attributes").toLowerCase();
      const isConcept = filterType === "concepts";
      const classError = isConcept
        ? conceptData.errorsByClass[className] || ""
        : attributeData.errorsByClass[className] || "";
      const classChartData = classChartDataByClass[className] || [];
      const classDisplayName = filter.displayName || getFilterDisplayName(filterType, className);
      const selectedValuesForClass = isConcept
        ? selectedConceptValuesByClass[className] || []
        : selectedAttributeValuesByClass[className] || [];
      const onSelectionChangeForClass = handleSelectionChange(
        isConcept ? setSelectedConceptValuesByClass : setSelectedAttributeValuesByClass,
        className
      );
      const sortMode = isConcept
        ? conceptSortModeByClass[className] || getFilterDefaultSortMode("concepts", className)
        : attributeSortModeByClass[className] || getFilterDefaultSortMode("attributes", className);
      const customSortOrder = getCustomSortOrderForDensity(filterType, className);
      const classChartDataForRender = getChartDataForDensity(classChartData, filterType, className);
      const selectedCount = selectedValuesForClass.length;
      const cardHeightOverride = cardHeightOverrideByClass[className];
      const measuredCardHeight = Number(measuredCardHeightByClass[className]) || 0;
      const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
      const configuredCardHeightCapPx = getFilterMaxHeightPx("attributes", className);
      const resolvedCardHeightCapPx = Math.min(
        FILTER_CARD_MAX_HEIGHT_PX,
        configuredCardHeightCapPx == null
          ? resolvedSectionHeightCapPx
          : Math.min(resolvedSectionHeightCapPx, configuredCardHeightCapPx)
      );
      const requestedCardHeightOverride = Math.max(0, Number(cardHeightOverride) || 0);
      const cardMarginBottom = Math.max(0, Number(cardMarginBottomByClass[className]) || 0);
      const rowCount = classChartData.length;
      const estimatedCardHeight = estimateCardHeight(rowCount, ROW_HEIGHT_ESTIMATE, CARD_OVERHEAD_ESTIMATE);
      const shouldStretchScrollableCard = isCompactPlusDensity && estimatedCardHeight > resolvedCardHeightCapPx;
      // Only include the stretch override once a real measurement exists.
      // Before measurement (measuredCardHeight === 0) the override is derived from
      // estimates and can be hundreds of pixels too large; applying minHeight on
      // that first pass makes the DOM report the inflated estimate back as the
      // "natural" height, which then feeds a different layout, causing oscillation.
      const stretchedCardHeightCapPx = shouldStretchScrollableCard
        ? Math.min(
            resolvedSectionHeightCapPx,
            Math.max(resolvedCardHeightCapPx, measuredCardHeight > 0 ? requestedCardHeightOverride : 0)
          )
        : resolvedCardHeightCapPx;
      const boundedCardHeightOverride = Math.min(stretchedCardHeightCapPx, requestedCardHeightOverride);
      const canApplyCardHeightOverride = boundedCardHeightOverride > 0 && measuredCardHeight > 0;
      const shouldApplyCardHeightOverride =
        canApplyCardHeightOverride && (!isCompactPlusDensity || shouldStretchScrollableCard);
      const packedSpan = resolvePackedGridSpan({
        displayName: classDisplayName,
        rowCount,
      });
      const cardOuterStyle = {
        "--filter-section-height-cap": `${stretchedCardHeightCapPx}px`,
        "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(stretchedCardHeightCapPx)}px`,
        maxHeight: `${stretchedCardHeightCapPx}px`,
        ...(shouldStretchScrollableCard
          ? { minHeight: `${Math.round(stretchedCardHeightCapPx)}px` }
          : shouldApplyCardHeightOverride
          ? { minHeight: `${Math.round(boundedCardHeightOverride)}px` }
          : {}),
      };

      return (
        <Box
          key={`${keyPrefix}:${filterSet.id}:${className}`}
          className="filter-section-column"
          sx={getFilterSectionColumnSx(packedSpan)}
        >
          <FilterSectionCard
            classNameKey={className}
            classDisplayName={classDisplayName}
            classError={classError}
            sortMode={sortMode}
            density={isCompactDensity ? "compact" : "standard"}
            data={classChartDataForRender}
            selectedValues={selectedValuesForClass}
            selectedCount={selectedCount}
            onSelectionChange={onSelectionChangeForClass}
            onRowToggleExpand={isConcept ? undefined : handleAttributeParentExpansionChange(className)}
            fontScale={fontScale}
            customSortOrder={customSortOrder}
            inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
            getPatientSummary={getPatientSummary}
            onOpenFilterModal={handleOpenFilterModal}
            filterType={filterType}
            measureRef={setCardMeasureRef(filterType, className)}
            cardOuterStyle={cardOuterStyle}
            cardMarginBottom={cardMarginBottom}
            cardHeightCapPx={stretchedCardHeightCapPx}
            cardHeightOverride={shouldApplyCardHeightOverride ? Math.round(boundedCardHeightOverride) : undefined}
            cardSx={getCardSx(classIndex)}
            contentAreaSx={getCardContentAreaSx(sectionHeightCap)}
            isCompactDensity={isCompactDensity}
          />
        </Box>
      );
    };

    const renderedCardsByClassName = new Map(
      orderedClassNames.map((className, classIndex) => [className, renderAttributeCard(className, classIndex)])
    );

    if (isCompactPlusDensity) {
      return columnGroups.map((group, groupIndex) => (
        <Box
          key={`${keyPrefix}:${filterSet.id}:compact-plus-column-${groupIndex}`}
          className="filter-section-column filter-section-column-group"
          data-compact-plus-column="true"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: FILTER_PANEL_SPACING_UNITS,
            minWidth: 0,
          }}
        >
          {group.map((className) => renderedCardsByClassName.get(className))}
        </Box>
      ));
    }

    return orderedClassNames.map((className) => renderedCardsByClassName.get(className));
  };

  const renderOmopFilterSet = (filterSet, keyPrefix = "omop", { inlineAttributeFilterSets = [] } = {}) => {
    const renderedFilters = filterSet.filters;
    const sectionHasData = renderedFilters.some((filter) => {
      const className = filter.key;
      const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
      const classData =
        isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
          ? ageAtDxDecileChartData
          : chartDataByClass[className] || [];
      const classChartData = omopChartDataWithIncludedByClass[className] || classData;
      return Array.isArray(classChartData) && classChartData.length > 0;
    });
    const classChartDataByClass = {};
    renderedFilters.forEach((filter) => {
      const className = filter.key;
      const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
      const classData =
        isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
          ? ageAtDxDecileChartData
          : chartDataByClass[className] || [];
      classChartDataByClass[className] = omopChartDataWithIncludedByClass[className] || classData;
    });
    const omopLayoutColumnCap = getFilterGridColumnCount(renderedFilters.length, filterSet.id);
    const {
      columnGroups,
      measuredCardHeightByClass,
      cardHeightOverrideByClass,
      cardMarginBottomByClass,
      sectionHeight,
      sectionHeightCap,
    } = buildSectionLayout("omop", renderedFilters, classChartDataByClass, {
      maxColumns: omopLayoutColumnCap,
    });
    const filterByClassName = Object.fromEntries(renderedFilters.map((filter) => [filter.key, filter]));
    const orderedClassNames = renderedFilters.map((filter) => filter.key);
    const shouldStackEthnicityUnderGender =
      !isCompactPlusDensity &&
      filterSet.id === "demographics" &&
      orderedClassNames.includes("GENDER") &&
      orderedClassNames.includes("ETHNICITY");
    const injectedAttributeCardCount = inlineAttributeFilterSets.reduce(
      (sum, attributeFilterSet) => sum + (attributeFilterSet.filters?.length || 0),
      0
    );
    const omopGridItemCount = shouldStackEthnicityUnderGender
      ? Math.max(1, renderedFilters.length - 1)
      : Math.max(1, renderedFilters.length);
    const compactPlusOmopGridItemCount = isCompactPlusDensity ? Math.max(1, columnGroups.length) : omopGridItemCount;
    const totalGridItemCount = Math.max(1, compactPlusOmopGridItemCount + injectedAttributeCardCount);

    const renderOmopFilterCard = (className, classIndex, cardKeyPrefix = "") => {
      const filter = filterByClassName[className];
      if (!filter) {
        return null;
      }
      const classError = omopData.errorsByClass[className] || "";
      const classChartData = classChartDataByClass[className] || [];
      const classDisplayName = filter.displayName || getFilterDisplayName("omop", className);
      const selectedValuesForClass = selectedOmopValuesByClass[className] || [];
      const onSelectionChangeForClass = handleSelectionChange(setSelectedOmopValuesByClass, className);
      const sortMode = omopSortModeByClass[className] || getFilterDefaultSortMode("omop", className);
      const customSortOrder = getCustomSortOrderForDensity("omop", className);
      const classChartDataForRender = getChartDataForDensity(classChartData, "omop", className);
      const selectedCount = selectedValuesForClass.length;
      const cardHeightOverride = cardHeightOverrideByClass[className];
      const measuredCardHeight = Number(measuredCardHeightByClass[className]) || 0;
      const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
      const configuredCardHeightCapPx = getFilterMaxHeightPx("omop", className);
      const resolvedCardHeightCapPx = Math.min(
        FILTER_CARD_MAX_HEIGHT_PX,
        configuredCardHeightCapPx == null
          ? resolvedSectionHeightCapPx
          : Math.min(resolvedSectionHeightCapPx, configuredCardHeightCapPx)
      );
      const requestedCardHeightOverride = Math.max(0, Number(cardHeightOverride) || 0);
      const cardMarginBottom = Math.max(0, Number(cardMarginBottomByClass[className]) || 0);
      const rowCount = classChartData.length;
      const estimatedCardHeight = estimateCardHeight(rowCount, ROW_HEIGHT_ESTIMATE, CARD_OVERHEAD_ESTIMATE);
      const shouldStretchScrollableCard = isCompactPlusDensity && estimatedCardHeight > resolvedCardHeightCapPx;
      const stretchedCardHeightCapPx = shouldStretchScrollableCard
        ? Math.min(
            resolvedSectionHeightCapPx,
            Math.max(resolvedCardHeightCapPx, measuredCardHeight > 0 ? requestedCardHeightOverride : 0)
          )
        : resolvedCardHeightCapPx;
      const boundedCardHeightOverride = Math.min(stretchedCardHeightCapPx, requestedCardHeightOverride);
      const canApplyCardHeightOverride = boundedCardHeightOverride > 0 && measuredCardHeight > 0;
      const shouldApplyCardHeightOverride =
        canApplyCardHeightOverride && (!isCompactPlusDensity || shouldStretchScrollableCard);
      const cardOuterStyle = {
        "--filter-section-height-cap": `${stretchedCardHeightCapPx}px`,
        "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(stretchedCardHeightCapPx)}px`,
        maxHeight: `${stretchedCardHeightCapPx}px`,
        ...(shouldStretchScrollableCard
          ? { minHeight: `${Math.round(stretchedCardHeightCapPx)}px` }
          : shouldApplyCardHeightOverride
          ? { minHeight: `${Math.round(boundedCardHeightOverride)}px` }
          : {}),
      };
      return (
        <FilterSectionCard
          key={`${cardKeyPrefix}${keyPrefix}:${filterSet.id}:${className}`}
          classNameKey={className}
          classDisplayName={classDisplayName}
          classError={classError}
          sortMode={sortMode}
          density={isCompactDensity ? "compact" : "standard"}
          data={classChartDataForRender}
          selectedValues={selectedValuesForClass}
          selectedCount={selectedCount}
          onSelectionChange={onSelectionChangeForClass}
          fontScale={fontScale}
          customSortOrder={customSortOrder}
          inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
          getPatientSummary={getPatientSummary}
          onOpenFilterModal={handleOpenFilterModal}
          filterType="omop"
          measureRef={setCardMeasureRef("omop", className)}
          cardOuterStyle={cardOuterStyle}
          cardMarginBottom={cardMarginBottom}
          cardHeightCapPx={stretchedCardHeightCapPx}
          cardHeightOverride={shouldApplyCardHeightOverride ? Math.round(boundedCardHeightOverride) : undefined}
          cardSx={getCardSx(classIndex)}
          contentAreaSx={getCardContentAreaSx(sectionHeightCap)}
          isCompactDensity={isCompactDensity}
        />
      );
    };

    const omopGridColumns = getFilterGridColumnCount(totalGridItemCount, filterSet.id);
    const renderedOmopCardsByClassName = new Map(
      orderedClassNames.map((className, classIndex) => [className, renderOmopFilterCard(className, classIndex)])
    );
    const compactPlusOmopColumns = isCompactPlusDensity
      ? columnGroups.map((group, groupIndex) => (
          <Box
            key={`${keyPrefix}:${filterSet.id}:compact-plus-column-${groupIndex}`}
            className="filter-section-column filter-section-column-group"
            data-compact-plus-column="true"
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: FILTER_PANEL_SPACING_UNITS,
              minWidth: 0,
            }}
          >
            {group.map((className) => renderedOmopCardsByClassName.get(className))}
          </Box>
        ))
      : null;

    return (
      <Stack
        key={`${keyPrefix}:${filterSet.id}`}
        spacing={FILTER_PANEL_SPACING_UNITS}
        className="filter-set"
        data-section-height-cap={sectionHeightCap}
        sx={getFilterSetSx(sectionHeight, sectionHeightCap)}
      >
        <Typography component="h2" variant="caption" sx={FILTER_SECTION_LABEL_SX}>
          {filterSet.label}
        </Typography>
        {cohortSize > 0 && sectionHasData ? (
          <Typography variant="caption" color="text.secondary">
            Showing filter values for {cohortSize.toLocaleString()} matched patient
            {cohortSize === 1 ? "" : "s"}
          </Typography>
        ) : null}
        <Masonry
          className="filter-section-grid"
          data-column-cap={JSON.stringify(omopGridColumns)}
          data-section-height-cap={sectionHeightCap}
          columns={omopGridColumns}
          spacing={FILTER_PANEL_SPACING_UNITS}
          sx={getFilterGridSx(sectionHeightCap)}
        >
          {compactPlusOmopColumns ||
            orderedClassNames.map((className, classIndex) => {
              if (shouldStackEthnicityUnderGender && className === "ETHNICITY") {
                return null;
              }
              const stackedEthnicityCard = shouldStackEthnicityUnderGender && className === "GENDER";
              return (
                <Box
                  key={`${keyPrefix}:${filterSet.id}:${className}`}
                  className="filter-section-column"
                  sx={{
                    ...getFilterSectionColumnSx(1),
                    display: "flex",
                    flexDirection: "column",
                    gap: stackedEthnicityCard ? FILTER_PANEL_SPACING_UNITS : 0,
                  }}
                >
                  {renderOmopFilterCard(className, classIndex)}
                  {stackedEthnicityCard ? renderOmopFilterCard("ETHNICITY", classIndex + 0.25, "stacked:") : null}
                </Box>
              );
            })}
          {inlineAttributeFilterSets.flatMap((attributeFilterSet) =>
            renderAttributeFilterCards(attributeFilterSet, `cohort-inline:${filterSet.id}`, {
              sectionHeightCap,
            })
          )}
        </Masonry>
      </Stack>
    );
  };

  const renderAttributeFilterSet = (filterSet, keyPrefix = "attributes") => {
    const renderedFilters = filterSet.filters;
    const sectionHasData = renderedFilters.some((filter) => {
      const className = filter.key;
      const isConcept = String(filter.type || "").toLowerCase() === "concepts";
      const classChartData = isConcept
        ? conceptChartDataWithIncludedByClass[className] || conceptDisplayChartDataByClass[className] || []
        : attributeChartDataWithIncludedByClass[className] || attributeDisplayChartDataByClass[className] || [];
      return Array.isArray(classChartData) && classChartData.length > 0;
    });
    const classChartDataByClass = {};
    renderedFilters.forEach((filter) => {
      const className = filter.key;
      const isConcept = String(filter.type || "").toLowerCase() === "concepts";
      if (isConcept) {
        const classData = conceptDisplayChartDataByClass[className] || [];
        classChartDataByClass[className] = conceptChartDataWithIncludedByClass[className] || classData;
      } else {
        const classData = attributeDisplayChartDataByClass[className] || [];
        classChartDataByClass[className] = attributeChartDataWithIncludedByClass[className] || classData;
      }
    });
    const attributeGridColumns = getFilterGridColumnCount(renderedFilters.length, filterSet.id);
    const { sectionHeight, sectionHeightCap } = buildSectionLayout(
      "attributes",
      renderedFilters,
      classChartDataByClass,
      { maxColumns: attributeGridColumns }
    );

    return (
      <Box
        key={`${keyPrefix}:${filterSet.id}`}
        className="filter-set"
        data-section-height-cap={sectionHeightCap}
        sx={{
          ...getFilterSetSx(sectionHeight, sectionHeightCap),
          minWidth: 0,
        }}
      >
        <Typography component="h2" variant="caption" sx={FILTER_SECTION_LABEL_SX}>
          {filterSet.label}
        </Typography>
        {!isCompactDensity && cohortSize > 0 && sectionHasData ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Showing filter values for {cohortSize.toLocaleString()} matched patient
            {cohortSize === 1 ? "" : "s"}
          </Typography>
        ) : null}
        <Masonry
          className="filter-section-grid"
          data-column-cap={JSON.stringify(attributeGridColumns)}
          data-section-height-cap={sectionHeightCap}
          columns={attributeGridColumns}
          spacing={FILTER_PANEL_SPACING_UNITS}
          sx={getFilterGridSx(sectionHeightCap)}
        >
          {renderAttributeFilterCards(filterSet, keyPrefix, { sectionHeightCap })}
        </Masonry>
      </Box>
    );
  };

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
            <FiltersToolbar
              spacingUnits={FILTER_PANEL_SPACING_UNITS}
              fontScalePercentLabel={fontScalePercentLabel}
              canDecreaseFontScale={canDecreaseFontScale}
              canIncreaseFontScale={canIncreaseFontScale}
              onChangeFontScale={handleFontScaleChange}
              highContrast={highContrast}
              onToggleHighContrast={handleHighContrastToggle}
              reducedMotion={reducedMotion}
              onToggleReducedMotion={handleReducedMotionToggle}
              onResetAllFilters={handleResetAllFilters}
              canResetAllFilters={canResetAllFilters}
              filterLayoutToggleTooltip={filterLayoutToggleTooltip}
              isPerCardColumnLayout={isPerCardColumnLayout}
              onToggleFilterLayout={toggleFilterLayoutMode}
              filterPanelDensityMode={filterPanelDensityMode}
              onChangeFilterPanelDensityMode={handleFilterPanelDensityModeChange}
              isCompactPlusDensity={isCompactPlusDensity}
              stackGapPx={stackGapPx}
              onChangeStackGapPx={handleStackGapChange}
              slackDistributionMode={slackDistributionMode}
              onChangeSlackDistributionMode={handleSlackModeChange}
              themeKey={themeKey}
              onChangeTheme={handleThemeChange}
              getToggleButtonSx={getToggleButtonSx}
              themeEditorMenuValue={THEME_EDITOR_MENU_VALUE}
            />

            {shouldShowFilterLoadingState ? (
              <Typography variant="body2" color="text.secondary">
                Loading filters...
              </Typography>
            ) : null}

            {rootError ? <Alert severity="error">{rootError}</Alert> : null}
            {attributeRootError ? <Alert severity="error">{attributeRootError}</Alert> : null}
            {conceptRootError ? <Alert severity="error">{conceptRootError}</Alert> : null}

            {canRenderFilterSections ? (
              filterSectionsForDisplay.length > 0 ? (
                <Masonry
                  className="filter-set-layout-masonry"
                  columns={resolvedFilterSectionLayoutColumns}
                  spacing={FILTER_PANEL_SPACING_UNITS}
                  sequential
                  sx={{
                    m: 0,
                    width: "100%",
                    maxWidth: "100%",
                    alignContent: "flex-start",
                    "& > .filter-set-layout-item": {
                      minWidth: 0,
                      breakInside: "avoid",
                      pageBreakInside: "avoid",
                      WebkitColumnBreakInside: "avoid",
                    },
                  }}
                >
                  {filterSectionsForDisplay.map(({ id, kind, filterSet }) => {
                    const shouldInjectInlineAttributes =
                      kind === "omop" && filterSet.id === "cancer-type" && shouldInjectCohortOverviewAttributes;
                    return (
                      <Box
                        key={`${kind}:${id}`}
                        className="filter-set-layout-item filter-domain-lane"
                        data-filter-set-id={id}
                        data-filter-set-kind={kind}
                        sx={getFilterSetLaneSx(kind)}
                      >
                        {kind === "omop"
                          ? renderOmopFilterSet(filterSet, "omop", {
                              inlineAttributeFilterSets: shouldInjectInlineAttributes
                                ? cohortOverviewInlineAttributeFilterSets
                                : [],
                            })
                          : renderAttributeFilterSet(filterSet, "attributes")}
                      </Box>
                    );
                  })}
                </Masonry>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No filter classes returned.
                </Typography>
              )
            ) : null}
            <PatientDrawer
              isVisible={isPatientGridDockVisible}
              isMaximized={isPatientGridDockMaximized}
              isExpanded={isPatientGridDockExpanded}
              filterSummaryText={patientGridDrawerFilterSummaryText}
              activeDrawerTab={activeDrawerTab}
              setActiveDrawerTab={setActiveDrawerTab}
              openPatientIds={openPatientIds}
              cohortSize={cohortSize}
              onClosePatientTab={handleClosePatientTab}
              panelId={patientGridDrawerPanelId}
              patientGridRows={patientGridRows}
              totalPatientGridPages={totalPatientGridPages}
              currentPatientGridPage={currentPatientGridPage}
              pageSize={patientGridPageSize}
              onPageChange={setCurrentPatientGridPage}
              isTableLoading={patientGridDrawerTableLoading}
              pageError={patientGridPageError}
              onRetryPatientSummary={handleRetryPatientSummary}
              statusText={patientGridDrawerStatusText}
              collapsedHeaderSummary={patientGridCollapsedHeaderSummary}
              onOpenPatientTab={handleOpenPatientTab}
              setIsExpanded={setIsPatientGridDockExpanded}
              setIsMaximized={setIsPatientGridDockMaximized}
            />
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
                          const hasEntryOverride = typeof overriddenValue === "string" && overriddenValue.length > 0;

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
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  alignItems={{ sm: "center" }}
                                >
                                  {colorPickerValue ? (
                                    <TextField
                                      size="small"
                                      type="color"
                                      label="Pick"
                                      value={colorPickerValue}
                                      onChange={(event) => handleThemeBuilderEntryChange(entry, event.target.value)}
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
                                    onChange={(event) => handleThemeBuilderEntryChange(entry, event.target.value)}
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
                      title={activeFilterSortDirection === FILTER_SORT_DIRECTION.ASC ? "Ascending" : "Descending"}
                    >
                      <IconButton
                        onClick={handleModalSortDirectionToggle}
                        aria-label={
                          activeFilterSortDirection === FILTER_SORT_DIRECTION.ASC ? "Sort ascending" : "Sort descending"
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
                            ? handleSelectionChange(setSelectedAttributeValuesByClass, activeFilterDetail.className)
                            : activeFilterDetail.type === "concepts"
                            ? handleSelectionChange(setSelectedConceptValuesByClass, activeFilterDetail.className)
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
                          ? getCustomSortOrderForDensity(activeFilterDetail.type, activeFilterDetail.className)
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
