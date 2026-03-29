import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, Chip, Paper, Popper, Typography } from "@mui/material";

const NOOP = () => {};

const sectionLabelSx = {
  fontSize: "0.62rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "text.secondary",
  mb: 0.4,
};

function joinNames(items = []) {
  return items.map((item) => item.name).filter(Boolean).join(" \u00b7 ");
}

export default function PatientSummaryTooltip({
  open = false,
  anchorEl = null,
  summaryData = null,
  onClose = NOOP,
}) {
  const mergedTxItems = useMemo(() => {
    const tx = Array.isArray(summaryData?.treatments) ? summaryData.treatments : [];
    const procedures = Array.isArray(summaryData?.procedures) ? summaryData.procedures : [];

    return [...tx, ...procedures].sort((leftItem, rightItem) => {
      if ((rightItem.docFreq || 0) !== (leftItem.docFreq || 0)) {
        return (rightItem.docFreq || 0) - (leftItem.docFreq || 0);
      }
      return String(leftItem.name || "").localeCompare(String(rightItem.name || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [summaryData?.procedures, summaryData?.treatments]);

  if (!summaryData) {
    return null;
  }

  const numericDocCount = Number(summaryData.docCount);
  const hasKnownDocCount = Number.isFinite(numericDocCount) && numericDocCount > 0;

  const activeDx = Array.isArray(summaryData.activeDx) ? summaryData.activeDx : [];
  const activeDxRows = activeDx.slice(0, 5);
  const extraDxCount = Math.max(0, activeDx.length - activeDxRows.length);
  const stagingText = joinNames(summaryData.staging);
  const biomarkersText = joinNames(summaryData.biomarkers);
  const activeFindings = Array.isArray(summaryData.activeFindings)
    ? summaryData.activeFindings
    : [];
  const negatedFindings = Array.isArray(summaryData.negatedFindings)
    ? summaryData.negatedFindings
    : [];
  const negatedDx = Array.isArray(summaryData.negatedDx) ? summaryData.negatedDx : [];

  return (
    <Popper
      open={open && Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="bottom-start"
      onMouseLeave={onClose}
      modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
    >
      <Paper
        elevation={8}
        sx={{
          width: "min(420px, 25vw)",
          maxWidth: "min(420px, 25vw)",
          maxHeight: "50vh",
          overflowY: "auto",
          p: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "rgba(15, 23, 42, 0.98)" : "background.paper",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
          Patient {summaryData.patientId}
          {hasKnownDocCount ? ` · ${numericDocCount} notes` : ""}
        </Typography>

        {activeDxRows.length > 0 ? (
          <Box sx={{ mb: 0.9 }}>
            <Typography sx={sectionLabelSx}>DX</Typography>
            {activeDxRows.map((item) => (
              <Box
                key={`${item.name}-${item.site || ""}-${item.laterality || ""}`}
                sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.35, flexWrap: "wrap" }}
              >
                <Typography variant="body2">
                  {item.name}
                  {item.site ? ` — ${item.site}` : ""}
                  {item.laterality ? `, ${item.laterality}` : ""}
                </Typography>
                {item.uncertain ? (
                  <Chip
                    size="small"
                    label="uncertain"
                    sx={{
                      height: 16,
                      fontSize: "0.62rem",
                      fontStyle: "italic",
                      bgcolor: "rgba(245, 158, 11, 0.16)",
                      color: "warning.light",
                    }}
                  />
                ) : null}
              </Box>
            ))}
            {extraDxCount > 0 ? (
              <Typography variant="caption" color="text.secondary">
                +{extraDxCount} more
              </Typography>
            ) : null}
          </Box>
        ) : null}

        {stagingText ? (
          <Box sx={{ mb: 0.9 }}>
            <Typography sx={sectionLabelSx}>Stage</Typography>
            <Typography variant="body2">{stagingText}</Typography>
          </Box>
        ) : null}

        {biomarkersText ? (
          <Box sx={{ mb: 0.9 }}>
            <Typography sx={sectionLabelSx}>Markers</Typography>
            <Typography variant="body2">{biomarkersText}</Typography>
          </Box>
        ) : null}

        {mergedTxItems.length > 0 ? (
          <Box sx={{ mb: 0.9 }}>
            <Typography sx={sectionLabelSx}>Tx</Typography>
            <Typography variant="body2">
              {mergedTxItems
                .map((item) => `${item.name}${item.docFreq ? ` (×${item.docFreq})` : ""}`)
                .join(" · ")}
            </Typography>
          </Box>
        ) : null}

        {activeFindings.length > 0 || negatedFindings.length > 0 ? (
          <Box sx={{ mb: 0.4 }}>
            <Typography sx={sectionLabelSx}>Path</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {activeFindings.map((item) => (
                <Typography key={`active-${item.name}`} variant="body2">
                  {item.name}
                </Typography>
              ))}
              {negatedFindings.map((item) => (
                <Chip
                  key={`negated-${item.name}`}
                  size="small"
                  label={`${item.name}: neg ✓`}
                  sx={{
                    height: 18,
                    fontSize: "0.62rem",
                    bgcolor: "rgba(34, 197, 94, 0.18)",
                    color: "success.light",
                  }}
                />
              ))}
            </Box>
          </Box>
        ) : null}

        {negatedDx.length > 0 ? (
          <Box
            component="details"
            sx={{
              mt: 0.4,
              color: "text.secondary",
              "& > summary": {
                cursor: "pointer",
                fontSize: "0.75rem",
                listStyle: "none",
              },
              "& > summary::-webkit-details-marker": {
                display: "none",
              },
            }}
          >
            <Box component="summary">Ruled out</Box>
            <Typography variant="caption" sx={{ display: "block", mt: 0.4 }}>
              {negatedDx.map((item) => item.name).join(", ")}
            </Typography>
          </Box>
        ) : null}
      </Paper>
    </Popper>
  );
}

PatientSummaryTooltip.propTypes = {
  open: PropTypes.bool,
  anchorEl: PropTypes.oneOfType([
    PropTypes.shape({
      nodeType: PropTypes.number,
    }),
    PropTypes.func,
  ]),
  summaryData: PropTypes.shape({
    patientId: PropTypes.string,
    docCount: PropTypes.number,
    activeDx: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        site: PropTypes.string,
        laterality: PropTypes.string,
        uncertain: PropTypes.bool,
        docFreq: PropTypes.number,
      })
    ),
    negatedDx: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
    staging: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
    biomarkers: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
    procedures: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        docFreq: PropTypes.number,
      })
    ),
    treatments: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        docFreq: PropTypes.number,
      })
    ),
    activeFindings: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
    negatedFindings: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
  }),
  onClose: PropTypes.func,
};
