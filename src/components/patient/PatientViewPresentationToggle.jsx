import React from "react";
import PropTypes from "prop-types";
import {
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import usePatientViewPresentation from "../../hooks/usePatientViewPresentation";
import { PATIENT_VIEW_PRESENTATION_OPTIONS } from "../../constants/patientViewPresentation";

/**
 * Switches the patient view between the alpha's reading and the improved one.
 * Both stay available so they can be compared directly.
 */
export default function PatientViewPresentationToggle({ dense = false }) {
  const { presentation, setPresentation } = usePatientViewPresentation();
  const groupLabelId = "patient-view-presentation-label";

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ flexWrap: "wrap", rowGap: 0 }}
      data-testid="patient-view-presentation"
    >
      <FormLabel
        id={groupLabelId}
        sx={{
          fontSize: dense ? 12 : 13,
          fontWeight: 600,
          color: "text.secondary",
          whiteSpace: "nowrap",
          "&.Mui-focused": { color: "text.secondary" },
        }}
      >
        View
      </FormLabel>
      <RadioGroup
        row
        aria-labelledby={groupLabelId}
        name="patient-view-presentation"
        value={presentation}
        onChange={(event) => setPresentation(event.target.value)}
        sx={{ gap: 0.25 }}
      >
        {PATIENT_VIEW_PRESENTATION_OPTIONS.map((option) => (
          <Tooltip key={option.value} title={option.description}>
            <FormControlLabel
              value={option.value}
              sx={{ mr: 0.5, ml: 0 }}
              control={
                <Radio
                  size="small"
                  sx={{ p: 0.375 }}
                  inputProps={{ "data-testid": `patient-view-presentation-${option.value}` }}
                />
              }
              label={
                <Typography variant="caption" sx={{ fontSize: dense ? 12 : 13, lineHeight: 1.2 }}>
                  {option.label}
                </Typography>
              }
            />
          </Tooltip>
        ))}
      </RadioGroup>
    </Stack>
  );
}

PatientViewPresentationToggle.propTypes = {
  dense: PropTypes.bool,
};
