import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CancerTumorSummaryCard from "./patient/CancerTumorSummaryCard";
import PatientDocumentsCard from "./patient/PatientDocumentsCard";
import PatientDocumentViewerCard from "./patient/PatientDocumentViewerCard";
import PatientSummaryCard from "./patient/PatientSummaryCard";
import { getInstances } from "../controllers/omap";
import { loadPatientFilterSummary, loadPatientProfile } from "../controllers/patient";
import { asRowArray, getValueFromRow } from "../utils/dataProcessing";
import { transformCancerSummary } from "../utils/patientView/transformCancerSummary";
import { transformDocumentTimeline } from "../utils/patientView/transformDocumentTimeline";
import { resolveFactSelection } from "../utils/patientView/factLinking";

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
  const [patientData, setPatientData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [cancerSummary, setCancerSummary] = useState([]);
  const [factSelection, setFactSelection] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectionContext, setSelectionContext] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestIdRef = useRef(0);
  const omopRequestIdRef = useRef(0);
  const patientSummaryRequestIdRef = useRef(0);
  const [omopDetails, setOmopDetails] = useState(EMPTY_OMOP_DETAILS);
  const [patientSummaryData, setPatientSummaryData] = useState(null);

  useEffect(() => {
    const normalizedId = String(patientId || "").trim();
    if (!normalizedId) {
      setPatientData(null);
      setTimelineData(null);
      setCancerSummary([]);
      setFactSelection(null);
      setSelectedDocumentId("");
      setSelectionContext(null);
      setErrorMessage("");
      setOmopDetails(EMPTY_OMOP_DETAILS);
      setPatientSummaryData(null);
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setErrorMessage("");

    const run = async () => {
      try {
        const nextPatientData = await loadPatientProfile(normalizedId);
        if (requestIdRef.current !== requestId) return;

        const nextTimeline = transformDocumentTimeline({
          patientId: nextPatientData.patientId,
          patientName: nextPatientData.patientName,
          demographics: nextPatientData.demographics,
          documents: nextPatientData.documents,
        });
        const nextCancerSummary = transformCancerSummary(nextPatientData.cancers);

        setPatientData(nextPatientData);
        setTimelineData(nextTimeline);
        setCancerSummary(nextCancerSummary);
        setFactSelection(null);
        setSelectedDocumentId("");
        setSelectionContext(null);
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        setPatientData(null);
        setTimelineData(null);
        setCancerSummary([]);
        setFactSelection(null);
        setSelectedDocumentId("");
        setSelectionContext(null);
        setErrorMessage(error?.message || "Failed to load patient details.");
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    };

    run();
    return undefined;
  }, [patientId]);

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
    if (!normalizedFactId || !patientData) return;

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

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
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
            lg: patientSummarySections.length > 0 ? "fit-content(62%) minmax(0, 1fr)" : "minmax(0, 1fr)",
          },
          alignItems: "stretch",
          flexShrink: { xs: 0, lg: 1 },
          minHeight: 0,
          maxHeight: { xs: "none", lg: 360 },
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          mx: 1.5,
          mb: 1,
        }}
      >
        {/* Cancer and Tumor Detail */}
        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            justifySelf: { lg: "start" },
            width: { lg: "fit-content" },
            maxWidth: { lg: "100%" },
            overflowY: { xs: "visible", lg: "auto" },
          }}
        >
          <CancerTumorSummaryCard
            embedded
            cancers={cancerSummary}
            factSelection={factSelection}
            selectedDocumentId={selectedDocumentId}
            onFactSelect={handleFactSelect}
            onSelectDocument={handleSelectRelatedDocument}
            contentAutoHeight
          />
        </Box>

        {/* Patient Summary */}
        {patientSummarySections.length > 0 ? (
          <Box
            sx={{
              minWidth: 0,
              minHeight: 0,
              borderTop: { xs: 1, lg: 0 },
              borderLeft: { lg: 1 },
              borderColor: "divider",
              overflowY: { xs: "visible", lg: "auto" },
            }}
          >
            <PatientSummaryCard sections={patientSummarySections} />
          </Box>
        ) : null}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: { xs: 0, lg: 220 },
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: selectedDocument ? "300px minmax(0, 2fr)" : "300px",
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
        {/* Document Timeline */}
        <Box sx={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <PatientDocumentsCard
            embedded
            timelineData={timelineData}
            selectedDocumentId={selectedDocumentId}
            relatedDocumentIds={factSelection?.documentIds || []}
            onSelectDocument={handleSelectDocumentFromTimeline}
          />
        </Box>

        {/* Document Viewer */}
        {selectedDocument ? (
          <Box
            sx={{
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
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
    </Box>
  );
}

EmbeddedPatientView.propTypes = {
  patientId: PropTypes.string,
};
