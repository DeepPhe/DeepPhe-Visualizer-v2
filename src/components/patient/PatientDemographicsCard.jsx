import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardContent,
  Typography,
} from "@mui/material";

function DemographicItem({ label, value = "", capitalize = false }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        display: "inline-flex",
        alignItems: "baseline",
        gap: 0.55,
      }}
    >
      <Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{ letterSpacing: 0.2, whiteSpace: "nowrap", flex: "0 0 auto" }}
      >
        {label}
      </Typography>
      <Typography
        component="span"
        variant="body2"
        sx={{
          fontWeight: 600,
          lineHeight: 1.12,
          overflowWrap: "anywhere",
          minWidth: 0,
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
      data-testid="patient-details-card"
      elevation={0}
      sx={{
        border: 0,
        borderRadius: 0,
      }}
    >
      <CardContent
        sx={{
          px: 1.1,
          py: 0.55,
          "&:last-child": { pb: 0.55 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "auto 1fr" },
          alignItems: "center",
          columnGap: 1.35,
          rowGap: 0.45,
        }}
      >
        <Typography
          variant="subtitle1"
          component="h2"
          sx={{
            fontWeight: 800,
            fontSize: "0.95rem",
            letterSpacing: 0,
            whiteSpace: "nowrap",
          }}
        >
          Patient Details
        </Typography>
        <Box
          data-testid="patient-demographics-grid"
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 172px), 1fr))",
            columnGap: 2.2,
            rowGap: 0.35,
            alignItems: "center",
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
