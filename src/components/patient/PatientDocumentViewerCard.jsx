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
  Slider,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import {
  buildConfidenceHistogram,
  buildMentionHighlightModel,
} from "../../utils/patientView/documentMentions";
import SectionCollapseToggle from "./SectionCollapseToggle";

const DEFAULT_GROUP_COLOR = "#e0e0e0";
const MIN_CONFIDENCE_PERCENT = 50;
const MAX_CONFIDENCE_PERCENT = 100;
const CONFIDENCE_STEP_PERCENT = 5;

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

const GROUP_FAMILY_COLOR = {
  Anatomy: "#99E6E6",
  Device: "#785ef0",
  Finding: "#ffbcdd",
  Disorder: "#7fce94",
  Severity: "#ff8712",
  Attribute: "#ffef00",
  Intervention: "#ca99f4",
};

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

function humanizeMetadataKey(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatMetadataValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => formatMetadataValue(item)).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }
  return String(value ?? "").trim();
}

function buildConfidenceSummary(mentionRecords = []) {
  const confidenceValues = mentionRecords
    .map((record) => Number(record?.confidencePercent))
    .filter(Number.isFinite);
  if (confidenceValues.length === 0) {
    return "Unknown";
  }

  const highest = Math.max(...confidenceValues);
  const lowest = Math.min(...confidenceValues);
  if (highest === lowest) {
    return `${highest}%`;
  }

  const average = Math.round(
    confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
  );
  return `${highest}% highest · ${average}% average · ${lowest}–${highest}% range`;
}

function ConceptMetadataRow({ label, value }) {
  if (!String(value ?? "").trim()) {
    return null;
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "112px minmax(0, 1fr)", gap: 1 }}>
      <Typography component="dt" variant="caption" sx={{ m: 0, fontWeight: 700, color: "inherit" }}>
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="caption"
        sx={{ m: 0, color: "inherit", overflowWrap: "anywhere" }}
      >
        {value}
      </Typography>
    </Box>
  );
}

ConceptMetadataRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function ConceptDetailsTooltip({ conceptRow, concept = {}, mentionRecords = [], documentText = "" }) {
  const conceptName = String(concept?.name || "").trim();
  const preferredText = String(concept?.preferredText || "").trim();
  const confidenceSummary = buildConfidenceSummary(mentionRecords);
  const handledKeys = new Set([
    "id",
    "name",
    "preferredText",
    "classUri",
    "dpheGroup",
    "mentionIds",
    "confidence",
    "negated",
    "uncertain",
    "historic",
  ]);
  const additionalMetadata = Object.entries(concept || {})
    .filter(([key, value]) => {
      if (handledKeys.has(key) || value == null) {
        return false;
      }
      return Boolean(formatMetadataValue(value));
    })
    .map(([key, value]) => ({
      key,
      label: humanizeMetadataKey(key),
      value: formatMetadataValue(value),
    }));

  return (
    <Box sx={{ width: "min(480px, 80vw)", py: 0.25 }} data-testid="concept-details-tooltip">
      <Typography variant="subtitle2" sx={{ color: "inherit", fontWeight: 700, mb: 0.75 }}>
        {conceptRow.label}
      </Typography>
      <Box component="dl" sx={{ m: 0, display: "grid", gap: 0.35 }}>
        <ConceptMetadataRow label="Name" value={conceptName || conceptRow.label} />
        {preferredText && preferredText !== conceptName ? (
          <ConceptMetadataRow label="Preferred text" value={preferredText} />
        ) : null}
        <ConceptMetadataRow label="Concept type" value={conceptRow.group || "Unknown"} />
        <ConceptMetadataRow label="Confidence" value={confidenceSummary} />
        <ConceptMetadataRow label="Mentions" value={conceptRow.mentionCount} />
        <ConceptMetadataRow label="Concept ID" value={conceptRow.conceptId} />
        <ConceptMetadataRow label="Class URI" value={conceptRow.classUri} />
        {additionalMetadata.map((entry) => (
          <ConceptMetadataRow key={entry.key} label={entry.label} value={entry.value} />
        ))}
      </Box>

      {mentionRecords.length > 0 ? (
        <Box sx={{ mt: 1 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.3)", mb: 0.75 }} />
          <Typography variant="caption" sx={{ color: "inherit", fontWeight: 700 }}>
            Linked mentions
          </Typography>
          <Stack spacing={0.75} sx={{ mt: 0.5 }}>
            {mentionRecords.map((mention, index) => {
              const mentionText = String(documentText || "")
                .slice(mention.begin, mention.end)
                .replace(/\s+/g, " ")
                .trim();
              const assertionState = [
                mention.negated ? "Negated" : "Affirmed",
                mention.uncertain ? "Uncertain" : "Certain",
                mention.historic ? "Historic" : "Current",
              ].join(" · ");

              return (
                <Box
                  key={mention.mentionId || `${conceptRow.conceptId}-${index}`}
                  sx={{ pl: 1, borderLeft: "2px solid rgba(255,255,255,0.45)" }}
                >
                  <Typography variant="caption" sx={{ display: "block", color: "inherit", fontWeight: 700 }}>
                    {`${index + 1}. ${mentionText || "Mention"} — ${mention.confidencePercent}%`}
                  </Typography>
                  <Typography variant="caption" sx={{ display: "block", color: "inherit" }}>
                    {assertionState}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", color: "inherit", opacity: 0.85, overflowWrap: "anywhere" }}
                  >
                    {`Offsets ${mention.begin}–${mention.end} · ID ${mention.mentionId}`}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}

ConceptDetailsTooltip.propTypes = {
  conceptRow: PropTypes.shape({
    conceptId: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    classUri: PropTypes.string,
    group: PropTypes.string,
    mentionCount: PropTypes.number,
  }).isRequired,
  concept: PropTypes.object,
  mentionRecords: PropTypes.arrayOf(PropTypes.object),
  documentText: PropTypes.string,
};

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
  minConfidencePercent = MIN_CONFIDENCE_PERCENT,
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
  const visibleBuckets = useMemo(
    () =>
      buckets.filter(
        (bucket) => Number(bucket?.binEnd) * 100 > MIN_CONFIDENCE_PERCENT
      ),
    [buckets]
  );

  const sortedGroupNames = useMemo(() => {
    const nextNames = new Set(groupNames);
    visibleBuckets.forEach((bucket) => {
      Object.keys(bucket?.[valueKey] || {}).forEach((groupName) => {
        if (groupName) {
          nextNames.add(groupName);
        }
      });
    });
    return sortGroupNames([...nextNames]);
  }, [groupNames, valueKey, visibleBuckets]);

  const bucketTotals = useMemo(
    () =>
      visibleBuckets.map((bucket) =>
        sortedGroupNames.reduce((sum, groupName) => sum + Number(bucket?.[valueKey]?.[groupName] || 0), 0)
      ),
    [sortedGroupNames, valueKey, visibleBuckets]
  );

  const maxOccurrences = Math.max(1, ...bucketTotals);
  const bucketWidth = plotWidth / Math.max(1, visibleBuckets.length || 1);
  const barWidth = Math.max(3, bucketWidth - 3);
  const confidenceRange = MAX_CONFIDENCE_PERCENT - MIN_CONFIDENCE_PERCENT;
  const normalizedThreshold =
    (clamp(
      minConfidencePercent,
      MIN_CONFIDENCE_PERCENT,
      MAX_CONFIDENCE_PERCENT
    ) -
      MIN_CONFIDENCE_PERCENT) /
    confidenceRange;
  const thresholdX = plotLeft + normalizedThreshold * plotWidth;

  const readPercentFromClientX = useCallback(
    (clientX) => {
      const containerRect = chartRef.current?.getBoundingClientRect();
      if (!containerRect || containerRect.width <= 0) {
        return clamp(
          minConfidencePercent,
          MIN_CONFIDENCE_PERCENT,
          MAX_CONFIDENCE_PERCENT
        );
      }

      const svgX = ((clientX - containerRect.left) / containerRect.width) * chartWidth;
      const clampedX = clamp(svgX, plotLeft, plotLeft + plotWidth);
      const ratio = (clampedX - plotLeft) / plotWidth;
      const confidencePercent = MIN_CONFIDENCE_PERCENT + ratio * confidenceRange;
      return (
        Math.round(confidencePercent / CONFIDENCE_STEP_PERCENT) *
        CONFIDENCE_STEP_PERCENT
      );
    },
    [chartWidth, confidenceRange, minConfidencePercent, plotLeft, plotWidth]
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

          {visibleBuckets.map((bucket, bucketIndex) => {
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

              </g>
            );
          })}

          {Array.from({ length: visibleBuckets.length + 1 }, (_unused, index) => {
            const x = plotLeft + index * bucketWidth;
            const label =
              index === 0
                ? `${MIN_CONFIDENCE_PERCENT}%`
                : visibleBuckets[index - 1]?.bucket;

            return (
              <g key={`confidence-tick-${label}`}>
                <line
                  x1={x}
                  y1={plotTop + plotHeight}
                  x2={x}
                  y2={plotTop + plotHeight + 4}
                  stroke="#8f8f8f"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={plotTop + plotHeight + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {label}
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

    case "summary": {
      push("Patient summary", "muted");
      if (context.categoryName) push(context.categoryName, "meta");
      if (context.prettyName) push(context.prettyName, "strong");
      if (context.documentType) push(formatDocumentType(context.documentType), "meta");
      if (context.documentDate) push(context.documentDate, "meta");
      const rawConfidence = Number(context.documentConfidence);
      const confidenceText =
        Number.isFinite(rawConfidence) && rawConfidence > 0
          ? `${Math.round((rawConfidence > 1 ? rawConfidence / 100 : rawConfidence) * 100)}% confidence`
          : "";
      const sourcesText = Number(context.documentCount) > 1 ? `${context.documentCount} sources` : "";
      const summaryTail = [confidenceText, sourcesText].filter(Boolean).join(" · ");
      if (summaryTail) push(summaryTail, "muted");
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
    source: PropTypes.oneOf(["auto", "timeline", "fact", "related-document", "summary"]),
    documentType: PropTypes.string,
    documentDate: PropTypes.string,
    episodeLabel: PropTypes.string,
    categoryName: PropTypes.string,
    prettyName: PropTypes.string,
    isTumorLevel: PropTypes.bool,
    cancerIndex: PropTypes.number,
    tumorIndex: PropTypes.number,
    documentCount: PropTypes.number,
    documentConfidence: PropTypes.number,
  }),
};

export default function PatientDocumentViewerCard({
  document = null,
  concepts = [],
  factSelection = null,
  embedded = false,
  selectionContext = null,
  onClose = undefined,
  confidenceThreshold: controlledConfidenceThreshold = undefined,
  onConfidenceThresholdChange = undefined,
  expanded = true,
  onToggleExpanded = undefined,
  collapsiblePanelId = undefined,
  sectionLabel = "Document Viewer",
}) {
  const theme = useTheme();
  // The concept/filter column is a secondary control surface. On narrow screens
  // it stacks above the report text and buries it, so let the reader collapse it
  // to a header there. On md+ it stays as the fixed left column.
  const isConceptColumnCollapsible = useMediaQuery(theme.breakpoints.down("md"));
  const [isConceptColumnCollapsed, setIsConceptColumnCollapsed] = useState(false);
  const isConceptColumnExpanded = !isConceptColumnCollapsible || !isConceptColumnCollapsed;
  const NO_ENABLED_GROUP_SENTINEL = "__NO_ENABLED_GROUPS__";
  const [activeTab, setActiveTab] = useState(0);
  const [internalMinConfidencePercent, setInternalMinConfidencePercent] = useState(100);
  const hasControlledConfidenceThreshold = Number.isFinite(
    Number(controlledConfidenceThreshold)
  );
  const minConfidencePercent = hasControlledConfidenceThreshold
    ? clamp(
        Number(controlledConfidenceThreshold),
        MIN_CONFIDENCE_PERCENT,
        MAX_CONFIDENCE_PERCENT
      )
    : internalMinConfidencePercent;
  const handleConfidenceThresholdChange = useCallback(
    (nextValue) => {
      const normalizedValue = clamp(
        Number(nextValue) || MIN_CONFIDENCE_PERCENT,
        MIN_CONFIDENCE_PERCENT,
        MAX_CONFIDENCE_PERCENT
      );
      if (!hasControlledConfidenceThreshold) {
        setInternalMinConfidencePercent(normalizedValue);
      }
      onConfidenceThresholdChange?.(normalizedValue);
    },
    [hasControlledConfidenceThreshold, onConfidenceThresholdChange]
  );
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
      if (embedded) {
        firstMention.scrollIntoView?.({ block: "center", behavior: "smooth" });
        return;
      }

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
  }, [embedded, selectedConceptIds]);

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

  const conceptDetailsById = useMemo(() => {
    const detailsById = new Map();
    highlightModel.conceptsInDocument.forEach((concept) => {
      const conceptId = String(concept?.id || "").trim();
      if (conceptId) {
        detailsById.set(conceptId, { concept, mentionRecords: [] });
      }
    });
    highlightModel.mentionRecords.forEach((mentionRecord) => {
      const conceptId = String(mentionRecord?.conceptId || "").trim();
      if (!conceptId) {
        return;
      }
      const details = detailsById.get(conceptId) || { concept: {}, mentionRecords: [] };
      details.mentionRecords.push(mentionRecord);
      detailsById.set(conceptId, details);
    });
    return detailsById;
  }, [highlightModel.conceptsInDocument, highlightModel.mentionRecords]);

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
    ? {
        border: 0,
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        height: "auto",
        overflow: "visible",
      }
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
    <Card elevation={0} sx={cardSx} data-testid="patient-document-viewer-card">
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
        action={
          <Stack direction="row" spacing={0.5} alignItems="center">
            {onToggleExpanded ? (
              <SectionCollapseToggle
                expanded={expanded}
                onToggle={onToggleExpanded}
                label={sectionLabel}
                panelId={collapsiblePanelId}
              />
            ) : null}
            {onClose ? (
              <Tooltip title="Close document">
                <IconButton size="small" aria-label="Close document" onClick={onClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        }
      />
      {expanded ? (
        <>
      <Divider />
      <CardContent
        id={collapsiblePanelId}
        sx={
          embedded
            ? {
                display: "flex",
                flexDirection: "column",
                overflow: "visible",
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
          sx={embedded ? { overflow: "visible", alignItems: "flex-start" } : undefined}
        >
          <Grid
            item
            xs={12}
            md={4}
            sx={
              embedded && isConceptColumnExpanded
                ? {
                    display: "flex",
                    flexDirection: "column",
                    overflow: "visible",
                    alignSelf: "flex-start",
                  }
                : undefined
            }
          >
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {isConceptColumnCollapsible ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.25,
                    py: 0.5,
                    ...(isConceptColumnExpanded
                      ? { borderBottom: 1, borderColor: "divider" }
                      : {}),
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Concepts &amp; Filters
                  </Typography>
                  <SectionCollapseToggle
                    expanded={isConceptColumnExpanded}
                    onToggle={() => setIsConceptColumnCollapsed((previous) => !previous)}
                    label="Concepts and Filters"
                    panelId={collapsiblePanelId ? `${collapsiblePanelId}-concepts` : undefined}
                  />
                </Box>
              ) : null}
              {isConceptColumnExpanded ? (
                <Box
                  id={collapsiblePanelId ? `${collapsiblePanelId}-concepts` : undefined}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                  }}
                >
              <Box sx={{ px: 1.25, py: 0.75, borderBottom: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography component="span" sx={{ fontSize: "inherit", whiteSpace: "nowrap" }}>
                    Confidence:{" "}
                    <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
                      50%
                    </Box>
                  </Typography>
                  <Slider
                    size="small"
                    value={minConfidencePercent}
                    min={MIN_CONFIDENCE_PERCENT}
                    max={MAX_CONFIDENCE_PERCENT}
                    step={CONFIDENCE_STEP_PERCENT}
                    onChange={(_event, value) =>
                      handleConfidenceThresholdChange(Array.isArray(value) ? value[0] : value)
                    }
                    aria-label="Document viewer confidence percent"
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                    sx={{ flex: 1, minWidth: 72 }}
                  />
                  <Typography
                    component="span"
                    aria-hidden
                    sx={{
                      minWidth: 34,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: "text.secondary",
                    }}
                  >
                    100%
                  </Typography>
                </Stack>
              </Box>
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

              <Box sx={{ p: 1.25, ...(embedded ? { overflow: "visible" } : {}) }}>
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
                                {groupName}
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
                        const conceptDetails = conceptDetailsById.get(conceptRow.conceptId) || {
                          concept: {},
                          mentionRecords: [],
                        };
                        const confidenceSummary = buildConfidenceSummary(conceptDetails.mentionRecords);
                        return (
                          <Tooltip
                            key={conceptRow.conceptId}
                            arrow
                            describeChild
                            enterDelay={250}
                            placement="right-start"
                            title={
                              <ConceptDetailsTooltip
                                conceptRow={conceptRow}
                                concept={conceptDetails.concept}
                                mentionRecords={conceptDetails.mentionRecords}
                                documentText={document?.text || ""}
                              />
                            }
                            slotProps={{
                              tooltip: {
                                sx: {
                                  maxWidth: "none",
                                  maxHeight: "70vh",
                                  overflowY: "auto",
                                  p: 1.25,
                                },
                              },
                            }}
                          >
                            <Chip
                              size="small"
                              clickable
                              aria-label={`${conceptRow.label}. ${conceptRow.group}. Confidence ${confidenceSummary}. ${conceptRow.mentionCount} linked mention${conceptRow.mentionCount === 1 ? "" : "s"}.`}
                              label={
                                <Box
                                  component="span"
                                  sx={{
                                    position: "relative",
                                    display: "inline-block",
                                    pr: allMentionsNegated ? 1.1 : 0,
                                  }}
                                >
                                  {`${conceptRow.label} (${conceptRow.mentionCount})`}
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
                          </Tooltip>
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
                      onConfidenceChange={handleConfidenceThresholdChange}
                    />

                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Confidence: {minConfidencePercent}%
                    </Typography>
                  </Stack>
                </TabPanel>
              </Box>
                </Box>
              ) : null}
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
                    overflow: "visible",
                    alignSelf: "flex-start",
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
              {...(!embedded
                ? {
                    onWheelCapture: (event) => event.stopPropagation(),
                    onTouchMoveCapture: (event) => event.stopPropagation(),
                  }
                : {})}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
                minHeight: 280,
                ...(embedded ? { height: "auto" } : {}),
                overflowY: embedded ? "visible" : "auto",
                overflowX: "hidden",
                overscrollBehavior: embedded ? "auto" : "contain",
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
        </>
      ) : null}
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
  onClose: PropTypes.func,
  confidenceThreshold: PropTypes.number,
  onConfidenceThresholdChange: PropTypes.func,
  selectionContext: PropTypes.shape({
    source: PropTypes.oneOf(["auto", "timeline", "fact", "related-document", "summary"]),
    documentType: PropTypes.string,
    documentDate: PropTypes.string,
    episodeLabel: PropTypes.string,
    categoryName: PropTypes.string,
    prettyName: PropTypes.string,
    isTumorLevel: PropTypes.bool,
    cancerIndex: PropTypes.number,
    tumorIndex: PropTypes.number,
    documentCount: PropTypes.number,
    documentConfidence: PropTypes.number,
  }),
  expanded: PropTypes.bool,
  onToggleExpanded: PropTypes.func,
  collapsiblePanelId: PropTypes.string,
  sectionLabel: PropTypes.string,
};
