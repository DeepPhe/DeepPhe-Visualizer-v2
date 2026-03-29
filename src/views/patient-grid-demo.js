import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import PatientGrid from "../components/PatientGrid";

function PatientGridDemoView() {
  return (
    <Box sx={{ maxWidth: 1240, mx: "auto", p: { xs: 2, md: 4 } }}>
      <Stack spacing={2.5}>
        <Typography variant="h4" color="text.primary">
          Patient Grid Demo
        </Typography>
        <Typography variant="body1" color="text.secondary">
          TanStack Table rendered with MUI Table components.
        </Typography>

        <PatientGrid />

        <Typography
          component={RouterLink}
          to="/"
          sx={{ color: "primary.main", textDecoration: "none", width: "fit-content" }}
        >
          Back Home
        </Typography>
      </Stack>
    </Box>
  );
}

export default PatientGridDemoView;
