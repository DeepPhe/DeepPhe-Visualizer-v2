import React from "react";
import PropTypes from "prop-types";
import { Box, TableCell, TableRow } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { flexRender } from "@tanstack/react-table";
import DetailPanel from "./PatientDetailPanel";

// A single data row plus its (conditionally rendered) expanded detail row.
// Intentionally NOT memoized: TanStack keeps row object references stable across
// renders, so a memo would compare equal even when row.getIsExpanded() flips —
// the detail panel would never appear. Expansion is read live at render time.
function PatientGridRow({ row, rowIndex, columnCount, onToggleExpansion, onPatientOpen, onDetailContextMenu }) {
  const theme = useTheme();
  const rowBackground = rowIndex % 2 === 0 ? theme.palette.background.paper : theme.palette.background.default;
  const rowHoverBackground = theme.custom?.rowHoverBg || alpha(theme.palette.primary.main, 0.08);

  return (
    <>
      <TableRow
        hover
        onClick={row.getCanExpand() ? () => onToggleExpansion(row.id) : undefined}
        sx={{
          cursor: row.getCanExpand() ? "pointer" : "default",
          bgcolor: rowBackground,
          "&:hover > td[data-pinned-column='true']": {
            background: `linear-gradient(${rowHoverBackground}, ${rowHoverBackground}), ${rowBackground}`,
          },
        }}
      >
        {row.getVisibleCells().map((cell) => {
          const columnMeta = cell.column.columnDef.meta || {};

          return (
            <TableCell
              key={cell.id}
              data-column-id={cell.column.id}
              data-column-size={cell.column.getSize()}
              data-pinned-column={columnMeta.pinned ? "true" : undefined}
              sx={{
                py: 0.7,
                verticalAlign: "top",
                width: cell.column.getSize(),
                minWidth: cell.column.getSize(),
                maxWidth: cell.column.getSize(),
                overflow: "hidden",
                position: columnMeta.pinned ? "sticky" : "static",
                left: columnMeta.pinned ? columnMeta.stickyLeft : "auto",
                zIndex: columnMeta.pinned ? 2 : 1,
                bgcolor: columnMeta.pinned ? rowBackground : "inherit",
                boxShadow:
                  cell.column.id === "patientId" ? `2px 0 4px ${alpha(theme.palette.common.black, 0.1)}` : "none",
              }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          );
        })}
      </TableRow>

      {row.getIsExpanded() ? (
        <TableRow
          onContextMenu={
            typeof onPatientOpen === "function"
              ? (event) => onDetailContextMenu(event, row.original?.patientId)
              : undefined
          }
          sx={{
            cursor: typeof onPatientOpen === "function" ? "context-menu" : "default",
          }}
        >
          <TableCell
            colSpan={columnCount}
            sx={{
              py: 0,
              px: 0,
              bgcolor: theme.custom?.rowHoverBg || alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <Box
              sx={{
                position: "sticky",
                left: 0,
                width: "min(calc(100vw - 32px), 100%)",
                maxWidth: "100%",
              }}
            >
              <DetailPanel row={row} onPatientOpen={onPatientOpen} />
            </Box>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

PatientGridRow.propTypes = {
  row: PropTypes.object.isRequired,
  rowIndex: PropTypes.number.isRequired,
  columnCount: PropTypes.number.isRequired,
  onToggleExpansion: PropTypes.func.isRequired,
  onPatientOpen: PropTypes.func,
  onDetailContextMenu: PropTypes.func,
};

export default PatientGridRow;
