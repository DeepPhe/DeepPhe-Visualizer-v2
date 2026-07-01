import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CancerTumorSummaryCard from "./patient/CancerTumorSummaryCard";
import PatientDocumentsCard from "./patient/PatientDocumentsCard";
import PatientDocumentViewerCard from "./patient/PatientDocumentViewerCard";
import PatientSummaryCard from "./patient/PatientSummaryCard";
import { getInstances } from "../controllers/omap";
import { loadPatientFilterSummary } from "../controllers/patient";
import { usePatientData } from "../hooks/usePatientData";
import { asRowArray, getValueFromRow } from "../utils/dataProcessing";
import { resolveFactSelection } from "../utils/patientView/factLinking";
import { resolveSummarySelection } from "../utils/patientView/summarySelection";

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

const DETAIL_FLAG_DEFINITIONS = [
  { key: "negated", label: "Negated", color: "error" },
  { key: "historic", label: "Historic", color: "default" },
  { key: "uncertain", label: "Uncertain", color: "warning" },
  { key: "conflicted", label: "Conflicted", color: "info" },
];

function getKnownValue(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return "";
  }
  if (/^(unknown|n\/a|na|none|null|-)$/i.test(normalizedValue)) {
    return "";
  }
  return normalizedValue;
}

function toUniqueKnownValues(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => getKnownValue(value))
        .filter(Boolean)
    ),
  ];
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

function toCancerTypeDisplayValue(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return "";
  }

  const upperValue = normalizedValue.toUpperCase();
  if (upperValue === "B") return "Breast";
  if (upperValue === "M") return "Melanoma";
  if (upperValue === "O") return "Ovarian Cancer";
  return normalizedValue;
}

function getOmopValuesForAttribute(attribute, payload) {
  const rows = asRowArray(payload);
  const values = rows.map((row) => getValueFromRow(attribute, row));
  if (String(attribute || "").toUpperCase() === "CANCER") {
    return toUniqueKnownValues(values.map(toCancerTypeDisplayValue));
  }
  return toUniqueKnownValues(values);
}

const EMPTY_OMOP_DETAILS = Object.freeze({
  gender: "",
  race: "",
  ethnicity: "",
  ageAtDx: "",
  cancerTypes: [],
});

function normalizePatientConfidenceThreshold(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 100;
  }
  return Math.min(100, Math.max(50, Math.round(numericValue / 5) * 5));
}

async function loadPatientOmopDetails(patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  if (!normalizedPatientId) {
    return EMPTY_OMOP_DETAILS;
  }

  const attributes = ["GENDER", "RACE", "ETHNICITY", "AGE_AT_DX", "CANCER"];
  const results = await Promise.allSettled(
    attributes.map((attribute) =>
      getInstances(attribute, { patientId: normalizedPatientId })
    )
  );

  const valuesByAttribute = {};
  attributes.forEach((attribute, index) => {
    const result = results[index];
    valuesByAttribute[attribute] =
      result?.status === "fulfilled"
        ? getOmopValuesForAttribute(attribute, result.value)
        : [];
  });

  return {
    gender: valuesByAttribute.GENDER?.[0] || "",
    race: valuesByAttribute.RACE?.[0] || "",
    ethnicity: valuesByAttribute.ETHNICITY?.[0] || "",
    ageAtDx: valuesByAttribute.AGE_AT_DX?.[0] || "",
    cancerTypes: valuesByAttribute.CANCER || [],
  };
}

export default function EmbeddedPatientView({ patientId = "" }) {
  const theme = useTheme();
  const { patientData, timelineData, cancerSummary, isLoading, errorMessage, loadPatient } =
    usePatientData();
  const [factSelection, setFactSelection] = useState(null);
  const [summarySelection, setSummarySelection] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectionContext, setSelectionContext] = useState(null);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [cancerDetailWidth, setCancerDetailWidth] = useState(null);
  const cancerResizeObserverRef = useRef(null);
  const omopRequestIdRef = useRef(0);
  const patientSummaryRequestIdRef = useRef(0);
  const [omopDetails, setOmopDetails] = useState(EMPTY_OMOP_DETAILS);
  const [patientSummaryData, setPatientSummaryData] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(100);
  const handleConfidenceThresholdChange = useCallback((nextValue) => {
    setConfidenceThreshold(normalizePatientConfidenceThreshold(nextValue));
  }, []);

  useEffect(() => {
    const normalizedId = String(patientId || "").trim();
    if (!normalizedId) {
      setFactSelection(null);
      setSummarySelection(null);
      setSelectedDocumentId("");
      setSelectionContext(null);
      setOmopDetails(EMPTY_OMOP_DETAILS);
      setPatientSummaryData(null);
      setConfidenceThreshold(100);
      return undefined;
    }

    setConfidenceThreshold(100);

    loadPatient(normalizedId).then((result) => {
      if (!result) return;
      setFactSelection(null);
      setSummarySelection(null);
      setSelectedDocumentId("");
      setSelectionContext(null);
    });

    return undefined;
  }, [patientId, loadPatient]);

  useEffect(() => {
    const normalizedId = String(patientId || "").trim();
    if (!normalizedId) {
      setPatientSummaryData(null);
      return undefined;
    }

    const requestId = patientSummaryRequestIdRef.current + 1;
    patientSummaryRequestIdRef.current = requestId;

    const run = async () => {
      try {
        const summaryPayload = await loadPatientFilterSummary([normalizedId]);
        if (patientSummaryRequestIdRef.current !== requestId) {
          return;
        }
        setPatientSummaryData(resolvePatientSummaryPayload(summaryPayload, normalizedId));
      } catch {
        if (patientSummaryRequestIdRef.current !== requestId) {
          return;
        }
        setPatientSummaryData(null);
      }
    };

    run();
    return undefined;
  }, [patientId]);

  useEffect(() => {
    const normalizedId = String(patientId || "").trim();
    if (!normalizedId) {
      setOmopDetails(EMPTY_OMOP_DETAILS);
      return undefined;
    }

    const requestId = omopRequestIdRef.current + 1;
    omopRequestIdRef.current = requestId;

    const run = async () => {
      const nextOmopDetails = await loadPatientOmopDetails(normalizedId);
      if (omopRequestIdRef.current !== requestId) {
        return;
      }
      setOmopDetails(nextOmopDetails);
    };

    run();
    return undefined;
  }, [patientId]);

  const selectedDocument = useMemo(() => {
    if (!selectedDocumentId) return null;
    const documents = Array.isArray(patientData?.documents) ? patientData.documents : [];
    return documents.find((doc) => doc.id === selectedDocumentId) || null;
  }, [patientData, selectedDocumentId]);

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

  const patientOverviewEntries = useMemo(() => {
    const demographics = patientData?.demographics || {};
    const raceValue = getKnownValue(omopDetails?.race) || getKnownValue(demographics?.race);
    const ethnicityValue =
      getKnownValue(omopDetails?.ethnicity) || getKnownValue(demographics?.ethnicity);
    const genderValue = getKnownValue(omopDetails?.gender) || getKnownValue(demographics?.gender);
    const ageAtDxValue = getKnownValue(omopDetails?.ageAtDx);
    const cancerTypes = toUniqueKnownValues(omopDetails?.cancerTypes);
    const cancerTypesLabel = cancerTypes.join(", ");
    const raceEthnicity = [raceValue, ethnicityValue].filter(Boolean).join(" / ");

    return [
      getKnownValue(demographics?.firstEncounterDate)
        ? { label: "First Encounter", value: getKnownValue(demographics?.firstEncounterDate) }
        : null,
      getKnownValue(demographics?.lastEncounterDate)
        ? { label: "Last Encounter", value: getKnownValue(demographics?.lastEncounterDate) }
        : null,
      getKnownValue(demographics?.birthDate)
        ? { label: "Birth Date", value: getKnownValue(demographics?.birthDate) }
        : null,
      genderValue ? { label: "Gender", value: genderValue } : null,
      ageAtDxValue ? { label: "Age at Dx", value: ageAtDxValue } : null,
      raceEthnicity ? { label: "Race/Ethnicity", value: raceEthnicity } : null,
      cancerTypesLabel ? { label: "Cancer Type(s)", value: cancerTypesLabel } : null,
    ].filter(Boolean);
  }, [omopDetails, patientData]);

  const patientSummarySections = useMemo(
    () => getSummaryDetailSections(patientSummaryData || patientData?.rawPatient || patientData),
    [patientData, patientSummaryData]
  );

  // Timeline report metadata keyed by document id, for labeling the document
  // picker with the same "type · date" the timeline shows.
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

  // Resolve each summary item to its source documents from the local mention
  // graph so it can open the document viewer on click. Items that can't be
  // tied to any source document keep no selection and render non-interactive.
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

  const handleCloseDocument = useCallback(() => {
    setSelectedDocumentId("");
    setSelectionContext(null);
  }, []);

  // Track the Cancer & Tumor Detail panel's actual rendered width so Patient
  // Summary can be sized to match it (it is content-sized, not a fixed %).
  const registerCancerCell = useCallback((node) => {
    if (cancerResizeObserverRef.current) {
      cancerResizeObserverRef.current.disconnect();
      cancerResizeObserverRef.current = null;
    }
    if (node && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const nextWidth = Math.round(entries[0]?.contentRect?.width || 0);
        if (nextWidth > 0) {
          setCancerDetailWidth(nextWidth);
        }
      });
      observer.observe(node);
      cancerResizeObserverRef.current = observer;
    }
  }, []);

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

  // Open a specific source document for a summary item. Summary selections and
  // cancer/tumor fact selections are mutually exclusive — only one drives the
  // viewer at a time.
  const openSummaryDocument = useCallback(
    (selection, documentId) => {
      const normalizedDocId = String(documentId || "").trim();
      if (!selection || !normalizedDocId) {
        return;
      }

      setFactSelection(null);
      setSummarySelection(selection);
      setSelectedDocumentId(normalizedDocId);

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

  // Single-source findings: open their one source document on click, toggling
  // off when the same item is clicked again. (Multi-source findings open the
  // document picker instead and route through handleSelectSummaryDocument.)
  const handleSelectSummaryItem = useCallback(
    (selection) => {
      if (!selection || !Array.isArray(selection.documentIds) || selection.documentIds.length === 0) {
        return;
      }

      if (summarySelection?.factId === selection.factId) {
        setSummarySelection(null);
        setSelectedDocumentId("");
        setSelectionContext(null);
        return;
      }

      openSummaryDocument(selection, selection.documentIds[0]);
    },
    [summarySelection, openSummaryDocument]
  );

  // Document picker: open the specific source document chosen from the list.
  const handleSelectSummaryDocument = useCallback(
    (selection, documentId) => {
      openSummaryDocument(selection, documentId);
    },
    [openSummaryDocument]
  );

  const handleFactSelect = (factId) => {
    const normalizedFactId = String(factId || "").trim();
    if (!normalizedFactId || !patientData) return;

    if (factSelection?.factId === normalizedFactId) {
      setFactSelection(null);
      setSelectionContext(null);
      return;
    }

    // Cancer/tumor fact selection supersedes any active summary selection.
    setSummarySelection(null);
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

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
          Loading {patientId}…
        </Typography>
      </Box>
    );
  }

  if (errorMessage) {
    return (
      <Alert severity="error" sx={{ m: 1.5 }}>
        {errorMessage}
      </Alert>
    );
  }

  if (!patientData) {
    return null;
  }

  // Either a cancer/tumor fact or a Patient Summary item drives the document
  // viewer and the related-document highlights — never both at once.
  const activeSelection = factSelection || summarySelection;

  const hasSummary = enrichedSummarySections.length > 0;
  const summaryCollapsed = hasSummary && isSummaryCollapsed;
  // A collapsed summary with no open document only needs a slim rail, so the
  // bottom region shrinks to it instead of holding a tall, mostly-empty box.
  const bottomCollapsedAlone = summaryCollapsed && !selectedDocument;

  let bottomGridColumnsLg;
  if (summaryCollapsed) {
    bottomGridColumnsLg = selectedDocument ? "48px minmax(0, 1fr)" : "48px";
  } else if (hasSummary && selectedDocument) {
    bottomGridColumnsLg = "minmax(280px, 1fr) minmax(0, 1.7fr)";
  } else if (hasSummary) {
    // No document open: single column; the box itself is capped to the measured
    // Cancer & Tumor Detail width so the two left-hand panels line up.
    bottomGridColumnsLg = "minmax(0, 1fr)";
  } else {
    bottomGridColumnsLg = "minmax(0, 1fr)";
  }

  // When only the (expanded) summary is showing, match Cancer & Tumor Detail's
  // actual rendered width instead of a fixed percentage.
  const matchCancerWidth = hasSummary && !summaryCollapsed && !selectedDocument;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        // Let the patient tab own vertical scrolling. A natural-height child
        // prevents the lower summary/viewer row from being clipped when the
        // drawer is shorter than the combined panel minimums.
        height: "auto",
        minHeight: "100%",
        overflow: "visible",
      }}
    >
      {patientOverviewEntries.length > 0 ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1.25,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            px: 1.5,
            py: 1,
            mx: 1.5,
            mt: 1.5,
            mb: 1,
            bgcolor: "background.paper",
          }}
        >
          {patientOverviewEntries.map((entry, index) => (
            <Box key={`${entry.label || "patient-id"}-${entry.value}`} sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
              {entry.label ? (
                <Typography variant="caption" color="text.secondary">
                  {entry.label}
                </Typography>
              ) : null}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontFamily: entry.monospace ? "ui-monospace, monospace" : undefined,
                }}
              >
                {entry.value}
              </Typography>
              {index < patientOverviewEntries.length - 1 ? (
                <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                  ·
                </Typography>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}

      {false && patientSummarySections.length > 0 ? (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            gap: "4px 12px",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            px: 1.5,
            py: 0.8,
            mx: 1.5,
            mb: 1,
            bgcolor: theme.custom?.rowHoverBg || alpha(theme.palette.primary.main, 0.08),
          }}
        >
          {patientSummarySections.map((section) => (
            <Box
              key={section.key}
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: "2px 4px",
                minWidth: 0,
                mr: 1.25,
              }}
            >
              <Typography
                component="span"
                variant="caption"
                sx={{
                  bgcolor: alpha(theme.palette.success.main, 0.15),
                  color: theme.palette.success.dark,
                  px: 0.75,
                  py: 0.125,
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {section.label}
              </Typography>

              <Box
                component="span"
                sx={{ display: "inline-flex", alignItems: "baseline", flexWrap: "wrap", ml: 0.5 }}
              >
                {section.items.map((item, itemIndex) => {
                  const itemName = String(item?.name ?? item?.value ?? "").trim() || "Unnamed";
                  const badges = DETAIL_FLAG_DEFINITIONS.filter((flag) =>
                    Boolean(item?.[flag.key])
                  ).map((flag) => ({ key: flag.key, label: flag.label, color: flag.color }));

                  if (item?.source) {
                    badges.push({
                      key: "source",
                      label: `source: ${String(item.source)}`,
                      color: "secondary",
                    });
                  }

                  return (
                    <React.Fragment key={`${section.key}-${itemIndex}`}>
                      <Box
                        component="span"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        }}
                      >
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{
                            color: item?.negated
                              ? "text.disabled"
                              : item?.historic
                              ? "text.secondary"
                              : alpha(theme.palette.text.primary, 0.9),
                            textDecoration: item?.negated ? "line-through" : "none",
                          }}
                        >
                          {itemName}
                        </Typography>

                        {badges.length > 0 ? (
                          <Box
                            component="span"
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                              ml: 0.5,
                            }}
                          >
                            {badges.map((badge) => {
                              const badgePalette =
                                badge.color === "error"
                                  ? theme.palette.error
                                  : badge.color === "warning"
                                  ? theme.palette.warning
                                  : badge.color === "info"
                                  ? theme.palette.info
                                  : badge.color === "secondary"
                                  ? theme.palette.secondary
                                  : theme.palette.text;

                              return (
                                <Typography
                                  key={`${section.key}-${itemIndex}-${badge.key}`}
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    px: 0.5,
                                    py: 0,
                                    borderRadius: "3px",
                                    fontSize: "0.65rem",
                                    lineHeight: 1.4,
                                    border: "1px solid",
                                    borderColor: alpha(badgePalette.main || badgePalette.primary || theme.palette.text.primary, 0.5),
                                    color: badgePalette.main || badgePalette.primary || theme.palette.text.secondary,
                                    bgcolor: alpha(badgePalette.main || badgePalette.primary || theme.palette.text.primary, 0.08),
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {badge.label}
                                </Typography>
                              );
                            })}
                          </Box>
                        ) : null}
                      </Box>

                      {itemIndex < section.items.length - 1 ? (
                        <Typography
                          component="span"
                          sx={{
                            mx: 0.5,
                            color: alpha(theme.palette.text.primary, 0.3),
                            fontSize: "0.85rem",
                            lineHeight: 1,
                          }}
                        >
                          ·
                        </Typography>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "minmax(340px, 32%) minmax(0, 1fr)",
          },
          alignItems: "start",
          gap: 1,
          flex: "0 0 auto",
          mx: 1.5,
          mb: 1,
        }}
      >
        {/* Cancer and Tumor Detail */}
        <Box
          ref={registerCancerCell}
          sx={{
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            alignSelf: "start",
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <CancerTumorSummaryCard
            contentAutoHeight
            embedded
            cancers={cancerSummary}
            factSelection={factSelection}
            selectedDocumentId={selectedDocumentId}
            onFactSelect={handleFactSelect}
            onSelectDocument={handleSelectRelatedDocument}
          />
        </Box>

        {/* Patient Document Timeline */}
        <Box
          sx={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignSelf: "start",
            overflow: "visible",
            minHeight: 0,
            height: "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <PatientDocumentsCard
            embedded
            timelineData={timelineData}
            selectedDocumentId={selectedDocumentId}
            relatedDocumentIds={activeSelection?.documentIds || []}
            onSelectDocument={handleSelectDocumentFromTimeline}
          />
        </Box>
      </Box>

      {hasSummary || selectedDocument ? (
        <Box
          sx={{
            flex: bottomCollapsedAlone ? "0 0 auto" : 1,
            minHeight: bottomCollapsedAlone ? 0 : { xs: 0, lg: 220 },
            width: bottomCollapsedAlone ? { lg: "fit-content" } : undefined,
            maxWidth: matchCancerWidth
              ? { lg: cancerDetailWidth ? `${cancerDetailWidth}px` : "32%" }
              : undefined,
            alignSelf: matchCancerWidth ? { lg: "flex-start" } : undefined,
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              lg: bottomGridColumnsLg,
            },
            alignItems: "stretch",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
            mx: 1.5,
            mb: 1.5,
          }}
        >
          {/* Patient Summary */}
          {hasSummary ? (
            <Box sx={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <PatientSummaryCard
                sections={enrichedSummarySections}
                collapsed={isSummaryCollapsed}
                onToggleCollapse={() => setIsSummaryCollapsed((previous) => !previous)}
                onSelectItem={handleSelectSummaryItem}
                onSelectDocumentForItem={handleSelectSummaryDocument}
                selectedFactId={summarySelection?.factId || ""}
                selectedDocumentId={selectedDocumentId}
                confidenceThreshold={confidenceThreshold}
                onConfidenceThresholdChange={handleConfidenceThresholdChange}
              />
            </Box>
          ) : null}

          {/* Document Viewer */}
          {selectedDocument ? (
            <Box
              sx={{
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderTop: { xs: hasSummary ? 1 : 0, lg: 0 },
                borderLeft: { lg: hasSummary ? 1 : 0 },
                borderColor: "divider",
              }}
            >
              <PatientDocumentViewerCard
                embedded
                document={selectedDocument}
                concepts={patientData.concepts}
                factSelection={activeSelection}
                selectionContext={selectionContext}
                onClose={handleCloseDocument}
                confidenceThreshold={confidenceThreshold}
                onConfidenceThresholdChange={handleConfidenceThresholdChange}
              />
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

EmbeddedPatientView.propTypes = {
  patientId: PropTypes.string,
};
