import {
  AGE_DECILE_LABELS,
  COUNT_FIELDS,
  VALUE_FIELDS_BY_ATTRIBUTE,
} from "../constants/debugConstants";

/**
 * Normalizes API payload shapes to an array of row objects.
 * @param {unknown} payload
 * @returns {Array<object>}
 */
export function asRowArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

/**
 * Resolves the value/label field for a row using attribute-specific field priority.
 * @param {string} attribute
 * @param {Record<string, unknown>} row
 * @returns {string|undefined}
 */
export function getValueFromRow(attribute, row) {
  const normalizedAttribute = String(attribute || "").toUpperCase();
  const candidateFields = VALUE_FIELDS_BY_ATTRIBUTE[normalizedAttribute] || [
    "value",
    "label",
    "name",
    "classUri",
  ];

  for (const field of candidateFields) {
    const value = row?.[field];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return undefined;
}

/**
 * Extracts a numeric count from a row using known count fields.
 * Falls back to patient id cardinality and then 1.
 * @param {Record<string, unknown>} row
 * @returns {number}
 */
export function getCountFromRow(row) {
  for (const field of COUNT_FIELDS) {
    const rawCount = row?.[field];
    if (rawCount === undefined || rawCount === null || rawCount === "") {
      continue;
    }

    const parsedCount = Number(rawCount);
    if (Number.isFinite(parsedCount)) {
      return parsedCount;
    }
  }

  const patientIdsRaw = row?.patient_ids;
  if (Array.isArray(patientIdsRaw)) {
    return patientIdsRaw.length;
  }
  if (typeof patientIdsRaw === "string" && patientIdsRaw.trim()) {
    return patientIdsRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean).length;
  }

  return 1;
}

/**
 * Aggregates instance rows into [{ value, count }] summary rows.
 * @param {string} attribute
 * @param {unknown} payload
 * @returns {Array<{value: string, count: number}>}
 */
export function summarizeInstances(attribute, payload) {
  const rows = asRowArray(payload);
  const countsByValue = new Map();

  rows.forEach((row) => {
    const value = getValueFromRow(attribute, row);
    if (!value) {
      return;
    }
    const count = getCountFromRow(row);
    countsByValue.set(value, (countsByValue.get(value) || 0) + count);
  });

  return [...countsByValue.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Converts age-like values into decile bucket labels.
 * @param {unknown} value
 * @returns {string|undefined}
 */
export function getAgeDecileLabel(value) {
  const text = String(value || "").trim();
  if (!text) {
    return undefined;
  }

  const rangeMatch = text.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    if (Number.isFinite(start)) {
      const decileStart = Math.floor(start / 10) * 10;
      return decileStart >= 90 ? "90+" : `${decileStart}-${decileStart + 9}`;
    }
  }

  const plusMatch = text.match(/^(\d+)\+$/);
  if (plusMatch) {
    const start = Number(plusMatch[1]);
    if (Number.isFinite(start)) {
      const decileStart = Math.floor(start / 10) * 10;
      return decileStart >= 90 ? "90+" : `${decileStart}-${decileStart + 9}`;
    }
  }

  const firstNumberMatch = text.match(/\d+/);
  if (!firstNumberMatch) {
    return undefined;
  }

  const age = Number(firstNumberMatch[0]);
  if (!Number.isFinite(age)) {
    return undefined;
  }

  const decileStart = Math.floor(age / 10) * 10;
  return decileStart >= 90 ? "90+" : `${decileStart}-${decileStart + 9}`;
}

/**
 * Builds a complete decile distribution with zero-filled buckets.
 * @param {Array<{value?: unknown, count?: unknown}>} summary
 * @returns {Array<{label: string, count: number}>}
 */
export function getAgeDecileDistribution(summary = []) {
  const totalsByDecile = new Map(AGE_DECILE_LABELS.map((label) => [label, 0]));

  summary.forEach((item) => {
    const label = getAgeDecileLabel(item?.value);
    if (!label || !totalsByDecile.has(label)) {
      return;
    }

    const itemCount = Number(item?.count);
    const safeCount = Number.isFinite(itemCount) ? itemCount : 0;
    totalsByDecile.set(label, totalsByDecile.get(label) + safeCount);
  });

  return AGE_DECILE_LABELS.map((label) => ({
    label,
    count: totalsByDecile.get(label) || 0,
  }));
}

/**
 * Maps a summary into chart-friendly category distribution.
 * @param {Array<{value?: unknown, count?: unknown}>} summary
 * @returns {Array<{label: string, count: number}>}
 */
export function getCategoryDistribution(summary = []) {
  return summary
    .map((item) => ({
      label: String(item?.value || ""),
      count: Number(item?.count) || 0,
    }))
    .filter((item) => item.label);
}

/**
 * Sums total count across summary rows.
 * @param {Array<{count?: unknown}>} summary
 * @returns {number}
 */
export function getSummaryTotalCount(summary = []) {
  return summary.reduce((total, item) => total + (Number(item?.count) || 0), 0);
}

/**
 * Sorts distribution rows by label alphanumerically.
 * @param {Array<{label: string, count?: number}>} distribution
 * @returns {Array<{label: string, count?: number}>}
 */
export function sortDistributionAlphanumerically(distribution = []) {
  return [...distribution].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
  );
}

/**
 * Creates a stable DOM anchor id for section/value jump links.
 * @param {string} sectionKey
 * @param {string} value
 * @returns {string}
 */
export function getAnchorId(sectionKey, value) {
  const normalizedSection = String(sectionKey || "").toLowerCase();
  const normalizedValue = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalizedSection}-${normalizedValue || "item"}`;
}
