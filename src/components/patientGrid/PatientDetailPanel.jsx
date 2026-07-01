import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box, Button, Chip, Slider, Stack, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import Masonry from "@mui/lab/Masonry";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";

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

function normalizeDetailConfidence(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const normalizedValue = numericValue > 1 ? numericValue / 100 : numericValue;
  return Math.max(0, Math.min(1, normalizedValue));
}

// Filter-summary payloads can expose confidence directly on an item or through
// the same selection/document ranking used by the full patient viewer.
function getDetailItemConfidence(item) {
  const directCandidates = [
    item?.selection?.bestConfidence,
    item?.bestConfidence,
    item?.best_confidence,
    item?.confidence,
    item?.confidenceScore,
    item?.confidence_score,
    item?.score,
  ];

  for (const candidate of directCandidates) {
    const confidence = normalizeDetailConfidence(candidate);
    if (confidence !== null) {
      return confidence;
    }
  }

  const ranking = Array.isArray(item?.selection?.documentRanking)
    ? item.selection.documentRanking
    : Array.isArray(item?.documentRanking)
    ? item.documentRanking
    : [];
  const rankedConfidences = ranking
    .map((entry) => normalizeDetailConfidence(entry?.confidence))
    .filter((confidence) => confidence !== null);

  return rankedConfidences.length > 0 ? Math.max(...rankedConfidences) : null;
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
  const [confidenceThreshold, setConfidenceThreshold] = useState(50);
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
  const rawPatientSummary = row?.original?._raw;
  const allDetails = useMemo(() => getDetailSections(rawPatientSummary), [rawPatientSummary]);
  const thresholdFraction = confidenceThreshold / 100;
  const details = useMemo(() => {
    if (thresholdFraction <= 0) {
      return allDetails;
    }

    return allDetails
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const confidence = getDetailItemConfidence(item);
          return confidence === null || confidence >= thresholdFraction - 1e-9;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [allDetails, thresholdFraction]);
  const totalItemCount = allDetails.reduce(
    (count, section) => count + section.items.length,
    0
  );
  const visibleItemCount = details.reduce(
    (count, section) => count + section.items.length,
    0
  );
  const hiddenItemCount = totalItemCount - visibleItemCount;
  const patientId = String(row?.original?.patientId || "").trim();
  const canShowDocumentViewerButton = typeof onPatientOpen === "function" && Boolean(patientId);
  const detailPanelHeader = (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Patient Summary
      </Typography>
      {canShowDocumentViewerButton ? (
        <Button
          size="small"
          variant="contained"
          color="primary"
          disableElevation
          startIcon={<ArticleOutlinedIcon />}
          onClick={(event) => {
            event.stopPropagation();
            onPatientOpen(patientId);
          }}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            boxShadow: 1,
            "&:hover": { boxShadow: 3 },
          }}
        >
          Show in Document Viewer
        </Button>
      ) : null}
      {allDetails.length > 0 ? (
        <Tooltip title="Hide findings below this extraction confidence">
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            sx={{ ml: "auto", pr: 0.5 }}
          >
            <Typography component="span" sx={{ fontSize: "inherit", whiteSpace: "nowrap" }}>
              Confidence:{" "}
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
                {">=50%"}
              </Box>
            </Typography>
            <Slider
              size="small"
              value={confidenceThreshold}
              min={50}
              max={100}
              step={5}
              onChange={(_event, value) =>
                setConfidenceThreshold(Array.isArray(value) ? value[0] : value)
              }
              aria-label="Minimum patient drawer finding confidence percent"
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              sx={{ width: { xs: 84, sm: 116 } }}
            />
            <Typography
              variant="caption"
              aria-hidden
              sx={{
                fontSize: "inherit",
                minWidth: 34,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                fontWeight: 700,
                color: "text.secondary",
              }}
            >
              100%
            </Typography>
          </Stack>
        </Tooltip>
      ) : null}
    </Box>
  );

  if (allDetails.length === 0) {
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
      {hiddenItemCount > 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          aria-live="polite"
          sx={{ px: 0.25 }}
        >
          {hiddenItemCount} finding{hiddenItemCount === 1 ? "" : "s"} hidden below {confidenceThreshold}% confidence.
        </Typography>
      ) : null}
      {details.length > 0 ? (
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
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.25 }}>
          No findings at or above {confidenceThreshold}% confidence. Lower the confidence filter to show more.
        </Typography>
      )}
    </Box>
  );
}

DetailPanel.propTypes = {
  row: PropTypes.object.isRequired,
  onPatientOpen: PropTypes.func,
};

export default DetailPanel;
