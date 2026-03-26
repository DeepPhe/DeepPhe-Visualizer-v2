import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Checkbox,
  CssBaseline,
  FormControlLabel,
  GlobalStyles,
  IconButton,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import TuneIcon from "@mui/icons-material/Tune";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import { Link as RouterLink } from "react-router-dom";
import { getClasses as getOmopClasses, getInstances as getOmopInstances } from "../controllers/omap";
import {
  getClasses as getAttributeClasses,
  getInstances as getAttributeInstances,
} from "../controllers/attributes";
import { fetchDeepPheFilterCount } from "../clients/deepphe-data-api";
import HorizontalBarChart from "../components/HorizontalBarChart";
import { useDataLoader } from "../hooks/useDataLoader";
import { THEME_OPTIONS, getThemeByKey } from "../themes";
import { getAgeDecileLabel } from "../utils/dataProcessing";
import {
  buildChildChartData,
  buildRollupInstanceMap,
  buildRolledUpChartData,
  hasRollup,
  isExpandable,
  resolveRollupSelections,
} from "./rollup";

const SLOW_QUERY_THRESHOLD_MS = 100;
const AUTO_SHOW_PATIENT_IDS_THRESHOLD = 1000;
const INLINE_PATIENT_IDS_THRESHOLD = 20;
const MAX_RENDERED_PATIENT_IDS = 1000;
const AGE_AT_DX_CLASS = "AGE_AT_DX";
const AGE_SELECTION_MODE = {
  DECILE: "decile",
};
const OMOP_CLASS_PREFERRED_ORDER = ["AGE_AT_DX", "RACE", "GENDER", "ETHNICITY", "CANCER"];
const OMOP_CANCER_DISPLAY_NAME_MAP = {
  B: "Breast",
  M: "Melanoma",
  O: "Ovarian Cancer",
};
const OMOP_CLASS_DISPLAY_NAME_MAP = {
  AGE_AT_DX: "Age at Dx",
  ETHNICITY: "Ethnicity",
  GENDER: "Gender",
  RACE: "Race",
  CANCER: "Cancer",
};
const ATTRIBUTE_FILTER_CLASS_ORDER = ["T Stage", "N Stage", "M Stage", "Grade_Numeric", "Behavior"];
const CARD_HEIGHT_MODE = {
  NORMALIZE: "normalize",
  FIT: "fit",
};
const NORMALIZED_CARD_MIN_HEIGHT = 180;
const NORMALIZED_CARD_MAX_HEIGHT = 320;
const NORMALIZED_CHART_HEIGHT_OFFSET = 88;
const CONTEXT_HEADER_SX = { fontWeight: 700, letterSpacing: 0.2 };

const THEME_STORAGE_KEY = "filterPageTheme";

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

function normalizeClassName(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeLookupKey(value) {
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

function sortOmopClasses(classes) {
  if (!Array.isArray(classes)) {
    return [];
  }

  return [...classes]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .sort((leftClass, rightClass) => {
      const leftNormalized = normalizeClassName(leftClass);
      const rightNormalized = normalizeClassName(rightClass);
      const leftPriority = OMOP_CLASS_PREFERRED_ORDER.indexOf(leftNormalized);
      const rightPriority = OMOP_CLASS_PREFERRED_ORDER.indexOf(rightNormalized);
      const leftOrder = leftPriority >= 0 ? leftPriority : Number.MAX_SAFE_INTEGER;
      const rightOrder = rightPriority >= 0 ? rightPriority : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return leftNormalized.localeCompare(rightNormalized, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function toDisplayInstanceValue(type, className, value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  if (String(type || "").toLowerCase() === "omop" && normalizeClassName(className) === "CANCER") {
    const mappedCancerName = OMOP_CANCER_DISPLAY_NAME_MAP[normalizeClassName(rawValue)];
    if (mappedCancerName) {
      return mappedCancerName;
    }
  }

  return rawValue;
}

function toChartData(summaryRows, type, className) {
  if (!Array.isArray(summaryRows)) {
    return [];
  }

  const normalizePatientIds = (rawValue) => {
    if (Array.isArray(rawValue)) {
      return [...new Set(rawValue.map((item) => String(item || "").trim()).filter(Boolean))];
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

  if (/^[A-Z0-9]+$/.test(text) && text.length <= 6) {
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

function normalizeGenderLabel(value) {
  const normalized = normalizeClassName(value);
  if (normalized === "M" || normalized === "MALE") {
    return "male";
  }
  if (normalized === "F" || normalized === "FEMALE") {
    return "female";
  }
  if (normalized === "U" || normalized === "UNKNOWN") {
    return "unknown gender";
  }
  return String(value || "").trim().toLowerCase();
}

function formatStageInstance(value, stagePrefix) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const normalizedPrefix = String(stagePrefix || "").trim().toUpperCase();
  const compact = rawValue.replace(/[\s_-]+/g, "");
  const stageCodeMatch = compact.match(
    new RegExp(`^(P?)${normalizedPrefix}([0-9X]+(?:[A-C]|is|mi)?)(?:StageFinding)?$`, "i")
  );

  if (stageCodeMatch) {
    const isPathologic = String(stageCodeMatch[1] || "").toUpperCase() === "P";
    const rawSuffix = String(stageCodeMatch[2] || "");
    const normalizedSuffix = rawSuffix
      .replace(/is/gi, "is")
      .replace(/mi/gi, "mi")
      .replace(/[a-z]/g, (token) => token.toLowerCase())
      .replace(/[0-9x]/gi, (token) => token.toUpperCase());
    const stageCode = `${normalizedPrefix}${normalizedSuffix}`;
    return isPathologic ? `pathologic ${stageCode}` : stageCode;
  }

  const withoutFinding = rawValue
    .replace(/stage\s*finding$/i, "")
    .replace(/StageFinding$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  return withoutFinding || rawValue;
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
    normalizeGenderLabel(value)
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

  const tStageValues = getDisplayInstances(attributeFiltersByClass["T STAGE"]).map((value) =>
    formatStageInstance(value, "T")
  );
  if (tStageValues.length > 0) {
    conditionClauses.push(`T stage ${joinWithConjunction(tStageValues, "or")}`);
  }

  const nStageValues = getDisplayInstances(attributeFiltersByClass["N STAGE"]).map((value) =>
    formatStageInstance(value, "N")
  );
  if (nStageValues.length > 0) {
    conditionClauses.push(`N stage ${joinWithConjunction(nStageValues, "or")}`);
  }

  const mStageValues = getDisplayInstances(attributeFiltersByClass["M STAGE"]).map((value) =>
    formatStageInstance(value, "M")
  );
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
  const isAttributeRollupClass = normalizedType === "attributes" && hasRollup(className);

  if (isAgeAtDxDecileClass) {
    const mappedInstances = ageDecileInstanceMap?.[rowLabel];
    if (Array.isArray(mappedInstances) && mappedInstances.length > 0) {
      return mappedInstances;
    }
  }

  if (isAttributeRollupClass) {
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
      const isAttributeRollupClass =
        normalizedFilterType === "attributes" && hasRollup(filter?.class);

      if (!isAgeAtDxFilter && !isAttributeRollupClass) {
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

      if (isAttributeRollupClass) {
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

function resolveAttributeFilterClasses(classes) {
  if (!Array.isArray(classes)) {
    return [];
  }

  const availableClasses = classes
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const usedClasses = new Set();

  return ATTRIBUTE_FILTER_CLASS_ORDER.map((requestedClass) => {
    const requestedKey = normalizeLookupKey(requestedClass);
    const matchedClass = availableClasses.find(
      (candidateClass) =>
        !usedClasses.has(candidateClass) &&
        normalizeLookupKey(candidateClass) === requestedKey
    );

    if (matchedClass) {
      usedClasses.add(matchedClass);
      return matchedClass;
    }

    return "";
  }).filter(Boolean);
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
    if (!hasRollup(className)) {
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
  const count = Number(payload?.count);
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

function buildDistributionSeries(data, maxBars = 28) {
  if (!Array.isArray(data)) {
    return [];
  }

  const rows = data
    .map((item) => ({
      label: String(item?.displayLabel ?? item?.label ?? "").trim(),
      value: Number(item?.value),
    }))
    .filter((item) => item.label && Number.isFinite(item.value) && item.value > 0)
    .sort((leftItem, rightItem) => {
      if (rightItem.value !== leftItem.value) {
        return rightItem.value - leftItem.value;
      }
      return leftItem.label.localeCompare(rightItem.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

  return rows.slice(0, Math.max(1, maxBars)).map((item) => item.value);
}

function buildInstanceOrderedDistributionSeries(data, maxBars = 28) {
  if (!Array.isArray(data)) {
    return [];
  }

  const rows = data
    .map((item) => ({
      label: String(item?.displayLabel ?? item?.label ?? "").trim(),
      value: Number(item?.value),
    }))
    .filter((item) => item.label && Number.isFinite(item.value) && item.value > 0)
    .sort((leftItem, rightItem) =>
      leftItem.label.localeCompare(rightItem.label, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );

  return rows.slice(0, Math.max(1, maxBars)).map((item) => item.value);
}

function DistributionStrip({ data, sortDimension = "count" }) {
  const series = useMemo(() => {
    if (sortDimension === "instance") {
      return buildInstanceOrderedDistributionSeries(data);
    }
    return buildDistributionSeries(data);
  }, [data, sortDimension]);

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

function FiltersView() {
  const [themeKey, setThemeKey] = useState(getInitialThemeKey);
  const activeTheme = useMemo(() => getThemeByKey(themeKey), [themeKey]);
  const custom = activeTheme.custom || {};

  const handleThemeChange = (event) => {
    const nextKey = event.target.value;
    setThemeKey(nextKey);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextKey);
    } catch {
      // localStorage unavailable
    }
  };

  const omopData = useDataLoader(getOmopClasses, getOmopInstances, "OMOP");
  const attributeData = useDataLoader(
    getAttributeClasses,
    getAttributeInstances,
    "Attributes",
  );
  const [selectedOmopValuesByClass, setSelectedOmopValuesByClass] = useState({});
  const [selectedAttributeValuesByClass, setSelectedAttributeValuesByClass] = useState({});
  const [expandedParentsByClass, setExpandedParentsByClass] = useState({});
  const [omopSortDimensionByClass, setOmopSortDimensionByClass] = useState({});
  const [attributeSortDimensionByClass, setAttributeSortDimensionByClass] = useState({});
  const ageAtDxSelectionMode = AGE_SELECTION_MODE.DECILE;
  const [includePatientIds, setIncludePatientIds] = useState(false);
  const [countResult, setCountResult] = useState(null);
  const [includedCountByRowKey, setIncludedCountByRowKey] = useState({});
  const [countError, setCountError] = useState("");
  const [isCountLoading, setIsCountLoading] = useState(false);
  const [cardHeightMode, setCardHeightMode] = useState(CARD_HEIGHT_MODE.NORMALIZE);
  const [normalizedCardHeights, setNormalizedCardHeights] = useState({
    omop: null,
    attributes: null,
  });
  const omopCardContentRefs = useRef({});
  const attributeCardContentRefs = useRef({});

  const orderedOmopClasses = useMemo(
    () => sortOmopClasses(omopData.classes),
    [omopData.classes]
  );
  const orderedAttributeFilterClasses = useMemo(
    () => resolveAttributeFilterClasses(attributeData.classes),
    [attributeData.classes]
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
      next[className] = hasRollup(className)
        ? buildRolledUpChartData(classData, className)
        : classData;
    });

    return next;
  }, [attributeChartDataByClass, orderedAttributeFilterClasses]);
  const rollupInstanceMapByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];
      next[className] = hasRollup(className)
        ? buildRollupInstanceMap(classData, className)
        : {};
    });

    return next;
  }, [attributeChartDataByClass, orderedAttributeFilterClasses]);
  const attributeDisplayChartDataByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];

      if (!hasRollup(className)) {
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

  useEffect(() => {
    let isActive = true;

    const staticCountsByRowKey = {};
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

        if (!shouldQueryIncludedCounts) {
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

    if (countRequests.length === 0) {
      return () => {
        isActive = false;
      };
    }

    const loadIncludedCounts = async () => {
      const nextCountsByRowKey = { ...staticCountsByRowKey };

      await Promise.all(
        countRequests.map(async ({ rowKey, rowRequestFilters, fallbackCount }) => {
          try {
            const countPayload = await fetchDeepPheFilterCount({
              filters: rowRequestFilters,
              includePatientIds: false,
            });
            const resolvedCount = normalizeCountResponse(countPayload).count;
            nextCountsByRowKey[rowKey] = Number.isFinite(resolvedCount)
              ? Math.max(0, Math.round(resolvedCount))
              : fallbackCount;
          } catch {
            nextCountsByRowKey[rowKey] = fallbackCount;
          }
        })
      );

      if (isActive) {
        setIncludedCountByRowKey(nextCountsByRowKey);
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
    setOmopSortDimensionByClass((previousDimensions) => {
      const nextDimensions = {};
      orderedOmopClasses.forEach((className) => {
        nextDimensions[className] =
          previousDimensions?.[className] === "instance" ? "instance" : "count";
      });
      return nextDimensions;
    });
  }, [orderedOmopClasses]);
  useEffect(() => {
    setAttributeSortDimensionByClass((previousDimensions) => {
      const nextDimensions = {};
      orderedAttributeFilterClasses.forEach((className) => {
        nextDimensions[className] =
          previousDimensions?.[className] === "instance" ? "instance" : "count";
      });
      return nextDimensions;
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
      return () => {
        isActive = false;
      };
    }

    setIsCountLoading(true);
    setCountError("");

    const loadCount = async () => {
      try {
        let nextResult = normalizeCountResponse(
          await fetchDeepPheFilterCount({
            filters: requestFilters,
            includePatientIds,
          })
        );

        const shouldAutoResolvePatientIds =
          !includePatientIds &&
          nextResult.count > 0 &&
          nextResult.count < AUTO_SHOW_PATIENT_IDS_THRESHOLD &&
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
  }, [hasSelections, includePatientIds, requestFilters]);

  const timing = countResult?.timing || {};
  const isSlowQuery = Number(timing.totalMs || 0) > SLOW_QUERY_THRESHOLD_MS;
  const zeroResultHint = countResult?.count === 0 ? getZeroResultHint(activeFilters, timing.itemCounts) : "";
  const identifiedSummary = useMemo(
    () => buildIdentifiedSummary(activeFilters, countResult?.count),
    [activeFilters, countResult?.count]
  );
  const patientIdsForDisplay = useMemo(() => {
    const ids = Array.isArray(countResult?.patientIds) ? countResult.patientIds : [];
    return [...ids].sort((leftId, rightId) =>
      leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [countResult?.patientIds]);
  const displayedPatientIds = useMemo(
    () => patientIdsForDisplay.slice(0, MAX_RENDERED_PATIENT_IDS),
    [patientIdsForDisplay]
  );
  const isPatientIdListTruncated = patientIdsForDisplay.length > displayedPatientIds.length;
  const shouldShowPatientIdBox =
    Boolean(countResult) &&
    patientIdsForDisplay.length > 0 &&
    (countResult.count < AUTO_SHOW_PATIENT_IDS_THRESHOLD || includePatientIds);
  const omopChartDataWithIncludedByClass = useMemo(() => {
    const next = {};

    orderedOmopClasses.forEach((className) => {
      const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
      const classData =
        isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
          ? ageAtDxDecileChartData
          : chartDataByClass[className] || [];

      next[className] = classData.map((row) => ({
        ...row,
        includedValue:
          includedCountByRowKey[
            getFilterRowKey("omop", className, String(row?.label || "").trim())
          ],
      }));
    });

    return next;
  }, [
    ageAtDxDecileChartData,
    ageAtDxSelectionMode,
    chartDataByClass,
    includedCountByRowKey,
    orderedOmopClasses,
  ]);
  const attributeChartDataWithIncludedByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeDisplayChartDataByClass[className] || [];
      next[className] = classData.map((row) => ({
        ...row,
        includedValue:
          includedCountByRowKey[
            getFilterRowKey("attributes", className, String(row?.label || "").trim())
          ],
      }));
    });

    return next;
  }, [
    attributeDisplayChartDataByClass,
    includedCountByRowKey,
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
    if (!hasRollup(className)) {
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
  const handleSortDimensionChange = (setter, className) => (nextSortDimension) => {
    const normalizedSortDimension =
      nextSortDimension === "instance" ? "instance" : "count";

    setter((previousDimensions) => {
      if (previousDimensions?.[className] === normalizedSortDimension) {
        return previousDimensions;
      }
      return {
        ...previousDimensions,
        [className]: normalizedSortDimension,
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
  const getCardContentAreaSx = (sectionKey) => {
    const sectionHeight = normalizedCardHeights[sectionKey];

    return {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    height:
      isNormalizedHeightMode && Number.isFinite(sectionHeight)
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
  const filterGridSx = {
    display: "grid",
    gap: 3,
    alignItems: isNormalizedHeightMode ? "stretch" : "start",
    gridTemplateColumns: {
      xs: "1fr",
      sm: "repeat(2, minmax(0, 1fr))",
      md: "repeat(3, minmax(0, 1fr))",
      lg: "repeat(5, minmax(0, 1fr))",
    },
  };
  const getCardSx = () => {
    const base = {
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

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      {REDUCED_MOTION_STYLES}
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        background: custom.pageBgExtra
          ? `${custom.pageBgExtra}, ${activeTheme.palette.background.default}`
          : undefined,
        p: { xs: 2, md: 4 },
        transition: "background-color 0.2s ease",
      }}
    >
      <Stack spacing={2}>
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
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.25 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "nowrap" }}>
                    <Typography variant="h6" color="text.primary" sx={CONTEXT_HEADER_SX}>
                      Identified Patients
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={includePatientIds}
                          onChange={(event) => setIncludePatientIds(event.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="caption" color="text.secondary">
                          Include IDs
                        </Typography>
                      }
                      sx={{ m: 0, whiteSpace: "nowrap" }}
                    />
                  </Box>
                  {countResult ? (
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "nowrap" }}>
                      <Typography
                        variant="h6"
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
                  <Select
                    size="small"
                    value={themeKey}
                    onChange={handleThemeChange}
                    aria-label="Theme"
                    startAdornment={
                      <PaletteOutlinedIcon
                        fontSize="small"
                        sx={{ mr: 0.5, color: "text.secondary", flexShrink: 0 }}
                      />
                    }
                    sx={{
                      minWidth: 110,
                      fontSize: "0.75rem",
                      height: 32,
                      bgcolor: "background.paper",
                      "& .MuiSelect-select": { py: 0.5 },
                    }}
                  >
                    {THEME_OPTIONS.map((option) => (
                      <MenuItem key={option.key} value={option.key} sx={{ fontSize: "0.8rem" }}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
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
                    {shouldShowPatientIdBox ? (
                      <Box
                        sx={{
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                          p: 0.5,
                          maxHeight: "4rem",
                          overflowY: "auto",
                          bgcolor: "background.default",
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 0.25, fontVariantNumeric: "tabular-nums" }}
                        >
                          patient_ids (
                          {isPatientIdListTruncated
                            ? `showing ${displayedPatientIds.length.toLocaleString()} of ${patientIdsForDisplay.length.toLocaleString()}`
                            : patientIdsForDisplay.length.toLocaleString()}
                          )
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.35,
                            fontFamily: custom.countFontFamily || "monospace",
                            lineHeight: 1.2,
                          }}
                        >
                          {displayedPatientIds.map((patientId) => (
                            <Box
                              key={patientId}
                              component="span"
                              sx={{
                                px: 0.35,
                                py: 0.15,
                                borderRadius: 0.75,
                                bgcolor: "background.paper",
                                border: 1,
                                borderColor: "divider",
                                fontSize: "0.75rem",
                                color: "text.primary",
                              }}
                            >
                              {patientId}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ) : includePatientIds && countResult.count > 0 && !isCountLoading ? (
                      <Alert severity="info">
                        Patient IDs were requested, but the API returned none for this cohort.
                      </Alert>
                    ) : countResult.count >= AUTO_SHOW_PATIENT_IDS_THRESHOLD && !includePatientIds ? (
                      <Typography variant="body2" color="text.secondary">
                        Patient IDs auto-display when cohort size is below{" "}
                        {AUTO_SHOW_PATIENT_IDS_THRESHOLD.toLocaleString()}.
                      </Typography>
                    ) : null}
                    {isSlowQuery ? (
                      <Alert severity="warning">
                        Query took {formatMs(timing.totalMs)} ms. Consider narrowing selections for faster response.
                      </Alert>
                    ) : null}
                    {zeroResultHint ? <Alert severity="info">{zeroResultHint}</Alert> : null}
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
                  </Stack>
                ) : null}
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
            {orderedOmopClasses.length > 0 ? (
              <Box sx={filterGridSx}>
                {orderedOmopClasses.map((className) => {
                  const classError = omopData.errorsByClass[className] || "";
                  const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
                  const classData =
                    isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
                      ? ageAtDxDecileChartData
                      : chartDataByClass[className] || [];
                  const classChartData = omopChartDataWithIncludedByClass[className] || classData;
                  const classDisplayName = prettifyClassName(className, "omop");
                  const selectedValuesForClass = selectedOmopValuesByClass[className] || [];
                  const sortDimension = omopSortDimensionByClass[className] || "count";

                  return (
                    <Paper
                      key={className}
                      elevation={0}
                      sx={getCardSx()}
                    >
                      <Box
                        ref={setCardContentRef(omopCardContentRefs, `omop-${className}`)}
                        sx={getCardContentAreaSx("omop")}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
                          <Box sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                            <Typography
                              variant="h6"
                              sx={getHeaderSx()}
                            >
                              {classDisplayName}
                            </Typography>
                          </Box>
                          <DistributionStrip data={classData} sortDimension={sortDimension} />
                        </Box>
                        {classError ? <Alert severity="error">{classError}</Alert> : null}
                        <HorizontalBarChart
                          title={classDisplayName}
                          showTitle={false}
                          allowCollapse={false}
                          showSortDimensionToggle
                          showSortCycleButton={false}
                          onSortDimensionChange={handleSortDimensionChange(
                            setOmopSortDimensionByClass,
                            className
                          )}
                          data={classChartData}
                          selectedValues={selectedValuesForClass}
                          onSelectionChange={handleSelectionChange(
                            setSelectedOmopValuesByClass,
                            className
                          )}
                          height={getNormalizedChartHeight("omop")}
                          defaultSort="value-desc"
                          inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
                        />
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No OMOP classes returned.
              </Typography>
            )}

            {orderedAttributeFilterClasses.length > 0 ? (
              <Box sx={filterGridSx}>
                {orderedAttributeFilterClasses.map((className) => {
                  const classError = attributeData.errorsByClass[className] || "";
                  const classData = attributeDisplayChartDataByClass[className] || [];
                  const classChartData =
                    attributeChartDataWithIncludedByClass[className] || classData;
                  const classDisplayName = prettifyClassName(className, "attributes");
                  const selectedValuesForClass = selectedAttributeValuesByClass[className] || [];
                  const sortDimension = attributeSortDimensionByClass[className] || "count";

                  return (
                    <Paper
                      key={className}
                      elevation={0}
                      sx={getCardSx()}
                    >
                      <Box
                        ref={setCardContentRef(
                          attributeCardContentRefs,
                          `attribute-${className}`
                        )}
                        sx={getCardContentAreaSx("attributes")}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
                          <Box sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                            <Typography
                              variant="h6"
                              sx={getHeaderSx()}
                            >
                              {classDisplayName}
                            </Typography>
                          </Box>
                          <DistributionStrip data={classData} sortDimension={sortDimension} />
                        </Box>
                        {classError ? <Alert severity="error">{classError}</Alert> : null}
                        <HorizontalBarChart
                          title={classDisplayName}
                          showTitle={false}
                          allowCollapse={false}
                          showSortDimensionToggle
                          showSortCycleButton={false}
                          onSortDimensionChange={handleSortDimensionChange(
                            setAttributeSortDimensionByClass,
                            className
                          )}
                          data={classChartData}
                          selectedValues={selectedValuesForClass}
                          onSelectionChange={handleSelectionChange(
                            setSelectedAttributeValuesByClass,
                            className
                          )}
                          onRowToggleExpand={handleAttributeParentExpansionChange(className)}
                          height={getNormalizedChartHeight("attributes")}
                          defaultSort="value-desc"
                          inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
                        />
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                None of the requested Attribute filters were returned (T Stage, N Stage, M Stage, Grade_Numeric, Behavior).
              </Typography>
            )}
          </Stack>
        ) : null}

        <MuiLink
          component={RouterLink}
          to="/"
          underline="hover"
          sx={{ width: "fit-content", color: "text.secondary" }}
        >
          Back Home
        </MuiLink>
      </Stack>
    </Box>
    </ThemeProvider>
  );
}

export default FiltersView;
