import React from "react";
import PropTypes from "prop-types";
import { Box, Card, CardHeader, Chip, Divider, IconButton, Tooltip, Typography, useMediaQuery } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { alpha, useTheme } from "@mui/material/styles";

/**
 * A single concept item within a section. Negated items are struck through and
 * dimmed; historic items are secondary; uncertain/conflicted get small chips.
 */
function SummaryItem({ item }) {
  const theme = useTheme();

  const name = String(item?.name ?? item?.value ?? "").trim() || "Unnamed";
  const isNegated = Boolean(item?.negated);
  const isHistoric = Boolean(item?.historic);
  const isUncertain = Boolean(item?.uncertain);
  const isConflicted = Boolean(item?.conflicted);
  const source = item?.source ? String(item.source).trim() : null;

  const textColor = isNegated
    ? "text.disabled"
    : isHistoric
    ? "text.secondary"
    : "text.primary";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 0.35,
        py: 0.12,
      }}
    >
      <Typography
        variant="body2"
        component="span"
        sx={{
          color: textColor,
          lineHeight: 1.25,
        }}
      >
        {isNegated ? <Box component="span" sx={{ fontWeight: 600 }}>No </Box> : null}{name}
      </Typography>

      {isUncertain ? (
        <Chip
          label="uncertain"
          size="small"
          sx={{
            height: 16,
            fontSize: "0.6rem",
            fontWeight: 600,
            bgcolor: alpha(theme.palette.warning.main, 0.12),
            color: theme.palette.warning.dark,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      ) : null}

      {isConflicted ? (
        <Chip
          label="conflicted"
          size="small"
          sx={{
            height: 16,
            fontSize: "0.6rem",
            fontWeight: 600,
            bgcolor: alpha(theme.palette.info.main, 0.12),
            color: theme.palette.info.dark,
            border: `1px solid ${alpha(theme.palette.info.main, 0.35)}`,
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      ) : null}

      {source ? (
        <Typography
          variant="caption"
          component="span"
          sx={{ color: "text.disabled", fontSize: "0.65rem" }}
        >
          via {source}
        </Typography>
      ) : null}
    </Box>
  );
}

SummaryItem.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string,
    value: PropTypes.string,
    negated: PropTypes.bool,
    historic: PropTypes.bool,
    uncertain: PropTypes.bool,
    conflicted: PropTypes.bool,
    source: PropTypes.string,
  }),
};

/**
 * PatientSummaryCard — displays DIAGNOSES, STAGING, GRADING, BIOMARKERS,
 * PROCEDURES, FINDINGS, and BEHAVIOR as a readable card alongside the
 * Cancer and Tumor Detail panel.
 */
export default function PatientSummaryCard({
  sections = [],
  collapsed = false,
  onToggleCollapse = undefined,
}) {
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  const upLg = useMediaQuery(theme.breakpoints.up("lg"));
  const upXl = useMediaQuery(theme.breakpoints.up("xl"));

  // Cap the number of columns at the number of sections so a wide layout never
  // renders an empty trailing column, then spread sections across them by
  // estimated height so the tall BIOMARKERS block doesn't strand a column.
  const maxColumns = upXl ? 4 : upLg ? 3 : upSm ? 2 : 1;
  const columnCount = Math.max(1, Math.min(maxColumns, sections.length || 1));
  const balancedColumns = (() => {
    const columns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));
    const estimateHeight = (section) => 30 + (section.items?.length || 0) * 22;
    sections.forEach((section) => {
      const target = columns.reduce(
        (shortest, column) => (column.height < shortest.height ? column : shortest),
        columns[0]
      );
      target.items.push(section);
      target.height += estimateHeight(section);
    });
    return columns;
  })();

  if (collapsed) {
    return (
      <Box
        sx={{
          width: 48,
          height: "100%",
          minHeight: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.75,
          py: 0.75,
          bgcolor: "background.paper",
        }}
      >
        <Tooltip title="Expand Patient Summary" placement="right">
          <IconButton
            size="small"
            aria-label="Expand Patient Summary"
            aria-expanded={false}
            onClick={() => onToggleCollapse?.()}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography
          variant="subtitle2"
          onClick={() => onToggleCollapse?.()}
          sx={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontWeight: 700,
            color: "text.secondary",
            cursor: "pointer",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          Patient Summary
        </Typography>
      </Box>
    );
  }

  return (
    <Card
      elevation={0}
      sx={{
        border: 0,
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <CardHeader
        title="Patient Summary"
        sx={{ py: 0.75, px: 1.25 }}
        titleTypographyProps={{ variant: "subtitle1", sx: { fontWeight: 700 } }}
        action={
          onToggleCollapse ? (
            <Tooltip title="Collapse Patient Summary">
              <IconButton
                size="small"
                aria-label="Collapse Patient Summary"
                aria-expanded
                onClick={() => onToggleCollapse()}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : undefined
        }
      />
      <Divider />

      {sections.length === 0 ? (
        <Box sx={{ px: 1.25, py: 0.9 }}>
          <Typography variant="body2" color="text.secondary">
            No summary data available for this patient.
          </Typography>
        </Box>
      ) : (
        <Box
          data-testid="patient-summary-card-scroll"
          sx={{
            overflowX: "hidden",
            overflowY: "auto",
            overscrollBehavior: "contain",
            flex: "1 1 auto",
            minHeight: 0,
            px: 1,
            py: 0.75,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            {balancedColumns.map((column, columnIndex) => (
              <Box
                key={`summary-column-${columnIndex}`}
                sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}
              >
                {column.items.map((section) => (
                  <Box
                    key={section.key}
                    sx={{
                      p: 0.85,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.background.paper, 0.7),
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", mb: 0.4 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          bgcolor: alpha(theme.palette.success.main, 0.13),
                          color: theme.palette.success.dark,
                          px: 0.75,
                          py: 0.1,
                          borderRadius: "4px",
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}
                      >
                        {section.label}
                      </Typography>
                    </Box>
                    {section.items.map((item, itemIndex) => (
                      <SummaryItem key={`${section.key}-${itemIndex}`} item={item} />
                    ))}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Card>
  );
}

PatientSummaryCard.propTypes = {
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      items: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          value: PropTypes.string,
          negated: PropTypes.bool,
          historic: PropTypes.bool,
          uncertain: PropTypes.bool,
          conflicted: PropTypes.bool,
          source: PropTypes.string,
        })
      ).isRequired,
    })
  ),
};
