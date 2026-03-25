import React, { useEffect, useMemo, useRef, useState, useId } from "react";
import PropTypes from "prop-types";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SortIcon from "@mui/icons-material/Sort";

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

const FALLBACK_CHART_WIDTH = 780;
const MIN_CHART_WIDTH = 280;
const LEFT_PADDING = 10;
const RIGHT_PADDING = 10;
const COUNT_COLUMN_WIDTH = 52;

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

export default function HorizontalBarChart({
  title,
  data,
  selectedValues,
  onSelectionChange,
  height,
  fontScale = 1,
  defaultExpanded = true,
  defaultSort = DEFAULT_SORT_MODE,
  sortValuesOnly = false,
  showTitle = true,
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
  }, [isExpanded]);

  useEffect(() => {
    if (availableSortModes.includes(sortMode)) {
      return;
    }
    setSortMode(availableSortModes[0]);
  }, [availableSortModes, sortMode]);

  const normalizedData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => {
        const rawLabel = typeof item?.label === "string" ? item.label : String(item?.label ?? "");
        const label = rawLabel.trim();
        const numericValue = Number(item?.value);
        const value = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
        return { label, value };
      })
      .filter((item) => item.label.length > 0);
  }, [data]);
  const safeSelectedValues = useMemo(
    () => (Array.isArray(selectedValues) ? selectedValues : []),
    [selectedValues]
  );
  const selectedSet = useMemo(() => new Set(safeSelectedValues), [safeSelectedValues]);
  const hasSelections = selectedSet.size > 0;
  const isInteractive = typeof onSelectionChange === "function";

  const sortedData = useMemo(() => {
    const rows = [...normalizedData];

    rows.sort((left, right) => {
      if (sortMode === "value-asc") {
        if (left.value !== right.value) {
          return left.value - right.value;
        }
        return left.label.localeCompare(right.label);
      }

      if (sortMode === "alpha-asc") {
        return left.label.localeCompare(right.label);
      }
      if (sortMode === "alpha-desc") {
        return right.label.localeCompare(left.label);
      }

      if (left.value !== right.value) {
        return right.value - left.value;
      }
      return left.label.localeCompare(right.label);
    });

    return rows;
  }, [normalizedData, sortMode]);

  const maxValue = useMemo(
    () => sortedData.reduce((currentMax, row) => Math.max(currentMax, row.value), 0),
    [sortedData]
  );
  const maxLabelLength = useMemo(
    () => sortedData.reduce((currentMax, row) => Math.max(currentMax, row.label.length), 0),
    [sortedData]
  );

  const textFontSize = Math.max(10, Math.round(12 * safeFontScale));
  const rowHeight = Math.min(34, Math.max(28, Math.round(30 * safeFontScale)));
  const barHeight = Math.min(22, Math.max(16, Math.round(18 * safeFontScale)));

  const availableWidth = Math.max(
    MIN_CHART_WIDTH,
    chartWidth - LEFT_PADDING - RIGHT_PADDING - COUNT_COLUMN_WIDTH
  );
  const estimatedLabelWidth = Math.ceil(maxLabelLength * textFontSize * 0.58) + 16;
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
    chartWidth - RIGHT_PADDING - COUNT_COLUMN_WIDTH - columnGap - barStartX
  );
  const maxLabelCharacters = Math.max(
    8,
    Math.floor((labelColumnWidth - 12) / Math.max(1, textFontSize * 0.58))
  );

  const verticalPadding = 10;
  const calculatedHeight = Math.max(
    rowHeight + verticalPadding * 2,
    sortedData.length * rowHeight + verticalPadding * 2
  );
  const viewportHeight =
    typeof height === "number" && height > 0 ? height : Math.min(calculatedHeight, 420);

  const stripeFill =
    theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
  const selectedRowFill =
    theme.palette.mode === "dark" ? "rgba(144, 202, 249, 0.16)" : "rgba(25, 118, 210, 0.14)";
  const currentSortLabel = SORT_MODE_LABELS[sortMode];
  const nextSortMode = getNextSortMode(sortMode, availableSortModes);
  const nextSortLabel = SORT_MODE_LABELS[nextSortMode];
  const sortButtonLabel = `Currently sorted ${currentSortLabel}. Click to sort ${nextSortLabel}.`;

  const resolvedTitle = String(title || "").trim();
  const chartAriaLabel = resolvedTitle ? `${resolvedTitle} horizontal bar chart` : DEFAULT_TITLE;
  const chartRegionAriaLabel = resolvedTitle
    ? `${resolvedTitle} chart region`
    : "Horizontal bar chart region";
  const toggleButtonLabel = resolvedTitle
    ? `${isExpanded ? "Collapse" : "Expand"} ${resolvedTitle} chart`
    : `${isExpanded ? "Collapse" : "Expand"} chart`;

  const handleToggleExpanded = () => {
    setIsExpanded((previousState) => !previousState);
  };

  const handleSortClick = () => {
    const nextMode = getNextSortMode(sortMode, availableSortModes);
    setSortMode(nextMode);
    setSortAnnouncement(`Sort order changed to ${SORT_MODE_LABELS[nextMode]}.`);
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

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box
          component="button"
          type="button"
          aria-expanded={isExpanded}
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
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 2,
              borderRadius: 1,
            },
          }}
        >
          <ExpandMoreIcon
            aria-hidden="true"
            sx={{
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
              "@media (prefers-reduced-motion: reduce)": {
                transition: "none",
              },
            }}
          />
          {showTitle && resolvedTitle ? (
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

        <Tooltip title={`Sort: ${currentSortLabel}`}>
          <IconButton
            size="small"
            aria-label={sortButtonLabel}
            onClick={handleSortClick}
          >
            <SortIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" aria-live="polite" sx={visuallyHiddenStyles}>
        {sortAnnouncement}
      </Box>

      <Box
        id={chartRegionId}
        role="region"
        aria-label={chartRegionAriaLabel}
        hidden={!isExpanded}
        sx={{
          width: "100%",
          mt: 1.25,
          display: isExpanded ? "block" : "none",
        }}
      >
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
              maxHeight: viewportHeight,
              overflowY: "auto",
              overflowX: "hidden",
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
            }}
          >
            <svg
              role="img"
              aria-label={chartAriaLabel}
              width={chartWidth}
              height={calculatedHeight}
              viewBox={`0 0 ${chartWidth} ${calculatedHeight}`}
            >
              {sortedData.map((row, index) => {
                const rowTop = verticalPadding + index * rowHeight;
                const rowCenterY = rowTop + rowHeight / 2;
                const barY = rowCenterY - barHeight / 2;
                const barWidth = maxValue > 0 ? (row.value / maxValue) * barMaxWidth : 0;
                const valueLabel = row.value.toLocaleString();
                const shortLabel = truncateLabel(row.label, maxLabelCharacters);
                const isSelected = selectedSet.has(row.label);
                const barFillOpacity = hasSelections ? (isSelected ? 0.9 : 0.35) : 0.82;

                return (
                  <g key={`${row.label}-${index}`}>
                    {index % 2 === 1 ? (
                      <rect
                        x={0}
                        y={rowTop}
                        width={chartWidth}
                        height={rowHeight}
                        fill={stripeFill}
                      />
                    ) : null}
                    {isSelected ? (
                      <rect
                        x={0}
                        y={rowTop}
                        width={chartWidth}
                        height={rowHeight}
                        fill={selectedRowFill}
                      />
                    ) : null}

                    <text
                      x={LEFT_PADDING}
                      y={rowCenterY}
                      dominantBaseline="middle"
                      textAnchor="start"
                      fontSize={textFontSize}
                      fill={theme.palette.text.primary}
                    >
                      {shortLabel}
                    </text>

                    <rect
                      x={barStartX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      fill={theme.palette.primary.main}
                      fillOpacity={barFillOpacity}
                      stroke={
                        isSelected
                          ? theme.palette.mode === "dark"
                            ? theme.palette.primary.light
                            : theme.palette.primary.dark
                          : "transparent"
                      }
                      strokeOpacity={0.9}
                      strokeWidth={isSelected ? 1.1 : 0}
                    >
                      <title>{`${row.label}: ${valueLabel}`}</title>
                    </rect>

                    <text
                      x={chartWidth - RIGHT_PADDING}
                      y={rowCenterY}
                      dominantBaseline="middle"
                      textAnchor="end"
                      fontSize={textFontSize}
                      fill={theme.palette.text.secondary}
                    >
                      {valueLabel}
                    </text>

                    <rect
                      x={0}
                      y={rowTop}
                      width={chartWidth}
                      height={rowHeight}
                      fill="transparent"
                      role={isInteractive ? "button" : undefined}
                      aria-label={
                        isInteractive
                          ? `${row.label}: ${valueLabel}. ${isSelected ? "Selected" : "Not selected"}.`
                          : undefined
                      }
                      aria-pressed={isInteractive ? isSelected : undefined}
                      tabIndex={isInteractive ? 0 : undefined}
                      style={{ cursor: isInteractive ? "pointer" : "default" }}
                      onClick={isInteractive ? () => handleToggleSelection(row.label) : undefined}
                      onKeyDown={
                        isInteractive
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleToggleSelection(row.label);
                              }
                            }
                          : undefined
                      }
                    />
                  </g>
                );
              })}
            </svg>
          </Box>
        )}
      </Box>
    </Box>
  );
}

HorizontalBarChart.propTypes = {
  title: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    })
  ),
  selectedValues: PropTypes.arrayOf(PropTypes.string),
  onSelectionChange: PropTypes.func,
  height: PropTypes.number,
  fontScale: PropTypes.number,
  defaultExpanded: PropTypes.bool,
  defaultSort: PropTypes.oneOf(SORT_MODES),
  sortValuesOnly: PropTypes.bool,
  showTitle: PropTypes.bool,
};

HorizontalBarChart.defaultProps = {
  title: "",
  data: [],
  selectedValues: [],
  onSelectionChange: undefined,
  height: undefined,
  fontScale: 1,
  defaultExpanded: true,
  defaultSort: DEFAULT_SORT_MODE,
  sortValuesOnly: false,
  showTitle: true,
};
