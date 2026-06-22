/**
 * Pure data pipeline for HorizontalBarFilter: normalize raw chart rows, apply
 * the active sort (flat or hierarchical, honoring a custom order), and format
 * count/label text. Kept free of React so it can be unit-tested in isolation.
 */
import { parsePatientIds } from "../../utils/patientIds";

// Layout constants shared by the geometry math (here) and the SVG render (in
// the component). Kept in the model so there is a single source of truth.
export const LEFT_PADDING = 6;
export const RIGHT_PADDING = 6;
export const COUNT_COLUMN_MIN_WIDTH = 38;
export const LABEL_COLUMN_MAX_SHARE = 0.42;
export const LABEL_COLUMN_SHARE_MULTIPLIER = 1.25;
export const HIERARCHY_ICON_HIT_WIDTH = 14;
export const HIERARCHY_CHILD_INDENT = 14;
export const PATIENT_DOT_RADIUS = 3;

export function truncateLabel(label, maxCharacters) {
  if (label.length <= maxCharacters) {
    return label;
  }
  return `${label.slice(0, Math.max(1, maxCharacters - 1))}…`;
}

export function formatCountLabel(totalValue, includedValue) {
  const numericTotalValue = Number(totalValue);
  const safeTotalValue = Number.isFinite(numericTotalValue)
    ? Math.max(0, Math.round(numericTotalValue))
    : 0;
  const totalLabel = safeTotalValue.toLocaleString();

  const numericIncludedValue = Number(includedValue);
  const hasIncludedValue = Number.isFinite(numericIncludedValue);
  if (!hasIncludedValue) {
    return totalLabel;
  }

  const safeIncludedValue = Math.max(0, Math.round(numericIncludedValue));
  const includedLabel = safeIncludedValue.toLocaleString();
  if (safeIncludedValue === safeTotalValue) {
    return totalLabel;
  }
  return `${includedLabel}/${totalLabel}`;
}

export function shouldShowPatientDots(row, threshold) {
  if (!row || threshold <= 0) {
    return false;
  }

  return row.value > 0 && row.value <= threshold && row.patientIds.length > 0;
}

export function toDotPatientIds(row) {
  const safeCount = Math.max(0, Math.round(Number(row?.value) || 0));
  if (safeCount === 0) {
    return [];
  }

  const explicitIds = Array.isArray(row?.patientIds)
    ? row.patientIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (explicitIds.length === 0) {
    return [];
  }

  if (explicitIds.length >= safeCount) {
    return explicitIds.slice(0, safeCount);
  }

  return explicitIds;
}

function normalizeCustomSortToken(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function createCustomSortIndexMap(customSortOrder = []) {
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

function compareWithCustomSortOrder(leftRow, rightRow, sortMode, customSortIndexMap) {
  if (!customSortIndexMap || !String(sortMode).startsWith("alpha")) {
    return null;
  }

  const leftIndex = customSortIndexMap.get(
    normalizeCustomSortToken(leftRow.displayLabel || leftRow.label)
  );
  const rightIndex = customSortIndexMap.get(
    normalizeCustomSortToken(rightRow.displayLabel || rightRow.label)
  );

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

export function compareRowsBySortMode(leftRow, rightRow, sortMode, customSortIndexMap = null) {
  const compareLabel = leftRow.displayLabel.localeCompare(rightRow.displayLabel, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  const customSortComparison = compareWithCustomSortOrder(
    leftRow,
    rightRow,
    sortMode,
    customSortIndexMap
  );

  if (customSortComparison !== null) {
    return customSortComparison;
  }

  if (sortMode === "value-asc") {
    if (leftRow.value !== rightRow.value) {
      return leftRow.value - rightRow.value;
    }
    return compareLabel;
  }

  if (sortMode === "alpha-asc") {
    return compareLabel;
  }

  if (sortMode === "alpha-desc") {
    return -compareLabel;
  }

  if (leftRow.value !== rightRow.value) {
    return rightRow.value - leftRow.value;
  }
  return compareLabel;
}

export function sortHierarchicalRows(rows, sortMode, customSortIndexMap = null) {
  const groups = [];
  let currentGroup = null;

  rows.forEach((row) => {
    if (!row.isChild) {
      currentGroup = {
        parent: row,
        children: [],
      };
      groups.push(currentGroup);
      return;
    }

    if (!currentGroup) {
      groups.push({
        parent: row,
        children: [],
      });
      return;
    }

    currentGroup.children.push(row);
  });

  groups.sort((leftGroup, rightGroup) => {
    return compareRowsBySortMode(
      leftGroup.parent,
      rightGroup.parent,
      sortMode,
      customSortIndexMap
    );
  });

  return groups.flatMap((group) => {
    if (group.children.length === 0) {
      return [group.parent];
    }

    const sortedChildren = [...group.children].sort((leftChild, rightChild) => {
      return compareRowsBySortMode(leftChild, rightChild, sortMode, customSortIndexMap);
    });

    return [group.parent, ...sortedChildren];
  });
}

/**
 * Reshape raw chart rows into the normalized shape the chart renders. Drops
 * rows with an empty label; coerces numeric/patient-id fields defensively.
 */
export function normalizeChartData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      const rawLabel = typeof item?.label === "string" ? item.label : String(item?.label ?? "");
      const label = rawLabel.trim();
      const rawDisplayLabel =
        typeof item?.displayLabel === "string" ? item.displayLabel : String(item?.displayLabel ?? "");
      const displayLabel = rawDisplayLabel.trim() || label;
      const numericValue = Number(item?.value);
      const value = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
      const numericIncludedValue = Number(item?.includedValue);
      const includedValue = Number.isFinite(numericIncludedValue) ? Math.max(0, numericIncludedValue) : undefined;
      const patientIds = parsePatientIds(
        item?.patientIds ?? item?.patient_ids ?? item?.patientId ?? item?.patient_id
      );
      return {
        label,
        displayLabel,
        value,
        includedValue,
        patientIds,
        isRolledUp: Boolean(item?._isRolledUp),
        isExpandable: Boolean(item?._expandable),
        isChild: Boolean(item?._isChild),
        isExpandedParent: Boolean(item?._isExpandedParent),
      };
    })
    .filter((item) => item.label.length > 0);
}

/**
 * Sort normalized rows by the active mode. Hierarchical data keeps parents with
 * their children; flat data is a straight comparator sort.
 */
export function sortChartData(normalizedData, { sortMode, customSortIndexMap = null, hasHierarchyRows = false } = {}) {
  const rows = [...(Array.isArray(normalizedData) ? normalizedData : [])];

  if (hasHierarchyRows) {
    return sortHierarchicalRows(rows, sortMode, customSortIndexMap);
  }

  rows.sort((leftRow, rightRow) => compareRowsBySortMode(leftRow, rightRow, sortMode, customSortIndexMap));
  return rows;
}

/**
 * Pure SVG layout math for the chart: row/bar/font metrics (density- and
 * font-scale aware), the label/bar/count column geometry pinned to the right
 * edge, and the intrinsic chart height. Returns every derived pixel metric the
 * render needs. No viewport/virtualization state — that stays in the component.
 */
export function computeChartGeometry({
  isCompactDensity,
  safeFontScale,
  safeBarRegionScale,
  chartWidth,
  maxLabelLength,
  maxCountLabelLength,
  hasHierarchyRows,
  rowCount,
}) {
  const textFontSize = isCompactDensity
    ? Math.max(9, Math.round(10.5 * safeFontScale))
    : Math.max(10, Math.round(12 * safeFontScale));
  const rowHeight = isCompactDensity
    ? Math.min(24, Math.max(18, Math.round(20 * safeFontScale)))
    : Math.min(34, Math.max(28, Math.round(30 * safeFontScale)));
  const barHeight = isCompactDensity
    ? Math.min(14, Math.max(10, Math.round(12 * safeFontScale)))
    : Math.min(22, Math.max(16, Math.round(18 * safeFontScale)));
  const dotRadius = Math.max(2, Math.round(PATIENT_DOT_RADIUS * safeFontScale));
  const dotHitRadius = Math.max(8, dotRadius + 4);
  const countColumnWidth = Math.max(
    COUNT_COLUMN_MIN_WIDTH,
    Math.ceil(maxCountLabelLength * textFontSize * 0.62) + 12
  );

  const hierarchyInsetWidth = hasHierarchyRows ? HIERARCHY_ICON_HIT_WIDTH + HIERARCHY_CHILD_INDENT : 0;
  const columnGap = Math.max(6, Math.round(8 * safeFontScale));
  // Pin count to the right edge first; derive bar region from remaining space.
  const countColumnStartX = chartWidth - RIGHT_PADDING - countColumnWidth;
  const labelBarRegionWidth = Math.max(0, countColumnStartX - columnGap - LEFT_PADDING);
  const estimatedLabelWidth = Math.ceil(maxLabelLength * textFontSize * 0.58) + 16 + hierarchyInsetWidth;
  const minLabelWidth = isCompactDensity
    ? Math.ceil(52 + safeFontScale * 6)
    : Math.ceil(78 + safeFontScale * 14);
  const maxLabelWidth = Math.max(
    isCompactDensity ? 60 : 82,
    Math.round(
      labelBarRegionWidth *
        (isCompactDensity ? 0.6 : LABEL_COLUMN_MAX_SHARE) *
        (isCompactDensity ? 1.0 : LABEL_COLUMN_SHARE_MULTIPLIER)
    )
  );
  const labelColumnWidth = Math.min(maxLabelWidth, Math.max(minLabelWidth, estimatedLabelWidth));
  const barStartX = LEFT_PADDING + labelColumnWidth + columnGap;
  const fullBarMaxWidth = Math.max(24, countColumnStartX - columnGap - barStartX);
  const barMaxWidth = Math.max(24, Math.round(fullBarMaxWidth * safeBarRegionScale));
  const maxLabelCharacters = Math.max(
    8,
    Math.floor((labelColumnWidth - 12 - hierarchyInsetWidth) / Math.max(1, textFontSize * 0.58))
  );

  const columnHeaderHeight = Math.max(24, Math.round(26 * safeFontScale));
  const columnHeaderFontSize = Math.max(10, Math.round(10 * safeFontScale));
  const verticalPaddingTop = isCompactDensity ? 3 : 10;
  const verticalPaddingBottom = isCompactDensity ? 3 : 10;
  const calculatedHeight = Math.max(
    rowHeight + verticalPaddingTop + verticalPaddingBottom,
    rowCount * rowHeight + verticalPaddingTop + verticalPaddingBottom
  );

  return {
    textFontSize,
    rowHeight,
    barHeight,
    dotRadius,
    dotHitRadius,
    countColumnWidth,
    hierarchyInsetWidth,
    columnGap,
    countColumnStartX,
    labelBarRegionWidth,
    estimatedLabelWidth,
    minLabelWidth,
    maxLabelWidth,
    labelColumnWidth,
    barStartX,
    fullBarMaxWidth,
    barMaxWidth,
    maxLabelCharacters,
    columnHeaderHeight,
    columnHeaderFontSize,
    verticalPaddingTop,
    verticalPaddingBottom,
    calculatedHeight,
  };
}
