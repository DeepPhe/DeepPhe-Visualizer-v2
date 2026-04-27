import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Typography,
} from "@mui/material";

function getTotalReportsByType(typeCounts = {}) {
  return Object.entries(typeCounts)
    .sort((leftEntry, rightEntry) => {
      if (rightEntry[1] !== leftEntry[1]) {
        return rightEntry[1] - leftEntry[1];
      }

      return leftEntry[0].localeCompare(rightEntry[0], undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map(([type, count]) => ({
      type,
      count: Number(count) || 0,
    }));
}

function DemographicItem({ label, value = "", gridColumn = {} }) {
  return (
    <Box sx={{ minWidth: 0, gridColumn }}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
        {value || "Unknown"}
      </Typography>
    </Box>
  );
}

DemographicItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  gridColumn: PropTypes.object,
};

export default function PatientDemographicsCard({ patientData = null, timelineData = null }) {
  const reportTypes = getTotalReportsByType(timelineData?.typeCounts);
  const reportTypeSummary =
    reportTypes.length > 0
      ? reportTypes.map((entry) => `${entry.type}: ${entry.count}`).join("  •  ")
      : "No document-type breakdown available.";

  return (
    <Card elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      <CardHeader
        title="Patient Details"
        sx={{ py: 1, px: 1.5 }}
        titleTypographyProps={{ variant: "subtitle1", sx: { fontWeight: 700 } }}
      />
      <Divider />
      <CardContent sx={{ px: 1.5, py: 1.25, "&:last-child": { pb: 1.25 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              md: "repeat(8, minmax(0, 1fr))",
            },
            columnGap: { xs: 1.25, md: 2 },
            rowGap: 0.9,
          }}
        >
          <DemographicItem
            label="Patient ID"
            value={patientData?.patientId}
            gridColumn={{ xs: "span 2", md: "span 2" }}
          />
          <DemographicItem
            label="Name"
            value={patientData?.demographics?.patientName}
            gridColumn={{ xs: "span 2", md: "span 2" }}
          />
          <DemographicItem
            label="Gender"
            value={patientData?.demographics?.gender}
            gridColumn={{ xs: "span 1", md: "span 1" }}
          />
          <DemographicItem
            label="Race"
            value={patientData?.demographics?.race}
            gridColumn={{ xs: "span 1", md: "span 1" }}
          />
          <DemographicItem
            label="Ethnicity"
            value={patientData?.demographics?.ethnicity}
            gridColumn={{ xs: "span 1", md: "span 1" }}
          />
          <DemographicItem
            label="Document Count"
            value={`${patientData?.documents?.length || 0}`}
            gridColumn={{ xs: "span 1", md: "span 1" }}
          />
          <DemographicItem
            label="Birth Date"
            value={patientData?.demographics?.birthDate}
            gridColumn={{ xs: "span 1", md: "span 2" }}
          />
          <DemographicItem
            label="First Encounter"
            value={patientData?.demographics?.firstEncounterDate}
            gridColumn={{ xs: "span 1", md: "span 2" }}
          />
          <DemographicItem
            label="Last Encounter"
            value={patientData?.demographics?.lastEncounterDate}
            gridColumn={{ xs: "span 2", md: "span 2" }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.1 }}>
          {reportTypeSummary}
        </Typography>
      </CardContent>
    </Card>
  );
}

PatientDemographicsCard.propTypes = {
  patientData: PropTypes.shape({
    patientId: PropTypes.string,
    documents: PropTypes.arrayOf(PropTypes.object),
    demographics: PropTypes.shape({
      patientName: PropTypes.string,
      gender: PropTypes.string,
      race: PropTypes.string,
      ethnicity: PropTypes.string,
      birthDate: PropTypes.string,
      firstEncounterDate: PropTypes.string,
      lastEncounterDate: PropTypes.string,
    }),
  }),
  timelineData: PropTypes.shape({
    typeCounts: PropTypes.object,
  }),
};
