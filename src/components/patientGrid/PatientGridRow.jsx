import React from "react";
import PropTypes from "prop-types";
import { TableCell, TableRow } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { flexRender } from "@tanstack/react-table";
import DetailPanel from "./PatientDetailPanel";

// A single data row plus its (conditionally rendered) expanded detail row.
// Intentionally NOT memoized: TanStack keeps row object references stable across
// renders, so a memo would compare equal even when row.getIsExpanded() flips —
// the detail panel would never appear. Expansion is read live at render time.
function PatientGridRow({ row, rowIndex, columnCount, onToggleExpansion, onPatientOpen, onDetailContextMenu }) {
  const theme = useTheme();

  return (
    <>
      <TableRow
        hover
        onClick={row.getCanExpand() ? () => onToggleExpansion(row.id) : undefined}
        sx={{
          cursor: row.getCanExpand() ? "pointer" : "default",
          bgcolor:
            rowIndex % 2 === 0
              ? "transparent"
              : alpha(
                  theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black,
                  theme.palette.mode === "dark" ? 0.02 : 0.03
                ),
        }}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell
            key={cell.id}
            data-column-id={cell.column.id}
            data-column-size={cell.column.getSize()}
            sx={{
              py: 0.7,
              verticalAlign: "top",
              width: cell.column.getSize(),
              minWidth: cell.column.getSize(),
              maxWidth: cell.column.getSize(),
              overflow: "hidden",
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
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
            <DetailPanel row={row} onPatientOpen={onPatientOpen} />
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
