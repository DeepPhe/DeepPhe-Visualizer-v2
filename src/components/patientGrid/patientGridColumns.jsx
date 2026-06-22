import React from "react";
import PropTypes from "prop-types";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const MIN_TOOLTIP_TEXT_LENGTH = 25;

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

function renderTruncatedCell({ displayValue, fullValue, align = "left", muted = false }) {
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
          width: "100%",
          maxWidth: "100%",
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

function renderSummaryCell(summary) {
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
          maxWidth: "100%",
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

export function createColumns({ onToggleRow }) {
  return [
    {
      id: "expand",
      header: () => (
        <Box component="span" sx={visuallyHidden}>
          Row details
        </Box>
      ),
      size: 40,
      minSize: 40,
      maxSize: 40,
      meta: { exportable: false },
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
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
      size: 200,
      minSize: 130,
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
                width: "100%",
                maxWidth: "100%",
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
      minSize: 65,
      sortingFn: (rowA, rowB, columnId) =>
        getAgeSortValue(rowA.getValue(columnId)) - getAgeSortValue(rowB.getValue(columnId)),
      cell: ({ getValue }) => {
        const value = getValue();
        const textValue = value === null || value === undefined || value === "" ? "—" : String(value);
        return renderTruncatedCell({
          displayValue: textValue,
          fullValue: textValue,
          align: "right",
        });
      },
    },
    {
      accessorKey: "gender",
      id: "gender",
      header: "Gender",
      size: 65,
      minSize: 65,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
        }),
    },
    {
      accessorKey: "race",
      id: "race",
      header: "Race",
      size: 100,
      minSize: 90,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
        }),
    },
    {
      accessorKey: "ethnicity",
      id: "ethnicity",
      header: "Ethnicity",
      size: 115,
      minSize: 105,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
        }),
    },
    {
      accessorKey: "cancerType",
      id: "cancerType",
      header: "Cancer Type",
      size: 100,
      minSize: 90,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
        }),
    },
    {
      accessorKey: "stage",
      id: "stage",
      header: "Stage",
      size: 90,
      minSize: 90,
      sortingFn: (rowA, rowB) =>
        Number(rowA.original?.stageSortRank ?? Number.NEGATIVE_INFINITY) -
        Number(rowB.original?.stageSortRank ?? Number.NEGATIVE_INFINITY),
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
        }),
    },
    {
      accessorKey: "grade",
      id: "grade",
      header: "Grade",
      size: 75,
      minSize: 70,
      cell: ({ getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
        }),
    },
    {
      accessorKey: "activeDx",
      id: "activeDx",
      header: "Active Dx",
      size: 200,
      minSize: 150,
      cell: ({ row, getValue }) =>
        renderTruncatedCell({
          displayValue: String(getValue() || "—"),
          fullValue: String(getValue() || "—"),
          muted: Boolean(row.original?.activeDxMeta?.historic),
        }),
    },
    {
      accessorFn: (row) => row?.diagnosesSummary?.full || "",
      id: "diagnosesSummary",
      header: "Diagnoses",
      size: 200,
      minSize: 150,
      meta: {
        exportValue: (row) => row?.original?.diagnosesSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.diagnosesSummary),
    },
    {
      accessorFn: (row) => row?.biomarkersSummary?.full || "",
      id: "biomarkersSummary",
      header: "Biomarkers",
      size: 200,
      minSize: 150,
      meta: {
        exportValue: (row) => row?.original?.biomarkersSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.biomarkersSummary),
    },
    {
      accessorFn: (row) => row?.treatmentsSummary?.full || "",
      id: "treatmentsSummary",
      header: "Treatments",
      size: 180,
      minSize: 150,
      meta: {
        exportValue: (row) => row?.original?.treatmentsSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.treatmentsSummary),
    },
    {
      accessorFn: (row) => row?.proceduresSummary?.full || "",
      id: "proceduresSummary",
      header: "Procedures",
      size: 180,
      minSize: 150,
      meta: {
        exportValue: (row) => row?.original?.proceduresSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.proceduresSummary),
    },
    {
      accessorFn: (row) => row?.findingsSummary?.full || "",
      id: "findingsSummary",
      header: "Key Findings",
      size: 180,
      minSize: 150,
      meta: {
        exportValue: (row) => row?.original?.findingsSummary?.full || "",
      },
      cell: ({ row }) => renderSummaryCell(row.original?.findingsSummary),
    },
  ];
}

export function SortIndicator({ column }) {
  const sort = column.getIsSorted();
  if (!sort) {
    return null;
  }

  if (sort === "asc") {
    return <ArrowUpwardIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: "middle" }} />;
  }

  return <ArrowDownwardIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: "middle" }} />;
}

SortIndicator.propTypes = {
  column: PropTypes.object.isRequired,
};
