import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  CssBaseline,
  Divider,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link as RouterLink } from "react-router-dom";
import PatientSearchForm from "../components/patient/PatientSearchForm";
import PatientDemographicsCard from "../components/patient/PatientDemographicsCard";
import CancerTumorSummaryCard from "../components/patient/CancerTumorSummaryCard";
import PatientDocumentsCard from "../components/patient/PatientDocumentsCard";
import PatientDocumentViewerCard from "../components/patient/PatientDocumentViewerCard";
import {
  loadPatientProfile,
  loadRandomPatientId,
  loadViz2PatientOptions,
  loadViz2PatientProfile,
} from "../controllers/patient";
import { transformCancerSummary } from "../utils/patientView/transformCancerSummary";
import { transformDocumentTimeline } from "../utils/patientView/transformDocumentTimeline";
import { resolveFactSelection } from "../utils/patientView/factLinking";
import { getThemeByKey } from "../themes";

const DEFAULT_THEME_KEY = "govuk";
const LOOKUP_MODE_PATIENT_ID = "patient-id";
const LOOKUP_MODE_VIZ2_DOCS = "viz2-docs";

function getMostRecentDocumentId(reportData = []) {
  if (!Array.isArray(reportData) || reportData.length === 0) {
    return "";
  }

  return String(reportData[reportData.length - 1]?.id || "").trim();
}

export default function PatientView() {
  const [lookupMode, setLookupMode] = useState(LOOKUP_MODE_PATIENT_ID);
  const [patientIdInput, setPatientIdInput] = useState("");
  const [viz2PatientOptions, setViz2PatientOptions] = useState([]);
  const [viz2PatientId, setViz2PatientId] = useState("");
  const [isViz2OptionsLoading, setIsViz2OptionsLoading] = useState(false);
  const [viz2OptionsErrorMessage, setViz2OptionsErrorMessage] = useState("");
  const [loadedPatientId, setLoadedPatientId] = useState("");
  const [patientData, setPatientData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [cancerSummary, setCancerSummary] = useState([]);
  const [factSelection, setFactSelection] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestIdRef = useRef(0);

  const activeTheme = useMemo(() => getThemeByKey(DEFAULT_THEME_KEY), []);
  const activeErrorMessage =
    errorMessage ||
    (lookupMode === LOOKUP_MODE_VIZ2_DOCS ? viz2OptionsErrorMessage : "");

  const selectedDocument = useMemo(() => {
    const documents = Array.isArray(patientData?.documents) ? patientData.documents : [];
    if (documents.length === 0) {
      return null;
    }

    return documents.find((document) => document.id === selectedDocumentId) || documents[0];
  }, [patientData, selectedDocumentId]);

  useEffect(() => {
    if (lookupMode !== LOOKUP_MODE_VIZ2_DOCS || viz2PatientOptions.length > 0) {
      return undefined;
    }

    let isCancelled = false;
    setIsViz2OptionsLoading(true);
    setViz2OptionsErrorMessage("");

    loadViz2PatientOptions()
      .then((options) => {
        if (isCancelled) {
          return;
        }

        setViz2PatientOptions(options);

        const currentSelectionIsValid = options.some((option) => option.id === viz2PatientId);
        if (currentSelectionIsValid) {
          return;
        }

        setViz2PatientId(String(options[0]?.id || "").trim());
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setViz2PatientOptions([]);
        setViz2PatientId("");
        setViz2OptionsErrorMessage(error?.message || "Failed to load Viz2 patient options.");
      })
      .finally(() => {
        if (!isCancelled) {
          setIsViz2OptionsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [lookupMode, viz2PatientId, viz2PatientOptions.length]);

  const handleLoadPatient = async () => {
    const isViz2Mode = lookupMode === LOOKUP_MODE_VIZ2_DOCS;
    const normalizedPatientId = String(
      isViz2Mode ? viz2PatientId : patientIdInput
    ).trim();

    if (!normalizedPatientId) {
      setErrorMessage(
        isViz2Mode ? "Please select a Viz2 patient." : "Please enter a patient ID."
      );
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const nextPatientData = isViz2Mode
        ? await loadViz2PatientProfile(normalizedPatientId)
        : await loadPatientProfile(normalizedPatientId);
      if (requestIdRef.current !== requestId) {
        return;
      }

      const nextTimeline = transformDocumentTimeline({
        patientId: nextPatientData.patientId,
        patientName: nextPatientData.patientName,
        demographics: nextPatientData.demographics,
        documents: nextPatientData.documents,
      });
      const nextCancerSummary = transformCancerSummary(nextPatientData.cancers);

      setLoadedPatientId(nextPatientData.patientId || normalizedPatientId);
      setPatientData(nextPatientData);
      setTimelineData(nextTimeline);
      setCancerSummary(nextCancerSummary);
      setFactSelection(null);
      setSelectedDocumentId(getMostRecentDocumentId(nextTimeline.reportData));
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setPatientData(null);
      setTimelineData(null);
      setCancerSummary([]);
      setFactSelection(null);
      setSelectedDocumentId("");
      setLoadedPatientId("");
      setErrorMessage(error?.message || "Failed to load patient details.");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  };

  const handleLookupModeChange = (nextLookupMode) => {
    setLookupMode(nextLookupMode);
    setErrorMessage("");
  };

  const handleFactSelect = (factId) => {
    const normalizedFactId = String(factId || "").trim();
    if (!normalizedFactId || !patientData) {
      return;
    }

    if (factSelection?.factId === normalizedFactId) {
      setFactSelection(null);
      return;
    }

    const nextSelection = resolveFactSelection(patientData, normalizedFactId);
    setFactSelection(nextSelection);

    if (nextSelection?.documentIds?.length > 0) {
      setSelectedDocumentId(String(nextSelection.documentIds[0] || "").trim());
    }
  };

  const handlePickRandomPatientId = async () => {
    setIsRandomLoading(true);

    try {
      const randomPatientId = await loadRandomPatientId();
      setPatientIdInput(randomPatientId);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error?.message || "Failed to pick a random patient.");
    } finally {
      setIsRandomLoading(false);
    }
  };

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          p: { xs: 2, md: 4 },
        }}
      >
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ border: 1, borderColor: "divider", p: 1.5 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                <MuiLink
                  component={RouterLink}
                  to="/"
                  underline="none"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    color: "text.primary",
                    "&:hover": {
                      color: "text.primary",
                      textDecoration: "underline",
                    },
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                  <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                    Home
                  </Typography>
                </MuiLink>
                <Divider orientation="vertical" flexItem />
                <Typography component="h1" variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Patient View
                </Typography>
              </Stack>

              {isLoading ? <CircularProgress size={20} /> : null}
            </Stack>
          </Paper>

          <PatientSearchForm
            lookupMode={lookupMode}
            onLookupModeChange={handleLookupModeChange}
            patientIdValue={patientIdInput}
            onPatientIdChange={setPatientIdInput}
            viz2PatientId={viz2PatientId}
            viz2PatientOptions={viz2PatientOptions}
            onViz2PatientIdChange={setViz2PatientId}
            isViz2OptionsLoading={isViz2OptionsLoading}
            onLoadPatient={handleLoadPatient}
            isLoading={isLoading}
            onPickRandomPatientId={handlePickRandomPatientId}
            isRandomLoading={isRandomLoading}
          />

          {activeErrorMessage ? <Alert severity="error">{activeErrorMessage}</Alert> : null}

          {loadedPatientId && patientData ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Loaded patient: <strong>{loadedPatientId}</strong>
              </Typography>

              <PatientDemographicsCard patientData={patientData} timelineData={timelineData} />

              <CancerTumorSummaryCard
                cancers={cancerSummary}
                factSelection={factSelection}
                selectedDocumentId={selectedDocumentId}
                onFactSelect={handleFactSelect}
                onSelectDocument={setSelectedDocumentId}
              />

              <PatientDocumentsCard
                timelineData={timelineData}
                selectedDocumentId={selectedDocumentId}
                relatedDocumentIds={factSelection?.documentIds || []}
                onSelectDocument={setSelectedDocumentId}
              />

              <PatientDocumentViewerCard
                document={selectedDocument}
                concepts={patientData.concepts}
                factSelection={factSelection}
              />
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
