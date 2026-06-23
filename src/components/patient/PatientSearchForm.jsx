import React from "react";
import PropTypes from "prop-types";
import { Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";

export default function PatientSearchForm({
  patientIdValue,
  onPatientIdChange = undefined,
  onLoadPatient = undefined,
  onPickRandomPatientId = undefined,
  isLoading = false,
  isRandomLoading = false,
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    onLoadPatient?.();
  };

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider", p: 1.5 }}>
      <Stack component="form" spacing={1.25} onSubmit={handleSubmit}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
          Patient Lookup
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField
            label="Patient ID"
            name="patient-id"
            size="small"
            value={patientIdValue}
            onChange={(event) => onPatientIdChange?.(event.target.value)}
            placeholder="fake_patient1"
            sx={{ minWidth: { xs: "100%", sm: 300 } }}
            inputProps={{ "aria-label": "Patient ID" }}
            required
          />
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            sx={{ minWidth: 140 }}
          >
            {isLoading ? "Loading..." : "Load Patient"}
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={() => onPickRandomPatientId?.()}
            disabled={isLoading || isRandomLoading}
            sx={{ minWidth: 130 }}
          >
            {isRandomLoading ? "Choosing..." : "Random"}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

PatientSearchForm.propTypes = {
  patientIdValue: PropTypes.string.isRequired,
  onPatientIdChange: PropTypes.func,
  onLoadPatient: PropTypes.func,
  onPickRandomPatientId: PropTypes.func,
  isLoading: PropTypes.bool,
  isRandomLoading: PropTypes.bool,
};
