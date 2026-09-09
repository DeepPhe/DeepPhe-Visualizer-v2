import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
} from "@mui/material";

function DemographicItem({ label, value = "", capitalize = false }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ letterSpacing: 0.2, display: "block" }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          lineHeight: 1.25,
          overflowWrap: "anywhere",
          ...(capitalize ? { textTransform: "capitalize" } : {}),
        }}
      >
        {value || "Unknown"}
      </Typography>
    </Box>
  );
}

DemographicItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  capitalize: PropTypes.bool,
};

function getRaceEthnicity(demographics = {}) {
  const race = String(demographics?.race || "").trim();
  const ethnicity = String(demographics?.ethnicity || "").trim();
  const combinedValue = [race, ethnicity].filter(Boolean).join(" / ");
  return combinedValue || "Unknown";
}

export default function PatientDemographicsCard({ patientData = null }) {
  const demographics = patientData?.demographics || {};

  return (
    <Card
      elevation={0}
      sx={{
        border: 0,
        borderRadius: 0,
      }}
    >
      <CardHeader
        title="Patient Details"
        sx={{ py: 1, px: 1.5 }}
        titleTypographyProps={{
          variant: "h6",
          sx: { fontWeight: 700, fontSize: "1rem", letterSpacing: 0 },
        }}
      />
      <CardContent sx={{ px: 1.5, py: 0.5, "&:last-child": { pb: 1.5 } }}>
        {/* Fields flow across the full panel width and reflow to fewer columns
            as it narrows, rather than stacking in one column and leaving the
            rest of the row empty. */}
        <Box
          data-testid="patient-demographics-grid"
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            columnGap: 2,
            rowGap: 1.1,
            alignItems: "start",
          }}
        >
          <DemographicItem label="Patient ID" value={patientData?.patientId} />
          <DemographicItem label="Gender" value={demographics?.gender} capitalize />
          <DemographicItem
            label="Race/Ethnicity"
            value={getRaceEthnicity(demographics)}
            capitalize
          />
          <DemographicItem label="Birth Date" value={demographics?.birthDate} />
          <DemographicItem label="First Encounter" value={demographics?.firstEncounterDate} />
          <DemographicItem label="Last Encounter" value={demographics?.lastEncounterDate} />
        </Box>
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
};
