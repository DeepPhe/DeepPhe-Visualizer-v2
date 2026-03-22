import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

const DEFAULT_HEIGHT = 320;

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) {
    return [];
  }

  return categories
    .map((item) => {
      const label = String(item?.label ?? "").trim();
      const parsedCount = Number(item?.count);
      const count = Number.isFinite(parsedCount) ? Math.max(0, parsedCount) : 0;
      return { label, count };
    })
    .filter((item) => item.label.length > 0);
}

function toShortLabel(label) {
  if (label.length <= 14) {
    return label;
  }
  return `${label.slice(0, 11)}...`;
}

export default function FilterBarChart({
  title,
  categories,
  selectedValues,
  onSelectionChange,
  height = DEFAULT_HEIGHT,
  fontScale = 1,
}) {
  const theme = useTheme();
  const normalizedCategories = useMemo(() => normalizeCategories(categories), [categories]);
  const safeSelectedValues = useMemo(
    () => (Array.isArray(selectedValues) ? selectedValues : []),
    [selectedValues]
  );
  const selectedSet = useMemo(() => new Set(safeSelectedValues), [safeSelectedValues]);
  const hasSelections = selectedSet.size > 0;
  const svgFontSize = Math.max(10, Math.round(12 * fontScale));

  const handleReset = () => {
    if (typeof onSelectionChange !== "function") {
      return;
    }
    onSelectionChange([]);
  };

  const chart = useMemo(() => {
    const margin = { top: 24, right: 16, bottom: 68, left: 16 };
    const viewWidth = 780;
    const chartHeight = Math.max(220, height);
    const plotWidth = viewWidth - margin.left - margin.right;
    const plotHeight = chartHeight - margin.top - margin.bottom;
    const count = normalizedCategories.length;
    const maxCount = Math.max(1, ...normalizedCategories.map((item) => item.count));

    const gap = count <= 4 ? 18 : count <= 7 ? 12 : 8;
    const barWidth = Math.max(24, (plotWidth - gap * Math.max(0, count - 1)) / Math.max(1, count));

    const bars = normalizedCategories.map((item, index) => {
      const value = item.label;
      const isSelected = selectedSet.has(value);
      const barHeight = maxCount > 0 ? (item.count / maxCount) * plotHeight : 0;
      const x = margin.left + index * (barWidth + gap);
      const y = margin.top + (plotHeight - barHeight);

      return {
        ...item,
        x,
        y,
        barHeight,
        barWidth,
        isSelected,
      };
    });

    return {
      bars,
      viewWidth,
      chartHeight,
      baselineY: margin.top + plotHeight,
      maxCount,
    };
  }, [height, normalizedCategories, selectedSet]);

  const handleToggle = (label) => {
    if (typeof onSelectionChange !== "function") {
      return;
    }

    const currentlySelected = selectedSet.has(label);
    if (currentlySelected) {
      onSelectionChange(safeSelectedValues.filter((value) => value !== label));
      return;
    }

    const nextValues = [...safeSelectedValues, label];
    onSelectionChange([...new Set(nextValues)]);
  };

  if (normalizedCategories.length === 0) {
    return (
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          {title ? (
            <Typography
              variant="subtitle1"
              color="text.primary"
              sx={{ fontSize: `calc(${theme.typography.subtitle1.fontSize} * ${fontScale})` }}
            >
              {title}
            </Typography>
          ) : (
            <Box />
          )}
          <Tooltip title="Reset filter">
            <span>
              <IconButton
                size="small"
                aria-label="Reset filter"
                onClick={handleReset}
                disabled={safeSelectedValues.length === 0}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: `calc(${theme.typography.body2.fontSize} * ${fontScale})` }}
        >
          No categories available.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
        }}
      >
        {title ? (
          <Typography
            variant="subtitle1"
            color="text.primary"
            sx={{
              fontWeight: 600,
              fontSize: `calc(${theme.typography.subtitle1.fontSize} * ${fontScale})`,
            }}
          >
            {title}
          </Typography>
        ) : (
          <Box />
        )}
        <Tooltip title="Reset filter">
          <span>
            <IconButton
              size="small"
              aria-label="Reset filter"
              onClick={handleReset}
              disabled={safeSelectedValues.length === 0}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <svg
          role="img"
          aria-label={title || "Filter bar chart"}
          width="100%"
          height={chart.chartHeight}
          viewBox={`0 0 ${chart.viewWidth} ${chart.chartHeight}`}
        >
          <line
            x1={8}
            y1={chart.baselineY + 0.5}
            x2={chart.viewWidth - 8}
            y2={chart.baselineY + 0.5}
            stroke={theme.palette.divider}
            strokeWidth={1}
          />
          {chart.bars.map((bar) => {
            const barColor = bar.isSelected
              ? theme.palette.primary.main
              : theme.palette.primary.light;
            const fillOpacity = hasSelections && !bar.isSelected ? 0.35 : 0.85;

            return (
              <g key={bar.label}>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.barWidth}
                  height={Math.max(2, bar.barHeight)}
                  rx={4}
                  ry={4}
                  fill={barColor}
                  fillOpacity={fillOpacity}
                  stroke={bar.isSelected ? theme.palette.primary.dark : "transparent"}
                  strokeWidth={bar.isSelected ? 1.5 : 0}
                  style={{ cursor: "pointer" }}
                  role="button"
                  aria-label={`${bar.label}: ${bar.count}`}
                  aria-pressed={bar.isSelected}
                  tabIndex={0}
                  onClick={() => handleToggle(bar.label)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleToggle(bar.label);
                    }
                  }}
                >
                  <title>{`${bar.label}: ${bar.count.toLocaleString()}`}</title>
                </rect>
                <text
                  x={bar.x + bar.barWidth / 2}
                  y={Math.max(14, bar.y - 6)}
                  textAnchor="middle"
                  fontSize={svgFontSize}
                  fill={theme.palette.text.secondary}
                >
                  {bar.count.toLocaleString()}
                </text>
                <text
                  x={bar.x + bar.barWidth / 2}
                  y={chart.baselineY + 20}
                  textAnchor="middle"
                  fontSize={svgFontSize}
                  fill={theme.palette.text.primary}
                >
                  {toShortLabel(bar.label)}
                  <title>{bar.label}</title>
                </text>
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}

FilterBarChart.propTypes = {
  title: PropTypes.string,
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    })
  ),
  selectedValues: PropTypes.arrayOf(PropTypes.string),
  onSelectionChange: PropTypes.func.isRequired,
  height: PropTypes.number,
  fontScale: PropTypes.number,
};

FilterBarChart.defaultProps = {
  title: "",
  categories: [],
  selectedValues: [],
  height: DEFAULT_HEIGHT,
  fontScale: 1,
};
