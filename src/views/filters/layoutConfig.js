export const FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT = Object.freeze({
  xs: 1,
  sm: 2,
  md: 3,
  lg: 6,
  xl: 6,
});

// Minimum on-screen widths used to cap how finely the breakpoint-based column
// counts may subdivide the available space. These keep filter cards readable
// (titles, bars, and counts not cut off) regardless of viewport width.
export const FILTER_SECTION_LANE_MIN_WIDTH_PX = 460;
export const FILTER_CARD_MIN_WIDTH_PX = 240;

/**
 * Reduce a configured column count so each resulting column is at least
 * `minColumnWidthPx` wide given `availableWidthPx`. When the available width is
 * unknown (0) the configured cap is returned unchanged.
 * @returns {number}
 */
export function capColumnsByWidth(configuredColumns, availableWidthPx, minColumnWidthPx) {
  const cap = Math.max(1, Math.floor(Number(configuredColumns) || 1));
  const width = Number(availableWidthPx) || 0;
  const minWidth = Math.max(1, Number(minColumnWidthPx) || 1);
  if (width <= 0) {
    return cap;
  }
  const widthCap = Math.max(1, Math.floor(width / minWidth));
  return Math.max(1, Math.min(cap, widthCap));
}

export const FILTER_SECTION_LABEL_SX = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "text.secondary",
  mb: 0.5,
};

export const FILTER_SET_RENDER_PRIORITY = Object.freeze([
  "demographics",
  "cancer-type",
  "tumor-anatomy",
  "staging",
  "pathology",
  "biomarkers",
  "treatment",
  "clinical-status",
  "uncategorized-omop",
  "uncategorized-attributes",
  "uncategorized-concepts",
]);

export const FILTER_SECTION_LAYOUT_COLUMNS = Object.freeze({
  compact: { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 },
  standard: { xs: 1, sm: 1, md: 2, lg: 3, xl: 3 },
});

export const DEFAULT_FILTER_SET_CARD_COLUMN_CAP = Object.freeze({
  xs: 1,
  sm: 1,
  md: 2,
  lg: 2,
  xl: 2,
});

export const FILTER_SET_CARD_COLUMN_CAP_BY_ID = Object.freeze({
  demographics: { xs: 1, sm: 1, md: 3, lg: 3, xl: 3 },
  "cancer-type": { xs: 1, sm: 1, md: 2, lg: 2, xl: 2 },
  "tumor-anatomy": { xs: 1, sm: 1, md: 2, lg: 3, xl: 3 },
  staging: { xs: 1, sm: 2, md: 2, lg: 3, xl: 3 },
  pathology: { xs: 1, sm: 1, md: 2, lg: 2, xl: 3 },
  biomarkers: { xs: 1, sm: 1, md: 2, lg: 2, xl: 3 },
  treatment: { xs: 1, sm: 1, md: 2, lg: 3, xl: 3 },
  "clinical-status": { xs: 1, sm: 1, md: 2, lg: 2, xl: 3 },
  "uncategorized-omop": { xs: 1, sm: 1, md: 2, lg: 2, xl: 2 },
  "uncategorized-attributes": { xs: 1, sm: 1, md: 2, lg: 2, xl: 2 },
  "uncategorized-concepts": { xs: 1, sm: 1, md: 2, lg: 2, xl: 2 },
});

// Minimum number of charted values a filter card must have to claim its own
// dedicated column. Tunable per density: standard rows are ~1.5x taller
// (rowHeight ~30 vs ~20), so a value list reaches "its own browseable lane"
// length at fewer values there; compact and compact-plus share the tighter row
// height and tolerate longer shared columns.
export const OVERSIZED_MIN_ROWS_BY_DENSITY = Object.freeze({
  standard: 18,
  compact: 25,
  "compact-plus": 25,
});

/**
 * Dedicated-column threshold for a density, in the form the layout machinery
 * expects. The packer compares `rowCount > threshold`, so this returns one less
 * than the inclusive minimum — a card with at least the configured minimum
 * number of charted values gets its own column.
 * @param {string} densityMode "standard" | "compact" | "compact-plus"
 * @returns {number}
 */
export function getOversizedRowThreshold(densityMode) {
  const minRows = OVERSIZED_MIN_ROWS_BY_DENSITY[densityMode] ?? OVERSIZED_MIN_ROWS_BY_DENSITY.standard;
  return Math.max(0, Math.floor(minRows) - 1);
}

export function resolvePackedGridSpan({ displayName = "", rowCount = 0 } = {}) {
  const safeRowCount = Math.max(0, Number(rowCount) || 0);
  const safeNameLength = String(displayName || "").trim().length;

  if (safeRowCount <= 2 && safeNameLength <= 14) {
    return { xs: 1, sm: 1, md: 1, lg: 2, xl: 2 };
  }
  if (safeRowCount >= 12 || safeNameLength >= 28) {
    return { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 };
  }
  if (safeRowCount >= 8 || safeNameLength >= 22) {
    return { xs: 1, sm: 2, md: 2, lg: 3, xl: 3 };
  }
  return { xs: 1, sm: 2, md: 2, lg: 3, xl: 3 };
}

export function toResolvedColumnCap(value, fallback = 1) {
  const numericValue = Number(value);
  const safeFallback = Math.max(1, Number(fallback) || 1);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.max(1, Math.floor(numericValue)) : safeFallback;
}

export function resolveResponsiveColumnCap(
  columnCapByBreakpoint = FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT,
  { isSmUp = false, isMdUp = false, isLgUp = false, isXlUp = false } = {}
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

export function getFilterSetCardColumnsByBreakpoint(
  filterSetId,
  itemCount = 1,
  { isSmUp = false, isMdUp = false, isLgUp = false, isXlUp = false } = {}
) {
  const spanConfig =
    FILTER_SET_CARD_COLUMN_CAP_BY_ID[String(filterSetId || "").trim()] || DEFAULT_FILTER_SET_CARD_COLUMN_CAP;
  const cappedItemCount = Math.max(1, Number(itemCount) || 1);
  const resolvedColumns = resolveResponsiveColumnCap(spanConfig, {
    isSmUp,
    isMdUp,
    isLgUp,
    isXlUp,
  });
  return Math.max(1, Math.min(cappedItemCount, resolvedColumns));
}

export function getFilterSetPriorityIndex(filterSetId) {
  const normalizedId = String(filterSetId || "").trim();
  const configuredIndex = FILTER_SET_RENDER_PRIORITY.indexOf(normalizedId);
  if (configuredIndex >= 0) {
    return configuredIndex;
  }
  return FILTER_SET_RENDER_PRIORITY.length;
}
