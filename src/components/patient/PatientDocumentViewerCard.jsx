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

export default function PatientDocumentViewerCard({
  document = null,
  concepts = [],
  factSelection = null,
}) {
  const NO_ENABLED_GROUP_SENTINEL = "__NO_ENABLED_GROUPS__";
  const [activeTab, setActiveTab] = useState(0);
  const [minConfidencePercent, setMinConfidencePercent] = useState(0);
  const [enabledGroupByName, setEnabledGroupByName] = useState({});
  const [selectedConceptIds, setSelectedConceptIds] = useState([]);
  const [confidenceMode, setConfidenceMode] = useState("byMention");
  const [helpAnchorEl, setHelpAnchorEl] = useState(null);

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

  if (!document) {
    return (
      <Card elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        <CardHeader
          title="Document Viewer"
          titleTypographyProps={{ variant: "h6", sx: { fontWeight: 700 } }}
        />
        <Divider />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Select a document from the timeline to view text mentions and concept overlays.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      <CardHeader
        title="Document Viewer"
        subheader={document?.name || document?.id}
        titleTypographyProps={{ variant: "h6", sx: { fontWeight: 700 } }}
        subheaderTypographyProps={{ variant: "body2", color: "text.secondary" }}
      />
      <Divider />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                minHeight: 360,
                display: "flex",
                flexDirection: "column",
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

              <Box sx={{ p: 1.25 }}>
                <TabPanel value={activeTab} index={0}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Concepts in Document
                      </Typography>
                      {selectedConceptIds.length > 0 ? (
                        <Button size="small" variant="outlined" onClick={clearConceptFilter}>
                          Clear
                        </Button>
                      ) : null}
                    </Stack>

                    <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                      {highlightModel.conceptRows.map((conceptRow) => {
                        const isSelected = selectedConceptIdSet.has(conceptRow.conceptId);
                        const negationSummary = conceptNegationSummaryById.get(conceptRow.conceptId);
                        const allMentionsNegated = Boolean(
                          negationSummary &&
                            negationSummary.mentionCount > 0 &&
                            negationSummary.negatedCount === negationSummary.mentionCount
                        );
                        const conceptColor =
                          highlightModel.groupColorByName[conceptRow.group] || DEFAULT_GROUP_COLOR;

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
                              backgroundColor: conceptColor,
                              border: isSelected ? "1.5px solid #333" : "1px solid rgba(0,0,0,0.2)",
                              fontWeight: isSelected ? 700 : 500,
                              "& .MuiChip-label": { px: 0.9 },
                            }}
                          />
                        );
                      })}
                    </Stack>
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

          <Grid item xs={12} md={8}>
            {!(typeof document?.text === "string" && document.text.length > 0) ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This document payload does not include text. Mention overlays require full text.
              </Alert>
            ) : null}

            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
                minHeight: 280,
                maxHeight: 560,
                overflow: "auto",
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
                {highlightModel.segments.map((segment, index) => {
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
                })}
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
};
