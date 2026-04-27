import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

export default function PatientSearchForm({
  lookupMode = "patient-id",
  onLookupModeChange = undefined,
  patientIdValue,
  onPatientIdChange = undefined,
  viz2PatientId = "",
  viz2PatientOptions = [],
  onViz2PatientIdChange = undefined,
  isViz2OptionsLoading = false,
  onLoadPatient = undefined,
  onPickRandomPatientId = undefined,
  isLoading = false,
  isRandomLoading = false,
}) {
  const isViz2Mode = lookupMode === "viz2-docs";

  const handleSubmit = (event) => {
    event.preventDefault();
    onLoadPatient?.();
  };

  const handleLookupModeChange = (_, nextMode) => {
    if (!nextMode) {
      return;
    }

    onLookupModeChange?.(nextMode);
  };

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider", p: 1.5 }}>
      <Stack component="form" spacing={1.25} onSubmit={handleSubmit}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
          Patient Lookup
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={lookupMode}
          onChange={handleLookupModeChange}
          size="small"
          aria-label="Patient lookup source"
        >
          <ToggleButton value="patient-id" aria-label="Lookup by patient ID">
            Enter Patient ID
          </ToggleButton>
          <ToggleButton value="viz2-docs" aria-label="Lookup from Viz2 source docs">
            Viz2 Source Docs
          </ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "flex-end" }}>
          {isViz2Mode ? (
            <TextField
              select
              label="Viz2 Patient"
              name="viz2-patient-id"
              size="small"
              value={viz2PatientId}
              onChange={(event) => onViz2PatientIdChange?.(event.target.value)}
              sx={{ minWidth: { xs: "100%", sm: 300 } }}
              inputProps={{ "aria-label": "Viz2 patient selection" }}
              SelectProps={{ native: true }}
              disabled={isViz2OptionsLoading}
              required
            >
              <option value="" disabled>
                {isViz2OptionsLoading ? "Loading patients..." : "Select a patient"}
              </option>
              {viz2PatientOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </TextField>
          ) : (
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
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || (isViz2Mode && isViz2OptionsLoading)}
            sx={{ minWidth: 140 }}
          >
            {isLoading ? "Loading..." : "Load Patient"}
          </Button>
          {!isViz2Mode ? (
            <Button
              type="button"
              variant="outlined"
              onClick={() => onPickRandomPatientId?.()}
              disabled={isLoading || isRandomLoading}
              sx={{ minWidth: 130 }}
            >
              {isRandomLoading ? "Choosing..." : "Random"}
            </Button>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
}

PatientSearchForm.propTypes = {
  lookupMode: PropTypes.oneOf(["patient-id", "viz2-docs"]),
  onLookupModeChange: PropTypes.func,
  patientIdValue: PropTypes.string.isRequired,
  onPatientIdChange: PropTypes.func,
  viz2PatientId: PropTypes.string,
  viz2PatientOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  onViz2PatientIdChange: PropTypes.func,
  isViz2OptionsLoading: PropTypes.bool,
  onLoadPatient: PropTypes.func,
  onPickRandomPatientId: PropTypes.func,
  isLoading: PropTypes.bool,
  isRandomLoading: PropTypes.bool,
};
