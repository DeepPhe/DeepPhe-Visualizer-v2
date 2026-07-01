import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from "react";
import PropTypes from "prop-types";
import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import PatientSummaryTooltip from "./PatientSummaryTooltip";
import BarFilterHeader from "./horizontalBarFilter/BarFilterHeader";
import {
  HIERARCHY_CHILD_INDENT,
  HIERARCHY_ICON_HIT_WIDTH,
  LEFT_PADDING,
  RIGHT_PADDING,
  computeChartGeometry,
  createCustomSortIndexMap,
  formatCountLabel,
  normalizeChartData,
  shouldShowPatientDots,
  sortChartData,
  toDotPatientIds,
  truncateLabel,
} from "./horizontalBarFilter/horizontalBarFilterModel";

const SORT_MODES = ["value-desc", "value-asc", "alpha-asc", "alpha-desc"];
const VALUE_SORT_MODES = ["value-desc", "value-asc"];
const SORT_MODE_LABELS = {
  "value-desc": "count: highest first",
  "value-asc": "count: lowest first",
  "alpha-asc": "value: A to Z",
  "alpha-desc": "value: Z to A",
};
const DEFAULT_SORT_MODE = "alpha-asc";
const DEFAULT_TITLE = "Horizontal Bar Filter";
const NOOP = () => {};

const FALLBACK_CHART_WIDTH = 780;
const MIN_CHART_WIDTH = 160;
const MIN_BAR_REGION_SCALE = 0.2;

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

function joinClassNames(...values) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function clampFontScale(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 1;
  }
  return Math.max(0.5, Math.min(2, numericValue));
}

function clampBarRegionScale(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 1;
  }
  return Math.max(MIN_BAR_REGION_SCALE, Math.min(1, numericValue));
}

function getNextSortMode(currentMode, modes) {
  const currentIndex = modes.indexOf(currentMode);
  if (currentIndex < 0) {
    return modes[0];
  }
  return modes[(currentIndex + 1) % modes.length];
}

function createFallbackPatientSummary(patientId) {
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

function HorizontalBarFilter({
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
  showBarBehindDots = false,
  getPatientSummary,
  onOpenPatientDocumentView,
  barRegionScale = 1,
  density = "standard",
  className = "",
  sectionLabel = "",
}) {
  const isCompactDensity = density === "compact";
  const theme = useTheme();
  const generatedId = useId();
  const chartRegionId = `${generatedId}-chart-region`;

  const availableSortModes = useMemo(
    () => (sortValuesOnly ? VALUE_SORT_MODES : SORT_MODES),
    [sortValuesOnly]
  );
  const safeFontScale = clampFontScale(fontScale);
  const safeBarRegionScale = clampBarRegionScale(barRegionScale);
  const [isExpanded, setIsExpanded] = useState(Boolean(defaultExpanded));
  const [sortMode, setSortMode] = useState(
    availableSortModes.includes(defaultSort) ? defaultSort : availableSortModes[0]
  );
  const [sortAnnouncement, setSortAnnouncement] = useState("");
  const chartContainerRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(FALLBACK_CHART_WIDTH);
  const [viewportClientHeight, setViewportClientHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
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

  // Measure the chart container BEFORE paint. chartWidth starts at a fallback
  // (FALLBACK_CHART_WIDTH) and the entire SVG geometry — bar start/width, count
  // column position — is derived from it. If this ran as a post-paint useEffect,
  // the chart would paint once at the fallback geometry and then snap to the
  // measured width a frame later (the "bars jump into place after the cards
  // appear" flash). useLayoutEffect resolves the real width before the first
  // paint, so the chart's initial paint already uses the correct layout. The
  // ResizeObserver below still handles later container resizes.
  useLayoutEffect(() => {
    const element = chartContainerRef.current;
    if (!element) {
      return undefined;
    }

    const updateSize = (nextWidth, nextHeight) => {
      const resolvedWidth = Number(nextWidth) || element.clientWidth;
      const resolvedHeight = Number(nextHeight) || element.clientHeight;
      setChartWidth(Math.max(MIN_CHART_WIDTH, Math.floor(resolvedWidth)));
      setViewportClientHeight(Math.max(0, Math.floor(resolvedHeight)));
    };

    updateSize(element.clientWidth, element.clientHeight);

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries.length === 0) {
          return;
        }
        updateSize(entries[0].contentRect.width, entries[0].contentRect.height);
      });

      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    }

    if (typeof window !== "undefined") {
      const handleResize = () => updateSize(element.clientWidth, element.clientHeight);
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
  const clearScrollFrame = () => {
    if (!scrollFrameRef.current) {
      return;
    }
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(scrollFrameRef.current);
    } else {
      clearTimeout(scrollFrameRef.current);
    }
    scrollFrameRef.current = null;
  };

  useEffect(
    () => () => {
      clearHoverTimer();
      clearScrollFrame();
    },
    []
  );

  const normalizedData = useMemo(() => normalizeChartData(data), [data]);
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

  const sortedData = useMemo(
    () => sortChartData(normalizedData, { sortMode, customSortIndexMap, hasHierarchyRows }),
    [customSortIndexMap, hasHierarchyRows, normalizedData, sortMode]
  );

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

  // Density- and font-scale-aware SVG layout math lives in computeChartGeometry
  // (pure + unit-tested). The viewport/virtualization derivations below stay
  // here because they depend on live scroll/measurement state.
  const {
    textFontSize,
    rowHeight,
    barHeight,
    dotRadius,
    dotHitRadius,
    countColumnWidth,
    columnGap,
    countColumnStartX,
    labelColumnWidth,
    barStartX,
    barMaxWidth,
    maxLabelCharacters,
    columnHeaderHeight,
    columnHeaderFontSize,
    verticalPaddingTop,
    calculatedHeight,
  } = computeChartGeometry({
    isCompactDensity,
    safeFontScale,
    safeBarRegionScale,
    chartWidth,
    maxLabelLength,
    maxCountLabelLength,
    hasHierarchyRows,
    rowCount: sortedData.length,
  });
  const viewportHeight = fillContainer
    ? undefined
    : typeof height === "number" && height > 0
      ? height
      : Math.min(calculatedHeight, 420);
  const resolvedViewportHeight = fillContainer
    ? viewportClientHeight || Math.min(calculatedHeight, 420)
    : viewportHeight;
  const shouldVirtualizeRows =
    sortedData.length > 30 &&
    Number.isFinite(resolvedViewportHeight) &&
    resolvedViewportHeight > 0 &&
    calculatedHeight > resolvedViewportHeight;
  const visibleRowRange = useMemo(() => {
    if (!shouldVirtualizeRows) {
      return { start: 0, end: sortedData.length };
    }

    const overscanRows = 4;
    const firstVisibleRow = Math.floor(
      Math.max(0, scrollTop - verticalPaddingTop) / Math.max(1, rowHeight)
    );
    const visibleRowCount = Math.ceil(resolvedViewportHeight / Math.max(1, rowHeight));
    const start = Math.max(0, firstVisibleRow - overscanRows);
    const end = Math.min(sortedData.length, firstVisibleRow + visibleRowCount + overscanRows);

    return { start, end };
  }, [
    resolvedViewportHeight,
    rowHeight,
    scrollTop,
    shouldVirtualizeRows,
    sortedData.length,
    verticalPaddingTop,
  ]);
  const visibleRows = useMemo(
    () =>
      sortedData.slice(visibleRowRange.start, visibleRowRange.end).map((row, offset) => ({
        row,
        index: visibleRowRange.start + offset,
      })),
    [sortedData, visibleRowRange.end, visibleRowRange.start]
  );

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
  // Qualify the region landmark with its section so charts that share a title
  // across sections (e.g. two "Tissue" filters) stay uniquely named — otherwise
  // axe's landmark-unique rule flags the collision.
  const resolvedSectionLabel = String(sectionLabel || "").trim();
  const chartRegionAriaLabel = resolvedTitle
    ? resolvedSectionLabel
      ? `${resolvedTitle} chart region, ${resolvedSectionLabel}`
      : `${resolvedTitle} chart region`
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
  const handleViewportScroll = (event) => {
    if (!shouldVirtualizeRows) {
      return;
    }

    const nextScrollTop = Number(event.currentTarget?.scrollTop) || 0;
    const schedule =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (callback) => setTimeout(callback, 0);
    clearScrollFrame();
    scrollFrameRef.current = schedule(() => {
      scrollFrameRef.current = null;
      setScrollTop((previousScrollTop) =>
        Math.abs(previousScrollTop - nextScrollTop) > 1 ? nextScrollTop : previousScrollTop
      );
    });
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
    const normalizedPatientId = String(patientId || "").trim();
    if (!normalizedPatientId) {
      return;
    }

    clearHoverTimer();
    const requestId = hoverRequestIdRef.current + 1;
    hoverRequestIdRef.current = requestId;

    const run = async () => {
      setSummaryTooltipState({
        open: true,
        anchorEl: anchorNode,
        summaryData: createFallbackPatientSummary(normalizedPatientId),
        pinned,
      });
      try {
        const summary = await getPatientSummary(normalizedPatientId);
        if (hoverRequestIdRef.current !== requestId) {
          return;
        }
        setSummaryTooltipState({
          open: true,
          anchorEl: anchorNode,
          summaryData: summary || createFallbackPatientSummary(normalizedPatientId),
          pinned,
        });
      } catch {
        if (hoverRequestIdRef.current !== requestId) {
          return;
        }
        setSummaryTooltipState({
          open: true,
          anchorEl: anchorNode,
          summaryData: createFallbackPatientSummary(normalizedPatientId),
          pinned,
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
    // Clicking a dot opens that patient's document view in the patient drawer.
    // Hovering still shows the summary tooltip (handled separately). Where no
    // open-document-view handler is wired (e.g. the filter detail modal), fall
    // back to the previous behavior of pinning the summary tooltip.
    if (typeof onOpenPatientDocumentView === "function") {
      onOpenPatientDocumentView(patientId);
      return;
    }
    openPatientSummary(event.currentTarget, patientId, 0, true);
  };
  const handlePatientDotMouseEnter = (event, patientId, rowIndex = null) => {
    const normalizedRowIndex = Number(rowIndex);
    if (Number.isFinite(normalizedRowIndex)) {
      setHoveredRowIndex(normalizedRowIndex);
    }
    openPatientSummary(event.currentTarget, patientId, 200, false);
  };
  const handlePatientDotMouseLeave = (rowIndex = null) => {
    const normalizedRowIndex = Number(rowIndex);
    if (Number.isFinite(normalizedRowIndex)) {
      setHoveredRowIndex((previousIndex) =>
        previousIndex === normalizedRowIndex ? null : previousIndex
      );
    }
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
      className={joinClassNames("horizontal-bar-filter", className)}
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
        <BarFilterHeader
          allowCollapse={allowCollapse}
          isChartExpanded={isChartExpanded}
          chartRegionId={chartRegionId}
          toggleButtonLabel={toggleButtonLabel}
          onToggleExpanded={handleToggleExpanded}
          showInlineTitle={showInlineTitle}
          resolvedTitle={resolvedTitle}
          safeFontScale={safeFontScale}
          showSortCycleControl={showSortCycleControl}
          currentSortLabel={currentSortLabel}
          sortButtonLabel={sortButtonLabel}
          onSortClick={handleSortClick}
        />
      ) : null}

      <Box
        component="span"
        className="horizontal-bar-filter-sort-announcement"
        aria-live="polite"
        sx={visuallyHiddenStyles}
      >
        {sortAnnouncement}
      </Box>

      <Box
        className="horizontal-bar-filter-chart-region"
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
            className="horizontal-bar-filter-column-sort-header"
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
              className="horizontal-bar-filter-sort-label-button"
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
            <Box
              sx={{
                width: `${barMaxWidth}px`,
                minWidth: `${barMaxWidth}px`,
                maxWidth: `${barMaxWidth}px`,
              }}
            />
            <Box
              className="horizontal-bar-filter-sort-count-button"
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
            className="horizontal-bar-filter-empty"
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: `${textFontSize}px` }}
          >
            No data available
          </Typography>
        ) : (
          <Box
            className="horizontal-bar-filter-chart-viewport"
            ref={chartContainerRef}
            onScroll={handleViewportScroll}
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
              className="horizontal-bar-filter-svg"
              role="group"
              aria-label={chartAriaLabel}
              width={chartWidth}
              height={calculatedHeight}
              viewBox={`0 0 ${chartWidth} ${calculatedHeight}`}
            >
              {visibleRows.map(({ row, index }) => {
                const rowTop = verticalPaddingTop + index * rowHeight;
                const rowCenterY = rowTop + rowHeight / 2;
                const barY = rowCenterY - barHeight / 2;
                const rawBarWidth = maxValue > 0 ? (row.value / maxValue) * barMaxWidth : 0;
                const barWidth = row.value > 0 ? Math.max(barMinWidth, rawBarWidth) : 0;
                const valueLabel = formatCountLabel(row.value, row.includedValue);
                const shortLabel = truncateLabel(row.displayLabel, maxLabelCharacters);
                const isSelected = selectedSet.has(row.label);
                // A row whose included (numerator) count is 0 matches no patients
                // under the current selection, so choosing it would filter the
                // cohort down to nothing — treat it as unselectable. Rows with no
                // data at all (value 0) are likewise disabled. An already-selected
                // row is never disabled, so it can always be toggled back off.
                const numericIncludedValue = Number(row.includedValue);
                const isExcludedByCurrentFilters =
                  Number.isFinite(numericIncludedValue) && numericIncludedValue === 0;
                const isDisabled =
                  isInteractive && !isSelected && (row.value === 0 || isExcludedByCurrentFilters);

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
                const isPatientDotActive = isSelected || isHovered || isFocused;
                const patientDotOpacity = isPatientDotActive
                  ? isSelected
                    ? 1
                    : 0.82
                  : hasSelections
                    ? 0.22
                    : 0.52;
                const patientDotStrokeOpacity = isPatientDotActive ? 0.35 : 0;

                return (
                  <g
                    className={joinClassNames(
                      "horizontal-bar-filter-row",
                      isSelected ? "is-selected" : "",
                      row.isChild ? "is-child" : "",
                      isDisabled ? "is-disabled" : ""
                    )}
                    key={`${row.label}-${index}`}
                    opacity={disabledOpacity}
                    style={{ pointerEvents: isDisabled ? "none" : undefined }}
                    aria-disabled={isDisabled ? "true" : undefined}
                  >
                    {index % 2 === 1 ? (
                      <rect
                        className="horizontal-bar-filter-row-stripe"
                        x={0}
                        y={rowTop}
                        width={chartWidth}
                        height={rowHeight}
                        fill={stripeFill}
                      />
                    ) : null}
                    <rect
                      className="horizontal-bar-filter-row-hover"
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
                        className="horizontal-bar-filter-row-selected-bg"
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
                        className="horizontal-bar-filter-row-selected-accent"
                        x={0}
                        y={rowTop}
                        width={3}
                        height={rowHeight}
                        fill={barActiveColor}
                      />
                    ) : null}
                    {isFocused ? (
                      <rect
                        className="horizontal-bar-filter-row-focus-ring"
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
                      className="horizontal-bar-filter-row-label"
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
                        className="horizontal-bar-filter-row-expand-icon"
                        d={iconPath}
                        fill={labelFill}
                        fillOpacity={canToggleExpand ? 0.95 : 0.55}
                      />
                    ) : null}

                    {/* Bar track */}
                    <rect
                      className="horizontal-bar-filter-row-bar-track"
                      x={barStartX}
                      y={barY}
                      width={barMaxWidth}
                      height={barHeight}
                      rx={2}
                      fill={barTrackColor}
                    />

                    {/* Bar fill. Normally the full proportional bar. When the
                        row renders as patient dots, the bar is hidden unless the
                        "bars behind dots" option is on — then the same
                        proportional bar is drawn behind the dots at half the
                        dots' opacity, so the dots stay the dominant mark. */}
                    {!showPatientDots ? (
                      <rect
                        className="horizontal-bar-filter-row-bar"
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
                    ) : showBarBehindDots ? (
                      <rect
                        className="horizontal-bar-filter-row-bar horizontal-bar-filter-row-bar-behind-dots"
                        x={barStartX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx={2}
                        fill={rowFillColor}
                        fillOpacity={patientDotOpacity * 0.5}
                        pointerEvents="none"
                      />
                    ) : null}

                    <text
                      className="horizontal-bar-filter-row-count"
                      x={countColumnStartX + countColumnWidth}
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

                    {/* Interactive overlay. Wrapped in an MUI Tooltip so the
                        full (untruncated) attribute label shows immediately on
                        hover. It replaces a native SVG <title>, which had a
                        slow, browser-controlled delay and was skipped entirely
                        for patient-dot rows. describeChild keeps the rect's own
                        aria-label as the accessible name. */}
                    <Tooltip
                      title={String(row.displayLabel)}
                      placement="top"
                      describeChild
                      followCursor
                      enterDelay={0}
                      enterNextDelay={0}
                      enterTouchDelay={0}
                    >
                    <rect
                      className="horizontal-bar-filter-row-overlay"
                      x={0}
                      y={rowTop}
                      width={chartWidth}
                      height={rowHeight}
                      fill="transparent"
                      role={isInteractive && !isDisabled ? "button" : undefined}
                      aria-label={
                        isInteractive
                          ? isDisabled
                            ? `${row.displayLabel}: ${valueLabel}. Unavailable — no patients match the current filters.`
                            : `${row.displayLabel}: ${valueLabel}. ${isSelected ? "Selected" : "Not selected"}.`
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
                    />
                    </Tooltip>
                    {showPatientDots
                      ? dotPatientIds.map((patientId, dotIndex) => {
                          const dotCenterX =
                            dotPatientIds.length === 1
                              ? barStartX + barMaxWidth / 2
                              : dotTrackStartX + dotStep * dotIndex;
                          const patientDotLabel =
                            typeof onOpenPatientDocumentView === "function"
                              ? `Patient ${patientId}. Hover to view summary, click to open document view.`
                              : `Patient ${patientId}. Hover or click to view summary.`;

                          return (
                            <g key={`${row.label}-${patientId}-${dotIndex}`}>
                              <circle
                                className="horizontal-bar-filter-patient-dot"
                                cx={dotCenterX}
                                cy={rowCenterY}
                                r={dotRadius}
                                fill={rowFillColor}
                                fillOpacity={patientDotOpacity}
                                stroke={rowFillColor}
                                strokeOpacity={patientDotStrokeOpacity}
                                strokeWidth={Math.max(1, dotRadius * 0.45)}
                                data-patient-dot="true"
                                data-patient-id={patientId}
                                pointerEvents="none"
                                style={{
                                  transition:
                                    "fill-opacity 120ms ease, stroke-opacity 120ms ease",
                                }}
                              />
                              <circle
                                className="horizontal-bar-filter-patient-dot-hitbox"
                                cx={dotCenterX}
                                cy={rowCenterY}
                                r={dotHitRadius}
                                fill="transparent"
                                role="button"
                                tabIndex={0}
                                aria-label={patientDotLabel}
                                style={{ cursor: "pointer" }}
                                onMouseEnter={(event) =>
                                  handlePatientDotMouseEnter(event, patientId, index)
                                }
                                onMouseLeave={() => handlePatientDotMouseLeave(index)}
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
                                onFocus={() => {
                                  setHoveredRowIndex(index);
                                }}
                                onBlur={() => handlePatientDotMouseLeave(index)}
                              />
                            </g>
                          );
                        })
                      : null}
                    {row.isExpandable ? (
                      <rect
                        className="horizontal-bar-filter-row-expand-hitbox"
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

HorizontalBarFilter.propTypes = {
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
  showBarBehindDots: PropTypes.bool,
  getPatientSummary: PropTypes.func,
  onOpenPatientDocumentView: PropTypes.func,
  barRegionScale: PropTypes.number,
  density: PropTypes.oneOf(["standard", "compact"]),
  className: PropTypes.string,
  // Section/group label used to disambiguate the chart's region landmark name.
  sectionLabel: PropTypes.string,
};

// Memoized so the chart's SVG layout/draw is skipped when its props are
// unchanged. The filters view renders one of these per filter class; without
// memoization, any state change in FiltersView re-rendered every chart. For
// this to be effective the parent must pass stable prop identities (callbacks
// and array props), which FiltersView now does.
export default memo(HorizontalBarFilter);
