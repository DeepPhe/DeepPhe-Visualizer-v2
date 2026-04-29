import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Stack,
  Typography,
} from "@mui/material";

function DemographicItem({ label, value = "" }) {
  return (
    <Box sx={{ minWidth: 0 }}>
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
        <Stack spacing={1.1}>
          <DemographicItem label="Patient ID" value={patientData?.patientId} />
          <DemographicItem label="Gender" value={demographics?.gender} />
          <DemographicItem label="Race/Ethnicity" value={getRaceEthnicity(demographics)} />
          <DemographicItem label="Birth Date" value={demographics?.birthDate} />
          <DemographicItem label="First Encounter" value={demographics?.firstEncounterDate} />
          <DemographicItem label="Last Encounter" value={demographics?.lastEncounterDate} />
        </Stack>
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
