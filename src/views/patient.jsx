import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
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
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import PatientSearchForm from "../components/patient/PatientSearchForm";
import PatientDemographicsCard from "../components/patient/PatientDemographicsCard";
import CancerTumorSummaryCard from "../components/patient/CancerTumorSummaryCard";
import PatientDocumentsCard from "../components/patient/PatientDocumentsCard";
import PatientDocumentDrawer from "../components/patient/PatientDocumentDrawer";
import EventRelationTimelineCard from "../components/patient/EventRelationTimelineCard";
import TimelineLinkProvider from "../components/patient/timeline/TimelineLinkProvider";
import PatientSummaryCard from "../components/patient/PatientSummaryCard";
import {
  loadPatientFilterSummary,
  loadPatientProfile,
  loadRandomPatientId,
} from "../controllers/patient";
import { shouldShowEventRelationTimeline } from "../controllers/eventRelationTimeline";
import { usePatientData } from "../hooks/usePatientData";
import { findDocumentIdsForConceptIds } from "../utils/patientView/documentMentions";
import { resolveFactSelection } from "../utils/patientView/factLinking";
import { resolveSummarySelection } from "../utils/patientView/summarySelection";
import { getThemeByKey } from "../themes";

const DEFAULT_THEME_KEY = "govuk";
const DETAIL_SECTION_DEFINITIONS = [
  { key: "diagnoses", label: "Diagnoses" },
  { key: "staging", label: "Staging" },
  { key: "grading", label: "Grading" },
  { key: "biomarkers", label: "Biomarkers" },
  { key: "treatments", label: "Treatments" },
  { key: "procedures", label: "Procedures" },
  { key: "findings", label: "Findings" },
  { key: "behavior", label: "Behavior" },
];

/**
 * @typedef {Object} SelectionContext
 * @property {"auto"|"timeline"|"fact"|"related-document"|"summary"} source
 * @property {string|null} [documentType]   - report type, e.g. "NOTE"
 * @property {string|null} [documentDate]   - formatted date string, e.g. "2010/02/05"
 * @property {string|null} [episodeLabel]   - e.g. "Treatment"
 * @property {string|null} [categoryName]   - fact category, e.g. "Location"
 * @property {string|null} [prettyName]     - fact value, e.g. "Upper-Outer Quadrant of the Breast"
 * @property {boolean}     [isTumorLevel]   - true when fact is on a tumor, not the cancer
 * @property {number|null} [cancerIndex]    - 1-based position in cancerSummary array
 * @property {number|null} [tumorIndex]     - 1-based position in cancer's tumor list
 * @property {number}      [documentCount]  - number of source documents for a summary item
 */

function getMostRecentDocumentId(reportData = []) {
  if (!Array.isArray(reportData) || reportData.length === 0) {
    return "";
  }
  return String(reportData[reportData.length - 1]?.id || "").trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseSummaryJsonObject(value) {
  let nextValue = value;
  for (let parsePass = 0; parsePass < 3; parsePass += 1) {
    if (!nextValue) {
      return null;
    }

    if (typeof nextValue === "object") {
      return nextValue;
    }

    if (typeof nextValue === "string") {
      const trimmedValue = nextValue.trim();
      if (!trimmedValue) {
        return null;
      }

      try {
        nextValue = JSON.parse(trimmedValue);
        continue;
      } catch {
        return null;
      }
    }

    return null;
  }

  return typeof nextValue === "object" && nextValue ? nextValue : null;
}

function normalizePatientSummaryRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.summaries)) {
    return payload.summaries;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  return [];
}

function resolvePatientSummaryPayload(summaryResponse, patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  const summaryRows = normalizePatientSummaryRows(summaryResponse);
  const matchingRow = summaryRows.find((row) => {
    const rowPatientId = String(row?.patient_id ?? row?.patientId ?? "").trim();
    return rowPatientId && rowPatientId === normalizedPatientId;
  }) || summaryRows[0];

  if (!matchingRow) {
    return null;
  }

  return parseSummaryJsonObject(
    matchingRow?.json_text ??
      matchingRow?.jsonText ??
      matchingRow?.summary_json ??
      matchingRow?.summaryJson ??
      matchingRow
  );
}

function getSummaryDetailSections(rawPatientSummary) {
  return DETAIL_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    items: toArray(rawPatientSummary?.[section.key]),
  })).filter((section) => section.items.length > 0);
}

function normalizePatientConfidenceThreshold(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 100;
  }
  return Math.min(100, Math.max(50, Math.round(numericValue / 5) * 5));
}

function getPatientIdFromSearchParams(searchParams) {
  return String(
    searchParams.get("patientId") ||
      searchParams.get("patient") ||
      searchParams.get("id") ||
      ""
  ).trim();
}

export default function PatientView() {
  const [searchParams] = useSearchParams();
  const [patientIdInput, setPatientIdInput] = useState("");
  const { patientData, timelineData, cancerSummary, isLoading, errorMessage, loadPatient } =
    usePatientData();
  const [loadedPatientId, setLoadedPatientId] = useState("");
  const [factSelection, setFactSelection] = useState(null);
  const [summarySelection, setSummarySelection] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [isDocumentDrawerOpen, setIsDocumentDrawerOpen] = useState(false);
  const [selectionContext, setSelectionContext] = useState(null);
  // Shared between the event relation timeline and the document viewer, the way
  // the alpha shares `clickedTerms` across the patient layout.
  const [timelineConceptIds, setTimelineConceptIds] = useState([]);
  const [isEventTimelineExpanded, setIsEventTimelineExpanded] = useState(true);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [patientSummaryData, setPatientSummaryData] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(100);
  const eventRelationTimelinePanelId = useId();
  const summaryPanelId = useId();

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
  const activeErrorMessage = validationMessage || errorMessage;

  const selectedDocument = useMemo(() => {
    const documents = Array.isArray(patientData?.documents) ? patientData.documents : [];
    if (documents.length === 0) {
      return null;
    }

    return documents.find((document) => document.id === selectedDocumentId) || null;
  }, [patientData, selectedDocumentId]);

  const loadedPatientTimelineId = patientData?.patientId || loadedPatientId;
  const showEventRelationTimeline = shouldShowEventRelationTimeline(loadedPatientTimelineId);

  const patientSummarySections = useMemo(
    () => getSummaryDetailSections(patientSummaryData || patientData?.rawPatient || patientData),
    [patientData, patientSummaryData]
  );
  const eventRelatedDocumentIds = useMemo(
    () =>
      findDocumentIdsForConceptIds(
        patientData?.documents,
        patientData?.concepts,
        timelineConceptIds
      ),
    [patientData, timelineConceptIds]
  );

  const reportById = useMemo(() => {
    const map = new Map();
    (timelineData?.reportData || []).forEach((report) => {
      const id = String(report?.id || "").trim();
      if (id) {
        map.set(id, report);
      }
    });
    return map;
  }, [timelineData]);

  const enrichedSummarySections = useMemo(
    () =>
      patientSummarySections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          const selection = resolveSummarySelection(patientData, item, {
            sectionKey: section.key,
            sectionLabel: section.label,
          });
          if (!selection) {
            return item;
          }
          const documentRanking = selection.documentRanking.map((entry) => {
            const report = reportById.get(entry.documentId);
            return {
              ...entry,
              type: String(report?.type || entry.document?.type || "").trim(),
              formattedDate: String(report?.formattedDate || entry.document?.date || "").trim(),
            };
          });
          return {
            ...item,
            selection: { ...selection, documentRanking },
            documentIds: selection.documentIds,
          };
        }),
      })),
    [patientSummarySections, patientData, reportById]
  );

  const activeSelection = factSelection || summarySelection;

  useEffect(() => {
    let isActive = true;
    const normalizedPatientId = String(loadedPatientId || "").trim();

    if (!normalizedPatientId) {
      setPatientSummaryData(null);
      return () => {
        isActive = false;
      };
    }

    loadPatientFilterSummary([normalizedPatientId])
      .then((summaryPayload) => {
        if (!isActive) {
          return;
        }
        setPatientSummaryData(resolvePatientSummaryPayload(summaryPayload, normalizedPatientId));
      })
      .catch(() => {
        if (isActive) {
          setPatientSummaryData(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [loadedPatientId]);

  const handleToggleEventTimeline = useCallback(() => {
    setIsEventTimelineExpanded((previous) => !previous);
  }, []);

  const handleConfidenceThresholdChange = useCallback((nextValue) => {
    setConfidenceThreshold(normalizePatientConfidenceThreshold(nextValue));
  }, []);

  const loadPatientById = useCallback(
    async (patientId) => {
      const normalizedPatientId = String(patientId || "").trim();

      if (!normalizedPatientId) {
        setValidationMessage("Please enter a patient ID.");
        return null;
      }

      setPatientIdInput(normalizedPatientId);
      setValidationMessage("");
      setFactSelection(null);
      setSummarySelection(null);
      setSelectedDocumentId("");
      setIsDocumentDrawerOpen(false);
      setTimelineConceptIds([]);
      setSelectionContext(null);
      setPatientSummaryData(null);
      setConfidenceThreshold(100);

      const result = await loadPatient(normalizedPatientId, loadPatientProfile);

      if (!result) {
        setLoadedPatientId("");
        setFactSelection(null);
        setSummarySelection(null);
        setSelectedDocumentId("");
        setIsDocumentDrawerOpen(false);
        setTimelineConceptIds([]);
        setSelectionContext(null);
        setPatientSummaryData(null);
        return null;
      }

      setLoadedPatientId(result.patientData.patientId || normalizedPatientId);
      const mostRecentId = getMostRecentDocumentId(result.timelineData.reportData);
      const mostRecentReport = (result.timelineData.reportData || []).find(
        (r) => String(r?.id || "").trim() === mostRecentId
      );
      setSelectedDocumentId(mostRecentId);
      setIsDocumentDrawerOpen(Boolean(mostRecentId));
      setSelectionContext({
        source: "auto",
        documentType: String(mostRecentReport?.type || "").trim() || null,
        documentDate: String(mostRecentReport?.formattedDate || "").trim() || null,
        episodeLabel: String(mostRecentReport?.episode || "").trim() || null,
      });
      return result;
    },
    [loadPatient]
  );

  useEffect(() => {
    const urlPatientId = getPatientIdFromSearchParams(searchParams);
    if (!urlPatientId || urlPatientId === loadedPatientId) {
      return;
    }

    loadPatientById(urlPatientId);
  }, [loadedPatientId, loadPatientById, searchParams]);

  const handleLoadPatient = () => {
    loadPatientById(patientIdInput);
  };

  const handleSelectDocumentFromTimeline = useCallback(
    (docId) => {
      const normalizedDocId = String(docId || "").trim();
      setSelectedDocumentId(normalizedDocId);
      setIsDocumentDrawerOpen(Boolean(normalizedDocId));

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

  const handleCloseDocument = useCallback(() => {
    // Keep the current report available to the event timeline after dismissal.
    setIsDocumentDrawerOpen(false);
  }, []);

  const handleSelectRelatedDocument = useCallback(
    (docId) => {
      const normalizedDocId = String(docId || "").trim();
      setSelectedDocumentId(normalizedDocId);
      setIsDocumentDrawerOpen(Boolean(normalizedDocId));

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

    if (factSelection?.factId === normalizedFactId && isDocumentDrawerOpen) {
      setFactSelection(null);
      setSelectionContext(null);
      return;
    }

    setSummarySelection(null);
    const nextSelection = resolveFactSelection(patientData, normalizedFactId);
    setFactSelection(nextSelection);

    if (nextSelection?.documentIds?.length > 0) {
      const firstDocId = String(nextSelection.documentIds[0] || "").trim();
      setSelectedDocumentId(firstDocId);
      setIsDocumentDrawerOpen(Boolean(firstDocId));

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

  const openSummaryDocument = useCallback(
    (selection, documentId) => {
      const normalizedDocId = String(documentId || "").trim();
      if (!selection || !normalizedDocId) {
        return;
      }

      setFactSelection(null);
      setSummarySelection(selection);
      setSelectedDocumentId(normalizedDocId);
      setIsDocumentDrawerOpen(Boolean(normalizedDocId));

      const report = (timelineData?.reportData || []).find(
        (r) => String(r?.id || "").trim() === normalizedDocId
      );
      const rankingEntry = Array.isArray(selection.documentRanking)
        ? selection.documentRanking.find(
            (entry) => String(entry?.documentId || "").trim() === normalizedDocId
          )
        : null;

      setSelectionContext({
        source: "summary",
        categoryName: selection.categoryName || null,
        prettyName: selection.prettyName || null,
        documentCount: Array.isArray(selection.documentIds) ? selection.documentIds.length : 0,
        documentConfidence: rankingEntry ? rankingEntry.confidence : null,
        documentType: String(report?.type || "").trim() || null,
        documentDate: String(report?.formattedDate || "").trim() || null,
      });
    },
    [timelineData]
  );

  const handleSelectSummaryItem = useCallback(
    (selection) => {
      if (!selection || !Array.isArray(selection.documentIds) || selection.documentIds.length === 0) {
        return;
      }

      if (summarySelection?.factId === selection.factId && isDocumentDrawerOpen) {
        setSummarySelection(null);
        setSelectedDocumentId("");
        setIsDocumentDrawerOpen(false);
        setTimelineConceptIds([]);
        setSelectionContext(null);
        return;
      }

      openSummaryDocument(selection, selection.documentIds[0]);
    },
    [summarySelection, openSummaryDocument, isDocumentDrawerOpen]
  );

  const handleSelectSummaryDocument = useCallback(
    (selection, documentId) => {
      openSummaryDocument(selection, documentId);
    },
    [openSummaryDocument]
  );

  const handlePickRandomPatientId = async () => {
    setIsRandomLoading(true);

    try {
      const randomPatientId = await loadRandomPatientId();
      setPatientIdInput(randomPatientId);
      setValidationMessage("");
    } catch (error) {
      setValidationMessage(error?.message || "Failed to pick a random patient.");
    } finally {
      setIsRandomLoading(false);
    }
  };

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Box
        component="main"
        aria-labelledby="patient-page-title"
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
                <Typography
                  id="patient-page-title"
                  component="h1"
                  variant="subtitle1"
                  sx={{ fontWeight: 800 }}
                >
                  Patient View
                </Typography>
              </Stack>

              {isLoading ? <CircularProgress size={20} aria-label="Loading patient" /> : null}
            </Stack>
          </Paper>

          <PatientSearchForm
            patientIdValue={patientIdInput}
            onPatientIdChange={setPatientIdInput}
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
                  // "1px", not 1: a bare 1 resolves to 100% in sx.
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                  whiteSpace: "nowrap",
                }}
              >
                {isDocumentDrawerOpen && selectedDocument
                  ? `Document viewer opened: ${selectedDocument.name || selectedDocument.id}`
                  : ""}
              </Typography>

              <Stack spacing={0.75}>
                <Box
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
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
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                  data-testid="patient-cancer-panel"
                >
                  <CancerTumorSummaryCard
                    contentAutoHeight
                    cancers={cancerSummary}
                    factSelection={factSelection}
                    selectedDocumentId={selectedDocumentId}
                    onFactSelect={handleFactSelect}
                    onSelectDocument={handleSelectRelatedDocument}
                  />
                </Box>

                {/* Links the two timelines: one date range, one zoom, aligned strips. */}
                <TimelineLinkProvider resetKey={loadedPatientTimelineId || ""}>
                <Box
                  sx={{
                    minWidth: 0,
                    minHeight: 0,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "visible",
                  }}
                  data-testid="patient-timeline-panel"
                >
                  <PatientDocumentsCard
                    embedded
                    timelineData={timelineData}
                    selectedDocumentId={selectedDocumentId}
                    relatedDocumentIds={activeSelection?.documentIds || []}
                    eventRelatedDocumentIds={eventRelatedDocumentIds}
                    onSelectDocument={handleSelectDocumentFromTimeline}
                  />
                </Box>

                {showEventRelationTimeline ? (
                  <Box
                    sx={{
                      minWidth: 0,
                      minHeight: 0,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      overflow: "visible",
                    }}
                    data-testid="patient-event-relation-panel"
                  >
                    <EventRelationTimelineCard
                      embedded
                      patientId={loadedPatientTimelineId}
                      concepts={patientData.concepts}
                      selectedDocument={selectedDocument}
                      birthDate={patientData.demographics?.birthDate}
                      selectedConceptIds={timelineConceptIds}
                      onSelectConceptIds={setTimelineConceptIds}
                      onOpenReport={() => setIsDocumentDrawerOpen(true)}
                      expanded={isEventTimelineExpanded}
                      onToggleExpanded={handleToggleEventTimeline}
                      collapsiblePanelId={eventRelationTimelinePanelId}
                    />
                  </Box>
                ) : null}
                </TimelineLinkProvider>

                <Box
                  sx={{
                    minWidth: 0,
                    minHeight: isSummaryExpanded ? 420 : "unset",
                    height: isSummaryExpanded
                      ? { xs: "clamp(420px, 70vh, 720px)", lg: "clamp(420px, 58vh, 760px)" }
                      : "auto",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                  data-testid="patient-summary-panel"
                >
                  <PatientSummaryCard
                    sections={enrichedSummarySections}
                    expanded={isSummaryExpanded}
                    onToggleExpanded={() => setIsSummaryExpanded((previous) => !previous)}
                    collapsiblePanelId={summaryPanelId}
                    onSelectItem={handleSelectSummaryItem}
                    onSelectDocumentForItem={handleSelectSummaryDocument}
                    selectedFactId={summarySelection?.factId || ""}
                    selectedDocumentId={selectedDocumentId}
                    confidenceThreshold={confidenceThreshold}
                    onConfidenceThresholdChange={handleConfidenceThresholdChange}
                  />
                </Box>
              </Stack>

              <PatientDocumentDrawer
                open={isDocumentDrawerOpen && Boolean(selectedDocument)}
                document={selectedDocument}
                concepts={patientData.concepts}
                factSelection={activeSelection}
                selectionContext={selectionContext}
                onClose={handleCloseDocument}
                confidenceThreshold={confidenceThreshold}
                onConfidenceThresholdChange={handleConfidenceThresholdChange}
                selectedConceptIds={timelineConceptIds}
                onSelectedConceptIdsChange={setTimelineConceptIds}
              />
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
