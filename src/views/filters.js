import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  CssBaseline,
  FormControl,
  GlobalStyles,
  IconButton,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ThemeProvider,
  alpha,
  createTheme,
  darken,
  getContrastRatio,
  lighten,
  useTheme,
} from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ContrastIcon from "@mui/icons-material/Contrast";
import MotionPhotosOffIcon from "@mui/icons-material/MotionPhotosOff";
import RemoveIcon from "@mui/icons-material/Remove";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import TuneIcon from "@mui/icons-material/Tune";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link as RouterLink } from "react-router-dom";
import { getSummary as getOmopSummary } from "../controllers/omap";
import { getSummary as getAttributesSummary } from "../controllers/attributes";
import {
  fetchDeepPheFilterCount,
  fetchDeepPheFilterSummary,
  fetchPatientDocuments,
} from "../clients/deepphe-data-api";
import HorizontalBarChart from "../components/HorizontalBarChart";
import PatientGrid from "../components/PatientGrid";
import AccessibilityBadge from "../components/AccessibilityBadge";
import { useBatchDataLoader } from "../hooks/useBatchDataLoader";
import { MONOSPACE_STACK, THEME_OPTIONS, getThemeByKey } from "../themes";
import { getAgeDecileLabel } from "../utils/dataProcessing";
import { toDisplayName } from "../utils/displayNames";
import {
  FILTER_ENTRY_BY_TYPE_CLASS,
  MIN_ROWS_FOR_DISTRIBUTION,
  resolveFilterSetsWithExtras,
} from "./filterSets";
import {
  buildChildChartData,
  buildRollupInstanceMap,
  buildRolledUpChartData,
  hasRollup,
  isExpandable,
  resolveRollupSelections,
} from "./rollup";

const SLOW_QUERY_THRESHOLD_MS = 100;
const PATIENT_GRID_PAGE_SIZE = 20;
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
const CARD_HEIGHT_MODE = {
  NORMALIZE: "normalize",
  FIT: "fit",
};
const NORMALIZED_CARD_MIN_HEIGHT = 180;
const NORMALIZED_CARD_MAX_HEIGHT = 320;
const NORMALIZED_CHART_HEIGHT_OFFSET = 88;
const CONTEXT_HEADER_SX = { fontWeight: 700, letterSpacing: 0.2 };
const CHART_SORT_MODES = ["value-desc", "value-asc", "alpha-asc", "alpha-desc"];
const DEFAULT_CHART_SORT_MODE = "value-desc";

const THEME_STORAGE_KEY = "filterPageTheme";
const FONT_SCALE_STORAGE_KEY = "filterPageFontScale";
const FONT_FAMILY_STORAGE_KEY = "filterPageFontFamily";
const HIGH_CONTRAST_STORAGE_KEY = "filterPageHighContrast";
const REDUCED_MOTION_STORAGE_KEY = "filterPageReducedMotion";
const FONT_SCALE_OPTIONS = [0.75, 0.9, 1, 1.1, 1.25, 1.5];
const FONT_FAMILY_OPTIONS = [
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
  return "solstice";
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
  return "theme-default";
}

function getInitialBooleanPref(storageKey) {
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    // localStorage unavailable
  }
  return false;
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
    getFilterEntry(type, className)?.defaultSortMode || DEFAULT_CHART_SORT_MODE
  );
}

function getFilterCustomSortOrder(type, className) {
  const configuredOrder = getFilterEntry(type, className)?.customSortOrder;
  return Array.isArray(configuredOrder) ? configuredOrder : [];
}

function resolveDisplayMode(filterEntry, chartData) {
  if (filterEntry?.hasRollup) {
    return "distribution";
  }

  const mode = String(filterEntry?.displayMode || "auto").trim().toLowerCase();
  if (mode === "distribution" || mode === "compact") {
    return mode;
  }

  const rowCount = Array.isArray(chartData) ? chartData.length : 0;
  return rowCount >= MIN_ROWS_FOR_DISTRIBUTION ? "distribution" : "compact";
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

  const noun = safeCount === 1 ? "patient" : "patients";
  const verb = safeCount === 1 ? "is" : "are";
  const subjectText = subjectDescriptors.length > 0 ? `${subjectDescriptors.join(" ")} ${noun}` : noun;

  if (conditionClauses.length === 0) {
    return `There ${verb} ${safeCount.toLocaleString()} ${subjectText} in the cohort.`;
  }

  return `There ${verb} ${safeCount.toLocaleString()} ${subjectText} in the cohort with ${joinCohortConditions(
    conditionClauses
  )}.`;
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
  if (CHART_SORT_MODES.includes(normalizedSortMode)) {
    return normalizedSortMode;
  }
  return DEFAULT_CHART_SORT_MODE;
}

function normalizeCustomSortToken(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function createCustomSortIndexMap(customSortOrder) {
  if (!Array.isArray(customSortOrder) || customSortOrder.length === 0) {
    return null;
  }

  const indexMap = new Map();
  customSortOrder.forEach((value, index) => {
    const token = normalizeCustomSortToken(value);
    if (!token || indexMap.has(token)) {
      return;
    }
    indexMap.set(token, index);
  });

  return indexMap.size > 0 ? indexMap : null;
}

function compareByCustomSortOrder(leftLabel, rightLabel, sortMode, customSortIndexMap) {
  if (!customSortIndexMap || !String(sortMode).startsWith("alpha")) {
    return null;
  }

  const leftIndex = customSortIndexMap.get(normalizeCustomSortToken(leftLabel));
  const rightIndex = customSortIndexMap.get(normalizeCustomSortToken(rightLabel));
  const leftKnown = Number.isFinite(leftIndex);
  const rightKnown = Number.isFinite(rightIndex);

  if (leftKnown && rightKnown && leftIndex !== rightIndex) {
    return sortMode === "alpha-desc" ? rightIndex - leftIndex : leftIndex - rightIndex;
  }

  if (leftKnown !== rightKnown) {
    return leftKnown ? -1 : 1;
  }

  return null;
}

function compareFacetRows(leftItem, rightItem, sortMode, customSortIndexMap) {
  const leftLabel = String(leftItem?.label || "").trim();
  const rightLabel = String(rightItem?.label || "").trim();
  const leftValue = Number(leftItem?.value);
  const rightValue = Number(rightItem?.value);

  const labelComparison = leftLabel.localeCompare(rightLabel, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  const customComparison = compareByCustomSortOrder(
    leftLabel,
    rightLabel,
    sortMode,
    customSortIndexMap
  );
  if (customComparison !== null) {
    return customComparison;
  }

  if (sortMode === "alpha-asc") {
    return labelComparison;
  }
  if (sortMode === "alpha-desc") {
    return -labelComparison;
  }
  if (sortMode === "value-asc") {
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
    return labelComparison;
  }

  if (leftValue !== rightValue) {
    return rightValue - leftValue;
  }
  return labelComparison;
}

function sortFacetRows(data, sortMode = DEFAULT_CHART_SORT_MODE, customSortOrder = []) {
  const normalizedSortMode = normalizeChartSortMode(sortMode);
  const customSortIndexMap = createCustomSortIndexMap(customSortOrder);

  return (Array.isArray(data) ? data : [])
    .map((item) => {
      const label = String(item?.displayLabel ?? item?.label ?? "").trim();
      const value = Number(item?.value);
      const includedValue = Number(item?.includedValue);
      const rowLabel = String(item?.label ?? item?.displayLabel ?? "").trim();

      return {
        label,
        rowLabel,
        value: Number.isFinite(value) ? value : 0,
        includedValue: Number.isFinite(includedValue) ? includedValue : null,
      };
    })
    .filter((item) => item.label)
    .sort((leftItem, rightItem) =>
      compareFacetRows(leftItem, rightItem, normalizedSortMode, customSortIndexMap)
    );
}

function buildDistributionSeries(
  data,
  sortMode = DEFAULT_CHART_SORT_MODE,
  maxBars = 28,
  customSortOrder = []
) {
  const rows = sortFacetRows(data, sortMode, customSortOrder).filter((item) => item.value > 0);
  if (rows.length === 0) {
    return [];
  }

  return rows.slice(0, Math.max(1, maxBars)).map((item) => item.value);
}

function DistributionStrip({ data, sortMode = DEFAULT_CHART_SORT_MODE, customSortOrder = [] }) {
  const series = useMemo(
    () => buildDistributionSeries(data, sortMode, 28, customSortOrder),
    [customSortOrder, data, sortMode]
  );

  if (series.length === 0) {
    return null;
  }

  const maxValue = Math.max(...series, 1);

  return (
    <Box
      aria-hidden="true"
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: 0.25,
        height: 22,
        width: { xs: 84, md: 108 },
        ml: "auto",
        flexShrink: 0,
      }}
    >
      {series.map((value, index) => {
        const ratio = value / maxValue;

        return (
          <Box
            key={`${value}-${index}`}
            sx={{
              flex: "1 1 0",
              minWidth: 2,
              height: `${Math.max(10, Math.round(ratio * 100))}%`,
              borderRadius: 0.5,
              bgcolor: "primary.main",
              opacity: 0.25 + ratio * 0.65,
            }}
          />
        );
      })}
    </Box>
  );
}

function formatCompactCountLabel(totalValue, includedValue) {
  const numericTotalValue = Number(totalValue);
  const safeTotalValue = Number.isFinite(numericTotalValue)
    ? Math.max(0, Math.round(numericTotalValue))
    : 0;
  const totalLabel = safeTotalValue.toLocaleString();

  if (!Number.isFinite(includedValue)) {
    return totalLabel;
  }

  const safeIncludedValue = Math.max(0, Math.round(Number(includedValue)));
  if (safeIncludedValue === safeTotalValue) {
    return totalLabel;
  }

  return `${safeIncludedValue.toLocaleString()} / ${totalLabel}`;
}

function CompactFilterCard({
  data,
  selectedValues = [],
  onSelectionChange,
  sortMode = DEFAULT_CHART_SORT_MODE,
  customSortOrder = [],
}) {
  const theme = useTheme();
  const custom = theme.custom || {};
  const selectedAccentColor = custom.barActive || theme.palette.primary.main;
  const baseFillColor = custom.barFill || theme.palette.primary.main;
  const focusRingColor = custom.focusRing || theme.palette.primary.main;
  const focusRingWidth = Number.parseFloat(custom.focusRingWidth) || 2;
  const sortedRows = useMemo(
    () => sortFacetRows(data, sortMode, customSortOrder),
    [customSortOrder, data, sortMode]
  );
  const selectedSet = useMemo(
    () => new Set((Array.isArray(selectedValues) ? selectedValues : []).map((value) => String(value || "").trim())),
    [selectedValues]
  );
  const maxValue = useMemo(
    () => Math.max(1, ...sortedRows.map((row) => Number(row.value) || 0)),
    [sortedRows]
  );

  const handleToggle = (label) => {
    if (typeof onSelectionChange !== "function") {
      return;
    }

    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel) {
      return;
    }

    const nextValues = selectedSet.has(normalizedLabel)
      ? [...selectedSet].filter((value) => value !== normalizedLabel)
      : [...selectedSet, normalizedLabel];
    onSelectionChange(nextValues);
  };

  if (sortedRows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No values available.
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5}>
      {sortedRows.map((row) => {
        const isSelected = selectedSet.has(row.rowLabel);
        const valueRatio = Math.max(0, Math.min(1, Number(row.value) / maxValue));
        const countLabel = formatCompactCountLabel(row.value, row.includedValue);
        const rowText = row.label || row.rowLabel;

        return (
          <Box
            key={row.rowLabel || row.label}
            sx={{
              position: "relative",
              display: "block",
              width: "100%",
              minHeight: 30,
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => handleToggle(row.rowLabel)}
              aria-pressed={isSelected}
              aria-label={`Toggle ${row.label}`}
              sx={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "14px minmax(0, 1fr)",
                alignItems: "center",
                gap: 0.75,
                width: "100%",
                minHeight: 30,
                border: "1px solid",
                borderColor: isSelected ? selectedAccentColor : "divider",
                borderRadius: 1,
                bgcolor: "background.paper",
                pl: 1,
                pr: 8,
                py: 0.4,
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background-color 0.15s ease",
                "&:hover": {
                  bgcolor: "action.hover",
                },
                "&:focus-visible": {
                  outline: `${focusRingWidth}px solid`,
                  outlineColor: focusRingColor,
                  outlineOffset: 1,
                },
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: `${Math.max(4, Math.round(valueRatio * 100))}%`,
                  bgcolor: isSelected ? selectedAccentColor : baseFillColor,
                  opacity: isSelected ? 0.2 : 0.12,
                }}
              />
              <Box
                aria-hidden="true"
                sx={{
                  position: "relative",
                  width: 14,
                  height: 14,
                  border: "1px solid",
                  borderColor: isSelected ? selectedAccentColor : "divider",
                  borderRadius: 0.5,
                  bgcolor: isSelected ? selectedAccentColor : "transparent",
                  boxShadow: isSelected ? "0 0 0 1px rgba(255,255,255,0.2) inset" : "none",
                }}
              />
              <Typography
                variant="body2"
                noWrap
                sx={{ position: "relative", minWidth: 0, color: "text.primary" }}
              >
                {rowText}
              </Typography>
            </Box>
            <Typography
              aria-hidden="true"
              variant="caption"
              sx={{
                position: "absolute",
                top: "50%",
                right: 8,
                transform: "translateY(-50%)",
                color: "text.secondary",
                fontVariantNumeric: "tabular-nums",
                pointerEvents: "none",
              }}
            >
              {countLabel}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

function FiltersView() {
  const [themeKey, setThemeKey] = useState(getInitialThemeKey);
  const [fontScale, setFontScale] = useState(getInitialFontScale);
  const [fontFamilyKey, setFontFamilyKey] = useState(getInitialFontFamilyKey);
  const [highContrast, setHighContrast] = useState(() => getInitialBooleanPref(HIGH_CONTRAST_STORAGE_KEY));
  const [reducedMotion, setReducedMotion] = useState(() => getInitialBooleanPref(REDUCED_MOTION_STORAGE_KEY));
  const activeTheme = useMemo(() => {
    let theme = getThemeByKey(themeKey);
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
  }, [fontFamilyKey, fontScale, highContrast, themeKey]);
  const custom = activeTheme.custom || {};
  const initialLoadStartRef = useRef(
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now()
  );
  const hasLoggedInitialLoadRef = useRef(false);

  const handleThemeChange = useCallback((event) => {
    const nextKey = event.target.value;
    setThemeKey(nextKey);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextKey);
    } catch {
      // localStorage unavailable
    }
  }, []);

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

  const handleFontFamilyChange = useCallback((event) => {
    const nextFontFamilyKey = event.target.value;
    setFontFamilyKey(nextFontFamilyKey);
    try {
      localStorage.setItem(FONT_FAMILY_STORAGE_KEY, nextFontFamilyKey);
    } catch {
      // localStorage unavailable
    }
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
  const [cardHeightMode, setCardHeightMode] = useState(CARD_HEIGHT_MODE.FIT);
  const [normalizedCardHeights, setNormalizedCardHeights] = useState({
    omop: null,
    attributes: null,
  });
  const omopCardContentRefs = useRef({});
  const attributeCardContentRefs = useRef({});
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
  const isNormalizedHeightMode = cardHeightMode === CARD_HEIGHT_MODE.NORMALIZE;
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

  const setCardContentRef = (refs, key) => (node) => {
    if (node) {
      refs.current[key] = node;
      return;
    }
    delete refs.current[key];
  };

  useLayoutEffect(() => {
    if (!isNormalizedHeightMode) {
      setNormalizedCardHeights({ omop: null, attributes: null });
      return undefined;
    }

    let frameId = 0;

    const getAverageSectionHeight = (nodes) => {
      const heights = nodes
        .map((node) => Number(node.scrollHeight))
        .filter((height) => Number.isFinite(height) && height > 0);

      if (heights.length === 0) {
        return null;
      }

      const averageHeight = Math.round(
        heights.reduce((sum, height) => sum + height, 0) / heights.length
      );
      return Math.max(
        NORMALIZED_CARD_MIN_HEIGHT,
        Math.min(NORMALIZED_CARD_MAX_HEIGHT, averageHeight)
      );
    };

    const runMeasure = () => {
      const omopNodes = Object.values(omopCardContentRefs.current).filter(Boolean);
      const attributeNodes = Object.values(attributeCardContentRefs.current).filter(Boolean);

      const nextOmopHeight = getAverageSectionHeight(omopNodes);
      const nextAttributeHeight = getAverageSectionHeight(attributeNodes);

      setNormalizedCardHeights((previousHeights) => {
        if (
          previousHeights.omop === nextOmopHeight &&
          previousHeights.attributes === nextAttributeHeight
        ) {
          return previousHeights;
        }

        return {
          omop: nextOmopHeight,
          attributes: nextAttributeHeight,
        };
      });
    };

    const scheduleMeasure = () => {
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
        }
        frameId = window.requestAnimationFrame(runMeasure);
        return;
      }
      runMeasure();
    };

    scheduleMeasure();

    const observerNodes = [
      ...Object.values(omopCardContentRefs.current),
      ...Object.values(attributeCardContentRefs.current),
    ].filter(Boolean);

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => {
        scheduleMeasure();
      });

      observerNodes.forEach((node) => resizeObserver.observe(node));

      return () => {
        if (frameId && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frameId);
        }
        resizeObserver.disconnect();
      };
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", scheduleMeasure);
      return () => {
        if (frameId && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frameId);
        }
        window.removeEventListener("resize", scheduleMeasure);
      };
    }

    return undefined;
  }, [
    attributeDisplayChartDataByClass,
    attributeRootError,
    chartDataByClass,
    isAttributeLoading,
    isLoading,
    isNormalizedHeightMode,
    orderedAttributeFilterClasses,
    orderedOmopClasses,
    rootError,
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
  const handleSortModeChange = (setter, className) => (nextSortMode) => {
    const normalizedSortMode = normalizeChartSortMode(nextSortMode);

    setter((previousModes) => {
      if (previousModes?.[className] === normalizedSortMode) {
        return previousModes;
      }
      return {
        ...previousModes,
        [className]: normalizedSortMode,
      };
    });
  };
  const toggleCardHeightMode = () => {
    setCardHeightMode((previousMode) =>
      previousMode === CARD_HEIGHT_MODE.NORMALIZE ? CARD_HEIGHT_MODE.FIT : CARD_HEIGHT_MODE.NORMALIZE
    );
  };
  const cardHeightToggleTooltip = isNormalizedHeightMode
    ? "Switch to fit content heights"
    : "Switch to normalized row heights";
  const getCardContentAreaSx = (sectionKey, isCompactCard = false) => {
    const sectionHeight = normalizedCardHeights[sectionKey];

    return {
      display: "flex",
      flexDirection: "column",
      gap: 1,
      height:
        isCompactCard
          ? "auto"
          : isNormalizedHeightMode && Number.isFinite(sectionHeight)
            ? `${sectionHeight}px`
            : "auto",
      overflowY: "hidden",
      pr: 0,
    };
  };
  const getNormalizedChartHeight = (sectionKey) => {
    const sectionHeight = normalizedCardHeights[sectionKey];
    if (!isNormalizedHeightMode || !Number.isFinite(sectionHeight)) {
      return undefined;
    }
    return Math.max(
      120,
      Math.round(sectionHeight - NORMALIZED_CHART_HEIGHT_OFFSET)
    );
  };
  const CARD_FIXED_WIDTH = 340;
  const MAX_FACET_COLUMNS = 3;
  const filterGridSx = {
    width: "100%",
    columnCount: { xs: 1, md: 2, lg: MAX_FACET_COLUMNS },
    columnGap: 3,
    columnWidth: `${CARD_FIXED_WIDTH}px`,
    maxWidth: (theme) => {
      const gapPx = Number.parseFloat(theme.spacing(3)) || 24;
      return `${CARD_FIXED_WIDTH * MAX_FACET_COLUMNS + gapPx * (MAX_FACET_COLUMNS - 1)}px`;
    },
  };
  const getCardSx = (cardIndex = 0) => {
    const shouldStartNewColumn =
      Number.isFinite(cardIndex) && cardIndex > 0 && cardIndex < MAX_FACET_COLUMNS;
    const base = {
      width: "100%",
      display: "inline-block",
      verticalAlign: "top",
      breakInside: "avoid",
      breakBefore: {
        xs: "auto",
        lg: shouldStartNewColumn ? "column" : "auto",
      },
      mb: 3,
      p: custom.cardPadding || { xs: 2, md: 3 },
      position: "relative",
      overflow: "visible",
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
  const getHeaderSx = () => ({
    fontWeight: custom.headerFontWeight || 700,
    letterSpacing: custom.headerLetterSpacing || "0.2px",
    textTransform: custom.headerTransform || "none",
    fontSize: custom.headerFontSize || undefined,
    color: custom.headerColor || "text.primary",
    ...(custom.cardBeforePseudo === "solstice-underline"
      ? {
          "&::after": {
            content: '""',
            display: "block",
            width: 32,
            height: 2,
            background: "#C2410C",
            mt: "6px",
            borderRadius: "1px",
          },
        }
      : {}),
  });
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
          <Stack spacing={2}>
            <Typography
              id="filters-page-title"
              component="h1"
              variant="h5"
              sx={{ fontWeight: 800, color: "text.primary" }}
            >
              Patient Cohort Explorer
            </Typography>
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
            <Paper elevation={0} sx={{ p: 1, border: 1, borderColor: "divider" }}>
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
                      flexWrap: "nowrap",
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
                          color: "text.secondary",
                          "&:hover": {
                            color: "text.primary",
                          },
                        }}
                      >
                        <ArrowBackIcon fontSize="small" />
                        <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                          Home
                        </Typography>
                      </MuiLink>
                    </Box>
                    <Typography component="h2" variant="h6" color="text.primary" sx={CONTEXT_HEADER_SX}>
                      Identified Patients
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
                      <Typography
                        component="span"
                        variant="h4"
                        sx={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          lineHeight: 1.1,
                          fontSize: custom.patientCountSize || "1.25rem",
                          fontWeight: custom.patientCountWeight || 400,
                          color: custom.patientCountColor || "text.primary",
                          fontFamily: custom.countFontFamily || "inherit",
                        }}
                      >
                        {countResult.count.toLocaleString()} patient{countResult.count === 1 ? "" : "s"}
                      </Typography>
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
                    <AccessibilityBadge label="Accessibility" />
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      <TextFieldsIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
                      <FormControl
                        size="small"
                        sx={{
                          minWidth: 150,
                          fontSize: "0.75rem",
                          height: 32,
                          bgcolor: "background.paper",
                        }}
                      >
                        <InputLabel id="font-family-select-label">Font</InputLabel>
                        <Select
                          labelId="font-family-select-label"
                          id="font-family-select"
                          value={fontFamilyKey}
                          onChange={handleFontFamilyChange}
                          label="Font"
                          sx={{
                            height: 32,
                            "& .MuiSelect-select": { py: 0.5 },
                          }}
                        >
                          {FONT_FAMILY_OPTIONS.map((option) => (
                            <MenuItem
                              key={option.key}
                              value={option.key}
                              sx={{
                                fontSize: "0.8rem",
                                fontFamily: option.stack || "inherit",
                              }}
                            >
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
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
                        sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: 0.2, userSelect: "none" }}
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
                        <InputLabel id="theme-select-label">Theme</InputLabel>
                        <Select
                          labelId="theme-select-label"
                          id="theme-select"
                          value={themeKey}
                          onChange={handleThemeChange}
                          label="Theme"
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
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                </Box>
                {isCountLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    Querying patient count...
                  </Typography>
                ) : null}
                {countError ? <Alert severity="error">{countError}</Alert> : null}
                {countResult ? (
                  <Stack spacing={0.35}>
                    {identifiedSummary ? (
                      <Typography variant="body2" color="text.secondary">
                        {identifiedSummary}
                      </Typography>
                    ) : null}
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
                    {cohortSize === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No patients match the current filters.
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Showing page {(currentPatientGridPage + 1).toLocaleString()} of{" "}
                        {Math.max(1, totalPatientGridPages).toLocaleString()} ·{" "}
                        {cohortSize.toLocaleString()} matched patients.
                      </Typography>
                    )}
                    {isSlowQuery ? (
                      <Alert severity="warning">
                        Query took {formatMs(timing.totalMs)} ms. Consider narrowing selections for faster response.
                      </Alert>
                    ) : null}
                    {zeroResultHint ? <Alert severity="info">{zeroResultHint}</Alert> : null}
                    {SHOULD_LOG_FILTERS_PERF ? (
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
                ) : null}
              </Stack>
            </Paper>
          </Box>
        </Box>

        {countResult && shouldShowPatientDetailGrid ? (
          <Box>
            <PatientGrid
              data={patientGridRows}
              cohortSize={cohortSize}
              totalCohortCount={cohortSize}
              totalPages={totalPatientGridPages}
              currentPage={currentPatientGridPage}
              pageSize={PATIENT_GRID_PAGE_SIZE}
              onPageChange={setCurrentPatientGridPage}
              isLoading={isPatientGridPageLoading}
              error={patientGridPageError}
              onRetry={handleRetryPatientSummary}
            />
          </Box>
        ) : null}

        {isLoading || isAttributeLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading filters...
          </Typography>
        ) : null}

        {rootError ? <Alert severity="error">{rootError}</Alert> : null}
        {attributeRootError ? <Alert severity="error">{attributeRootError}</Alert> : null}

        {!isLoading && !isAttributeLoading && !rootError && !attributeRootError ? (
          <Stack spacing={2.5}>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Tooltip title={cardHeightToggleTooltip}>
                <IconButton
                  size="small"
                  aria-label={cardHeightToggleTooltip}
                  onClick={toggleCardHeightMode}
                  sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper" }}
                >
                  {isNormalizedHeightMode ? (
                    <TuneIcon fontSize="small" />
                  ) : (
                    <ViewStreamIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
            {omopFilterSets.length > 0 ? (
              <Stack spacing={2}>
                {omopFilterSets.map((filterSet) => {
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

                  return (
                    <Stack key={filterSet.id} spacing={1}>
                      <Typography component="h2" variant="subtitle1" sx={CONTEXT_HEADER_SX}>
                        {filterSet.label}
                      </Typography>
                      {cohortSize > 0 && sectionHasData ? (
                        <Typography variant="caption" color="text.secondary">
                          Showing distributions for {cohortSize.toLocaleString()} matched patient
                          {cohortSize === 1 ? "" : "s"}
                        </Typography>
                      ) : null}
                      <Box sx={filterGridSx}>
                        {filterSet.filters.map((filter, filterIndex) => {
                        const className = filter.key;
                        const classError = omopData.errorsByClass[className] || "";
                        const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
                        const classData =
                          isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
                            ? ageAtDxDecileChartData
                            : chartDataByClass[className] || [];
                        const classChartData = omopChartDataWithIncludedByClass[className] || classData;
                        const classDisplayName =
                          filter.displayName || getFilterDisplayName("omop", className);
                        const selectedValuesForClass = selectedOmopValuesByClass[className] || [];
                        const defaultSortMode = getFilterDefaultSortMode("omop", className);
                        const customSortOrder = getFilterCustomSortOrder("omop", className);
                        const sortMode = omopSortModeByClass[className] || defaultSortMode;
                        const displayMode = resolveDisplayMode(filter, classChartData);
                        const isCompactMode = displayMode === "compact";
                        const onSelectionChangeForClass = handleSelectionChange(
                          setSelectedOmopValuesByClass,
                          className
                        );

                        return (
                          <Paper
                            key={`${filterSet.id}:${className}`}
                            elevation={0}
                            sx={getCardSx(filterIndex)}
                          >
                            <Box
                              ref={
                                isCompactMode
                                  ? undefined
                                  : setCardContentRef(omopCardContentRefs, `omop-${className}`)
                              }
                              sx={getCardContentAreaSx("omop", isCompactMode)}
                            >
                              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
                                <Box sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                                  <Typography
                                    component="h3"
                                    variant="h6"
                                    sx={getHeaderSx()}
                                  >
                                    {classDisplayName}
                                  </Typography>
                                </Box>
                                {displayMode === "distribution" ? (
                                  <DistributionStrip
                                    data={classChartData}
                                    sortMode={sortMode}
                                    customSortOrder={customSortOrder}
                                  />
                                ) : null}
                              </Box>
                              {classError ? <Alert severity="error">{classError}</Alert> : null}
                              {displayMode === "distribution" ? (
                                <HorizontalBarChart
                                  title={classDisplayName}
                                  showTitle={false}
                                  allowCollapse={false}
                                  showSortDimensionToggle
                                  showSortCycleButton={false}
                                  onSortModeChange={handleSortModeChange(
                                    setOmopSortModeByClass,
                                    className
                                  )}
                                  data={classChartData}
                                  selectedValues={selectedValuesForClass}
                                  onSelectionChange={onSelectionChangeForClass}
                                  fontScale={fontScale}
                                  height={getNormalizedChartHeight("omop")}
                                  defaultSort={defaultSortMode}
                                  customSortOrder={customSortOrder}
                                  inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
                                  getPatientSummary={getPatientSummary}
                                />
                              ) : (
                                <CompactFilterCard
                                  data={classChartData}
                                  selectedValues={selectedValuesForClass}
                                  onSelectionChange={onSelectionChangeForClass}
                                  sortMode={sortMode}
                                  customSortOrder={customSortOrder}
                                />
                              )}
                            </Box>
                          </Paper>
                        );
                        })}
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No OMOP classes returned.
              </Typography>
            )}

            {attributeFilterSets.length > 0 ? (
              <Stack spacing={2}>
                {attributeFilterSets.map((filterSet) => {
                  const sectionHasData = filterSet.filters.some((filter) => {
                    const classChartData =
                      attributeChartDataWithIncludedByClass[filter.key] ||
                      attributeDisplayChartDataByClass[filter.key] ||
                      [];
                    return Array.isArray(classChartData) && classChartData.length > 0;
                  });

                  return (
                    <Stack key={filterSet.id} spacing={1}>
                      <Typography component="h2" variant="subtitle1" sx={CONTEXT_HEADER_SX}>
                        {filterSet.label}
                      </Typography>
                      {cohortSize > 0 && sectionHasData ? (
                        <Typography variant="caption" color="text.secondary">
                          Showing distributions for {cohortSize.toLocaleString()} matched patient
                          {cohortSize === 1 ? "" : "s"}
                        </Typography>
                      ) : null}
                      <Box sx={filterGridSx}>
                        {filterSet.filters.map((filter, filterIndex) => {
                        const className = filter.key;
                        const classError = attributeData.errorsByClass[className] || "";
                        const classData = attributeDisplayChartDataByClass[className] || [];
                        const classChartData =
                          attributeChartDataWithIncludedByClass[className] || classData;
                        const classDisplayName =
                          filter.displayName || getFilterDisplayName("attributes", className);
                        const selectedValuesForClass = selectedAttributeValuesByClass[className] || [];
                        const defaultSortMode = getFilterDefaultSortMode("attributes", className);
                        const customSortOrder = getFilterCustomSortOrder("attributes", className);
                        const sortMode = attributeSortModeByClass[className] || defaultSortMode;
                        const displayMode = resolveDisplayMode(filter, classChartData);
                        const isCompactMode = displayMode === "compact";
                        const onSelectionChangeForClass = handleSelectionChange(
                          setSelectedAttributeValuesByClass,
                          className
                        );

                        return (
                          <Paper
                            key={`${filterSet.id}:${className}`}
                            elevation={0}
                            sx={getCardSx(filterIndex)}
                          >
                            <Box
                              ref={
                                isCompactMode
                                  ? undefined
                                  : setCardContentRef(
                                      attributeCardContentRefs,
                                      `attribute-${className}`
                                    )
                              }
                              sx={getCardContentAreaSx("attributes", isCompactMode)}
                            >
                              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
                                <Box sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                                  <Typography
                                    component="h3"
                                    variant="h6"
                                    sx={getHeaderSx()}
                                  >
                                    {classDisplayName}
                                  </Typography>
                                </Box>
                                {displayMode === "distribution" ? (
                                  <DistributionStrip
                                    data={classChartData}
                                    sortMode={sortMode}
                                    customSortOrder={customSortOrder}
                                  />
                                ) : null}
                              </Box>
                              {classError ? <Alert severity="error">{classError}</Alert> : null}
                              {displayMode === "distribution" ? (
                                <HorizontalBarChart
                                  title={classDisplayName}
                                  showTitle={false}
                                  allowCollapse={false}
                                  showSortDimensionToggle
                                  showSortCycleButton={false}
                                  onSortModeChange={handleSortModeChange(
                                    setAttributeSortModeByClass,
                                    className
                                  )}
                                  data={classChartData}
                                  selectedValues={selectedValuesForClass}
                                  onSelectionChange={onSelectionChangeForClass}
                                  onRowToggleExpand={handleAttributeParentExpansionChange(className)}
                                  fontScale={fontScale}
                                  height={getNormalizedChartHeight("attributes")}
                                  defaultSort={defaultSortMode}
                                  customSortOrder={customSortOrder}
                                  inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
                                  getPatientSummary={getPatientSummary}
                                />
                              ) : (
                                <CompactFilterCard
                                  data={classChartData}
                                  selectedValues={selectedValuesForClass}
                                  onSelectionChange={onSelectionChangeForClass}
                                  sortMode={sortMode}
                                  customSortOrder={customSortOrder}
                                />
                              )}
                            </Box>
                          </Paper>
                        );
                        })}
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No Attribute classes returned.
              </Typography>
            )}
          </Stack>
        ) : null}
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default FiltersView;
