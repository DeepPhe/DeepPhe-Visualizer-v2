/**
 * @typedef {"omop" | "attributes"} FilterType
 * @typedef {"value-desc" | "value-asc" | "alpha-asc" | "alpha-desc"} FilterSortMode
 * @typedef {"distribution" | "compact" | "auto"} FilterDisplayMode
 *
 * @typedef {Object} FilterEntry
 * @property {string} key Raw class name used in API requests
 * @property {FilterType} type
 * @property {string | undefined} displayName
 * @property {boolean} enabled
 * @property {boolean} hasRollup
 * @property {string | undefined} specialBehavior
 * @property {FilterSortMode} defaultSortMode
 * @property {string[] | undefined} customSortOrder
 * @property {FilterDisplayMode} displayMode
 * @property {number | undefined} maxHeightPx
 *
 * @typedef {Object} FilterSet
 * @property {string} id
 * @property {string} label
 * @property {string} row
 * @property {FilterEntry[]} filters
 * @property {boolean} defaultExpanded
 * @property {boolean} display
 */

const DEFAULT_SORT_MODE = "alpha-asc";
const VALID_SORT_MODES = new Set(["value-desc", "value-asc", "alpha-asc", "alpha-desc"]);
const DEFAULT_DISPLAY_MODE = "auto";
const VALID_DISPLAY_MODES = new Set(["distribution", "compact", "auto"]);
export const MIN_ROWS_FOR_DISTRIBUTION = 5;

function normalizeFilterType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "omop" || normalized === "attributes") {
    return normalized;
  }
  return "";
}

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function normalizeSortMode(value) {
  const normalized = String(value || "").trim();
  return VALID_SORT_MODES.has(normalized) ? normalized : DEFAULT_SORT_MODE;
}

function normalizeDisplayMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_DISPLAY_MODES.has(normalized) ? normalized : DEFAULT_DISPLAY_MODE;
}

function normalizeMaxHeightPx(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }

  return Math.max(1, Math.round(numericValue));
}

function normalizeFilterSetRow(value, fallback) {
  const normalized = String(value || "").trim();
  if (normalized) {
    return normalized;
  }
  return String(fallback || "").trim();
}

/**
 * @param {Partial<FilterEntry> & { key: string, type: FilterType }} filter
 * @returns {FilterEntry}
 */
function normalizeFilterEntry(filter) {
  return {
    key: String(filter.key || "").trim(),
    type: /** @type {FilterType} */ (normalizeFilterType(filter.type)),
    displayName:
      filter.displayName === undefined ? undefined : String(filter.displayName || "").trim(),
    enabled: filter.enabled !== false,
    hasRollup: Boolean(filter.hasRollup),
    specialBehavior:
      filter.specialBehavior === undefined
        ? undefined
        : String(filter.specialBehavior || "").trim(),
    defaultSortMode: normalizeSortMode(filter.defaultSortMode),
    customSortOrder: Array.isArray(filter.customSortOrder)
      ? [...new Set(filter.customSortOrder.map((item) => String(item || "").trim()).filter(Boolean))]
      : undefined,
    displayMode: normalizeDisplayMode(filter.displayMode),
    maxHeightPx: normalizeMaxHeightPx(filter.maxHeightPx),
  };
}

/**
 * @param {Partial<FilterSet> & { id: string, label: string, filters: FilterEntry[] }} filterSet
 * @returns {FilterSet}
 */
function normalizeFilterSet(filterSet) {
  const normalizedId = String(filterSet.id || "").trim();
  return {
    id: normalizedId,
    label: String(filterSet.label || "").trim(),
    row: normalizeFilterSetRow(filterSet.row, normalizedId),
    defaultExpanded: filterSet.defaultExpanded !== false,
    display: filterSet.display !== false,
    filters: Array.isArray(filterSet.filters)
      ? filterSet.filters.map((filter) => normalizeFilterEntry(filter))
      : [],
  };
}

function cloneFilterEntry(filter) {
  return {
    ...filter,
    customSortOrder: Array.isArray(filter.customSortOrder)
      ? [...filter.customSortOrder]
      : undefined,
  };
}

function cloneFilterSet(filterSet) {
  return {
    ...filterSet,
    filters: filterSet.filters.map((filter) => cloneFilterEntry(filter)),
  };
}

/** @type {FilterSet[]} */
const FILTER_SET_CONFIG = [
  {
    id: "cancer-type",
    label: "Cancer Type",
    row: "cohort-overview",
    display: true,
    defaultExpanded: true,
    filters: [{ key: "CANCER", type: "omop", displayName: "Cancer", displayMode: "compact" }],
  },
  {
    id: "demographics",
    label: "Demographics",
    row: "cohort-overview",
    display: true,
    defaultExpanded: true,
    filters: [
      {
        key: "AGE_AT_DX",
        type: "omop",
        displayName: "Age at Dx",
        specialBehavior: "ageDecile",
      },
      { key: "RACE", type: "omop", displayName: "Race" },
      { key: "GENDER", type: "omop", displayName: "Gender", displayMode: "distribution" },
      { key: "ETHNICITY", type: "omop", displayName: "Ethnicity", displayMode: "distribution" },
    ],
  },
  {
    id: "staging",
    label: "Staging",
    display: true,
    defaultExpanded: true,
    filters: [
      {
        key: "Stage",
        type: "attributes",
        maxHeightPx: 150,
        hasRollup: true,
        displayMode: "distribution",
        defaultSortMode: "alpha-asc",
        customSortOrder: [
          "Stage 0",
          "Stage I",
          "Stage Is",
          "Stage II",
          "Stage III",
          "Stage IV",
          "Advanced Stage",
        ],
      },
      { key: "Lymph Involvement", type: "attributes", maxHeightPx: 300 },
      {
        key: "T Stage",
        type: "attributes",
        hasRollup: true,
        defaultSortMode: "alpha-asc",
        customSortOrder: ["T0", "Tis", "Ta", "T1", "T2", "T3", "T4"],
      },
      {
        key: "N Stage",
        type: "attributes",
        hasRollup: true,
        defaultSortMode: "alpha-asc",
        customSortOrder: ["N0", "N1", "N2", "N3", "NX"],
      },
      {
        key: "M Stage",
        type: "attributes",
        hasRollup: true,
        displayMode: "compact",
        defaultSortMode: "alpha-asc",
        customSortOrder: ["M0", "M1", "MX"],
      }
    ],
  },
  {
    id: "biomarkers",
    label: "Biomarkers & Receptor Status",
    display: false,
    defaultExpanded: true,
    filters: [
      { key: "HER2/Neu Status", type: "attributes" },
      { key: "Estrogen Receptor Status", type: "attributes" },
      { key: "Progesterone Receptor Status", type: "attributes" },
      { key: "Receptor Status", type: "attributes" },
      { key: "Breast Cancer Type 1 Susceptibility Protein", type: "attributes" },
      { key: "Breast Cancer Type 2 Susceptibility Protein", type: "attributes" },
      { key: "Microsatellite Stable", type: "attributes" },
    ],
  },
  {
    id: "grading",
    label: "Grading",
    display: true,
    defaultExpanded: true,
    filters: [
      { key: "Grade_Numeric", type: "attributes", hasRollup: true },
      { key: "Grade_Differentiated", type: "attributes" },
      { key: "Grade_Tiered", type: "attributes" },
      { key: "Grade_Gleason", type: "attributes" },
    ],
  },
  {
    id: "anatomical-location",
    label: "Anatomical Location",
    display: false,
    defaultExpanded: true,
    filters: [
      { key: "Location", type: "attributes" },
      { key: "Topography major", type: "attributes" },
      { key: "Topography minor", type: "attributes" },
      { key: "Tissue", type: "attributes" },
      { key: "Metastatic Site", type: "attributes" },
      { key: "Quadrant", type: "attributes" },
      { key: "Laterality", type: "attributes" },
      { key: "Clockface", type: "attributes" },
    ],
  },
  {
    id: "tumor-characteristics",
    label: "Tumor Characteristics",
    display: false,
    defaultExpanded: true,
    filters: [
      { key: "Behavior", type: "attributes", hasRollup: true },
      { key: "Course", type: "attributes" },
    ],
  },
  {
    id: "clinical-history",
    label: "Clinical History",
    display: false,
    defaultExpanded: true,
    filters: [
      { key: "Comorbidities", type: "attributes" },
      { key: "Test Results", type: "attributes" },
      { key: "Genes", type: "attributes" },
      { key: "Treatments", type: "attributes" },
      { key: "Procedures", type: "attributes" },
    ],
  },
];

/**
 * Full ordered FilterSet config with normalized defaults.
 * @type {FilterSet[]}
 */
export const FILTER_SETS = FILTER_SET_CONFIG.map((filterSet) => normalizeFilterSet(filterSet));

const normalizedLookupByType = {
  omop: new Map(),
  attributes: new Map(),
};
const knownLookupKeysByType = {
  omop: new Set(),
  attributes: new Set(),
};

/**
 * Flat O(1) lookup map keyed by `type:class` (example: `omop:AGE_AT_DX`).
 * @type {Map<string, FilterEntry>}
 */
export const FILTER_ENTRY_BY_TYPE_CLASS = new Map();

FILTER_SETS.forEach((filterSet) => {
  filterSet.filters.forEach((filter) => {
    const filterType = normalizeFilterType(filter.type);
    if (!filterType) {
      throw new Error(`Invalid filter type for key "${filter.key}".`);
    }

    if (!filter.key) {
      throw new Error(`Invalid empty filter key in set "${filterSet.id}".`);
    }

    const rawMapKey = `${filterType}:${filter.key}`;
    if (FILTER_ENTRY_BY_TYPE_CLASS.has(rawMapKey)) {
      throw new Error(`Duplicate filter entry "${rawMapKey}".`);
    }
    FILTER_ENTRY_BY_TYPE_CLASS.set(rawMapKey, filter);

    const normalizedKey = normalizeLookupKey(filter.key);
    const normalizedMapKey = `${filterType}:${normalizedKey}`;
    if (normalizedLookupByType[filterType].has(normalizedMapKey)) {
      throw new Error(
        `Duplicate normalized filter entry "${normalizedMapKey}" in FilterSet configuration.`
      );
    }
    normalizedLookupByType[filterType].set(normalizedMapKey, filter);
    knownLookupKeysByType[filterType].add(normalizedKey);
  });
});

/**
 * Returns configured sets that include at least one enabled filter for the requested type.
 * @param {FilterType} type
 * @returns {FilterSet[]}
 */
export function getFilterSetsForType(type) {
  const normalizedType = normalizeFilterType(type);
  if (!normalizedType) {
    return [];
  }

  return FILTER_SETS.filter((filterSet) => filterSet.display).map((filterSet) => {
    const matchingFilters = filterSet.filters.filter(
      (filter) => filter.type === normalizedType && filter.enabled
    );
    if (matchingFilters.length === 0) {
      return null;
    }

    return {
      ...filterSet,
      filters: matchingFilters.map((filter) => cloneFilterEntry(filter)),
    };
  }).filter(Boolean);
}

/**
 * Returns the ordered list of enabled class keys for a type.
 * @param {FilterType} type
 * @returns {string[]}
 */
export function getOrderedClassesByType(type) {
  return getFilterSetsForType(type).flatMap((filterSet) =>
    filterSet.filters.map((filter) => filter.key)
  );
}

function createDefaultFilterEntry(type, key) {
  return normalizeFilterEntry({
    key,
    type,
    enabled: true,
    hasRollup: false,
    defaultSortMode: DEFAULT_SORT_MODE,
  });
}

/**
 * Resolves API class names into configured FilterSets and appends an Uncategorized set
 * for any API class not present in config.
 * @param {string[]} apiClasses
 * @param {FilterType} type
 * @returns {FilterSet[]}
 */
export function resolveFilterSetsWithExtras(apiClasses, type) {
  const normalizedType = normalizeFilterType(type);
  if (!normalizedType) {
    return [];
  }

  const availableRows = [];
  const availableByLookup = new Map();

  (Array.isArray(apiClasses) ? apiClasses : []).forEach((rawClassName) => {
    const className = String(rawClassName || "").trim();
    if (!className) {
      return;
    }

    const lookupKey = normalizeLookupKey(className);
    if (!lookupKey || availableByLookup.has(lookupKey)) {
      return;
    }

    const row = {
      className,
      lookupKey,
    };

    availableRows.push(row);
    availableByLookup.set(lookupKey, row);
  });

  if (availableRows.length === 0) {
    return [];
  }

  const resolvedSets = [];
  const usedLookupKeys = new Set();
  const configuredSets = getFilterSetsForType(normalizedType);

  configuredSets.forEach((filterSet) => {
    const matchedFilters = filterSet.filters
      .map((filter) => {
        const lookupKey = normalizeLookupKey(filter.key);
        const matchedClass = availableByLookup.get(lookupKey);
        if (!matchedClass || usedLookupKeys.has(lookupKey)) {
          return null;
        }

        usedLookupKeys.add(lookupKey);
        return normalizeFilterEntry({
          ...filter,
          key: matchedClass.className,
        });
      })
      .filter(Boolean);

    if (matchedFilters.length > 0) {
      resolvedSets.push({
        ...filterSet,
        filters: matchedFilters,
      });
    }
  });

  const uncategorizedFilters = availableRows
    .filter((row) => {
      if (usedLookupKeys.has(row.lookupKey)) {
        return false;
      }

      return !knownLookupKeysByType[normalizedType].has(row.lookupKey);
    })
    .map((row) => createDefaultFilterEntry(normalizedType, row.className));

  if (uncategorizedFilters.length > 0) {
    resolvedSets.push({
      id: `uncategorized-${normalizedType}`,
      label: "Uncategorized",
      row: `uncategorized-${normalizedType}`,
      display: true,
      defaultExpanded: true,
      filters: uncategorizedFilters,
    });
  }

  return resolvedSets.map((filterSet) => cloneFilterSet(filterSet));
}
