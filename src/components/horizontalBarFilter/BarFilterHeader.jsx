import React from "react";
import PropTypes from "prop-types";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SortIcon from "@mui/icons-material/Sort";

/**
 * The chart header row: optional collapse toggle, optional inline title, and an
 * optional sort-cycle button. Presentational — the parent decides whether to
 * render it (shouldRenderHeaderRow) and supplies the handlers/labels.
 */
export default function BarFilterHeader({
  allowCollapse,
  isChartExpanded,
  chartRegionId,
  toggleButtonLabel,
  onToggleExpanded,
  showInlineTitle,
  resolvedTitle,
  safeFontScale,
  showSortCycleControl,
  currentSortLabel,
  sortButtonLabel,
  onSortClick,
}) {
  const theme = useTheme();
  const custom = theme.custom || {};
  const focusRing = custom.focusRing || theme.palette.primary.main;
  const focusRingWidth = Number.parseFloat(custom.focusRingWidth) || 2;
  const titleFontSize = `calc(${theme.typography.subtitle1.fontSize} * ${safeFontScale})`;

  const titleNode = showInlineTitle ? (
    <Typography
      className="horizontal-bar-filter-title"
      variant="subtitle1"
      color="text.primary"
      sx={{ fontWeight: 600, fontSize: titleFontSize }}
    >
      {resolvedTitle}
    </Typography>
  ) : null;

  return (
    <Box
      className="horizontal-bar-filter-header"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Box
        className="horizontal-bar-filter-header-main"
        sx={{ display: "inline-flex", alignItems: "center", gap: 1, minHeight: 32 }}
      >
        {allowCollapse ? (
          <Box
            className="horizontal-bar-filter-toggle-button"
            component="button"
            type="button"
            aria-expanded={isChartExpanded}
            aria-controls={chartRegionId}
            aria-label={toggleButtonLabel}
            onClick={onToggleExpanded}
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
            {titleNode}
          </Box>
        ) : (
          titleNode
        )}
      </Box>

      {showSortCycleControl ? (
        <Tooltip title={`Sort: ${currentSortLabel}`}>
          <IconButton
            className="horizontal-bar-filter-sort-cycle-button"
            size="small"
            aria-label={sortButtonLabel}
            onClick={onSortClick}
          >
            <SortIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </Box>
  );
}

BarFilterHeader.propTypes = {
  allowCollapse: PropTypes.bool,
  isChartExpanded: PropTypes.bool,
  chartRegionId: PropTypes.string,
  toggleButtonLabel: PropTypes.string,
  onToggleExpanded: PropTypes.func,
  showInlineTitle: PropTypes.bool,
  resolvedTitle: PropTypes.string,
  safeFontScale: PropTypes.number,
  showSortCycleControl: PropTypes.bool,
  currentSortLabel: PropTypes.string,
  sortButtonLabel: PropTypes.string,
  onSortClick: PropTypes.func,
};
