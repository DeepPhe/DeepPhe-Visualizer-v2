import React, { useCallback, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PropTypes from "prop-types";
import { createColumns, SortIndicator } from "./patientGrid/patientGridColumns";
import PatientGridRow from "./patientGrid/PatientGridRow";
import { exportFilteredSortedRowsToCsv } from "./patientGrid/patientGridExport";

const CLINICAL_SEARCH_FIELDS = ["diagnoses", "biomarkers", "treatments", "procedures", "findings"];
const DEFAULT_PAGE_SIZE = 10;

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toExpandedState(updaterResult) {
  if (!updaterResult || updaterResult === true) {
    return {};
  }

  const expandedRowIds = Object.keys(updaterResult).filter((rowId) => Boolean(updaterResult[rowId]));
  if (expandedRowIds.length === 0) {
    return {};
  }

  const mostRecentRowId = expandedRowIds[expandedRowIds.length - 1];
  return { [mostRecentRowId]: true };
}

export default function PatientGrid({
  data = [],
  cohortSize = 0,
  totalCohortCount = 0,
  totalPages = 0,
  currentPage = 0,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange = () => {},
  isLoading = false,
  error = "",
  onRetry = () => {},
  embedded = false,
  title = embedded ? "Patient Grid" : "Patient Details",
  subtitle = "",
  collapsible = false,
  expanded = true,
  onToggleExpanded = () => {},
  compactHeader = false,
  toggleButtonTestId = undefined,
  collapsiblePanelId = undefined,
  collapsedHeaderSummary = null,
  onPatientOpen = undefined,
  openPatientIds = [],
}) {
  const theme = useTheme();
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnSizing, setColumnSizing] = useState({});
  const [columnSizingInfo, setColumnSizingInfo] = useState({});
  const [columnMenuAnchorEl, setColumnMenuAnchorEl] = useState(null);

  const [contextMenu, setContextMenu] = useState(null); // { mouseX, mouseY, patientId } | null

  const toggleRowExpansion = useCallback((rowId) => {
    setExpandedRows((previous) => (previous?.[rowId] ? {} : { [rowId]: true }));
  }, []);

  const handleDetailRowContextMenu = useCallback(
    (event, patientId) => {
      if (typeof onPatientOpen !== "function") return;
      event.preventDefault();
      setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, patientId });
    },
    [onPatientOpen]
  );

  const handleContextMenuClose = useCallback(() => setContextMenu(null), []);

  const columns = useMemo(
    () => createColumns({ onToggleRow: toggleRowExpansion, onPatientOpen }),
    [toggleRowExpansion, onPatientOpen]
  );

  const handleExpandedChange = useCallback((updater) => {
    setExpandedRows((previous) => {
      const nextExpanded = typeof updater === "function" ? updater(previous) : updater;
      return toExpandedState(nextExpanded);
    });
  }, []);

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      sorting,
      expanded: expandedRows,
      columnVisibility,
      columnSizing,
      columnSizingInfo,
    },
    getRowCanExpand: (row) => Boolean(row?.original?._raw),
    globalFilterFn: (row, _, filterValue) => {
      const query = String(filterValue ?? "").trim().toLowerCase();
      if (!query) {
        return true;
      }

      const candidateValues = [
        row.original?.patientId,
        row.original?.ageAtDx,
        row.original?.gender,
        row.original?.race,
        row.original?.ethnicity,
        row.original?.cancerType,
        row.original?.stage,
        row.original?.grade,
        row.original?.activeDx,
      ];

      const baseMatch = candidateValues
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(query));

      if (baseMatch) {
        return true;
      }

      return CLINICAL_SEARCH_FIELDS.some((field) =>
        toArray(row?.original?._raw?.[field]).some((item) =>
          String(item?.name ?? item?.value ?? "")
            .toLowerCase()
            .includes(query)
        )
      );
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onExpandedChange: handleExpandedChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnSizingInfoChange: setColumnSizingInfo,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableMinWidth = table
    .getVisibleLeafColumns()
    .reduce((totalWidth, column) => totalWidth + column.getSize(), 0);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const loadedRowCount = data.length;
  const safePageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const safeTotalCohortCount = Math.max(
    0,
    Number.isFinite(Number(totalCohortCount)) ? Number(totalCohortCount) : Number(cohortSize) || 0
  );
  const safeCurrentPage = Math.max(0, Number(currentPage) || 0);
  const safeTotalPages = Math.max(
    Number(totalPages) || 0,
    Math.ceil(safeTotalCohortCount / safePageSize)
  );
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const totalColumnCount = columns.length;
  const isColumnMenuOpen = Boolean(columnMenuAnchorEl);
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  const isSearchActive = Boolean(String(globalFilter || "").trim());
  const showToolbarTitle = Boolean(String(title || "").trim());
  const showToolbarSubtitle = Boolean(String(subtitle || "").trim());
  const showSummaryRow = !(embedded && compactHeader);
  const shouldRenderGridBody = !collapsible || expanded;
  const showCollapsedHeaderSummary = Boolean(collapsible && collapsedHeaderSummary);

  const content = (
    <Box
      sx={
        embedded
          ? {
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: 0,
            }
          : undefined
      }
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        {showToolbarTitle || showToolbarSubtitle ? (
          <Stack spacing={0.25} sx={{ minWidth: 0, flex: "1 1 260px" }}>
            {showToolbarTitle ? (
              <Typography component="h2" variant={embedded ? "subtitle1" : "h6"} sx={{ fontWeight: 700 }}>
                {title}
                {!embedded ? (
                  <Typography component="span" variant="body2" sx={{ ml: 1, color: "text.secondary" }}>
                    {cohortSize.toLocaleString()} patients
                  </Typography>
                ) : null}
              </Typography>
            ) : null}
            {showToolbarSubtitle ? (
              <Typography variant="body2" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
        ) : (
          <Box sx={{ flex: "1 1 auto" }} />
        )}

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ flexWrap: "wrap", justifyContent: { xs: "flex-start", sm: "flex-end" } }}
        >
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search patient details..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            inputProps={{ "aria-label": "Search patient details" }}
            sx={{ width: { xs: "100%", sm: 290 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />

          <Tooltip title="Choose visible columns">
            <IconButton
              size="small"
              aria-label="Toggle visible patient columns"
              onClick={(event) => setColumnMenuAnchorEl(event.currentTarget)}
            >
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Export current page to CSV">
            <IconButton
              size="small"
              aria-label="Export filtered cohort rows to CSV"
              onClick={() => exportFilteredSortedRowsToCsv(table, "cohort-patients.csv")}
            >
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>

          {collapsible ? (
            <Button
              size="small"
              variant={expanded ? "outlined" : "contained"}
              onClick={onToggleExpanded}
              aria-expanded={expanded}
              aria-controls={collapsiblePanelId}
              data-testid={toggleButtonTestId}
            >
              {expanded ? "Collapse" : "Expand"}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {showCollapsedHeaderSummary ? (
        <Box sx={{ mb: 1.25 }} data-testid="patient-grid-collapsed-summary">
          {collapsedHeaderSummary}
        </Box>
      ) : null}

      <Menu
        anchorEl={columnMenuAnchorEl}
        open={isColumnMenuOpen}
        onClose={() => setColumnMenuAnchorEl(null)}
        keepMounted
        PaperProps={{
          sx: {
            minWidth: 220,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Box sx={{ px: 1.5, py: 0.75 }}>
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Checkbox
                size="small"
                checked={table.getIsAllColumnsVisible()}
                indeterminate={table.getIsSomeColumnsVisible() && !table.getIsAllColumnsVisible()}
                onChange={table.getToggleAllColumnsVisibilityHandler()}
              />
            }
            label={<Typography variant="body2">Toggle all columns</Typography>}
          />
        </Box>
        <Divider sx={{ borderColor: "divider" }} />
        {hideableColumns.map((column) => {
          const header = column.columnDef.header;
          const label = typeof header === "string" ? header : column.id;

          return (
            <MenuItem key={column.id} dense disableRipple sx={{ py: 0 }}>
              <FormControlLabel
                sx={{ m: 0, width: "100%", py: 0.5 }}
                control={
                  <Checkbox
                    size="small"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                }
                label={<Typography variant="body2">{label}</Typography>}
              />
            </MenuItem>
          );
        })}
      </Menu>

      {showSummaryRow ? (
        <Stack spacing={0.35} sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {isSearchActive
              ? `Showing ${filteredCount.toLocaleString()} of ${loadedRowCount.toLocaleString()} loaded (filtered) · ${safeTotalCohortCount.toLocaleString()} in cohort`
              : `Showing ${loadedRowCount.toLocaleString()} of ${safeTotalCohortCount.toLocaleString()} patients`}
          </Typography>
          {isSearchActive ? (
            <Typography variant="caption" color="text.secondary">
              Searching within loaded page
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      <Box
        id={collapsiblePanelId}
        hidden={!shouldRenderGridBody}
        aria-hidden={!shouldRenderGridBody}
        sx={{
          display: shouldRenderGridBody ? (embedded ? "flex" : "block") : "none",
          flexDirection: embedded ? "column" : undefined,
          flex: embedded ? "1 1 auto" : undefined,
          minHeight: embedded ? 0 : undefined,
        }}
      >
          <TableContainer
            sx={{
              maxHeight: embedded ? "none" : 560,
              overflowX: "auto",
              overflowY: "auto",
              flex: embedded ? "1 1 auto" : undefined,
              minHeight: embedded ? 0 : undefined,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Table stickyHeader size="small" sx={{ tableLayout: "fixed", minWidth: tableMinWidth }}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableCell
                      key={header.id}
                      data-column-id={header.column.id}
                      data-column-size={header.getSize()}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      sx={{
                        fontWeight: 700,
                        cursor: canSort ? "pointer" : "default",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        maxWidth: header.getSize(),
                        position: "relative",
                        pr: 1.5,
                        bgcolor: (muiTheme) =>
                          alpha(
                            muiTheme.palette.background.paper,
                            muiTheme.palette.mode === "dark" ? 0.92 : 0.98
                          ),
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort ? <SortIndicator column={header.column} /> : null}
                      {header.column.getCanResize() ? (
                        <Box
                          role="separator"
                          aria-label={`Resize ${String(header.column.columnDef.header || header.column.id)} column`}
                          aria-orientation="vertical"
                          data-testid={`patient-grid-column-resizer-${header.column.id}`}
                          onMouseDown={(event) => {
                            event.stopPropagation();
                            header.getResizeHandler()(event);
                          }}
                          onTouchStart={(event) => {
                            event.stopPropagation();
                            header.getResizeHandler()(event);
                          }}
                          sx={{
                            position: "absolute",
                            top: 0,
                            right: -5,
                            height: "100%",
                            width: 10,
                            cursor: "col-resize",
                            touchAction: "none",
                            zIndex: 2,
                            "&::after": {
                              content: '""',
                              position: "absolute",
                              top: "20%",
                              bottom: "20%",
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: 2,
                              borderRadius: 999,
                              bgcolor: header.column.getIsResizing()
                                ? "primary.main"
                                : alpha(theme.palette.text.primary, 0.18),
                            },
                          }}
                        />
                      ) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={totalColumnCount || visibleColumnCount} align="center" sx={{ py: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                    <CircularProgress size={16} />
                    <Typography color="text.secondary">Loading patient details...</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={totalColumnCount || visibleColumnCount} align="center" sx={{ py: 2.5 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems="center"
                    justifyContent="center"
                    spacing={1}
                  >
                    <Typography color="error.main">
                      {String(error || "Failed to load patient details.")}
                    </Typography>
                    <Button size="small" variant="outlined" onClick={onRetry}>
                      Retry
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, rowIndex) => (
                <PatientGridRow
                  key={row.id}
                  row={row}
                  rowIndex={rowIndex}
                  columnCount={totalColumnCount}
                  onToggleExpansion={toggleRowExpansion}
                  onPatientOpen={onPatientOpen}
                  onDetailContextMenu={handleDetailRowContextMenu}
                />
              ))
            )}

            {!isLoading && !error && table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumnCount || visibleColumnCount} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No patients match your search.</Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={safeTotalCohortCount}
            page={safeCurrentPage}
            rowsPerPage={safePageSize}
            rowsPerPageOptions={[safePageSize]}
            onPageChange={(_, nextPage) => onPageChange(nextPage)}
            labelDisplayedRows={({ from, to, count }) =>
              `${from}\u2013${to} of ${Number(count || 0).toLocaleString()} patients`
            }
            backIconButtonProps={{ disabled: isLoading || safeCurrentPage <= 0 }}
            nextIconButtonProps={{
              disabled:
                isLoading ||
                safeTotalPages <= 0 ||
                safeCurrentPage >= Math.max(0, safeTotalPages - 1),
            }}
            sx={{
              ".MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows": {
                color: "text.secondary",
              },
            }}
          />
      </Box>

      {/* Right-click context menu on detail rows */}
      <Menu
        open={Boolean(contextMenu)}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        {contextMenu && Array.isArray(openPatientIds) && openPatientIds.includes(contextMenu.patientId) ? (
          [
            <MenuItem
              key="goto"
              onClick={() => {
                onPatientOpen?.(contextMenu.patientId);
                handleContextMenuClose();
              }}
            >
              Go to tab
            </MenuItem>,
            <Divider key="divider" />,
            <MenuItem
              key="open"
              onClick={() => {
                onPatientOpen?.(contextMenu.patientId);
                handleContextMenuClose();
              }}
            >
              Open in new tab
            </MenuItem>,
          ]
        ) : (
          <MenuItem
            onClick={() => {
              onPatientOpen?.(contextMenu?.patientId);
              handleContextMenuClose();
            }}
          >
            Open in new tab
          </MenuItem>
        )}
      </Menu>
    </Box>
  );

  if (embedded) {
    return (
      <Box
        data-testid="patient-grid-embedded"
        sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <CardContent sx={{ pb: 1 }}>{content}</CardContent>
    </Card>
  );
}

const summaryValueShape = PropTypes.shape({
  display: PropTypes.string,
  full: PropTypes.string,
  overflow: PropTypes.number,
});

PatientGrid.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      patientId: PropTypes.string,
      ageAtDx: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      gender: PropTypes.string,
      race: PropTypes.string,
      ethnicity: PropTypes.string,
      cancerType: PropTypes.string,
      stage: PropTypes.string,
      stageSortRank: PropTypes.number,
      grade: PropTypes.string,
      activeDx: PropTypes.string,
      activeDxMeta: PropTypes.shape({
        name: PropTypes.string,
        historic: PropTypes.bool,
        uncertain: PropTypes.bool,
      }),
      diagnosesSummary: summaryValueShape,
      biomarkersSummary: summaryValueShape,
      treatmentsSummary: summaryValueShape,
      proceduresSummary: summaryValueShape,
      findingsSummary: summaryValueShape,
      _raw: PropTypes.object,
    })
  ),
  cohortSize: PropTypes.number,
  totalCohortCount: PropTypes.number,
  totalPages: PropTypes.number,
  currentPage: PropTypes.number,
  pageSize: PropTypes.number,
  onPageChange: PropTypes.func,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
  embedded: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  collapsible: PropTypes.bool,
  expanded: PropTypes.bool,
  onToggleExpanded: PropTypes.func,
  compactHeader: PropTypes.bool,
  toggleButtonTestId: PropTypes.string,
  collapsiblePanelId: PropTypes.string,
  collapsedHeaderSummary: PropTypes.node,
  onPatientOpen: PropTypes.func,
  openPatientIds: PropTypes.arrayOf(PropTypes.string),
};
