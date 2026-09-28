import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box, Typography } from "@mui/material";
import { buildCancerComparisonMatrix, getFactLabel } from "../../controllers/cancerComparison";
import { PATIENT_VIEW_TYPE } from "../../constants/patientViewTypography";

const UNDOCUMENTED_TITLE = "Not documented in this patient's notes";

// A plain button, not an MUI one: these are values with an affordance, not
// inputs, and the matrix renders one per cell on a panel that re-renders with
// the theme.
const valueButtonSx = (isActive) => ({
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

function MatrixCell({ cell, activeFactId, onFactSelect }) {
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
        sx={{ ...PATIENT_VIEW_TYPE.value, fontStyle: "italic" }}
      >
        Same as cancer
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

MatrixCell.propTypes = {
  cell: PropTypes.shape({
    isUnknown: PropTypes.bool,
    matchesCancer: PropTypes.bool,
    facts: PropTypes.array,
  }).isRequired,
  activeFactId: PropTypes.string,
  onFactSelect: PropTypes.func,
};

/**
 * The cancers side by side: attributes down the left, one column per cancer,
 * tumors in their own sections underneath their parent. Rows where the cancers
 * disagree are marked, since those are the reason to compare. Rows with nothing
 * documented for any cancer fold away behind a count, so the panel stays short
 * enough to leave the timelines above the fold.
 */
export default function CancerComparisonMatrix({
  cancers = [],
  matrix: providedMatrix = null,
  activeFactId = "",
  onFactSelect = undefined,
}) {
  const builtMatrix = useMemo(
    () => (providedMatrix ? null : buildCancerComparisonMatrix(cancers)),
    [providedMatrix, cancers]
  );
  const matrix = providedMatrix || builtMatrix;
  const [showUndocumented, setShowUndocumented] = useState(false);

  const emptyRowCount = useMemo(
    () =>
      matrix.sections.reduce(
        (total, section) => total + section.rows.filter((row) => row.isFoldable).length,
        0
      ),
    [matrix]
  );

  if (!matrix.hasData) {
    return (
      <Typography variant="body2" color="text.secondary">
        No cancer summary data available for this patient.
      </Typography>
    );
  }

  const visibleSections = matrix.sections
    .map((section) => ({
      ...section,
      rows: showUndocumented ? section.rows : section.rows.filter((row) => !row.isFoldable),
    }))
    .filter((section) => section.rows.length > 0);

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        component="table"
        data-testid="cancer-comparison-matrix"
        sx={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: `minmax(92px, auto) repeat(${matrix.columns.length}, minmax(0, 1fr))`,
          columnGap: 1.5,
          "& thead, & tbody, & tr": { display: "contents" },
          "& th, & td": {
            textAlign: "left",
            verticalAlign: "baseline",
            px: 0.5,
            py: 0.2,
            minWidth: 0,
          },
        }}
      >
        <Box component="thead">
          <Box component="tr">
            <Box component="th" scope="col">
              <Typography
                variant="caption"
                color="text.secondary"
                sx={PATIENT_VIEW_TYPE.fieldLabel}
              >
                Attribute
              </Typography>
            </Box>
            {matrix.columns.map((column) => (
              <Box
                component="th"
                scope="col"
                key={column.key}
                sx={{ borderBottom: 2, borderColor: "divider" }}
                title={column.title ? `Full ID: ${column.title}` : undefined}
              >
                <Typography component="span" sx={{ ...PATIENT_VIEW_TYPE.panelTitle, fontSize: "0.875rem", mr: 0.75 }}>
                  {column.label}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary">
                  {`${column.documentedCount}/${column.fieldCount} documented`}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {visibleSections.map((section) => (
          <Box component="tbody" key={section.key}>
            <Box component="tr">
              <Box
                component="th"
                scope="colgroup"
                colSpan={matrix.columns.length + 1}
                sx={{ gridColumn: "1 / -1", pt: 0.5 }}
              >
                <Typography
                  variant="caption"
                  sx={{ ...PATIENT_VIEW_TYPE.fieldLabel, textTransform: "uppercase", letterSpacing: 0.5 }}
                  color="text.secondary"
                >
                  {section.label}
                </Typography>
              </Box>
            </Box>
            {section.rows.map((row) => (
              <Box component="tr" key={row.key} data-testid="cancer-comparison-row">
                <Box
                  component="th"
                  scope="row"
                  data-differs={row.differs ? "true" : "false"}
                  sx={{
                    borderTop: 1,
                    borderColor: "divider",
                    // Tumor rows sit under their cancer, so indent them.
                    pl: section.key === "cancer" ? 0.5 : 1.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={PATIENT_VIEW_TYPE.fieldLabel}
                  >
                    {row.label}
                  </Typography>
                  {row.differs ? (
                    <Typography
                      component="span"
                      variant="caption"
                      color="warning.dark"
                      sx={{ ml: 0.5, fontWeight: 700, fontSize: "0.625rem" }}
                    >
                      differs
                    </Typography>
                  ) : null}
                </Box>
                {row.cells.map((cell) => (
                  <Box
                    component="td"
                    key={`${row.key}:${cell.columnKey}`}
                    sx={{ borderTop: 1, borderColor: "divider" }}
                  >
                    <MatrixCell cell={cell} activeFactId={activeFactId} onFactSelect={onFactSelect} />
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        ))}
      </Box>

      {emptyRowCount > 0 ? (
        <Box
          component="button"
          type="button"
          data-testid="cancer-comparison-undocumented-toggle"
          onClick={() => setShowUndocumented((previous) => !previous)}
          aria-expanded={showUndocumented}
          sx={{
            ...valueButtonSx(false),
            color: "text.secondary",
            ...PATIENT_VIEW_TYPE.fieldLabel,
            mt: 0.5,
            ml: 0.5,
          }}
        >
          {showUndocumented
            ? `Hide ${emptyRowCount} undocumented or repeated field${emptyRowCount === 1 ? "" : "s"}`
            : `Show ${emptyRowCount} undocumented or repeated field${emptyRowCount === 1 ? "" : "s"}`}
        </Box>
      ) : null}
    </Box>
  );
}

CancerComparisonMatrix.propTypes = {
  cancers: PropTypes.arrayOf(PropTypes.object),
  matrix: PropTypes.object,
  activeFactId: PropTypes.string,
  onFactSelect: PropTypes.func,
};
