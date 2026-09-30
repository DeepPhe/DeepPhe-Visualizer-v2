import React from "react";
import PropTypes from "prop-types";
import { Box, Typography } from "@mui/material";
import { getFactLabel } from "../../controllers/cancerComparison";
import { PATIENT_VIEW_TYPE } from "../../constants/patientViewTypography";

const UNDOCUMENTED_TITLE = "Not documented in this patient's notes";

// A plain button, not an MUI one: these are values with an affordance, not
// inputs, and the matrix renders one per cell on a panel that re-renders with
// the theme.
export const valueButtonSx = (isActive) => ({
  appearance: "none",
  background: "none",
  border: 0,
  p: 0,
  m: 0,
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
  color: isActive ? "primary.main" : "text.primary",
  textDecoration: isActive ? "underline" : "none",
  textUnderlineOffset: 3,
  ...PATIENT_VIEW_TYPE.value,
  "&:hover": { textDecoration: "underline" },
  "&:focus-visible": {
    outline: (theme) =>
      `${Number.parseFloat(theme.custom?.focusRingWidth) || 2}px solid ${
        theme.custom?.focusRing || theme.palette.primary.main
      }`,
    outlineOffset: 2,
  },
});

/**
 * One value in a cancer comparison: its facts as clickable buttons (selecting
 * one links it to the documents that mention it), a muted dash when nothing is
 * documented, or a note that a tumor just repeats its cancer. `compact` shortens
 * that note for tables where the column is only as wide as its content.
 */
export default function CancerFactCell({ cell, activeFactId, onFactSelect, compact = false }) {
  if (cell.isUnknown) {
    return (
      <Typography
        component="span"
        variant="body2"
        color="text.disabled"
        title={UNDOCUMENTED_TITLE}
        aria-label="Not documented"
        sx={PATIENT_VIEW_TYPE.value}
      >
        —
      </Typography>
    );
  }

  if (cell.matchesCancer) {
    return (
      <Typography
        component="span"
        variant="body2"
        color="text.secondary"
        title={compact ? "Same as the cancer" : undefined}
        sx={{ ...PATIENT_VIEW_TYPE.value, fontStyle: "italic" }}
      >
        {compact ? "same" : "Same as cancer"}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 1, minWidth: 0 }}>
      {cell.facts.map((fact) => {
        const factId = String(fact.id || "").trim();
        return (
          <Box
            component="button"
            type="button"
            key={factId}
            onClick={() => onFactSelect?.(factId)}
            aria-pressed={activeFactId === factId}
            sx={valueButtonSx(activeFactId === factId)}
          >
            {fact.comparisonPrefix ? `${fact.comparisonPrefix}${getFactLabel(fact)}` : getFactLabel(fact)}
          </Box>
        );
      })}
    </Box>
  );
}

CancerFactCell.propTypes = {
  cell: PropTypes.shape({
    isUnknown: PropTypes.bool,
    matchesCancer: PropTypes.bool,
    facts: PropTypes.array,
  }).isRequired,
  activeFactId: PropTypes.string,
  onFactSelect: PropTypes.func,
  compact: PropTypes.bool,
};

