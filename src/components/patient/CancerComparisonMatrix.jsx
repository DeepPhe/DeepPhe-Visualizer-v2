import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, Button, Tooltip, Typography } from "@mui/material";
import { buildCancerComparisonMatrix, getFactLabel } from "../../controllers/cancerComparison";

const UNDOCUMENTED_TITLE = "Not documented in this patient's notes";

/**
 * One fact. Still a button — selecting it links the fact to the documents that
 * mention it — but it reads as a value with an affordance, not as an input box.
 */
function FactValue({ fact, isActive, onSelect }) {
  return (
    <Button
      size="small"
      disableRipple={false}
      onClick={() => onSelect?.(fact.id)}
      aria-pressed={isActive}
      sx={{
        minWidth: 0,
        p: 0,
        textTransform: "none",
        fontSize: "0.8125rem",
        fontWeight: 500,
        lineHeight: 1.3,
        textAlign: "left",
        justifyContent: "flex-start",
        color: isActive ? "primary.main" : "text.primary",
        textDecoration: isActive ? "underline" : "none",
        textUnderlineOffset: 3,
        "&:hover": { background: "none", textDecoration: "underline" },
      }}
    >
      {getFactLabel(fact)}
    </Button>
  );
}

FactValue.propTypes = {
  fact: PropTypes.shape({ id: PropTypes.string }).isRequired,
  isActive: PropTypes.bool.isRequired,
  onSelect: PropTypes.func,
};

function MatrixCell({ cell, activeFactId, onFactSelect }) {
  if (cell.isUnknown) {
    return (
      <Tooltip title={UNDOCUMENTED_TITLE}>
        <Typography component="span" variant="body2" color="text.disabled" aria-label="Not documented">
          —
        </Typography>
      </Tooltip>
    );
  }

  if (cell.matchesCancer) {
    return (
      <Typography component="span" variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
        Same as cancer
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 1, rowGap: 0.25, minWidth: 0 }}>
      {cell.facts.map((fact) => (
        <FactValue
          key={String(fact.id)}
          fact={fact}
          isActive={activeFactId === String(fact.id || "").trim()}
          onSelect={onFactSelect}
        />
      ))}
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
 * tumors in their own sections underneath their parent. Rows whose values
 * differ between cancers are marked, since those are the reason to compare.
 */
export default function CancerComparisonMatrix({
  cancers = [],
  activeFactId = "",
  onFactSelect = undefined,
}) {
  const matrix = useMemo(() => buildCancerComparisonMatrix(cancers), [cancers]);

  if (!matrix.hasData) {
    return (
      <Typography variant="body2" color="text.secondary">
        No cancer summary data available for this patient.
      </Typography>
    );
  }

  const gridTemplateColumns = `minmax(104px, auto) repeat(${matrix.columns.length}, minmax(0, 1fr))`;

  return (
    <Box
      component="table"
      data-testid="cancer-comparison-matrix"
      sx={{
        width: "100%",
        borderCollapse: "collapse",
        display: "grid",
        gridTemplateColumns,
        rowGap: 0,
        columnGap: 1.5,
        "& thead, & tbody, & tr": { display: "contents" },
        "& th, & td": {
          textAlign: "left",
          verticalAlign: "baseline",
          px: 0.5,
          py: 0.35,
          minWidth: 0,
        },
      }}
    >
      <Box component="thead">
        <Box component="tr">
          <Box component="th" scope="col">
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Attribute
            </Typography>
          </Box>
          {matrix.columns.map((column) => (
            <Box
              component="th"
              scope="col"
              key={column.key}
              sx={{ borderBottom: 2, borderColor: "divider" }}
            >
              <Tooltip title={column.title ? `Full ID: ${column.title}` : ""}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                  {column.label}
                </Typography>
              </Tooltip>
              <Typography variant="caption" color="text.secondary">
                {`${column.documentedCount} of ${column.fieldCount} documented`}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {matrix.sections.map((section) => (
        <Box component="tbody" key={section.key}>
          <Box component="tr">
            <Box
              component="th"
              scope="colgroup"
              colSpan={matrix.columns.length + 1}
              sx={{ gridColumn: "1 / -1", pt: 0.75 }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}
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
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, display: "block" }}
                >
                  {row.label}
                </Typography>
                {row.differs ? (
                  <Typography
                    variant="caption"
                    color="warning.dark"
                    sx={{ fontWeight: 600, fontSize: "0.65rem" }}
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
                  <MatrixCell
                    cell={cell}
                    activeFactId={activeFactId}
                    onFactSelect={onFactSelect}
                  />
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

CancerComparisonMatrix.propTypes = {
  cancers: PropTypes.arrayOf(PropTypes.object),
  activeFactId: PropTypes.string,
  onFactSelect: PropTypes.func,
};
