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
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
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
import { visuallyHidden } from "@mui/utils";
import PropTypes from "prop-types";

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

const CLINICAL_SEARCH_FIELDS = ["diagnoses", "biomarkers", "treatments", "procedures", "findings"];
const DEFAULT_PAGE_SIZE = 10;
const MIN_TOOLTIP_TEXT_LENGTH = 25;

function csvEscape(value) {
  const stringValue = String(value ?? "");
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

function resolveExportValue(row, column) {
  const exportValueResolver = column.columnDef?.meta?.exportValue;
  if (typeof exportValueResolver === "function") {
    return exportValueResolver(row);
  }
  return row.getValue(column.id);
}

function exportFilteredSortedRowsToCsv(table, filename = "cohort-patients.csv") {
  const exportableColumns = table
    .getVisibleLeafColumns()
    .filter((column) => column.columnDef?.meta?.exportable !== false);

  if (exportableColumns.length === 0) {
    return;
  }

  const headers = exportableColumns.map((column) => {
    const header = column.columnDef.header;
    return typeof header === "string" ? header : column.id;
  });

  const rows = table.getPrePaginationRowModel().rows.map((row) =>
    exportableColumns.map((column) => csvEscape(resolveExportValue(row, column)))
  );

  const csv = [headers.map(csvEscape).join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getDetailSections(rawPatientSummary) {
  return DETAIL_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    items: toArray(rawPatientSummary?.[section.key]),
  })).filter((section) => section.items.length > 0);
}

function getAgeSortValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : Number.POSITIVE_INFINITY;
}

function getSummaryDisplayValue(summary) {
  if (typeof summary === "string") {
    const text = summary.trim();
    return text || "—";
  }

  const text = String(summary?.display || "").trim();
  return text || "—";
}

function getSummaryOverflowCount(summary) {
  const numericOverflow = Number(summary?.overflow);
  return Number.isFinite(numericOverflow) && numericOverflow > 0 ? numericOverflow : 0;
}

function shouldShowTooltip(fullValue = "") {
  return String(fullValue || "").trim().length >= MIN_TOOLTIP_TEXT_LENGTH;
}

function renderTruncatedCell({ displayValue, fullValue, maxWidth, align = "left", muted = false }) {
  const textValue = String(displayValue ?? "").trim() || "—";
  const tooltipValue = String(fullValue ?? "").trim() || textValue;

  return (
    <Tooltip title={tooltipValue} disableHoverListener={!shouldShowTooltip(tooltipValue)}>
      <Typography
        component="span"
        variant="body2"
        noWrap
        sx={{
          display: "block",
          maxWidth,
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: align,
          color: muted ? "text.secondary" : "text.primary",
        }}
      >
        {textValue}
      </Typography>
    </Tooltip>
  );
}

function renderSummaryCell(summary, width) {
  const displayValue = getSummaryDisplayValue(summary);
  const overflowCount = getSummaryOverflowCount(summary);
  const fullValue = String(summary?.full || displayValue || "").trim() || "—";

  return (
    <Tooltip title={fullValue} disableHoverListener={!shouldShowTooltip(fullValue)}>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 0.75,
          maxWidth: width,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <Typography component="span" variant="body2">
          {displayValue}
        </Typography>
        {overflowCount > 0 ? (
          <Typography component="span" variant="body2" color="text.secondary">
            +{overflowCount} more
          </Typography>
        ) : null}
      </Box>
    </Tooltip>
  );
}

function createColumns({ onToggleRow }) {
  return [
    {
      id: "expand",
      header: () => (
        <Box component="span" sx={visuallyHidden}>
          Row details
        </Box>
      ),
      size: 40,
      meta: { exportable: false },
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        if (!row.getCanExpand()) {
          return null;
        }

        return (
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onToggleRow(row.id);
            }}
            aria-label={row.getIsExpanded() ? "Collapse row details" : "Expand row details"}
            sx={{
              p: 0.25,
              "&:focus-visible": {
                outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
            }}
          >
            <ChevronRightIcon
              fontSize="small"
              sx={{
                transform: row.getIsExpanded() ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.18s ease",
              }}
            />
          </IconButton>
        );
      },
    },
    {
      accessorKey: "patientId",
      id: "patientId",
      header: "Patient ID",
      size: 120,
      cell: ({ getValue }) => {
        const value = String(getValue() || "");
        return (
          <Tooltip title={value} disableHoverListener={!shouldShowTooltip(value)}>
            <Typography
              component="span"
              variant="body2"
              noWrap
              sx={{
                display: "block",
                maxWidth: 120,
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {value}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "ageAtDx",
      id: "ageAtDx",
      header: "Age at Dx",
      size: 65,
      sortingFn: (rowA, rowB, columnId) =>
        getAgeSortValue(rowA.getValue(columnId)) - getAgeSortValue(rowB.getValue(columnId)),
      cell: ({ getValue }) => {
        const value = getValue();
        const textValue = value === null || value === undefined || value === "" ? "—" : String(value);
        return renderTruncatedCell({
          displayValue: textValue,
          fullValue: textValue,
          maxWidth: 65,
          align: "right",
        });
      },
    },
    {
      accessorKey: "gender",
      id: "gender",
      header: "Gender",
      size: 65,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
          maxWidth: 65,
        }),
    },
    {
      accessorKey: "race",
      id: "race",
      header: "Race",
      size: 100,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
          maxWidth: 100,
        }),
    },
    {
      accessorKey: "ethnicity",
      id: "ethnicity",
      header: "Ethnicity",
      size: 115,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
          maxWidth: 115,
        }),
    },
    {
      accessorKey: "cancerType",
      id: "cancerType",
      header: "Cancer Type",
      size: 100,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
          maxWidth: 100,
        }),
    },
    {
      accessorKey: "stage",
      id: "stage",
      header: "Stage",
      size: 90,
      sortingFn: (rowA, rowB) =>
        Number(rowA.original?.stageSortRank ?? Number.NEGATIVE_INFINITY) -
        Number(rowB.original?.stageSortRank ?? Number.NEGATIVE_INFINITY),
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
          maxWidth: 90,
        }),
    },
    {
      accessorKey: "grade",
      id: "grade",
      header: "Grade",
      size: 75,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
          maxWidth: 75,
        }),
    },
    {
      accessorKey: "activeDx",
      id: "activeDx",
      header: "Active Dx",
      size: 200,
      cell: ({ row, getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
          maxWidth: 200,
          muted: Boolean(row.original?.activeDxMeta?.historic),
        }),
    },
    {
      accessorFn: (row) => row?.diagnosesSummary?.full || "",
      id: "diagnosesSummary",
      header: "Diagnoses",
      size: 200,
      meta: {
        exportValue: (row) => row?.original?.diagnosesSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.diagnosesSummary, 200),
    },
    {
      accessorFn: (row) => row?.biomarkersSummary?.full || "",
      id: "biomarkersSummary",
      header: "Biomarkers",
      size: 200,
      meta: {
        exportValue: (row) => row?.original?.biomarkersSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.biomarkersSummary, 200),
    },
    {
      accessorFn: (row) => row?.treatmentsSummary?.full || "",
      id: "treatmentsSummary",
      header: "Treatments",
      size: 180,
      meta: {
        exportValue: (row) => row?.original?.treatmentsSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.treatmentsSummary, 180),
    },
    {
      accessorFn: (row) => row?.proceduresSummary?.full || "",
      id: "proceduresSummary",
      header: "Procedures",
      size: 180,
      meta: {
        exportValue: (row) => row?.original?.proceduresSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.proceduresSummary, 180),
    },
    {
      accessorFn: (row) => row?.findingsSummary?.full || "",
      id: "findingsSummary",
      header: "Key Findings",
      size: 180,
      meta: {
        exportValue: (row) => row?.original?.findingsSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.findingsSummary, 180),
    },
  ];
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

function DetailPanel({ row }) {
  const theme = useTheme();
  const details = getDetailSections(row?.original?._raw);

  if (details.length === 0) {
    return (
      <Box sx={{ px: 2, py: 0.75 }}>
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
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: "4px 12px",
        px: 2,
        py: 0.75,
      }}
    >
      {details.map((section) => (
        <Box
          key={section.key}
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "2px 4px",
            minWidth: 0,
            mr: 1.5,
          }}
        >
          <Typography
            component="span"
            variant="caption"
            sx={{
              bgcolor: alpha(accentColor, 0.12),
              color: accentColor,
              px: 0.75,
              py: 0.125,
              borderRadius: "4px",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {section.label}
          </Typography>

          <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", flexWrap: "wrap", ml: 0.5 }}>
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
                <React.Fragment key={`${section.key}-${itemIndex}`}>
                  <Box
                    component="span"
                    sx={{ display: "inline-flex", alignItems: "center", whiteSpace: "nowrap", minWidth: 0 }}
                  >
                    <Typography
                      component="span"
                      variant="body2"
                      sx={
                        item?.negated || item?.historic
                          ? getDetailNameStyle(item)
                          : {
                              ...getDetailNameStyle(item),
                              color: alpha(theme.palette.text.primary, 0.85),
                            }
                      }
                    >
                      {itemName}
                    </Typography>

                    {badges.length > 0 ? (
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, ml: 0.5 }}>
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
                                borderRadius: "3px",
                                fontSize: "0.65rem",
                                lineHeight: 1.4,
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

                  {itemIndex < section.items.length - 1 ? (
                    <Typography
                      component="span"
                      sx={{
                        mx: 0.5,
                        color: alpha(theme.palette.text.primary, 0.3),
                        fontSize: "0.85rem",
                        lineHeight: 1,
                      }}
                    >
                      ·
                    </Typography>
                  ) : null}
                </React.Fragment>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function SortIndicator({ column }) {
  const sort = column.getIsSorted();
  if (!sort) {
    return null;
  }

  if (sort === "asc") {
    return <ArrowUpwardIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: "middle" }} />;
  }

  return <ArrowDownwardIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: "middle" }} />;
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
}) {
  const theme = useTheme();
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnMenuAnchorEl, setColumnMenuAnchorEl] = useState(null);

  const toggleRowExpansion = useCallback((rowId) => {
    setExpandedRows((previous) => (previous?.[rowId] ? {} : { [rowId]: true }));
  }, []);

  const columns = useMemo(() => createColumns({ onToggleRow: toggleRowExpansion }), [toggleRowExpansion]);

  const tableMinWidth = useMemo(
    () =>
      columns.reduce((totalWidth, column) => {
        const columnWidth = Number(column?.size);
        return totalWidth + (Number.isFinite(columnWidth) ? columnWidth : 120);
      }, 0),
    [columns]
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
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
    <>
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
        sx={{ display: shouldRenderGridBody ? "block" : "none" }}
      >
          <TableContainer
            sx={{
              maxHeight: 560,
              overflowX: "auto",
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
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      sx={{
                        fontWeight: 700,
                        cursor: canSort ? "pointer" : "default",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        width: header.column.columnDef.size,
                        bgcolor: (muiTheme) =>
                          alpha(
                            muiTheme.palette.background.paper,
                            muiTheme.palette.mode === "dark" ? 0.92 : 0.98
                          ),
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort ? <SortIndicator column={header.column} /> : null}
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
                <React.Fragment key={row.id}>
                  <TableRow
                    hover
                    onClick={row.getCanExpand() ? () => toggleRowExpansion(row.id) : undefined}
                    sx={{
                      cursor: row.getCanExpand() ? "pointer" : "default",
                      bgcolor:
                        rowIndex % 2 === 0
                          ? "transparent"
                          : alpha(
                              theme.palette.mode === "dark"
                                ? theme.palette.common.white
                                : theme.palette.common.black,
                              theme.palette.mode === "dark" ? 0.02 : 0.03
                            ),
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} sx={{ py: 0.7, verticalAlign: "top" }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>

                  {row.getIsExpanded() ? (
                    <TableRow>
                      <TableCell
                        colSpan={totalColumnCount}
                        sx={{
                          py: 0,
                          px: 0,
                          bgcolor: theme.custom?.rowHoverBg || alpha(theme.palette.primary.main, 0.08),
                        }}
                      >
                        <DetailPanel row={row} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
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
    </>
  );

  if (embedded) {
    return <Box data-testid="patient-grid-embedded">{content}</Box>;
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

SortIndicator.propTypes = {
  column: PropTypes.shape({
    getIsSorted: PropTypes.func.isRequired,
  }).isRequired,
};

DetailPanel.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      _raw: PropTypes.object,
    }),
  }).isRequired,
};

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
};
