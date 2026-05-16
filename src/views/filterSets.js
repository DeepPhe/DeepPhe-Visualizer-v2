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
  if (normalized === "omop" || normalized === "attributes" || normalized === "concepts") {
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
    compactLabelStripPrefix:
      typeof filter.compactLabelStripPrefix === "string" && filter.compactLabelStripPrefix.length > 0
        ? filter.compactLabelStripPrefix
        : undefined,
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
    standalone: filterSet.standalone === true,
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
    id: "demographics",
    label: "Patient",
    row: "cohort-overview",
    display: true,
    defaultExpanded: true,
    filters: [
      { key: "AGE_AT_DX", type: "omop", displayName: "Age at Dx", specialBehavior: "ageDecile" },
      { key: "RACE", type: "omop", displayName: "Race" },
      { key: "GENDER", type: "omop", displayName: "Gender", displayMode: "distribution" },
      { key: "ETHNICITY", type: "omop", displayName: "Ethnicity", displayMode: "distribution" },
    ],
  },
  {
    id: "cancer-type",
    label: "Cancer Type & Primary Site",
    row: "cohort-overview",
    display: true,
    defaultExpanded: true,
    filters: [
      { key: "CANCER", type: "omop", displayName: "Cancer", displayMode: "compact" },
      { key: "Location", type: "attributes", enabled: true },
      { key: "Topography, major", type: "attributes", enabled: true },
      { key: "Organ System", type: "attributes", enabled: true },
      { key: "Histology", type: "attributes", enabled: true },
      { key: "Disease or Disorder", type: "concepts", enabled: true },
      { key: "Neoplasm", type: "concepts", enabled: true },
    ],
  },
  {
    id: "tumor-anatomy",
    label: "Tumor Anatomy",
    display: true,
    defaultExpanded: true,
    filters: [
      { key: "Tissue", type: "attributes", enabled: true },
      { key: "Mass", type: "attributes", enabled: true },
      { key: "Topography, minor", type: "attributes", enabled: true },
      { key: "Quadrant", type: "attributes", enabled: true },
      { key: "Clockface", type: "attributes", enabled: true },
      { key: "Laterality", type: "attributes", enabled: true },
      { key: "Side", type: "attributes", enabled: true },
      { key: "Spatial Qualifier", type: "attributes", enabled: true },
      { key: "Body Part", type: "concepts", enabled: true },
      { key: "Position", type: "concepts", enabled: true },
      { key: "Body Fluid or Substance", type: "concepts", enabled: true },
    ],
  },
  {
    id: "staging",
    label: "Staging & Disease Extent",
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
        compactLabelStripPrefix: "Stage ",
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
      { key: "Disease Stage Qualifier", type: "attributes", enabled: true },
      {
        key: "T Stage",
        type: "attributes",
        hasRollup: true,
        defaultSortMode: "alpha-asc",
        compactLabelStripPrefix: "T",
        customSortOrder: ["T0", "Tis", "Ta", "T1", "T2", "T3", "T4"],
      },
      {
        key: "N Stage",
        type: "attributes",
        hasRollup: true,
        defaultSortMode: "alpha-asc",
        compactLabelStripPrefix: "N",
        customSortOrder: ["N0", "N1", "N2", "N3", "NX"],
      },
      {
        key: "M Stage",
        type: "attributes",
        hasRollup: true,
        displayMode: "compact",
        defaultSortMode: "alpha-asc",
        compactLabelStripPrefix: "M",
        customSortOrder: ["M0", "M1", "MX"],
      },
      { key: "Generic TNM Finding", type: "concepts", enabled: true },
      { key: "Pathologic TNM Finding", type: "concepts", enabled: true },
      { key: "Lymph Involvement", type: "attributes", maxHeightPx: 300 },
      { key: "Lymph Node", type: "concepts", enabled: true },
      { key: "Metastatic Site", type: "attributes", maxHeightPx: 220 },
      {
        key: "Behavior",
        type: "attributes",
        displayName: "Metastatic Behavior",
        displayMode: "compact",
        maxHeightPx: 220,
        defaultSortMode: "value-desc",
        customSortOrder: [
          "Metastatic",
          "Distantly Metastatic",
          "Locally Metastatic",
          "Malignant",
          "Invasive",
          "In Situ",
          "Borderline",
          "Benign",
        ],
      },
      { key: "Severity", type: "concepts", enabled: true },
      { key: "Finding", type: "concepts", enabled: true },
    ],
  },
  {
    id: "pathology",
    label: "Pathology & Grade",
    display: true,
    defaultExpanded: true,
    filters: [
      { key: "Grade", type: "attributes", hasRollup: true },
      { key: "Grade_Numeric", type: "attributes", hasRollup: true },
      { key: "Grade_Differentiated", type: "attributes" },
      { key: "Grade_Tiered", type: "attributes" },
      { key: "Grade_Gleason", type: "attributes" },
      { key: "Disease Grade Qualifier", type: "concepts", enabled: true },
      { key: "Test Results", type: "attributes", displayName: "Histologic Features", enabled: true },
      { key: "Pathologic Process", type: "concepts", enabled: true },
    ],
  },
  {
    id: "biomarkers",
    label: "Molecular Markers & Biomarkers",
    row: "clinical-treatment",
    display: true,
    defaultExpanded: true,
    filters: [
      { key: "HER2/Neu Status", type: "attributes", enabled: true },
      { key: "Estrogen Receptor Status", type: "attributes", enabled: true },
      { key: "Progesterone Receptor Status", type: "attributes", enabled: true },
      { key: "Receptor Status", type: "attributes", enabled: true },
      {
        key: "Microsatellite Stable",
        type: "attributes",
        displayName: "Microsatellite Status",
        enabled: true,
        defaultSortMode: "alpha-asc",
        customSortOrder: ["MSI-High", "MSI-Low", "MSS"],
      },
      {
        key: "Breast Cancer Type 1 Susceptibility Protein",
        type: "attributes",
        displayName: "BRCA1",
        enabled: true,
      },
      {
        key: "Breast Cancer Type 2 Susceptibility Protein",
        type: "attributes",
        displayName: "BRCA2",
        enabled: true,
      },
      { key: "Genes", type: "attributes", enabled: true },
      { key: "Gene", type: "concepts", enabled: true },
      { key: "Gene Product", type: "concepts", enabled: true },
      { key: "Clinical Test Result", type: "concepts", enabled: true },
      { key: "Quantitative Concept", type: "concepts", enabled: true },
    ],
  },
  {
    id: "clinical-status",
    label: "Clinical Status",
    row: "clinical-treatment",
    display: true,
    defaultExpanded: true,
    filters: [
      { key: "Performance Status", type: "attributes", enabled: true },
      { key: "Course", type: "attributes", displayName: "Disease Course/Response", enabled: true },
      { key: "Comorbidities", type: "attributes", enabled: true },
      { key: "Clinical Course of Disease", type: "concepts", enabled: true },
      { key: "Disease Qualifier", type: "concepts", enabled: true },
      { key: "Property or Attribute", type: "concepts", enabled: true },
      { key: "General Qualifier", type: "concepts", enabled: true },
      { key: "Temporal Qualifier", type: "concepts", enabled: true },
    ],
  },
  {
    id: "treatment",
    label: "Treatment & Interventions",
    row: "clinical-treatment",
    display: true,
    defaultExpanded: true,
    filters: [
      { key: "Treatments", type: "attributes", enabled: true },
      { key: "Procedures", type: "attributes", enabled: true },
      { key: "Diagnostic Procedures", type: "attributes", enabled: true },
      { key: "Diagnostic Procedure", type: "attributes", enabled: true },
      { key: "Therapeutic Procedures/Surgery", type: "attributes", enabled: true },
      { key: "Therapeutic Procedures", type: "attributes", enabled: true },
      { key: "Surgery", type: "attributes", enabled: true },
      { key: "Pharmacologic Substance", type: "concepts", enabled: true },
      { key: "Chemo/immuno/hormone Therapy Regimen", type: "concepts", enabled: true },
      { key: "Intervention or Procedure", type: "concepts", enabled: true },
      { key: "Imaging Device", type: "concepts", enabled: true },
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
  concepts: new Map(),
};
const knownLookupKeysByType = {
  omop: new Set(),
  attributes: new Set(),
  concepts: new Set(),
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

/**
 * Resolves a merged list of FilterSets containing both attribute and concept filters,
 * in the oncologist-configured order. Omop filters in the config are skipped here
 * (omop is handled separately). Appends uncategorized sections for any API classes
 * not matched in the config.
 * @param {{ attributes: string[], concepts: string[] }} param0
 * @returns {FilterSet[]}
 */
export function resolveFilterSetsForAttributesAndConcepts({
  attributes: attrClasses,
  concepts: conceptClasses,
} = {}) {
  const makeAvailableMap = (apiClasses) => {
    const map = new Map();
    (Array.isArray(apiClasses) ? apiClasses : []).forEach((raw) => {
      const className = String(raw || "").trim();
      if (!className) return;
      const key = normalizeLookupKey(className);
      if (key && !map.has(key)) map.set(key, className);
    });
    return map;
  };

  const availableByType = {
    attributes: makeAvailableMap(attrClasses),
    concepts: makeAvailableMap(conceptClasses),
  };
  const usedByType = { attributes: new Set(), concepts: new Set() };

  const resolvedSets = [];

  FILTER_SETS.forEach((filterSet) => {
    if (filterSet.display === false) return;

    const matchedFilters = filterSet.filters
      .filter((f) => f.type === "attributes" || f.type === "concepts")
      .map((filter) => {
        const type = filter.type;
        const available = availableByType[type];
        if (!available) return null;
        const lookupKey = normalizeLookupKey(filter.key);
        const matchedClass = available.get(lookupKey);
        if (!matchedClass || usedByType[type].has(lookupKey)) return null;
        usedByType[type].add(lookupKey);
        return normalizeFilterEntry({ ...filter, key: matchedClass });
      })
      .filter(Boolean);

    if (matchedFilters.length > 0) {
      resolvedSets.push({ ...filterSet, filters: matchedFilters });
    }
  });

  // Uncategorized attributes
  const uncatAttr = [];
  availableByType.attributes.forEach((className, lookupKey) => {
    if (usedByType.attributes.has(lookupKey)) return;
    if (knownLookupKeysByType.attributes.has(lookupKey)) return;
    uncatAttr.push(createDefaultFilterEntry("attributes", className));
  });
  if (uncatAttr.length > 0) {
    resolvedSets.push({
      id: "uncategorized-attributes",
      label: "Uncategorized",
      row: "uncategorized-attributes",
      display: true,
      defaultExpanded: true,
      filters: uncatAttr,
    });
  }

  // Uncategorized concepts
  const uncatConcept = [];
  availableByType.concepts.forEach((className, lookupKey) => {
    if (usedByType.concepts.has(lookupKey)) return;
    if (knownLookupKeysByType.concepts.has(lookupKey)) return;
    uncatConcept.push(createDefaultFilterEntry("concepts", className));
  });
  if (uncatConcept.length > 0) {
    resolvedSets.push({
      id: "uncategorized-concepts",
      label: "Uncategorized Concepts",
      row: "uncategorized-concepts",
      display: true,
      defaultExpanded: true,
      filters: uncatConcept,
    });
  }

  return resolvedSets.map((filterSet) => cloneFilterSet(filterSet));
}
