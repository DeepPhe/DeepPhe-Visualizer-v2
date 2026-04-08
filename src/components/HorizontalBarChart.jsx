import React, { useEffect, useMemo, useRef, useState, useId } from "react";
import PropTypes from "prop-types";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SortIcon from "@mui/icons-material/Sort";
import PatientSummaryTooltip from "./PatientSummaryTooltip";

const SORT_MODES = ["value-desc", "value-asc", "alpha-asc", "alpha-desc"];
const VALUE_SORT_MODES = ["value-desc", "value-asc"];
const SORT_MODE_LABELS = {
  "value-desc": "count: highest first",
  "value-asc": "count: lowest first",
  "alpha-asc": "value: A to Z",
  "alpha-desc": "value: Z to A",
};
const DEFAULT_SORT_MODE = "value-desc";
const DEFAULT_TITLE = "Horizontal Bar Chart";
const NOOP = () => {};

const FALLBACK_CHART_WIDTH = 780;
const MIN_CHART_WIDTH = 280;
const LEFT_PADDING = 10;
const RIGHT_PADDING = 10;
const COUNT_COLUMN_MIN_WIDTH = 52;
const HIERARCHY_ICON_HIT_WIDTH = 14;
const HIERARCHY_CHILD_INDENT = 14;
const PATIENT_DOT_RADIUS = 3;

const visuallyHiddenStyles = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function clampFontScale(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 1;
  }
  return Math.max(0.5, Math.min(2, numericValue));
}

function getNextSortMode(currentMode, modes) {
  const currentIndex = modes.indexOf(currentMode);
  if (currentIndex < 0) {
    return modes[0];
  }
  return modes[(currentIndex + 1) % modes.length];
}

function truncateLabel(label, maxCharacters) {
  if (label.length <= maxCharacters) {
    return label;
  }
  return `${label.slice(0, Math.max(1, maxCharacters - 1))}\u2026`;
}

function formatCountLabel(totalValue, includedValue) {
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

function normalizePatientIds(rawValue) {
  const ids = [];

  if (Array.isArray(rawValue)) {
    rawValue
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .forEach((id) => ids.push(id));
  } else if (typeof rawValue === "string") {
    rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((id) => ids.push(id));
  } else if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
    const textValue = String(rawValue).trim();
    if (textValue) {
      ids.push(textValue);
    }
  }

  return [...new Set(ids)];
}

function shouldShowPatientDots(row, threshold) {
  if (!row || threshold <= 0) {
    return false;
  }

  return row.value > 0 && row.value <= threshold && row.patientIds.length > 0;
}

function toDotPatientIds(row) {
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

function getSortDimension(mode) {
  return String(mode).startsWith("alpha") ? "instance" : "count";
}

function getSortModesForDimension(dimension, availableModes) {
  const preferredModes =
    dimension === "instance" ? ["alpha-asc", "alpha-desc"] : ["value-desc", "value-asc"];
  const filteredModes = preferredModes.filter((mode) => availableModes.includes(mode));

  return filteredModes.length > 0 ? filteredModes : availableModes;
}

function getDefaultSortModeForDimension(dimension, availableModes) {
  const preferredModes =
    dimension === "instance" ? ["alpha-asc", "alpha-desc"] : ["value-desc", "value-asc"];
  const nextMode = preferredModes.find((mode) => availableModes.includes(mode));

  return nextMode || availableModes[0];
}

function normalizeCustomSortToken(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function createCustomSortIndexMap(customSortOrder = []) {
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

function compareRowsBySortMode(leftRow, rightRow, sortMode, customSortIndexMap = null) {
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

function sortHierarchicalRows(rows, sortMode, customSortIndexMap = null) {
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

export default function HorizontalBarChart({
  title = "",
  data = [],
  selectedValues = [],
  onSelectionChange,
  onRowToggleExpand,
  onSortDimensionChange = NOOP,
  onSortModeChange,
  height,
  fillContainer = false,
  fontScale = 1,
  defaultExpanded = true,
  defaultSort = DEFAULT_SORT_MODE,
  sortValuesOnly = false,
  showTitle = true,
  allowCollapse = true,
  showSortDimensionToggle = false,
  showSortCycleButton = true,
  customSortOrder = [],
  inlinePatientIdsThreshold = 0,
  getPatientSummary,
}) {
  const theme = useTheme();
  const generatedId = useId();
  const chartRegionId = `${generatedId}-chart-region`;

  const availableSortModes = useMemo(
    () => (sortValuesOnly ? VALUE_SORT_MODES : SORT_MODES),
    [sortValuesOnly]
  );
  const safeFontScale = clampFontScale(fontScale);
  const [isExpanded, setIsExpanded] = useState(Boolean(defaultExpanded));
  const [sortMode, setSortMode] = useState(
    availableSortModes.includes(defaultSort) ? defaultSort : availableSortModes[0]
  );
  const [sortAnnouncement, setSortAnnouncement] = useState("");
  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(FALLBACK_CHART_WIDTH);
  const [hoveredRowIndex, setHoveredRowIndex] = useState(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState(null);
  const hoverTimerRef = useRef(null);
  const hoverRequestIdRef = useRef(0);
  const [summaryTooltipState, setSummaryTooltipState] = useState({
    open: false,
    anchorEl: null,
    summaryData: null,
    pinned: false,
  });
  const isChartExpanded = allowCollapse ? isExpanded : true;
  const sortDimension = getSortDimension(sortMode);
  const sortModesForCurrentDimension = getSortModesForDimension(
    sortDimension,
    availableSortModes
  );

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) {
      return undefined;
    }

    const updateWidth = (nextWidth) => {
      const resolvedWidth = Number(nextWidth) || element.clientWidth;
      setChartWidth(Math.max(MIN_CHART_WIDTH, Math.floor(resolvedWidth)));
    };

    updateWidth(element.clientWidth);

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries.length === 0) {
          return;
        }
        updateWidth(entries[0].contentRect.width);
      });

      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    }

    if (typeof window !== "undefined") {
      const handleResize = () => updateWidth(element.clientWidth);
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    return undefined;
  }, [isChartExpanded]);

  useEffect(() => {
    if (availableSortModes.includes(sortMode)) {
      return;
    }
    setSortMode(availableSortModes[0]);
  }, [availableSortModes, sortMode]);
  useEffect(() => {
    if (typeof onSortModeChange !== "function") {
      return;
    }
    onSortModeChange(sortMode);
  }, [onSortModeChange, sortMode]);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearHoverTimer();
    },
    []
  );

  const normalizedData = useMemo(() => {
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
        const includedValue = Number.isFinite(numericIncludedValue)
          ? Math.max(0, numericIncludedValue)
          : undefined;
        const patientIds = normalizePatientIds(
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
  }, [data]);
  const hasHierarchyRows = useMemo(
    () =>
      normalizedData.some(
        (row) =>
          row.isRolledUp || row.isExpandable || row.isChild || row.isExpandedParent
      ),
    [normalizedData]
  );
  const showColumnSortHeader =
    showSortDimensionToggle &&
    availableSortModes.some((mode) => mode.startsWith("alpha")) &&
    availableSortModes.some((mode) => mode.startsWith("value"));
  const showSortCycleControl = showSortCycleButton;
  const safeSelectedValues = useMemo(
    () => (Array.isArray(selectedValues) ? selectedValues : []),
    [selectedValues]
  );
  const selectedSet = useMemo(() => new Set(safeSelectedValues), [safeSelectedValues]);
  const hasSelections = selectedSet.size > 0;
  const isInteractive = typeof onSelectionChange === "function";
  const customSortIndexMap = useMemo(
    () => createCustomSortIndexMap(customSortOrder),
    [customSortOrder]
  );

  const sortedData = useMemo(() => {
    const rows = [...normalizedData];

    if (hasHierarchyRows) {
      return sortHierarchicalRows(rows, sortMode, customSortIndexMap);
    }

    rows.sort((leftRow, rightRow) =>
      compareRowsBySortMode(leftRow, rightRow, sortMode, customSortIndexMap)
    );

    return rows;
  }, [customSortIndexMap, hasHierarchyRows, normalizedData, sortMode]);

  const maxValue = useMemo(
    () => sortedData.reduce((currentMax, row) => Math.max(currentMax, row.value), 0),
    [sortedData]
  );
  const maxLabelLength = useMemo(
    () => sortedData.reduce((currentMax, row) => Math.max(currentMax, row.displayLabel.length), 0),
    [sortedData]
  );
  const maxCountLabelLength = useMemo(
    () =>
      sortedData.reduce(
        (currentMax, row) => Math.max(currentMax, formatCountLabel(row.value, row.includedValue).length),
        0
      ),
    [sortedData]
  );

  const textFontSize = Math.max(10, Math.round(12 * safeFontScale));
  const rowHeight = Math.min(34, Math.max(28, Math.round(30 * safeFontScale)));
  const barHeight = Math.min(22, Math.max(16, Math.round(18 * safeFontScale)));
  const dotRadius = Math.max(2, Math.round(PATIENT_DOT_RADIUS * safeFontScale));
  const countColumnWidth = Math.max(
    COUNT_COLUMN_MIN_WIDTH,
    Math.ceil(maxCountLabelLength * textFontSize * 0.62) + 12
  );

  const availableWidth = Math.max(
    MIN_CHART_WIDTH,
    chartWidth - LEFT_PADDING - RIGHT_PADDING - countColumnWidth
  );
  const hierarchyInsetWidth = hasHierarchyRows
    ? HIERARCHY_ICON_HIT_WIDTH + HIERARCHY_CHILD_INDENT
    : 0;
  const estimatedLabelWidth = Math.ceil(maxLabelLength * textFontSize * 0.58) + 16 + hierarchyInsetWidth;
  const minLabelWidth = Math.ceil(78 + safeFontScale * 14);
  const maxLabelWidth = Math.max(82, Math.round(availableWidth * 0.42));
  const labelColumnWidth = Math.min(
    maxLabelWidth,
    Math.max(minLabelWidth, estimatedLabelWidth)
  );
  const columnGap = Math.max(6, Math.round(8 * safeFontScale));
  const barStartX = LEFT_PADDING + labelColumnWidth + columnGap;
  const barMaxWidth = Math.max(
    24,
    chartWidth - RIGHT_PADDING - countColumnWidth - columnGap - barStartX
  );
  const maxLabelCharacters = Math.max(
    8,
    Math.floor((labelColumnWidth - 12 - hierarchyInsetWidth) / Math.max(1, textFontSize * 0.58))
  );

  const columnHeaderHeight = Math.max(24, Math.round(26 * safeFontScale));
  const columnHeaderFontSize = Math.max(10, Math.round(10 * safeFontScale));
  const verticalPaddingTop = 10;
  const verticalPaddingBottom = 10;
  const calculatedHeight = Math.max(
    rowHeight + verticalPaddingTop + verticalPaddingBottom,
    sortedData.length * rowHeight + verticalPaddingTop + verticalPaddingBottom
  );
  const viewportHeight = fillContainer
    ? undefined
    : typeof height === "number" && height > 0
      ? height
      : Math.min(calculatedHeight, 420);

  // Theme custom tokens
  const custom = theme.custom || {};
  const barTrackColor = custom.barTrack || "transparent";
  const barFillColor = custom.barFill || theme.palette.primary.main;
  const barActiveColor = custom.barActive || theme.palette.primary.main;
  const barMinWidth = parseInt(custom.barMinWidth, 10) || 3;
  const selectedLabelWeight = custom.selectedLabelWeight || 600;
  const selectedCountColor = custom.selectedCountColor || theme.palette.primary.light;
  const countFontFamily = custom.countFontFamily || "inherit";
  const categoryLabelColor = custom.categoryLabelColor || theme.palette.text.primary;
  const focusRing = custom.focusRing || theme.palette.primary.main;
  const focusRingWidth = Number.parseFloat(custom.focusRingWidth) || 2;
  const rowHoverFill = custom.rowHoverBg || (
    theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)"
  );
  const sortIconActiveColor = custom.barActive || theme.palette.primary.main;
  const sortIconInactiveColor = theme.palette.text.disabled || theme.palette.text.secondary;

  const stripeFill =
    theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
  const selectedRowFill = custom.rowHoverBg || (
    theme.palette.mode === "dark" ? "rgba(144, 202, 249, 0.16)" : "rgba(25, 118, 210, 0.14)"
  );
  const currentSortLabel = SORT_MODE_LABELS[sortMode];
  const nextSortMode = getNextSortMode(sortMode, sortModesForCurrentDimension);
  const nextSortLabel = SORT_MODE_LABELS[nextSortMode];
  const sortButtonLabel = `Currently sorted ${currentSortLabel}. Click to sort ${nextSortLabel}.`;
  const isAscending = String(sortMode).endsWith("asc");
  const activeDirectionGlyph = isAscending ? "\u25b2" : "\u25bc";

  const resolvedTitle = String(title || "").trim();
  const showInlineTitle = showTitle && resolvedTitle.length > 0;
  const shouldRenderHeaderRow = allowCollapse || showInlineTitle || showSortCycleControl;
  const chartAriaLabel = resolvedTitle ? `${resolvedTitle} horizontal bar chart` : DEFAULT_TITLE;
  const chartRegionAriaLabel = resolvedTitle
    ? `${resolvedTitle} chart region`
    : "Horizontal bar chart region";
  const toggleButtonLabel = resolvedTitle
    ? `${isChartExpanded ? "Collapse" : "Expand"} ${resolvedTitle} chart`
    : `${isChartExpanded ? "Collapse" : "Expand"} chart`;

  const handleToggleExpanded = () => {
    if (!allowCollapse) {
      return;
    }
    setIsExpanded((previousState) => !previousState);
  };

  const handleSortClick = () => {
    const nextMode = getNextSortMode(sortMode, sortModesForCurrentDimension);
    setSortMode(nextMode);
    setSortAnnouncement(`Sort order changed to ${SORT_MODE_LABELS[nextMode]}.`);
  };

  const handleColumnSortClick = (nextDimension) => {
    if (!nextDimension) {
      return;
    }

    const modesForDimension = getSortModesForDimension(nextDimension, availableSortModes);
    if (modesForDimension.length === 0) {
      return;
    }

    const nextMode =
      nextDimension === sortDimension
        ? getNextSortMode(sortMode, modesForDimension)
        : getDefaultSortModeForDimension(nextDimension, availableSortModes);
    setSortMode(nextMode);
    setSortAnnouncement(`Sort order changed to ${SORT_MODE_LABELS[nextMode]}.`);

    if (nextDimension !== sortDimension) {
      onSortDimensionChange(nextDimension);
    }
  };

  const handleToggleSelection = (label) => {
    if (!isInteractive) {
      return;
    }

    if (selectedSet.has(label)) {
      onSelectionChange(safeSelectedValues.filter((value) => value !== label));
      return;
    }

    onSelectionChange([...new Set([...safeSelectedValues, label])]);
  };
  const handleToggleExpandedRow = (row) => {
    if (!row?.isExpandable || typeof onRowToggleExpand !== "function") {
      return;
    }

    onRowToggleExpand(row.label, !row.isExpandedParent, row);
  };
  const openPatientSummary = (anchorNode, patientId, delayMs = 0, pinned = false) => {
    if (typeof getPatientSummary !== "function") {
      return;
    }

    clearHoverTimer();
    const requestId = hoverRequestIdRef.current + 1;
    hoverRequestIdRef.current = requestId;

    const run = async () => {
      try {
        const summary = await getPatientSummary(patientId);
        if (hoverRequestIdRef.current !== requestId) {
          return;
        }
        setSummaryTooltipState({
          open: true,
          anchorEl: anchorNode,
          summaryData: summary || null,
          pinned,
        });
      } catch {
        if (hoverRequestIdRef.current !== requestId) {
          return;
        }
        setSummaryTooltipState({
          open: false,
          anchorEl: null,
          summaryData: null,
          pinned: false,
        });
      }
    };

    if (delayMs > 0) {
      hoverTimerRef.current = setTimeout(run, delayMs);
      return;
    }

    run();
  };
  const handlePatientDotClick = (event, patientId) => {
    openPatientSummary(event.currentTarget, patientId, 0, true);
  };
  const handlePatientDotMouseEnter = (event, patientId) => {
    openPatientSummary(event.currentTarget, patientId, 200, false);
  };
  const handlePatientDotMouseLeave = () => {
    hoverRequestIdRef.current += 1;
    clearHoverTimer();
    setSummaryTooltipState((previousState) => ({
      ...(previousState.pinned
        ? previousState
        : {
            ...previousState,
            open: false,
            anchorEl: null,
          }),
    }));
  };
  const handleSummaryTooltipClose = () => {
    hoverRequestIdRef.current += 1;
    clearHoverTimer();
    setSummaryTooltipState((previousState) => ({
      ...previousState,
      open: false,
      anchorEl: null,
      pinned: false,
    }));
  };

  return (
    <Box
      sx={{
        width: "100%",
        ...(fillContainer
          ? {
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }
          : {}),
      }}
    >
      {shouldRenderHeaderRow ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, minHeight: 32 }}>
            {allowCollapse ? (
              <Box
                component="button"
                type="button"
                aria-expanded={isChartExpanded}
                aria-controls={chartRegionId}
                aria-label={toggleButtonLabel}
                onClick={handleToggleExpanded}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  p: 0,
                  border: "none",
                  backgroundColor: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                  minHeight: 32,
                  font: "inherit",
                  "&:focus-visible": {
                    outline: `${focusRingWidth}px solid ${focusRing}`,
                    outlineOffset: 2,
                    borderRadius: 1,
                  },
                }}
              >
                <ExpandMoreIcon
                  aria-hidden="true"
                  sx={{
                    transform: isChartExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 200ms ease",
                    "@media (prefers-reduced-motion: reduce)": {
                      transition: "none",
                    },
                  }}
                />
                {showInlineTitle ? (
                  <Typography
                    variant="subtitle1"
                    color="text.primary"
                    sx={{
                      fontWeight: 600,
                      fontSize: `calc(${theme.typography.subtitle1.fontSize} * ${safeFontScale})`,
                    }}
                  >
                    {resolvedTitle}
                  </Typography>
                ) : null}
              </Box>
            ) : showInlineTitle ? (
              <Typography
                variant="subtitle1"
                color="text.primary"
                sx={{
                  fontWeight: 600,
                  fontSize: `calc(${theme.typography.subtitle1.fontSize} * ${safeFontScale})`,
                }}
              >
                {resolvedTitle}
              </Typography>
            ) : null}
          </Box>

          {showSortCycleControl ? (
            <Tooltip title={`Sort: ${currentSortLabel}`}>
              <IconButton
                size="small"
                aria-label={sortButtonLabel}
                onClick={handleSortClick}
              >
                <SortIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>
      ) : null}

      <Box component="span" aria-live="polite" sx={visuallyHiddenStyles}>
        {sortAnnouncement}
      </Box>

      <Box
        id={chartRegionId}
        role="region"
        aria-label={chartRegionAriaLabel}
        hidden={!isChartExpanded}
        sx={{
          width: "100%",
          mt: shouldRenderHeaderRow ? 1.25 : 0,
          display: isChartExpanded ? (fillContainer ? "flex" : "block") : "none",
          ...(fillContainer
            ? {
                flex: 1,
                minHeight: 0,
                flexDirection: "column",
              }
            : {}),
        }}
      >
        {showColumnSortHeader ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: `${columnGap}px`,
              px: `${LEFT_PADDING}px`,
              pr: `${RIGHT_PADDING}px`,
              pb: 0.5,
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => handleColumnSortClick("instance")}
              aria-label={`Sort by label. Current order: ${currentSortLabel}.`}
              aria-pressed={sortDimension === "instance"}
              sx={{
                width: `${labelColumnWidth}px`,
                minWidth: `${labelColumnWidth}px`,
                maxWidth: `${labelColumnWidth}px`,
                minHeight: `${columnHeaderHeight}px`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 0.5,
                px: 0.75,
                border: "none",
                borderBottom: `2px solid ${
                  sortDimension === "instance" ? sortIconActiveColor : "transparent"
                }`,
                borderRadius: "4px 4px 0 0",
                backgroundColor: "transparent",
                color:
                  sortDimension === "instance" ? sortIconActiveColor : sortIconInactiveColor,
                font: "inherit",
                fontSize: `${columnHeaderFontSize}px`,
                fontWeight: sortDimension === "instance" ? 700 : 600,
                lineHeight: 1.2,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                cursor: "pointer",
                transition:
                  "background-color 140ms ease, border-color 140ms ease, color 140ms ease",
                "&:hover": {
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.05)",
                  color:
                    sortDimension === "instance"
                      ? sortIconActiveColor
                      : theme.palette.text.primary,
                },
                "&:focus-visible": {
                  outline: `${focusRingWidth}px solid ${focusRing}`,
                  outlineOffset: 1,
                },
              }}
            >
              <Box component="span">Label</Box>
              {sortDimension === "instance" ? (
                <Box component="span" aria-hidden="true" sx={{ fontSize: "0.9em" }}>
                  {activeDirectionGlyph}
                </Box>
              ) : null}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }} />
            <Box
              component="button"
              type="button"
              onClick={() => handleColumnSortClick("count")}
              aria-label={`Sort by count. Current order: ${currentSortLabel}.`}
              aria-pressed={sortDimension === "count"}
              sx={{
                width: `${countColumnWidth}px`,
                minWidth: `${countColumnWidth}px`,
                maxWidth: `${countColumnWidth}px`,
                minHeight: `${columnHeaderHeight}px`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 0.5,
                px: 0.75,
                border: "none",
                borderBottom: `2px solid ${
                  sortDimension === "count" ? sortIconActiveColor : "transparent"
                }`,
                borderRadius: "4px 4px 0 0",
                backgroundColor: "transparent",
                color: sortDimension === "count" ? sortIconActiveColor : sortIconInactiveColor,
                font: "inherit",
                fontSize: `${columnHeaderFontSize}px`,
                fontWeight: sortDimension === "count" ? 700 : 600,
                lineHeight: 1.2,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                cursor: "pointer",
                transition:
                  "background-color 140ms ease, border-color 140ms ease, color 140ms ease",
                "&:hover": {
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.05)",
                  color:
                    sortDimension === "count"
                      ? sortIconActiveColor
                      : theme.palette.text.primary,
                },
                "&:focus-visible": {
                  outline: `${focusRingWidth}px solid ${focusRing}`,
                  outlineOffset: 1,
                },
              }}
            >
              <Box component="span">Count</Box>
              {sortDimension === "count" ? (
                <Box component="span" aria-hidden="true" sx={{ fontSize: "0.9em" }}>
                  {activeDirectionGlyph}
                </Box>
              ) : null}
            </Box>
          </Box>
        ) : null}
        {sortedData.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: `${textFontSize}px` }}
          >
            No data available
          </Typography>
        ) : (
          <Box
            ref={chartContainerRef}
            sx={{
              width: "100%",
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              ...(fillContainer
                ? {
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                  }
                : {
                    maxHeight: viewportHeight,
                    overflowY: calculatedHeight > viewportHeight ? "auto" : "hidden",
                    overflowX: "hidden",
                  }),
            }}
          >
            <svg
              role="group"
              aria-label={chartAriaLabel}
              width={chartWidth}
              height={calculatedHeight}
              viewBox={`0 0 ${chartWidth} ${calculatedHeight}`}
            >
              {sortedData.map((row, index) => {
                const rowTop = verticalPaddingTop + index * rowHeight;
                const rowCenterY = rowTop + rowHeight / 2;
                const barY = rowCenterY - barHeight / 2;
                const rawBarWidth = maxValue > 0 ? (row.value / maxValue) * barMaxWidth : 0;
                const barWidth = row.value > 0 ? Math.max(barMinWidth, rawBarWidth) : 0;
                const valueLabel = formatCountLabel(row.value, row.includedValue);
                const shortLabel = truncateLabel(row.displayLabel, maxLabelCharacters);
                const isSelected = selectedSet.has(row.label);
                const isDisabled = row.value === 0 && isInteractive;

                const showPatientDots = shouldShowPatientDots(row, inlinePatientIdsThreshold);
                const dotPatientIds = showPatientDots ? toDotPatientIds(row) : [];
                const dotTrackStartX = barStartX + dotRadius + 1;
                const dotTrackEndX = barStartX + barMaxWidth - dotRadius - 1;
                const dotTrackRange = Math.max(0, dotTrackEndX - dotTrackStartX);
                const dotStep =
                  dotPatientIds.length > 1 ? dotTrackRange / (dotPatientIds.length - 1) : 0;
                const canToggleExpand =
                  row.isExpandable && !isDisabled && typeof onRowToggleExpand === "function";
                const tooltipText = showPatientDots
                  ? `${row.displayLabel}: ${valueLabel}. Hover or click a patient dot to view the summary.`
                  : `${row.displayLabel}: ${valueLabel}`;
                const hierarchyBaseOffset = hasHierarchyRows ? HIERARCHY_ICON_HIT_WIDTH : 0;
                const labelX =
                  LEFT_PADDING + hierarchyBaseOffset + (row.isChild ? HIERARCHY_CHILD_INDENT : 0);
                const iconCenterX = LEFT_PADDING + HIERARCHY_ICON_HIT_WIDTH / 2;
                const iconHalfWidth = Math.max(2.5, Math.round(3 * safeFontScale));
                const iconHalfHeight = Math.max(2.5, Math.round(3 * safeFontScale));
                const iconPath = row.isExpandedParent
                  ? `M ${iconCenterX - iconHalfWidth} ${rowCenterY - iconHalfHeight} L ${iconCenterX + iconHalfWidth} ${rowCenterY - iconHalfHeight} L ${iconCenterX} ${rowCenterY + iconHalfHeight} Z`
                  : `M ${iconCenterX - iconHalfWidth} ${rowCenterY - iconHalfHeight} L ${iconCenterX - iconHalfWidth} ${rowCenterY + iconHalfHeight} L ${iconCenterX + iconHalfWidth} ${rowCenterY} Z`;

                const rowFillColor = isSelected ? barActiveColor : barFillColor;
                const rowFillOpacity = hasSelections ? (isSelected ? 1 : 0.35) : 0.9;
                const labelFill = isSelected ? selectedCountColor : categoryLabelColor;
                const labelWeight = isSelected ? selectedLabelWeight : 400;
                const countFill = isSelected ? selectedCountColor : theme.palette.text.secondary;
                const disabledOpacity = isDisabled ? 0.35 : 1;
                const isHovered =
                  hoveredRowIndex === index && !isDisabled && !isSelected;
                const isFocused =
                  focusedRowIndex === index && isInteractive && !isDisabled;

                return (
                  <g
                    key={`${row.label}-${index}`}
                    opacity={disabledOpacity}
                    style={{ pointerEvents: isDisabled ? "none" : undefined }}
                    aria-disabled={isDisabled ? "true" : undefined}
                  >
                    {index % 2 === 1 ? (
                      <rect
                        x={0}
                        y={rowTop}
                        width={chartWidth}
                        height={rowHeight}
                        fill={stripeFill}
                      />
                    ) : null}
                    <rect
                      x={0}
                      y={rowTop}
                      width={chartWidth}
                      height={rowHeight}
                      fill={rowHoverFill}
                      opacity={isHovered ? 1 : 0}
                      pointerEvents="none"
                      data-hover-highlight="true"
                      style={{ transition: "opacity 120ms ease" }}
                    />
                    {isSelected ? (
                      <rect
                        x={0}
                        y={rowTop}
                        width={chartWidth}
                        height={rowHeight}
                        fill={selectedRowFill}
                      />
                    ) : null}

                    {/* Selected row left accent */}
                    {isSelected ? (
                      <rect
                        x={0}
                        y={rowTop}
                        width={3}
                        height={rowHeight}
                        fill={barActiveColor}
                      />
                    ) : null}
                    {isFocused ? (
                      <rect
                        x={1}
                        y={rowTop + 1}
                        width={Math.max(0, chartWidth - 2)}
                        height={Math.max(0, rowHeight - 2)}
                        rx={3}
                        fill="none"
                        stroke={focusRing}
                        strokeWidth={2}
                        pointerEvents="none"
                        data-focus-ring="true"
                      />
                    ) : null}

                    <text
                      x={labelX}
                      y={rowCenterY}
                      dominantBaseline="middle"
                      textAnchor="start"
                      fontSize={textFontSize}
                      fontWeight={labelWeight}
                      fill={labelFill}
                    >
                      {shortLabel}
                    </text>

                    {row.isExpandable ? (
                      <path
                        d={iconPath}
                        fill={labelFill}
                        fillOpacity={canToggleExpand ? 0.95 : 0.55}
                      />
                    ) : null}

                    {/* Bar track */}
                    <rect
                      x={barStartX}
                      y={barY}
                      width={barMaxWidth}
                      height={barHeight}
                      rx={2}
                      fill={barTrackColor}
                    />

                    {/* Bar fill */}
                    {!showPatientDots ? (
                      <rect
                        x={barStartX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx={2}
                        fill={rowFillColor}
                        fillOpacity={rowFillOpacity}
                      >
                        <title>{tooltipText}</title>
                      </rect>
                    ) : null}

                    <text
                      x={chartWidth - RIGHT_PADDING}
                      y={rowCenterY}
                      dominantBaseline="middle"
                      textAnchor="end"
                      fontSize={textFontSize}
                      fontFamily={countFontFamily}
                      fill={countFill}
                      fontWeight={isSelected ? 500 : 400}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {valueLabel}
                    </text>

                    {/* Interactive overlay */}
                    <rect
                      x={0}
                      y={rowTop}
                      width={chartWidth}
                      height={rowHeight}
                      fill="transparent"
                      role={isInteractive && !isDisabled ? "button" : undefined}
                      aria-label={
                        isInteractive
                          ? `${row.displayLabel}: ${valueLabel}. ${isSelected ? "Selected" : "Not selected"}.`
                          : undefined
                      }
                      aria-pressed={isInteractive ? isSelected : undefined}
                      aria-disabled={isDisabled ? "true" : undefined}
                      tabIndex={isInteractive && !isDisabled ? 0 : undefined}
                      style={{ cursor: isInteractive && !isDisabled ? "pointer" : "default" }}
                      onMouseEnter={
                        isInteractive && !isDisabled
                          ? () => {
                              setHoveredRowIndex(index);
                            }
                          : undefined
                      }
                      onMouseLeave={() => {
                        setHoveredRowIndex((previousIndex) =>
                          previousIndex === index ? null : previousIndex
                        );
                      }}
                      onClick={isInteractive && !isDisabled ? () => handleToggleSelection(row.label) : undefined}
                      onKeyDown={
                        isInteractive && !isDisabled
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleToggleSelection(row.label);
                              }
                            }
                          : undefined
                      }
                      onFocus={
                        isInteractive
                          ? () => {
                              setFocusedRowIndex(index);
                            }
                          : undefined
                      }
                      onBlur={
                        isInteractive
                          ? () => {
                              setFocusedRowIndex((previousIndex) =>
                                previousIndex === index ? null : previousIndex
                              );
                            }
                          : undefined
                      }
                    >
                      <title>{tooltipText}</title>
                    </rect>
                    {showPatientDots
                      ? dotPatientIds.map((patientId, dotIndex) => {
                          const dotCenterX =
                            dotPatientIds.length === 1
                              ? barStartX + barMaxWidth / 2
                              : dotTrackStartX + dotStep * dotIndex;
                          const patientDotLabel = `Patient ${patientId}. Hover or click to view summary.`;

                          return (
                            <circle
                              key={`${row.label}-${patientId}-${dotIndex}`}
                              cx={dotCenterX}
                              cy={rowCenterY}
                              r={dotRadius}
                              fill={rowFillColor}
                              fillOpacity={rowFillOpacity}
                              data-patient-dot="true"
                              data-patient-id={patientId}
                              role="button"
                              tabIndex={0}
                              aria-label={patientDotLabel}
                              style={{ cursor: "pointer" }}
                              onMouseEnter={(event) => handlePatientDotMouseEnter(event, patientId)}
                              onMouseLeave={handlePatientDotMouseLeave}
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePatientDotClick(event, patientId);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handlePatientDotClick(event, patientId);
                                }
                              }}
                              onBlur={handlePatientDotMouseLeave}
                            >
                              <title>{patientDotLabel}</title>
                            </circle>
                          );
                        })
                      : null}
                    {row.isExpandable ? (
                      <rect
                        x={LEFT_PADDING - 2}
                        y={rowTop}
                        width={HIERARCHY_ICON_HIT_WIDTH + 4}
                        height={rowHeight}
                        fill="transparent"
                        role={canToggleExpand ? "button" : undefined}
                        aria-label={
                          canToggleExpand
                            ? `${row.isExpandedParent ? "Collapse" : "Expand"} ${row.displayLabel}`
                            : undefined
                        }
                        aria-expanded={canToggleExpand ? row.isExpandedParent : undefined}
                        tabIndex={canToggleExpand ? 0 : undefined}
                        style={{
                          cursor: canToggleExpand ? "pointer" : "default",
                          outline: "none",
                        }}
                        onClick={
                          canToggleExpand
                            ? (event) => {
                                event.stopPropagation();
                                handleToggleExpandedRow(row);
                              }
                            : undefined
                        }
                        onKeyDown={
                          canToggleExpand
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleToggleExpandedRow(row);
                                }
                              }
                            : undefined
                        }
                        onFocus={
                          canToggleExpand
                            ? (event) => {
                                const el = event.target;
                                el.setAttribute("stroke", focusRing);
                                el.setAttribute("stroke-width", String(focusRingWidth));
                                el.setAttribute("rx", "4");
                              }
                            : undefined
                        }
                        onBlur={
                          canToggleExpand
                            ? (event) => {
                                const el = event.target;
                                el.removeAttribute("stroke");
                                el.removeAttribute("stroke-width");
                              }
                            : undefined
                        }
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </Box>
        )}
      </Box>
      <PatientSummaryTooltip
        open={summaryTooltipState.open}
        anchorEl={summaryTooltipState.anchorEl}
        summaryData={summaryTooltipState.summaryData}
        onClose={handleSummaryTooltipClose}
      />
    </Box>
  );
}

HorizontalBarChart.propTypes = {
  title: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      displayLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      includedValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      patientIds: PropTypes.arrayOf(PropTypes.string),
      _isRolledUp: PropTypes.bool,
      _expandable: PropTypes.bool,
      _isChild: PropTypes.bool,
      _isExpandedParent: PropTypes.bool,
    })
  ),
  selectedValues: PropTypes.arrayOf(PropTypes.string),
  onSelectionChange: PropTypes.func,
  onRowToggleExpand: PropTypes.func,
  onSortDimensionChange: PropTypes.func,
  onSortModeChange: PropTypes.func,
  height: PropTypes.number,
  fillContainer: PropTypes.bool,
  fontScale: PropTypes.number,
  defaultExpanded: PropTypes.bool,
  defaultSort: PropTypes.oneOf(SORT_MODES),
  sortValuesOnly: PropTypes.bool,
  showTitle: PropTypes.bool,
  allowCollapse: PropTypes.bool,
  showSortDimensionToggle: PropTypes.bool,
  showSortCycleButton: PropTypes.bool,
  customSortOrder: PropTypes.arrayOf(PropTypes.string),
  inlinePatientIdsThreshold: PropTypes.number,
  getPatientSummary: PropTypes.func,
};
