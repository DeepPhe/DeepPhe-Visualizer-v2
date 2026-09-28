import { toDisplayName } from "../utils/displayNames";

// Rows the matrix shows, in clinical reading order. Anything else a cancer
// carries is appended after these, so a new category is never silently dropped.
export const CANCER_COMPARISON_CATEGORIES = Object.freeze([
  "Location",
  "Laterality",
  "Histology",
  "Grade",
  "Stage",
  "Metastatic Site",
  "Genes",
]);

const TNM_KEYS = Object.freeze(["T", "N", "M"]);
export const TNM_CATEGORY = "TNM";

export function getFactLabel(fact = {}) {
  const rawLabel = String(fact?.value || fact?.prettyName || fact?.name || "").trim();
  if (!rawLabel) {
    return String(fact?.id || "Unknown").trim();
  }
  return toDisplayName(rawLabel) || rawLabel;
}

function normalizeCategoryName(value) {
  return String(value || "").trim();
}

/** Cancer-level facts keyed by their category name. */
function getCancerFactsByCategory(cancer = {}) {
  const byCategory = new Map();
  (Array.isArray(cancer?.collatedCancerFacts) ? cancer.collatedCancerFacts : []).forEach((group) => {
    const categoryName = normalizeCategoryName(group?.categoryName || group?.category);
    if (!categoryName) {
      return;
    }
    const facts = (Array.isArray(group?.facts) ? group.facts : []).filter((fact) =>
      String(fact?.id || "").trim()
    );
    byCategory.set(categoryName, [...(byCategory.get(categoryName) || []), ...facts]);
  });

  // TNM is read as one value ("T1 N0 M0"), so it is one row with the stage
  // letter carried on each fact rather than three rows a third full.
  const tnmData = cancer?.tnm?.[0]?.data || {};
  const tnmFacts = TNM_KEYS.flatMap((key) =>
    (Array.isArray(tnmData[key]) ? tnmData[key] : [])
      .filter((fact) => String(fact?.id || "").trim())
      .map((fact) => ({ ...fact, comparisonPrefix: key }))
  );
  byCategory.set(TNM_CATEGORY, tnmFacts);

  return byCategory;
}

/** One tumor's facts keyed by category name. */
function getTumorFactsByCategory(tumor = {}) {
  const byCategory = new Map();
  (Array.isArray(tumor?.data) ? tumor.data : []).forEach((category) => {
    const categoryName = normalizeCategoryName(category?.category);
    if (!categoryName) {
      return;
    }
    const facts = (Array.isArray(category?.facts) ? category.facts : []).filter((fact) =>
      String(fact?.id || "").trim()
    );
    byCategory.set(categoryName, [...(byCategory.get(categoryName) || []), ...facts]);
  });
  return byCategory;
}

function getTumors(cancer = {}) {
  return Array.isArray(cancer?.tumors?.listViewData) ? cancer.tumors.listViewData : [];
}

/** The cell's values as one comparable string: same facts, same key. */
function toValueKey(facts = []) {
  return facts
    .map((fact) => getFactLabel(fact).toLowerCase())
    .sort()
    .join("|");
}

function orderCategories(presentCategories) {
  const ordered = CANCER_COMPARISON_CATEGORIES.filter((category) =>
    presentCategories.has(category)
  );
  const extras = [...presentCategories]
    .filter((category) => !CANCER_COMPARISON_CATEGORIES.includes(category))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  return [...ordered, ...extras];
}

function buildRow({ key, label, factsByColumn, columns, cancerValueKeys }) {
  const cells = columns.map((column) => {
    const facts = factsByColumn.get(column.key) || [];
    const valueKey = toValueKey(facts);
    return {
      columnKey: column.key,
      facts,
      isUnknown: facts.length === 0,
      // A tumor repeating its cancer's value is noise; the matrix says so once
      // instead of printing the same long location six times.
      matchesCancer: Boolean(valueKey) && cancerValueKeys?.get(column.key) === valueKey,
      valueKey,
    };
  });

  const documentedCount = cells.filter((cell) => !cell.isUnknown).length;
  const allUnknown = documentedCount === 0;
  // A tumor row that only repeats its cancer adds nothing to the comparison.
  const repeatsCancer =
    !allUnknown && cells.every((cell) => cell.matchesCancer || cell.isUnknown);

  return {
    key,
    label,
    cells,
    // What the reader is here for: where the cancers disagree.
    differs: new Set(cells.map((cell) => cell.valueKey)).size > 1,
    documentedCount,
    allUnknown,
    repeatsCancer,
    // Nothing to compare: folded away behind a count rather than taking a line.
    isFoldable: allUnknown || repeatsCancer,
  };
}

/**
 * Reshapes the cancer summary into a comparison matrix: one column per cancer,
 * one row per attribute, tumors nested in their own sections. Three near
 * identical cards hide their differences; a matrix puts them in one column.
 *
 * Returns `{ columns, sections, hasData }`, with each cell carrying its facts
 * (so they stay clickable), whether it is undocumented, and whether a tumor
 * value simply repeats its cancer's.
 */
export function buildCancerComparisonMatrix(cancers = []) {
  const normalizedCancers = (Array.isArray(cancers) ? cancers : []).filter(Boolean);

  const columns = normalizedCancers.map((cancer, index) => ({
    key: String(cancer?.cancerId || cancer?.title || `cancer-${index + 1}`).trim(),
    label: `Cancer ${index + 1}`,
    title: String(cancer?.title || "").trim(),
  }));

  const cancerFacts = normalizedCancers.map(getCancerFactsByCategory);
  const tumorsByCancer = normalizedCancers.map(getTumors);
  const tumorCount = tumorsByCancer.reduce((most, tumors) => Math.max(most, tumors.length), 0);

  const cancerCategories = new Set();
  cancerFacts.forEach((byCategory) => {
    byCategory.forEach((facts, category) => {
      if (facts.length > 0 || category === TNM_CATEGORY) {
        cancerCategories.add(category);
      }
    });
  });

  const cancerRows = orderCategories(cancerCategories).map((category) =>
    buildRow({
      key: `cancer:${category}`,
      label: category === "Genes" ? "Gene(s)" : category,
      columns,
      factsByColumn: new Map(
        columns.map((column, index) => [column.key, cancerFacts[index].get(category) || []])
      ),
    })
  );

  const sections = [{ key: "cancer", label: "Cancer", rows: cancerRows }];

  for (let tumorIndex = 0; tumorIndex < tumorCount; tumorIndex += 1) {
    const tumorFacts = tumorsByCancer.map((tumors) => getTumorFactsByCategory(tumors[tumorIndex]));
    const categories = new Set();
    tumorFacts.forEach((byCategory) => {
      byCategory.forEach((facts, category) => {
        if (facts.length > 0) {
          categories.add(category);
        }
      });
    });
    if (categories.size === 0) {
      continue;
    }

    const rows = orderCategories(categories).map((category) => {
      const cancerValueKeys = new Map(
        columns.map((column, index) => [
          column.key,
          toValueKey(cancerFacts[index].get(category) || []),
        ])
      );
      return buildRow({
        key: `tumor-${tumorIndex + 1}:${category}`,
        label: category === "Genes" ? "Gene(s)" : category,
        columns,
        factsByColumn: new Map(
          columns.map((column, index) => [column.key, tumorFacts[index].get(category) || []])
        ),
        cancerValueKeys,
      });
    });

    sections.push({ key: `tumor-${tumorIndex + 1}`, label: `Tumor ${tumorIndex + 1}`, rows });
  }

  // "5 of 9 documented" per cancer, so a sparse record reads as sparse.
  const allRows = sections.flatMap((section) => section.rows);
  const columnsWithCompleteness = columns.map((column) => {
    const cells = allRows.map((row) => row.cells.find((cell) => cell.columnKey === column.key));
    return {
      ...column,
      documentedCount: cells.filter((cell) => cell && !cell.isUnknown).length,
      fieldCount: cells.length,
    };
  });

  return {
    columns: columnsWithCompleteness,
    sections,
    hasData: columns.length > 0 && allRows.length > 0,
  };
}
