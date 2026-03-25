import React, { useMemo, useState } from "react";
import { Alert, Box, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { getClasses as getOmopClasses, getInstances as getOmopInstances } from "../controllers/omap";
import HorizontalBarChart from "../components/HorizontalBarChart";
import { useDataLoader } from "../hooks/useDataLoader";

function resolveClassKey(classes, targetName) {
  const target = String(targetName || "").toUpperCase();
  const match = classes.find((item) => String(item).toUpperCase() === target);
  return match ? String(match) : "";
}

function toChartData(summaryRows) {
  if (!Array.isArray(summaryRows)) {
    return [];
  }

  return summaryRows
    .map((row) => ({
      label: String(row?.value ?? "").trim(),
      value: Number(row?.count ?? 0),
    }))
    .filter((row) => row.label.length > 0);
}

function formatSelectionText(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "None";
  }
  return values.join(", ");
}

function FiltersView() {
  const omopData = useDataLoader(getOmopClasses, getOmopInstances, "OMOP");
  const [selectedRaceValues, setSelectedRaceValues] = useState([]);
  const [selectedCancerValues, setSelectedCancerValues] = useState([]);

  const raceOmopKey = useMemo(() => resolveClassKey(omopData.classes, "RACE"), [omopData.classes]);
  const cancerOmopKey = useMemo(
    () => resolveClassKey(omopData.classes, "CANCER"),
    [omopData.classes]
  );

  const raceData = useMemo(
    () => toChartData(omopData.summaryByClass[raceOmopKey]),
    [omopData.summaryByClass, raceOmopKey]
  );
  const cancerData = useMemo(
    () => toChartData(omopData.summaryByClass[cancerOmopKey]),
    [omopData.summaryByClass, cancerOmopKey]
  );
  const isLoading = omopData.isLoading;
  const raceError = omopData.errorsByClass[raceOmopKey] || "";
  const cancerError = omopData.errorsByClass[cancerOmopKey] || "";
  const rootError = omopData.errorMessage;
  const hasSelections = selectedRaceValues.length > 0 || selectedCancerValues.length > 0;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50", p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="h4" component="h1" color="text.primary">
            Filters
          </Typography>
          <Box
            sx={{
              minWidth: { xs: "100%", md: 360 },
              maxWidth: 680,
              border: 1,
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "background.paper",
              p: 1.5,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
              Selected Summary
            </Typography>
            {hasSelections ? (
              <Stack spacing={0.25}>
                <Typography variant="body2" color="text.primary">
                  Race: {formatSelectionText(selectedRaceValues)}
                </Typography>
                <Typography variant="body2" color="text.primary">
                  Cancer: {formatSelectionText(selectedCancerValues)}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No filters selected.
              </Typography>
            )}
          </Box>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Race and Cancer filters using horizontal bar charts.
        </Typography>

        {isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading filters...
          </Typography>
        ) : null}

        {rootError ? <Alert severity="error">{rootError}</Alert> : null}

        {!isLoading && !rootError ? (
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            }}
          >
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
              <Stack spacing={1.5}>
                <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
                  RACE
                </Typography>
                {raceError ? <Alert severity="error">{raceError}</Alert> : null}
                <HorizontalBarChart
                  title="RACE"
                  showTitle={false}
                  data={raceData}
                  selectedValues={selectedRaceValues}
                  onSelectionChange={setSelectedRaceValues}
                  height={360}
                  defaultSort="value-desc"
                />
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
              <Stack spacing={1.5}>
                <Typography variant="h6" color="text.primary" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
                  CANCER
                </Typography>
                {cancerError ? <Alert severity="error">{cancerError}</Alert> : null}
                <HorizontalBarChart
                  title="CANCER"
                  showTitle={false}
                  data={cancerData}
                  selectedValues={selectedCancerValues}
                  onSelectionChange={setSelectedCancerValues}
                  height={420}
                  defaultSort="value-desc"
                />
              </Stack>
            </Paper>
          </Box>
        ) : null}

        <MuiLink
          component={RouterLink}
          to="/"
          underline="hover"
          sx={{ width: "fit-content", color: "text.secondary" }}
        >
          Back Home
        </MuiLink>
      </Stack>
    </Box>
  );
}

export default FiltersView;
