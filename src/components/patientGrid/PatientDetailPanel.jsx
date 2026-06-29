import React from "react";
import PropTypes from "prop-types";
import { Box, Button, Chip, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import Masonry from "@mui/lab/Masonry";

// Responsive column counts for the detail Masonry. Kept as a named constant so
// the SSR-fallback resolution below stays in sync with the `columns` prop.
const DETAIL_PANEL_COLUMNS = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 };
// Rough per-section height used only to seed Masonry's first-paint SSR layout.
const DETAIL_PANEL_SECTION_HEIGHT_PX = 140;

const DETAIL_SECTION_DEFINITIONS = [
  { key: "diagnoses", label: "Diagnoses" },
  { key: "staging", label: "Staging" },
  { key: "grading", label: "Grading" },
  { key: "biomarkers", label: "Biomarkers" },
  { key: "treatments", label: "Treatments" },
  { key: "procedures", label: "Procedures" },
  { key: "findings", label: "Findings" },
  { key: "behavior", label: "Behavior" },
];

const FLAG_CHIP_DEFINITIONS = [
  { key: "negated", label: "Negated", color: "error" },
  { key: "historic", label: "Historic", color: "default" },
  { key: "uncertain", label: "Uncertain", color: "warning" },
  { key: "conflicted", label: "Conflicted", color: "info" },
];

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getDetailSections(rawPatientSummary) {
  return DETAIL_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    items: toArray(rawPatientSummary?.[section.key]),
  })).filter((section) => section.items.length > 0);
}

function renderDetailItemChips(item) {
  const chips = FLAG_CHIP_DEFINITIONS.filter((flag) => Boolean(item?.[flag.key])).map((flag) => (
    <Chip
      key={flag.key}
      label={flag.label}
      color={flag.color}
      size="small"
      variant="outlined"
      sx={{ height: 20 }}
    />
  ));

  if (item?.source) {
    chips.push(
      <Chip
        key="source"
        label={`source: ${String(item.source)}`}
        color="secondary"
        size="small"
        variant="outlined"
        sx={{ height: 20 }}
      />
    );
  }

  return chips;
}

function getDetailNameStyle(item) {
  if (item?.negated) {
    return {
      textDecoration: "line-through",
      color: "text.disabled",
    };
  }

  if (item?.historic) {
    return {
      color: "text.secondary",
    };
  }

  return {
    color: "text.primary",
  };
}

function DetailPanel({ row, onPatientOpen }) {
  const theme = useTheme();
  // Resolve the responsive column count to a single number so Masonry's SSR
  // fast path (defaultColumns/defaultHeight/defaultSpacing) can render a
  // multi-column grid on first paint instead of flashing a single vertical
  // column until its ResizeObserver measures children. Mirrors the breakpoint
  // resolution used in the filters view.
  const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));
  const isXlUp = useMediaQuery(theme.breakpoints.up("xl"));
  const resolvedDetailColumns = isXlUp
    ? DETAIL_PANEL_COLUMNS.xl
    : isLgUp
    ? DETAIL_PANEL_COLUMNS.lg
    : isMdUp
    ? DETAIL_PANEL_COLUMNS.md
    : isSmUp
    ? DETAIL_PANEL_COLUMNS.sm
    : DETAIL_PANEL_COLUMNS.xs;
  const details = getDetailSections(row?.original?._raw);
  const patientId = String(row?.original?.patientId || "").trim();
  const canShowDocumentViewerButton = typeof onPatientOpen === "function" && Boolean(patientId);
  const detailPanelHeader = (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Patient Summary
      </Typography>
      {canShowDocumentViewerButton ? (
        <Button
          size="small"
          variant="outlined"
          onClick={(event) => {
            event.stopPropagation();
            onPatientOpen(patientId);
          }}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Show in Document Viewer
        </Button>
      ) : null}
    </Box>
  );

  if (details.length === 0) {
    return (
      <Box sx={{ px: 2, py: 0.75 }}>
        <Box sx={{ mb: 0.4 }}>{detailPanelHeader}</Box>
        <Typography variant="body2" color="text.secondary">
          No additional patient details available.
        </Typography>
      </Box>
    );
  }

  const accentColor = theme.custom?.barActive || theme.palette.primary.main;
  const badgeColorByChipColor = {
    error: {
      borderColor: alpha(theme.palette.error.main, 0.55),
      color: theme.palette.error.main,
      bgcolor: alpha(theme.palette.error.main, 0.1),
    },
    default: {
      borderColor: alpha(theme.palette.text.primary, 0.24),
      color: alpha(theme.palette.text.primary, 0.72),
      bgcolor: alpha(theme.palette.text.primary, 0.06),
    },
    warning: {
      borderColor: alpha(theme.palette.warning.main, 0.5),
      color: theme.palette.warning.main,
      bgcolor: alpha(theme.palette.warning.main, 0.1),
    },
    info: {
      borderColor: alpha(theme.palette.info.main, 0.5),
      color: theme.palette.info.main,
      bgcolor: alpha(theme.palette.info.main, 0.1),
    },
    secondary: {
      borderColor: alpha(theme.palette.secondary.main, 0.48),
      color: theme.palette.secondary.main,
      bgcolor: alpha(theme.palette.secondary.main, 0.08),
    },
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 0.75,
        px: 2,
        py: 0.75,
      }}
    >
      {detailPanelHeader}
      <Masonry
        columns={DETAIL_PANEL_COLUMNS}
        spacing={1}
        defaultColumns={Math.max(1, Math.min(resolvedDetailColumns, details.length))}
        defaultSpacing={1}
        defaultHeight={
          Math.ceil(details.length / Math.max(1, Math.min(resolvedDetailColumns, details.length))) *
          DETAIL_PANEL_SECTION_HEIGHT_PX
        }
        sx={{
          m: 0,
          width: "100%",
          alignContent: "flex-start",
        }}
      >
        {details.map((section) => (
          <Box
            key={section.key}
            component="div"
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.55,
              minWidth: 0,
              width: "100%",
              p: 0.75,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: alpha(theme.palette.background.paper, 0.72),
            }}
          >
            <Typography
              component="div"
              variant="caption"
              sx={{
                bgcolor: alpha(accentColor, 0.12),
                color: accentColor,
                px: 0.75,
                py: 0.125,
                borderRadius: "6px",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                alignSelf: "flex-start",
              }}
            >
              {section.label}
            </Typography>

            <Box
              component="div"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 0.35,
                minWidth: 0,
              }}
            >
              {section.items.map((item, itemIndex) => {
                const itemName = String(item?.name ?? item?.value ?? "").trim() || "Unnamed";
                const badges = renderDetailItemChips(item)
                  .map((chipNode, chipIndex) => ({
                    key: chipNode?.key || `${section.key}-${itemIndex}-chip-${chipIndex}`,
                    label: chipNode?.props?.label,
                    color: chipNode?.props?.color || "default",
                  }))
                  .filter((badge) => Boolean(String(badge.label || "").trim()));

                return (
                  <Box
                    key={`${section.key}-${itemIndex}`}
                    component="div"
                    sx={{
                      display: "flex",
                      alignItems: "baseline",
                      flexWrap: "wrap",
                      gap: "2px 6px",
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      component="span"
                      variant="body2"
                      sx={
                        item?.negated || item?.historic
                          ? {
                              ...getDetailNameStyle(item),
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                              lineHeight: 1.25,
                            }
                          : {
                              ...getDetailNameStyle(item),
                              color: alpha(theme.palette.text.primary, 0.85),
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                              lineHeight: 1.25,
                            }
                      }
                    >
                      {itemName}
                    </Typography>

                    {badges.length > 0 ? (
                      <Box
                        component="span"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          flexWrap: "wrap",
                        }}
                      >
                        {badges.map((badge) => {
                          const badgeColor = badgeColorByChipColor[badge.color] || badgeColorByChipColor.default;
                          return (
                            <Typography
                              key={`${section.key}-${itemIndex}-${badge.key}`}
                              component="span"
                              variant="caption"
                              sx={{
                                px: 0.5,
                                py: 0,
                                borderRadius: "9px",
                                fontSize: "0.65rem",
                                lineHeight: 1.5,
                                border: "1px solid",
                                borderColor: badgeColor.borderColor,
                                color: badgeColor.color,
                                bgcolor: badgeColor.bgcolor,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {badge.label}
                            </Typography>
                          );
                        })}
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Masonry>
    </Box>
  );
}

DetailPanel.propTypes = {
  row: PropTypes.object.isRequired,
  onPatientOpen: PropTypes.func,
};

export default DetailPanel;
