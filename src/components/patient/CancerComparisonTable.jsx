import React, { useCallback, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, Typography } from "@mui/material";
import { buildCancerComparisonTable } from "../../controllers/cancerComparison";
import { PATIENT_VIEW_TYPE } from "../../constants/patientViewTypography";
import CancerComparisonMatrix from "./CancerComparisonMatrix";
import CancerFactCell, { valueButtonSx } from "./CancerFactCell";

// Room each attribute column needs, and the cancer label column, in px. Below
// what the visible columns need, the table would scroll sideways, so the
// vertical matrix is used instead.
const COLUMN_MIN_WIDTH_PX = 112;
const ROW_LABEL_WIDTH_PX = 132;

const headerCellSx = {
  textAlign: "left",
  verticalAlign: "bottom",
  px: 1.25,
  py: 0.4,
  whiteSpace: "nowrap",
};

/**
 * The cancers as rows and their attributes as columns: a header and a few short
 * rows, each column only as wide as its values, instead of an equal share of the
 * panel. Tumor attributes get columns only where a tumor differs from its
 * cancer, under their own heading.
 *
 * When the panel is too narrow for the columns it needs, it renders the vertical
 * CancerComparisonMatrix instead, so nothing is hidden off-screen.
 */
export default function CancerComparisonTable({
  cancers = [],
  activeFactId = "",
  onFactSelect = undefined,
}) {
  const table = useMemo(() => buildCancerComparisonTable(cancers), [cancers]);
  const [showFolded, setShowFolded] = useState(false);
  // 0 until measured (and in environments that can't measure): assume it fits.
  const [containerWidth, setContainerWidth] = useState(0);
  const observerRef = useRef(null);

  const containerRef = useCallback((node) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) {
      return;
    }
    const initialWidth = node.getBoundingClientRect?.().width;
    if (initialWidth > 0) {
      setContainerWidth(initialWidth);
    }
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = Number(entries[0]?.contentRect?.width);
      if (Number.isFinite(width) && width > 0) {
        setContainerWidth((previous) => (Math.abs(previous - width) < 2 ? previous : width));
      }
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  const foldedCount = useMemo(
    () => table.columns.filter((column) => column.isFoldable).length,
    [table]
  );
  const visibleColumnIndexes = useMemo(
    () =>
      table.columns
        .map((column, index) => (showFolded || !column.isFoldable ? index : -1))
        .filter((index) => index >= 0),
    [table, showFolded]
  );

  // Consecutive visible columns from the same section share one heading.
  const groups = useMemo(() => {
    const result = [];
    visibleColumnIndexes.forEach((index) => {
      const column = table.columns[index];
      const last = result[result.length - 1];
      if (last && last.key === column.groupKey) {
        last.span += 1;
      } else {
        result.push({ key: column.groupKey, label: column.groupLabel, span: 1 });
      }
    });
    return result;
  }, [table, visibleColumnIndexes]);

  if (!table.hasData) {
    return (
      <Typography variant="body2" color="text.secondary">
        No cancer summary data available for this patient.
      </Typography>
    );
  }

  const neededWidth = ROW_LABEL_WIDTH_PX + visibleColumnIndexes.length * COLUMN_MIN_WIDTH_PX;
  const tooNarrow = containerWidth > 0 && containerWidth < neededWidth;

  return (
    <Box ref={containerRef} sx={{ minWidth: 0 }}>
      {tooNarrow ? (
        <CancerComparisonMatrix
          cancers={cancers}
          activeFactId={activeFactId}
          onFactSelect={onFactSelect}
        />
      ) : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              data-testid="cancer-comparison-table"
              sx={{
                // Only as wide as its content: narrow values, narrow columns.
                width: "max-content",
                maxWidth: "100%",
                borderCollapse: "collapse",
                "& td": { px: 1.25, py: 0.4, verticalAlign: "baseline", maxWidth: 280 },
              }}
            >
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" scope="col" rowSpan={2} sx={headerCellSx}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={PATIENT_VIEW_TYPE.fieldLabel}
                    >
                      Cancer
                    </Typography>
                  </Box>
                  {groups.map((group) => (
                    <Box
                      component="th"
                      scope="colgroup"
                      colSpan={group.span}
                      key={group.key}
                      sx={{ ...headerCellSx, pt: 0.5, borderBottom: 1, borderColor: "divider" }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          ...PATIENT_VIEW_TYPE.fieldLabel,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {group.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Box component="tr">
                  {visibleColumnIndexes.map((index) => {
                    const column = table.columns[index];
                    return (
                      <Box
                        component="th"
                        scope="col"
                        key={column.key}
                        data-differs={column.differs ? "true" : "false"}
                        sx={{ ...headerCellSx, borderBottom: 2, borderColor: "divider" }}
                      >
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={PATIENT_VIEW_TYPE.fieldLabel}
                        >
                          {column.label}
                        </Typography>
                        {column.differs ? (
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
                    );
                  })}
                </Box>
              </Box>
              <Box component="tbody">
                {table.rows.map((row) => (
                  <Box component="tr" key={row.key} data-testid="cancer-comparison-table-row">
                    <Box
                      component="th"
                      scope="row"
                      title={row.title ? `Full ID: ${row.title}` : undefined}
                      sx={{ ...headerCellSx, borderTop: 1, borderColor: "divider" }}
                    >
                      <Typography
                        component="span"
                        sx={{ ...PATIENT_VIEW_TYPE.panelTitle, fontSize: "0.875rem", mr: 0.75 }}
                      >
                        {row.label}
                      </Typography>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {`${row.documentedCount}/${row.fieldCount}`}
                      </Typography>
                    </Box>
                    {visibleColumnIndexes.map((index) => (
                      <Box
                        component="td"
                        key={`${row.key}:${table.columns[index].key}`}
                        sx={{ borderTop: 1, borderColor: "divider" }}
                      >
                        <CancerFactCell
                          compact
                          cell={row.cells[index]}
                          activeFactId={activeFactId}
                          onFactSelect={onFactSelect}
                        />
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {foldedCount > 0 ? (
            <Box
              component="button"
              type="button"
              data-testid="cancer-comparison-undocumented-toggle"
              onClick={() => setShowFolded((previous) => !previous)}
              aria-expanded={showFolded}
              sx={{
                ...valueButtonSx(false),
                color: "text.secondary",
                ...PATIENT_VIEW_TYPE.fieldLabel,
                mt: 0.5,
                ml: 1.25,
              }}
            >
              {showFolded
                ? `Hide ${foldedCount} undocumented or repeated column${foldedCount === 1 ? "" : "s"}`
                : `Show ${foldedCount} undocumented or repeated column${foldedCount === 1 ? "" : "s"}`}
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}

CancerComparisonTable.propTypes = {
  cancers: PropTypes.arrayOf(PropTypes.object),
  activeFactId: PropTypes.string,
  onFactSelect: PropTypes.func,
};
