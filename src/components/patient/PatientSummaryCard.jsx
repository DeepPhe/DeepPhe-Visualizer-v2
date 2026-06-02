import React from "react";
import PropTypes from "prop-types";
import { Box, Card, CardHeader, Chip, Divider, Typography } from "@mui/material";
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
export default function PatientSummaryCard({ sections = [] }) {
  const theme = useTheme();

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
          <Box
            sx={{
              columns: {
                xs: 1,
                sm: 2,
                md: 2,
                lg: 3,
                xl: 4,
              },
              columnGap: 1,
            }}
          >
            {sections.map((section) => (
              <Box
                key={section.key}
                sx={{
                  display: "inline-block",
                  width: "100%",
                  breakInside: "avoid",
                  WebkitColumnBreakInside: "avoid",
                  pageBreakInside: "avoid",
                  mb: 1,
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
        </Box>
      )}
    </Card>
  );
}

PatientSummaryCard.propTypes = {
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
