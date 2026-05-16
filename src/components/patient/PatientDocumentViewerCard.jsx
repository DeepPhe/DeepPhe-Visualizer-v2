import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  Popover,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  buildConfidenceHistogram,
  buildMentionHighlightModel,
} from "../../utils/patientView/documentMentions";

const DEFAULT_GROUP_COLOR = "#e0e0e0";

const GROUP_FAMILY_ORDER = [
  "Anatomy",
  "Device",
  "Finding",
  "Disorder",
  "Severity",
  "Attribute",
  "Intervention",
];

const GROUP_FAMILY_BY_NAME = {
  "Body Part": "Anatomy",
  "Lymph Node": "Anatomy",
  Tissue: "Anatomy",
  "Body Fluid or Substance": "Anatomy",
  Side: "Anatomy",
  "Spatial Qualifier": "Anatomy",
  "Imaging Device": "Device",
  Finding: "Finding",
  "Clinical Test Result": "Finding",
  "Gene Product": "Finding",
  Gene: "Finding",
  Position: "Finding",
  "Quantitative Concept": "Disorder",
  "Disease or Disorder": "Disorder",
  Neoplasm: "Disorder",
  Mass: "Disorder",
  "Disease Stage Qualifier": "Severity",
  "Disease Grade Qualifier": "Severity",
  "Generic TNM Finding": "Severity",
  "Pathologic TNM Finding": "Severity",
  Behavior: "Severity",
  Severity: "Severity",
  "Clinical Course of Disease": "Attribute",
  "Pathologic Process": "Attribute",
  "Disease Qualifier": "Attribute",
  "Property or Attribute": "Attribute",
  "General Qualifier": "Attribute",
  "Temporal Qualifier": "Attribute",
  "Pharmacologic Substance": "Intervention",
  "Chemo/immuno/hormone Therapy Regimen": "Intervention",
  "Intervention or Procedure": "Intervention",
};

const GROUP_FAMILY_RANK = GROUP_FAMILY_ORDER.reduce((accumulator, familyName, index) => {
  accumulator[familyName] = index;
  return accumulator;
}, {});

const GROUP_FAMILY_PREFIX = {
  Anatomy: "A",
  Device: "Dv",
  Finding: "F",
  Disorder: "D",
  Severity: "Sv",
  Attribute: "At",
  Intervention: "Rx",
};

const GROUP_FAMILY_COLOR = {
  Anatomy: "#99E6E6",
  Device: "#785ef0",
  Finding: "#ffbcdd",
  Disorder: "#7fce94",
  Severity: "#ff8712",
  Attribute: "#ffef00",
  Intervention: "#ca99f4",
};

function getGroupPrefix(groupName) {
  const family = GROUP_FAMILY_BY_NAME[groupName];
  return GROUP_FAMILY_PREFIX[family] || groupName.slice(0, 2).toUpperCase();
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function sortGroupNames(groupNames = []) {
  return [...groupNames].sort((leftGroupName, rightGroupName) => {
    const leftFamily = GROUP_FAMILY_BY_NAME[leftGroupName];
    const rightFamily = GROUP_FAMILY_BY_NAME[rightGroupName];
    const leftRank = Number.isFinite(GROUP_FAMILY_RANK[leftFamily])
      ? GROUP_FAMILY_RANK[leftFamily]
      : Number.POSITIVE_INFINITY;
    const rightRank = Number.isFinite(GROUP_FAMILY_RANK[rightFamily])
      ? GROUP_FAMILY_RANK[rightFamily]
      : Number.POSITIVE_INFINITY;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return leftGroupName.localeCompare(rightGroupName, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function TabPanel({ value, index, children = null }) {
  if (value !== index) {
    return null;
  }

  return (
    <Box
      role="tabpanel"
      id={`document-viewer-tabpanel-${index}`}
      aria-labelledby={`document-viewer-tab-${index}`}
    >
      {children}
    </Box>
  );
}

TabPanel.propTypes = {
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  children: PropTypes.node,
};

function ConfidenceHistogram({
  buckets = [],
  groupNames = [],
  groupColorByName = {},
  mode = "byMention",
  minConfidencePercent = 0,
  onConfidenceChange,
}) {
  const chartRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const chartWidth = 360;
  const chartHeight = 220;
  const margin = { top: 12, right: 10, bottom: 36, left: 44 };
  const plotLeft = margin.left;
  const plotTop = margin.top;
  const plotWidth = chartWidth - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const valueKey = mode === "byConcept" ? "byConcept" : "byMention";

  const sortedGroupNames = useMemo(() => {
    const nextNames = new Set(groupNames);
    buckets.forEach((bucket) => {
      Object.keys(bucket?.[valueKey] || {}).forEach((groupName) => {
        if (groupName) {
          nextNames.add(groupName);
        }
      });
    });
    return sortGroupNames([...nextNames]);
  }, [buckets, groupNames, valueKey]);

  const bucketTotals = useMemo(
    () =>
      buckets.map((bucket) =>
        sortedGroupNames.reduce((sum, groupName) => sum + Number(bucket?.[valueKey]?.[groupName] || 0), 0)
      ),
    [buckets, sortedGroupNames, valueKey]
  );

  const maxOccurrences = Math.max(1, ...bucketTotals);
  const bucketWidth = plotWidth / Math.max(1, buckets.length || 1);
  const barWidth = Math.max(3, bucketWidth - 3);
  const thresholdX = plotLeft + (clamp(minConfidencePercent, 0, 100) / 100) * plotWidth;

  const readPercentFromClientX = useCallback(
    (clientX) => {
      const containerRect = chartRef.current?.getBoundingClientRect();
      if (!containerRect || containerRect.width <= 0) {
        return clamp(minConfidencePercent, 0, 100);
      }

      const svgX = ((clientX - containerRect.left) / containerRect.width) * chartWidth;
      const clampedX = clamp(svgX, plotLeft, plotLeft + plotWidth);
      const ratio = (clampedX - plotLeft) / plotWidth;
      return Math.round(ratio * 100);
    },
    [chartWidth, minConfidencePercent, plotLeft, plotWidth]
  );

  const updateConfidenceFromClientX = useCallback(
    (clientX) => {
      if (typeof onConfidenceChange !== "function") {
        return;
      }
      onConfidenceChange(readPercentFromClientX(clientX));
    },
    [onConfidenceChange, readPercentFromClientX]
  );

  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    const handleMouseMove = (event) => {
      updateConfidenceFromClientX(event.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, updateConfidenceFromClientX]);

  const handleMouseDown = (event) => {
    event.preventDefault();
    updateConfidenceFromClientX(event.clientX);
    setIsDragging(true);
  };

  return (
    <Box>
      <Box
        ref={chartRef}
        onMouseDown={handleMouseDown}
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          backgroundColor: "background.paper",
          cursor: isDragging ? "grabbing" : "crosshair",
          userSelect: "none",
        }}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          width="100%"
          height={chartHeight}
          aria-label="Mention confidence histogram"
          role="img"
        >
          <line
            x1={plotLeft}
            y1={plotTop}
            x2={plotLeft}
            y2={plotTop + plotHeight}
            stroke="#8f8f8f"
            strokeWidth="1"
          />
          <line
            x1={plotLeft}
            y1={plotTop + plotHeight}
            x2={plotLeft + plotWidth}
            y2={plotTop + plotHeight}
            stroke="#8f8f8f"
            strokeWidth="1"
          />

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = plotTop + plotHeight - ratio * plotHeight;
            const tickValue = Math.round(ratio * maxOccurrences);
            return (
              <g key={`y-tick-${ratio}`}>
                <line x1={plotLeft - 4} y1={y} x2={plotLeft} y2={y} stroke="#8f8f8f" strokeWidth="1" />
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={plotLeft + plotWidth}
                  y2={y}
                  stroke="#f1f1f1"
                  strokeWidth="1"
                />
                <text x={plotLeft - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#666">
                  {tickValue}
                </text>
              </g>
            );
          })}

          {buckets.map((bucket, bucketIndex) => {
            const barLeft = plotLeft + bucketIndex * bucketWidth + (bucketWidth - barWidth) / 2;
            const isFilteredOut = bucket.binEnd * 100 <= minConfidencePercent;
            const barOpacity = isFilteredOut ? 0.3 : 1;
            let yCursor = plotTop + plotHeight;

            return (
              <g key={`bucket-${bucket.bucket}`}>
                {sortedGroupNames.map((groupName) => {
                  const count = Number(bucket?.[valueKey]?.[groupName] || 0);
                  if (count <= 0) {
                    return null;
                  }

                  const barHeight = (count / maxOccurrences) * plotHeight;
                  yCursor -= barHeight;

                  return (
                    <rect
                      key={`bucket-${bucket.bucket}-${groupName}`}
                      x={barLeft}
                      y={yCursor}
                      width={barWidth}
                      height={barHeight}
                      fill={groupColorByName[groupName] || DEFAULT_GROUP_COLOR}
                      opacity={barOpacity}
                    />
                  );
                })}

                <text
                  x={barLeft + barWidth / 2}
                  y={plotTop + plotHeight + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {bucket.bucket}
                </text>
              </g>
            );
          })}

          <line
            x1={thresholdX}
            y1={plotTop}
            x2={thresholdX}
            y2={plotTop + plotHeight}
            stroke="#1976d2"
            strokeWidth="2"
          />
          <circle cx={thresholdX} cy={plotTop + plotHeight + 2} r="4" fill="#1976d2" />

          <text
            x={16}
            y={plotTop + plotHeight / 2}
            transform={`rotate(-90 16 ${plotTop + plotHeight / 2})`}
            textAnchor="middle"
            fontSize="10"
            fill="#666"
          >
            Occurrences
          </text>
        </svg>
      </Box>
    </Box>
  );
}

ConfidenceHistogram.propTypes = {
  buckets: PropTypes.arrayOf(
    PropTypes.shape({
      bucket: PropTypes.string,
      binStart: PropTypes.number,
      binEnd: PropTypes.number,
      byMention: PropTypes.object,
      byConcept: PropTypes.object,
    })
  ),
  groupNames: PropTypes.arrayOf(PropTypes.string),
  groupColorByName: PropTypes.object,
  mode: PropTypes.oneOf(["byMention", "byConcept"]),
  minConfidencePercent: PropTypes.number,
  onConfidenceChange: PropTypes.func,
};

function toConceptIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function SelectionSummary({ context }) {
  if (!context) {
    return null;
  }

  const isUnknownValue = (value) =>
    /^(unknown|n\/a|na|none|null|-)$/i.test(String(value || "").trim());

  const formatDocumentType = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    if (isUnknownValue(normalized)) {
      return "Document type unknown (source data missing type)";
    }
    return normalized;
  };

  const formatEpisodeLabel = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    if (isUnknownValue(normalized)) {
      return "Episode unknown (source data not yet classified)";
    }
    return normalized;
  };

  const segments = [];

  const push = (text, variant = "normal") => {
    const normalized = String(text || "").trim();
    if (normalized) {
      segments.push({ text: normalized, variant });
    }
  };

  switch (context.source) {
    case "auto":
      push("Auto-selected", "muted");
      push("most recent document", "muted");
      if (context.documentType) push(formatDocumentType(context.documentType), "meta");
      if (context.documentDate) push(context.documentDate, "meta");
      if (context.episodeLabel) push(formatEpisodeLabel(context.episodeLabel), "meta");
      break;

    case "timeline":
      push("Timeline", "muted");
      if (context.documentType) push(formatDocumentType(context.documentType), "accent");
      if (context.documentDate) push(context.documentDate, "meta");
      if (context.episodeLabel) push(formatEpisodeLabel(context.episodeLabel), "meta");
      break;

    case "fact": {
      push(context.isTumorLevel ? "Tumor fact" : "Cancer fact", "muted");
      if (context.cancerIndex != null) {
        push(
          context.tumorIndex != null
            ? `Cancer ${context.cancerIndex} · Tumor ${context.tumorIndex}`
            : `Cancer ${context.cancerIndex}`,
          "accent"
        );
      }
      if (context.categoryName) push(context.categoryName, "meta");
      if (context.prettyName) push(context.prettyName, "strong");
      break;
    }

    case "related-document": {
      push("Linked document", "muted");
      if (context.cancerIndex != null) {
        push(
          context.tumorIndex != null
            ? `Cancer ${context.cancerIndex} · Tumor ${context.tumorIndex}`
            : `Cancer ${context.cancerIndex}`,
          "accent"
        );
      }
      if (context.categoryName) push(context.categoryName, "meta");
      if (context.prettyName) push(context.prettyName, "strong");
      if (context.documentType) push(formatDocumentType(context.documentType), "meta");
      if (context.documentDate) push(context.documentDate, "meta");
      break;
    }

    default:
      break;
  }

  if (segments.length === 0) {
    return null;
  }

  return (
    <Box
      component="span"
      sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.4, mt: 0.15 }}
    >
      <Typography
        component="span"
        variant="caption"
        sx={{ lineHeight: 1.4, color: "text.secondary", fontWeight: 600 }}
      >
        breadcrumb:
      </Typography>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          <Typography
            component="span"
            variant="caption"
            aria-hidden="true"
            sx={{ color: "text.disabled", lineHeight: 1, userSelect: "none" }}
          >
            ·
          </Typography>
          <Typography
            component="span"
            variant="caption"
            sx={{
              lineHeight: 1.4,
              color:
                segment.variant === "muted"
                  ? "text.disabled"
                  : segment.variant === "accent"
                  ? "primary.main"
                  : segment.variant === "strong"
                  ? "text.primary"
                  : "text.secondary",
              fontWeight:
                segment.variant === "strong" || segment.variant === "accent" ? 600 : 400,
            }}
          >
            {segment.text}
          </Typography>
        </React.Fragment>
      ))}
    </Box>
  );
}

SelectionSummary.propTypes = {
  context: PropTypes.shape({
    source: PropTypes.oneOf(["auto", "timeline", "fact", "related-document"]),
    documentType: PropTypes.string,
    documentDate: PropTypes.string,
    episodeLabel: PropTypes.string,
    categoryName: PropTypes.string,
    prettyName: PropTypes.string,
    isTumorLevel: PropTypes.bool,
    cancerIndex: PropTypes.number,
    tumorIndex: PropTypes.number,
  }),
};

export default function PatientDocumentViewerCard({
  document = null,
  concepts = [],
  factSelection = null,
  embedded = false,
  selectionContext = null,
}) {
  const NO_ENABLED_GROUP_SENTINEL = "__NO_ENABLED_GROUPS__";
  const [activeTab, setActiveTab] = useState(0);
  const [minConfidencePercent, setMinConfidencePercent] = useState(0);
  const [enabledGroupByName, setEnabledGroupByName] = useState({});
  const [selectedConceptIds, setSelectedConceptIds] = useState([]);
  const [confidenceMode, setConfidenceMode] = useState("byMention");
  const [conceptGrouping, setConceptGrouping] = useState("byLabel");
  const [helpAnchorEl, setHelpAnchorEl] = useState(null);
  const headingRef = useRef(null);
  const documentScrollRef = useRef(null);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (embedded && headingRef.current) {
      headingRef.current.focus();
    }
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const enabledGroups = useMemo(
    () =>
      Object.entries(enabledGroupByName)
        .filter(([, isEnabled]) => Boolean(isEnabled))
        .map(([groupName]) => groupName),
    [enabledGroupByName]
  );

  const enabledGroupsForModel = useMemo(() => {
    const hasGroupControls = Object.keys(enabledGroupByName).length > 0;
    if (hasGroupControls && enabledGroups.length === 0) {
      return [NO_ENABLED_GROUP_SENTINEL];
    }
    return enabledGroups;
  }, [NO_ENABLED_GROUP_SENTINEL, enabledGroupByName, enabledGroups]);

  const highlightModel = useMemo(
    () =>
      buildMentionHighlightModel({
        document,
        concepts,
        minConfidence: minConfidencePercent / 100,
        enabledGroups: enabledGroupsForModel,
        selectedConceptIds,
      }),
    [document, concepts, minConfidencePercent, enabledGroupsForModel, selectedConceptIds]
  );

  const sortedGroupNames = useMemo(
    () => sortGroupNames(Object.keys(highlightModel.groupColorByName || {})),
    [highlightModel.groupColorByName]
  );

  useEffect(() => {
    const nextGroups = {};
    sortedGroupNames.forEach((groupName) => {
      nextGroups[groupName] =
        enabledGroupByName[groupName] === undefined ? true : Boolean(enabledGroupByName[groupName]);
    });

    const hasChanges =
      Object.keys(nextGroups).length !== Object.keys(enabledGroupByName).length ||
      Object.keys(nextGroups).some((groupName) => nextGroups[groupName] !== enabledGroupByName[groupName]);

    if (hasChanges) {
      setEnabledGroupByName(nextGroups);
    }
  }, [document?.id, enabledGroupByName, sortedGroupNames]);

  useEffect(() => {
    const factConceptIds = toConceptIds(factSelection?.conceptIds);
    if (factConceptIds.length > 0) {
      setSelectedConceptIds(factConceptIds);
    }
  }, [factSelection?.factId, factSelection?.conceptIds]);

  const selectedConceptIdSet = useMemo(() => new Set(toConceptIds(selectedConceptIds)), [selectedConceptIds]);

  const conceptRowsByFamily = useMemo(() => {
    const byFamily = new Map();
    highlightModel.conceptRows.forEach((row) => {
      const family = GROUP_FAMILY_BY_NAME[row.group] || row.group;
      if (!byFamily.has(family)) {
        byFamily.set(family, []);
      }
      byFamily.get(family).push(row);
    });
    const ordered = [];
    const seen = new Set();
    GROUP_FAMILY_ORDER.forEach((family) => {
      if (byFamily.has(family)) {
        ordered.push({ family, rows: byFamily.get(family) });
        seen.add(family);
      }
    });
    byFamily.forEach((rows, family) => {
      if (!seen.has(family)) {
        ordered.push({ family, rows });
      }
    });
    return ordered;
  }, [highlightModel.conceptRows]);

  useEffect(() => {
    if (selectedConceptIds.length === 0) return;
    const container = documentScrollRef.current;
    if (!container) return;
    const firstMention = container.querySelector("[data-first-selected-mention]");
    if (firstMention) {
      const containerRect = container.getBoundingClientRect();
      const mentionRect = firstMention.getBoundingClientRect();
      const viewportPadding = 10;
      const mentionIsAbove = mentionRect.top < containerRect.top + viewportPadding;
      const mentionIsBelow = mentionRect.bottom > containerRect.bottom - viewportPadding;

      if (!mentionIsAbove && !mentionIsBelow) {
        return;
      }

      const targetTop =
        container.scrollTop +
        (mentionRect.top - containerRect.top) -
        Math.max(16, container.clientHeight * 0.28);
      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    }
  }, [selectedConceptIds]);

  const confidenceHistogram = useMemo(
    () =>
      buildConfidenceHistogram({
        mentionRecords: highlightModel.mentionRecords,
        conceptRows: highlightModel.conceptRows,
        bucketCount: 10,
      }),
    [highlightModel.conceptRows, highlightModel.mentionRecords]
  );

  const conceptNegationSummaryById = useMemo(() => {
    const summaryByConceptId = new Map();
    highlightModel.mentionRecords.forEach((mentionRecord) => {
      const conceptId = String(mentionRecord?.conceptId || "").trim();
      if (!conceptId) {
        return;
      }

      const currentSummary = summaryByConceptId.get(conceptId) || { mentionCount: 0, negatedCount: 0 };
      currentSummary.mentionCount += 1;
      if (mentionRecord.negated) {
        currentSummary.negatedCount += 1;
      }
      summaryByConceptId.set(conceptId, currentSummary);
    });
    return summaryByConceptId;
  }, [highlightModel.mentionRecords]);

  const handleConceptToggle = (conceptId) => {
    const normalizedConceptId = String(conceptId || "").trim();
    if (!normalizedConceptId) {
      return;
    }

    setSelectedConceptIds((previousConceptIds) => {
      const previousSet = new Set(toConceptIds(previousConceptIds));
      if (previousSet.has(normalizedConceptId)) {
        previousSet.delete(normalizedConceptId);
      } else {
        previousSet.add(normalizedConceptId);
      }
      return [...previousSet];
    });
  };

  const clearConceptFilter = () => {
    setSelectedConceptIds([]);
  };

  const handleGroupToggle = (groupName, nextEnabled) => {
    setEnabledGroupByName((previousValue) => ({
      ...previousValue,
      [groupName]: Boolean(nextEnabled),
    }));
  };

  const setAllGroupsEnabled = (isEnabled) => {
    const nextGroupByName = {};
    sortedGroupNames.forEach((groupName) => {
      nextGroupByName[groupName] = Boolean(isEnabled);
    });
    setEnabledGroupByName(nextGroupByName);
  };

  const openHelpPopover = Boolean(helpAnchorEl);

  const cardSx = embedded
    ? { border: 0, borderRadius: 0, display: "flex", flexDirection: "column", height: "100%" }
    : { border: 1, borderColor: "divider" };
  const titleVariant = embedded ? "subtitle1" : "h6";
  const selectedDocument = document;

  if (!document) {
    return (
      <Card elevation={0} sx={cardSx}>
        <CardHeader
          title="Document Viewer"
          sx={{ py: embedded ? 1 : undefined, px: embedded ? 1.5 : undefined }}
          titleTypographyProps={{ variant: titleVariant, sx: { fontWeight: 700 } }}
        />
        <Divider />
        <CardContent sx={embedded ? { px: 1.5, py: 1, "&:last-child": { pb: 1 } } : undefined}>
          <Typography variant="body2" color="text.secondary">
            Select a document from the timeline to view text mentions and concept overlays.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={0} sx={cardSx}>
      <CardHeader
        title={
          <span ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
            {selectedDocument?.name || selectedDocument?.id || "Document Viewer"}
          </span>
        }
        subheader={<SelectionSummary context={selectionContext} />}
        sx={{ py: embedded ? 1 : undefined, px: embedded ? 1.5 : undefined }}
        titleTypographyProps={{ variant: titleVariant, sx: { fontWeight: 700 } }}
        subheaderTypographyProps={{ component: "div", variant: "caption" }}
      />
      <Divider />
      <CardContent
        sx={
          embedded
            ? {
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                px: 1.5,
                py: 1,
                "&:last-child": { pb: 1 },
              }
            : undefined
        }
      >
        <Grid
          container
          spacing={2}
          sx={embedded ? { flex: 1, minHeight: 0, overflow: "hidden", alignItems: "stretch" } : undefined}
        >
          <Grid
            item
            xs={12}
            md={4}
            sx={
              embedded
                ? {
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    height: "100%",
                    overflow: "hidden",
                    alignSelf: "stretch",
                  }
                : undefined
            }
          >
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                minHeight: 360,
                display: "flex",
                flexDirection: "column",
                ...(embedded ? { flex: 1, minHeight: 0 } : {}),
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, nextTab) => setActiveTab(nextTab)}
                variant="fullWidth"
                aria-label="Document viewer controls"
              >
                <Tab label="Concept List" id="document-viewer-tab-0" aria-controls="document-viewer-tabpanel-0" />
                <Tab label="Group Filter" id="document-viewer-tab-1" aria-controls="document-viewer-tabpanel-1" />
                <Tab
                  label="Confidence Filter"
                  id="document-viewer-tab-2"
                  aria-controls="document-viewer-tabpanel-2"
                />
              </Tabs>
              <Divider />

              <Box sx={{ p: 1.25, ...(embedded ? { flex: 1, minHeight: 0, overflowY: "auto" } : {}) }}>
                <TabPanel value={activeTab} index={0}>
                  <Stack spacing={1}>
                    {sortedGroupNames.length > 0 ? (
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 1,
                          pb: 0.75,
                          borderBottom: 1,
                          borderColor: "divider",
                        }}
                        role="list"
                        aria-label="Concept group legend"
                      >
                        {sortedGroupNames.map((groupName) => {
                          const family = GROUP_FAMILY_BY_NAME[groupName] || groupName;
                          const prefix = getGroupPrefix(groupName);
                          const color = highlightModel.groupColorByName[groupName] || DEFAULT_GROUP_COLOR;
                          return (
                            <Box
                              key={groupName}
                              role="listitem"
                              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                            >
                              <Box
                                aria-hidden="true"
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "2px",
                                  bgcolor: color,
                                  border: "1px solid rgba(0,0,0,0.2)",
                                  flexShrink: 0,
                                }}
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: "0.68rem" }}
                              >
                                <strong>{prefix}</strong> {family}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : null}
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Concepts in Document
                      </Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <ToggleButtonGroup
                          value={conceptGrouping}
                          exclusive
                          size="small"
                          onChange={(_, next) => { if (next) setConceptGrouping(next); }}
                          aria-label="Concept grouping"
                        >
                          <ToggleButton value="byLabel" aria-label="Group by label" sx={{ py: 0.25, px: 0.75, fontSize: "0.65rem", lineHeight: 1.4, textTransform: "none" }}>
                            By label
                          </ToggleButton>
                          <ToggleButton value="byGroup" aria-label="Group by type" sx={{ py: 0.25, px: 0.75, fontSize: "0.65rem", lineHeight: 1.4, textTransform: "none" }}>
                            By type
                          </ToggleButton>
                        </ToggleButtonGroup>
                        {selectedConceptIds.length > 0 ? (
                          <Button size="small" variant="outlined" onClick={clearConceptFilter}>
                            Clear
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>

                    {(() => {
                      const renderChip = (conceptRow, familyColor) => {
                        const isSelected = selectedConceptIdSet.has(conceptRow.conceptId);
                        const hasActiveFilter = selectedConceptIdSet.size > 0;
                        const isDimmed = hasActiveFilter && !isSelected;
                        const negationSummary = conceptNegationSummaryById.get(conceptRow.conceptId);
                        const allMentionsNegated = Boolean(
                          negationSummary &&
                            negationSummary.mentionCount > 0 &&
                            negationSummary.negatedCount === negationSummary.mentionCount
                        );
                        const conceptColor =
                          familyColor ?? highlightModel.groupColorByName[conceptRow.group] ?? DEFAULT_GROUP_COLOR;
                        return (
                          <Chip
                            key={conceptRow.conceptId}
                            size="small"
                            clickable
                            label={
                              <Box
                                component="span"
                                sx={{
                                  position: "relative",
                                  display: "inline-block",
                                  pr: allMentionsNegated ? 1.1 : 0,
                                }}
                              >
                                {`${getGroupPrefix(conceptRow.group)} · ${conceptRow.label} (${conceptRow.mentionCount})`}
                                {allMentionsNegated ? (
                                  <Box
                                    component="span"
                                    aria-hidden
                                    sx={{
                                      position: "absolute",
                                      top: -5,
                                      right: 0,
                                      color: "error.main",
                                      fontSize: 10,
                                      fontWeight: 700,
                                      lineHeight: 1,
                                    }}
                                  >
                                    °
                                  </Box>
                                ) : null}
                              </Box>
                            }
                            onClick={() => handleConceptToggle(conceptRow.conceptId)}
                            sx={{
                              backgroundColor: isDimmed ? DEFAULT_GROUP_COLOR : conceptColor,
                              border: isSelected ? "1.5px solid #333" : "1px solid rgba(0,0,0,0.2)",
                              fontWeight: isSelected ? 700 : 500,
                              opacity: isDimmed ? 0.55 : 1,
                              transition: "border-color 0.12s ease, border-width 0.12s ease",
                              "&.MuiChip-clickable:hover": {
                                backgroundColor: isDimmed ? DEFAULT_GROUP_COLOR : conceptColor,
                                opacity: isDimmed ? 0.55 : 1,
                                border: isSelected ? "2px solid #333" : "2px solid rgba(0,0,0,0.45)",
                              },
                              "&.MuiChip-clickable:focus-visible": {
                                backgroundColor: isDimmed ? DEFAULT_GROUP_COLOR : conceptColor,
                                opacity: isDimmed ? 0.55 : 1,
                                border: "2px solid #333",
                              },
                              "& .MuiChip-label": { px: 0.9 },
                            }}
                          />
                        );
                      };

                      if (conceptGrouping === "byGroup") {
                        return (
                          <Stack spacing={1.25}>
                            {conceptRowsByFamily.map(({ family, rows }) => (
                              <Box key={family}>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 700,
                                    color: "text.secondary",
                                    textTransform: "uppercase",
                                    fontSize: "0.62rem",
                                    letterSpacing: "0.05em",
                                    display: "block",
                                    mb: 0.5,
                                  }}
                                >
                                  {family}
                                </Typography>
                                <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                                  {rows.map((row) => renderChip(row, GROUP_FAMILY_COLOR[family] ?? DEFAULT_GROUP_COLOR))}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        );
                      }

                      return (
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                          {highlightModel.conceptRows.map((row) => renderChip(row))}
                        </Stack>
                      );
                    })()}
                  </Stack>
                </TabPanel>

                <TabPanel value={activeTab} index={1}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => setAllGroupsEnabled(true)}>
                        CHECK ALL
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => setAllGroupsEnabled(false)}>
                        UNCHECK ALL
                      </Button>
                    </Stack>

                    <Stack spacing={0.35}>
                      {sortedGroupNames.map((groupName) => (
                        <FormControlLabel
                          key={groupName}
                          control={
                            <Checkbox
                              size="small"
                              checked={Boolean(enabledGroupByName[groupName])}
                              onChange={(event) => handleGroupToggle(groupName, event.target.checked)}
                            />
                          }
                          label={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "3px",
                                  border: "1px solid",
                                  borderColor: "divider",
                                  backgroundColor:
                                    highlightModel.groupColorByName[groupName] || DEFAULT_GROUP_COLOR,
                                }}
                              />
                              <Typography variant="body2">{groupName}</Typography>
                            </Stack>
                          }
                          sx={{ mr: 0 }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </TabPanel>

                <TabPanel value={activeTab} index={2}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <FormControl>
                        <RadioGroup
                          row
                          value={confidenceMode}
                          onChange={(event) => setConfidenceMode(event.target.value)}
                        >
                          <FormControlLabel
                            value="byMention"
                            control={<Radio size="small" />}
                            label={<Typography variant="body2">By Mention</Typography>}
                          />
                          <FormControlLabel
                            value="byConcept"
                            control={<Radio size="small" />}
                            label={<Typography variant="body2">By Concept</Typography>}
                          />
                        </RadioGroup>
                      </FormControl>

                      <IconButton
                        size="small"
                        aria-label="Confidence filter mode help"
                        onClick={(event) => setHelpAnchorEl(event.currentTarget)}
                      >
                        <InfoOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>

                    <ConfidenceHistogram
                      buckets={confidenceHistogram}
                      groupNames={sortedGroupNames}
                      groupColorByName={highlightModel.groupColorByName}
                      mode={confidenceMode}
                      minConfidencePercent={minConfidencePercent}
                      onConfidenceChange={(nextValue) => setMinConfidencePercent(clamp(nextValue, 0, 100))}
                    />

                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Confidence: {minConfidencePercent}%
                    </Typography>
                  </Stack>
                </TabPanel>
              </Box>
            </Box>
          </Grid>

          <Grid
            item
            xs={12}
            md={8}
            sx={
              embedded
                ? {
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    height: "100%",
                    overflow: "hidden",
                    alignSelf: "stretch",
                  }
                : undefined
            }
          >
            {!(typeof document?.text === "string" && document.text.length > 0) ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This document payload does not include text. Mention overlays require full text.
              </Alert>
            ) : null}

            <Box
              ref={documentScrollRef}
              data-testid="patient-document-text-pane"
              onWheelCapture={(event) => {
                event.stopPropagation();
              }}
              onTouchMoveCapture={(event) => {
                event.stopPropagation();
              }}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
                minHeight: 280,
                ...(embedded ? { flex: 1, minHeight: 0, height: 0 } : {}),
                overflowY: "auto",
                overflowX: "hidden",
                overscrollBehavior: "contain",
                touchAction: "pan-y",
                bgcolor: "background.paper",
              }}
            >
              <Typography
                component="div"
                variant="body2"
                sx={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.8,
                  wordBreak: "break-word",
                  fontSize: "0.875rem",
                }}
              >
                {(() => {
                  const firstSelectedSegmentIndex =
                    selectedConceptIdSet.size > 0
                      ? highlightModel.segments.findIndex((seg) => seg.type === "mention")
                      : -1;
                  return highlightModel.segments.map((segment, index) => {
                  if (segment.type === "text") {
                    return <React.Fragment key={`text-${index}`}>{segment.text}</React.Fragment>;
                  }

                  const mention = segment.mention;
                  const color = highlightModel.groupColorByName[mention.group] || "#E5E7EB";
                  const isConceptSelected = selectedConceptIdSet.has(mention.conceptId);

                  return (
                    <Tooltip
                      key={`mention-${mention.mentionId}-${index}`}
                      title={`${mention.conceptLabel} • ${mention.group} • ${mention.confidencePercent}%${
                        mention.negated ? " • negated" : ""
                      }${mention.uncertain ? " • uncertain" : ""}${
                        mention.historic ? " • historic" : ""
                      }`}
                      placement="top"
                    >
                      <Box
                        component="button"
                        type="button"
                        onClick={() => handleConceptToggle(mention.conceptId)}
                        {...(index === firstSelectedSegmentIndex ? { "data-first-selected-mention": "" } : {})}
                        sx={{
                          mx: 0,
                          px: 0.25,
                          py: 0,
                          borderRadius: 0.5,
                          border: isConceptSelected ? "1.5px solid #333" : "1px solid transparent",
                          backgroundColor: color,
                          cursor: "pointer",
                          font: "inherit",
                          color: "inherit",
                          position: "relative",
                          display: "inline-block",
                        }}
                        aria-label={`Mention ${segment.text}. Concept ${mention.conceptLabel}`}
                      >
                        {segment.text}
                        {mention.negated ? (
                          <Box
                            component="span"
                            aria-hidden
                            sx={{
                              position: "absolute",
                              top: -6,
                              right: -5,
                              color: "error.main",
                              fontSize: 10,
                              fontWeight: 700,
                              lineHeight: 1,
                            }}
                          >
                            °
                          </Box>
                        ) : null}
                      </Box>
                    </Tooltip>
                  );
                });
                })()}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>

      <Popover
        open={openHelpPopover}
        anchorEl={helpAnchorEl}
        onClose={() => setHelpAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 1.25, maxWidth: 260 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Confidence Modes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            By Mention counts every mention in each confidence bucket. By Concept counts each concept once, using
            the highest-confidence mention for that concept.
          </Typography>
        </Box>
      </Popover>
    </Card>
  );
}

PatientDocumentViewerCard.propTypes = {
  document: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    text: PropTypes.string,
    mentions: PropTypes.arrayOf(PropTypes.object),
  }),
  concepts: PropTypes.arrayOf(PropTypes.object),
  factSelection: PropTypes.shape({
    factId: PropTypes.string,
    conceptIds: PropTypes.arrayOf(PropTypes.string),
  }),
  embedded: PropTypes.bool,
  selectionContext: PropTypes.shape({
    source: PropTypes.oneOf(["auto", "timeline", "fact", "related-document"]),
    documentType: PropTypes.string,
    documentDate: PropTypes.string,
    episodeLabel: PropTypes.string,
    categoryName: PropTypes.string,
    prettyName: PropTypes.string,
    isTumorLevel: PropTypes.bool,
    cancerIndex: PropTypes.number,
    tumorIndex: PropTypes.number,
  }),
};
