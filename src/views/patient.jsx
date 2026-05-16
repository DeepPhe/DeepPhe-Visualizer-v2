import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * @typedef {Object} SelectionContext
 * @property {"auto"|"timeline"|"fact"|"related-document"} source
 * @property {string|null} [documentType]   - report type, e.g. "NOTE"
 * @property {string|null} [documentDate]   - formatted date string, e.g. "2010/02/05"
 * @property {string|null} [episodeLabel]   - e.g. "Treatment"
 * @property {string|null} [categoryName]   - fact category, e.g. "Location"
 * @property {string|null} [prettyName]     - fact value, e.g. "Upper-Outer Quadrant of the Breast"
 * @property {boolean}     [isTumorLevel]   - true when fact is on a tumor, not the cancer
 * @property {number|null} [cancerIndex]    - 1-based position in cancerSummary array
 * @property {number|null} [tumorIndex]     - 1-based position in cancer's tumor list
 */

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
  const [selectionContext, setSelectionContext] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestIdRef = useRef(0);

  const resolveCancerTumorIndex = useCallback(
    (cancerId, tumorId) => {
      const normalizedCancerId = String(cancerId || "").trim();
      const normalizedTumorId = String(tumorId || "").trim();

      if (!normalizedCancerId) {
        return { cancerIndex: null, tumorIndex: null };
      }

      const cancerIndex = cancerSummary.findIndex(
        (cancer) =>
          String(cancer?.cancerId || cancer?.title || "").trim() === normalizedCancerId
      );

      if (cancerIndex === -1) {
        return { cancerIndex: null, tumorIndex: null };
      }

      if (!normalizedTumorId) {
        return { cancerIndex: cancerIndex + 1, tumorIndex: null };
      }

      const tumors = Array.isArray(cancerSummary[cancerIndex]?.tumors?.listViewData)
        ? cancerSummary[cancerIndex].tumors.listViewData
        : [];

      const tumorIndex = tumors.findIndex(
        (tumor) => String(tumor?.id || "").trim() === normalizedTumorId
      );

      return {
        cancerIndex: cancerIndex + 1,
        tumorIndex: tumorIndex === -1 ? null : tumorIndex + 1,
      };
    },
    [cancerSummary]
  );

  const activeTheme = useMemo(() => getThemeByKey(DEFAULT_THEME_KEY), []);
  const activeErrorMessage =
    errorMessage ||
    (lookupMode === LOOKUP_MODE_VIZ2_DOCS ? viz2OptionsErrorMessage : "");

  const selectedDocument = useMemo(() => {
    const documents = Array.isArray(patientData?.documents) ? patientData.documents : [];
    if (documents.length === 0) {
      return null;
    }

    return documents.find((document) => document.id === selectedDocumentId) || null;
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
    setFactSelection(null);
    setSelectedDocumentId("");
    setSelectionContext(null);

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
      const mostRecentId = getMostRecentDocumentId(nextTimeline.reportData);
      const mostRecentReport = (nextTimeline.reportData || []).find(
        (r) => String(r?.id || "").trim() === mostRecentId
      );
      setSelectedDocumentId(mostRecentId);
      setSelectionContext({
        source: "auto",
        documentType: String(mostRecentReport?.type || "").trim() || null,
        documentDate: String(mostRecentReport?.formattedDate || "").trim() || null,
        episodeLabel: String(mostRecentReport?.episode || "").trim() || null,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setPatientData(null);
      setTimelineData(null);
      setCancerSummary([]);
      setFactSelection(null);
      setSelectedDocumentId("");
      setSelectionContext(null);
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

  const handleSelectDocumentFromTimeline = useCallback(
    (docId) => {
      const normalizedDocId = String(docId || "").trim();
      setSelectedDocumentId(normalizedDocId);

      const report = (timelineData?.reportData || []).find(
        (r) => String(r?.id || "").trim() === normalizedDocId
      );

      setSelectionContext({
        source: "timeline",
        documentType: String(report?.type || "").trim() || null,
        documentDate: String(report?.formattedDate || "").trim() || null,
        episodeLabel: String(report?.episode || "").trim() || null,
      });
    },
    [timelineData]
  );

  const handleSelectRelatedDocument = useCallback(
    (docId) => {
      const normalizedDocId = String(docId || "").trim();
      setSelectedDocumentId(normalizedDocId);

      const report = (timelineData?.reportData || []).find(
        (r) => String(r?.id || "").trim() === normalizedDocId
      );

      const { cancerIndex, tumorIndex } = resolveCancerTumorIndex(
        factSelection?.cancerId,
        factSelection?.tumorId
      );

      setSelectionContext({
        source: "related-document",
        categoryName: factSelection?.categoryName || null,
        prettyName: factSelection?.prettyName || null,
        isTumorLevel: factSelection?.source === "tumor-attribute",
        cancerIndex,
        tumorIndex,
        documentType: String(report?.type || "").trim() || null,
        documentDate: String(report?.formattedDate || "").trim() || null,
      });
    },
    [factSelection, timelineData, resolveCancerTumorIndex]
  );

  const handleFactSelect = (factId) => {
    const normalizedFactId = String(factId || "").trim();
    if (!normalizedFactId || !patientData) {
      return;
    }

    if (factSelection?.factId === normalizedFactId) {
      setFactSelection(null);
      setSelectionContext(null);
      return;
    }

    const nextSelection = resolveFactSelection(patientData, normalizedFactId);
    setFactSelection(nextSelection);

    if (nextSelection?.documentIds?.length > 0) {
      const firstDocId = String(nextSelection.documentIds[0] || "").trim();
      setSelectedDocumentId(firstDocId);

      const { cancerIndex, tumorIndex } = resolveCancerTumorIndex(
        nextSelection.cancerId,
        nextSelection.tumorId
      );

      setSelectionContext({
        source: "fact",
        categoryName: nextSelection.categoryName || null,
        prettyName: nextSelection.prettyName || null,
        isTumorLevel: nextSelection.source === "tumor-attribute",
        cancerIndex,
        tumorIndex,
      });
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
          p: { xs: 1, md: 2 },
        }}
      >
        <Stack spacing={1.5}>
          <Paper elevation={0} sx={{ border: 1, borderColor: "divider", p: 1 }}>
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
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Loaded patient: <strong>{loadedPatientId}</strong>
              </Typography>
              <Typography
                component="p"
                variant="caption"
                aria-live="polite"
                aria-atomic="true"
                sx={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedDocument
                  ? `Document viewer opened: ${selectedDocument.name || selectedDocument.id}`
                  : ""}
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    lg: selectedDocument
                      ? "200px minmax(0, 1fr) 280px minmax(0, 2fr)"
                      : "200px minmax(0, 1fr) 280px",
                  },
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    minWidth: { lg: 160 },
                    maxWidth: { lg: 200 },
                    borderRight: { lg: 1 },
                    borderColor: "divider",
                    minHeight: 0,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <PatientDemographicsCard
                    patientData={patientData}
                  />
                </Box>

                <Box
                  sx={{
                    minWidth: 0,
                    minHeight: 0,
                    borderTop: { xs: 1, lg: 0 },
                    borderColor: "divider",
                  }}
                >
                  <CancerTumorSummaryCard
                    cancers={cancerSummary}
                    factSelection={factSelection}
                    selectedDocumentId={selectedDocumentId}
                    onFactSelect={handleFactSelect}
                    onSelectDocument={handleSelectRelatedDocument}
                  />
                </Box>

                <Box
                  sx={{
                    minWidth: 0,
                    minHeight: 0,
                    borderTop: { xs: 1, lg: 0 },
                    borderLeft: { lg: 1 },
                    borderColor: "divider",
                  }}
                >
                  <PatientDocumentsCard
                    embedded
                    timelineData={timelineData}
                    selectedDocumentId={selectedDocumentId}
                    relatedDocumentIds={factSelection?.documentIds || []}
                    onSelectDocument={handleSelectDocumentFromTimeline}
                  />
                </Box>

                {selectedDocument ? (
                  <Box
                    sx={{
                      minWidth: 0,
                      minHeight: 0,
                      borderTop: { xs: 1, lg: 0 },
                      borderLeft: { lg: 1 },
                      borderColor: "divider",
                    }}
                  >
                    <PatientDocumentViewerCard
                      embedded
                      document={selectedDocument}
                      concepts={patientData.concepts}
                      factSelection={factSelection}
                      selectionContext={selectionContext}
                    />
                  </Box>
                ) : null}
              </Box>
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
