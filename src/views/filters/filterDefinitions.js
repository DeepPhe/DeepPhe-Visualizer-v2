import { getAgeDecileLabel, normalizeClassName } from "../../utils/dataProcessing";
import { toDisplayName } from "../../utils/displayNames";
import { hasRollup } from "../rollup";
import { FILTER_ENTRY_BY_TYPE_CLASS } from "../filterSets";

// Stable empty array so a class with no configured custom sort order always
// returns the same reference, keeping memoized chart props referentially stable.
const EMPTY_ARRAY = Object.freeze([]);

export const AGE_AT_DX_CLASS = "AGE_AT_DX";
export const AGE_SELECTION_MODE = {
  DECILE: "decile",
};
const OMOP_CLASS_DISPLAY_NAME_MAP = {
  AGE_AT_DX: "Age at Dx",
  ETHNICITY: "Ethnicity",
  GENDER: "Gender",
  RACE: "Race",
  CANCER: "Cancer",
};
const FILTER_VALUE_SORT_MODES = ["value-desc", "value-asc", "alpha-asc", "alpha-desc"];
export const DEFAULT_FILTER_VALUE_SORT_MODE = "alpha-asc";
export const FILTER_SORT_DIMENSION = {
  COUNT: "count",
  LABEL: "label",
};
export const FILTER_SORT_DIRECTION = {
  ASC: "asc",
  DESC: "desc",
};

export function normalizeChartSortMode(sortMode) {
  const normalizedSortMode = String(sortMode || "").trim();
  if (FILTER_VALUE_SORT_MODES.includes(normalizedSortMode)) {
    return normalizedSortMode;
  }
  return DEFAULT_FILTER_VALUE_SORT_MODE;
}

export function getSortDimensionFromMode(sortMode) {
  return String(sortMode || "").startsWith("alpha") ? FILTER_SORT_DIMENSION.LABEL : FILTER_SORT_DIMENSION.COUNT;
}

export function getSortDirectionFromMode(sortMode) {
  return String(sortMode || "").endsWith("asc") ? FILTER_SORT_DIRECTION.ASC : FILTER_SORT_DIRECTION.DESC;
}

export function toSortMode(sortDimension, sortDirection) {
  const nextDirection =
    sortDirection === FILTER_SORT_DIRECTION.ASC ? FILTER_SORT_DIRECTION.ASC : FILTER_SORT_DIRECTION.DESC;

  if (sortDimension === FILTER_SORT_DIMENSION.LABEL) {
    return nextDirection === FILTER_SORT_DIRECTION.ASC ? "alpha-asc" : "alpha-desc";
  }

  return nextDirection === FILTER_SORT_DIRECTION.ASC ? "value-asc" : "value-desc";
}

function normalizeClassLookupKey(value) {
  return normalizeClassName(value).replace(/[^A-Z0-9]+/g, "");
}

export function prettifyClassName(className, type = "") {
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

export function getFilterDisplayName(type, className) {
  return getFilterEntry(type, className)?.displayName || prettifyClassName(className, type);
}

export function getFilterDefaultSortMode(type, className) {
  return normalizeChartSortMode(getFilterEntry(type, className)?.defaultSortMode || DEFAULT_FILTER_VALUE_SORT_MODE);
}

export function getFilterCustomSortOrder(type, className) {
  const configuredOrder = getFilterEntry(type, className)?.customSortOrder;
  return Array.isArray(configuredOrder) ? configuredOrder : EMPTY_ARRAY;
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

export function withCompactFilterLabels(rows, type, className, isCompact) {
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

export function withCompactCustomSortOrder(sortOrder, type, className, isCompact) {
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

export function getFilterMaxHeightPx(type, className) {
  const numericMaxHeight = Number(getFilterEntry(type, className)?.maxHeightPx);
  if (!Number.isFinite(numericMaxHeight) || numericMaxHeight <= 0) {
    return null;
  }

  return Math.max(1, Math.round(numericMaxHeight));
}

export function isAttributeRollupClass(className) {
  const configuredFilter = getFilterEntry("attributes", className);
  if (configuredFilter) {
    return Boolean(configuredFilter.hasRollup);
  }
  return hasRollup(className);
}

export function toDisplayInstanceValue(type, className, value) {
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

export function toChartData(summaryRows, type, className) {
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

export function normalizeInstanceValues(values) {
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

export function buildAgeDecileChartData(rows) {
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

export function buildAgeDecileInstanceMap(rows) {
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

export function filterRowsByQuery(data, searchQuery) {
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
