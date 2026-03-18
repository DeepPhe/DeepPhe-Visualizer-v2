import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  IconButton,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { BarChart } from "@mui/x-charts/BarChart";
import { Link as RouterLink } from "react-router-dom";
import {
  getClasses as getAttributeClasses,
  getInstances as getAttributeInstances,
} from "../controllers/attributes";
import {
  getClasses as getConceptClasses,
  getInstances as getConceptInstances,
} from "../controllers/concepts";
import {
  getClasses as getCancerClasses,
  getInstances as getCancerInstances,
} from "../controllers/cancers";
import {
  getClasses as getOmopClasses,
  getInstances as getOmopInstances,
} from "../controllers/omap";

const AGE_AT_DX_ATTRIBUTE = "AGE_AT_DX";
const AGE_DECILE_LABELS = [
  "0-9",
  "10-19",
  "20-29",
  "30-39",
  "40-49",
  "50-59",
  "60-69",
  "70-79",
  "80-89",
  "90+",
];
const MAX_BAR_CHART_VALUES = 12;
const CARD_GRID_TEMPLATE_COLUMNS = "repeat(auto-fit, minmax(240px, 1fr))";
const DEFAULT_SECTION_STATE = {
  omop: false,
  attributes: false,
  concepts: false,
  cancers: false,
};

const VALUE_FIELDS_BY_ATTRIBUTE = {
  [AGE_AT_DX_ATTRIBUTE]: ["age_at_dx", "value", "age"],
  ETHNICITY: ["ethnicity", "value"],
  GENDER: ["gender", "value"],
  RACE: ["race", "value"],
  CANCER: ["cancer", "value", "classUri"],
};

const COUNT_FIELDS = [
  "count",
  "patient_count",
  "patientCount",
  "num_patients",
  "frequency",
];

const asRowArray = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
};

const getValueFromRow = (attribute, row) => {
  const normalizedAttribute = String(attribute || "").toUpperCase();
  const candidateFields = VALUE_FIELDS_BY_ATTRIBUTE[normalizedAttribute] || [
    "value",
    "label",
    "name",
    "classUri",
  ];

  for (const field of candidateFields) {
    const value = row?.[field];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return undefined;
};

const getCountFromRow = (row) => {
  for (const field of COUNT_FIELDS) {
    const rawCount = row?.[field];
    if (rawCount === undefined || rawCount === null || rawCount === "") {
      continue;
    }

    const parsedCount = Number(rawCount);
    if (Number.isFinite(parsedCount)) {
      return parsedCount;
    }
  }

  const patientIdsRaw = row?.patient_ids;
  if (Array.isArray(patientIdsRaw)) {
    return patientIdsRaw.length;
  }
  if (typeof patientIdsRaw === "string" && patientIdsRaw.trim()) {
    return patientIdsRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean).length;
  }

  return 1;
};

const summarizeInstances = (attribute, payload) => {
  const rows = asRowArray(payload);
  const countsByValue = new Map();

  rows.forEach((row) => {
    const value = getValueFromRow(attribute, row);
    if (!value) {
      return;
    }
    const count = getCountFromRow(row);
    countsByValue.set(value, (countsByValue.get(value) || 0) + count);
  });

  return [...countsByValue.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};

const getAgeDecileLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return undefined;
  }

  const rangeMatch = text.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    if (Number.isFinite(start)) {
      const decileStart = Math.floor(start / 10) * 10;
      return decileStart >= 90 ? "90+" : `${decileStart}-${decileStart + 9}`;
    }
  }

  const plusMatch = text.match(/^(\d+)\+$/);
  if (plusMatch) {
    const start = Number(plusMatch[1]);
    if (Number.isFinite(start)) {
      const decileStart = Math.floor(start / 10) * 10;
      return decileStart >= 90 ? "90+" : `${decileStart}-${decileStart + 9}`;
    }
  }

  const firstNumberMatch = text.match(/\d+/);
  if (!firstNumberMatch) {
    return undefined;
  }

  const age = Number(firstNumberMatch[0]);
  if (!Number.isFinite(age)) {
    return undefined;
  }

  const decileStart = Math.floor(age / 10) * 10;
  return decileStart >= 90 ? "90+" : `${decileStart}-${decileStart + 9}`;
};

const getAgeDecileDistribution = (summary = []) => {
  const totalsByDecile = new Map(AGE_DECILE_LABELS.map((label) => [label, 0]));

  summary.forEach((item) => {
    const label = getAgeDecileLabel(item?.value);
    if (!label || !totalsByDecile.has(label)) {
      return;
    }

    const itemCount = Number(item?.count);
    const safeCount = Number.isFinite(itemCount) ? itemCount : 0;
    totalsByDecile.set(label, totalsByDecile.get(label) + safeCount);
  });

  return AGE_DECILE_LABELS.map((label) => ({
    label,
    count: totalsByDecile.get(label) || 0,
  }));
};

const getCategoryDistribution = (summary = []) => {
  return summary
    .map((item) => ({
      label: String(item?.value || ""),
      count: Number(item?.count) || 0,
    }))
    .filter((item) => item.label);
};

const getSummaryTotalCount = (summary = []) => {
  return summary.reduce((total, item) => total + (Number(item?.count) || 0), 0);
};

const sortDistributionAlphanumerically = (distribution = []) => {
  return [...distribution].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
  );
};

const getAnchorId = (sectionKey, value) => {
  const normalizedSection = String(sectionKey || "").toLowerCase();
  const normalizedValue = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalizedSection}-${normalizedValue || "item"}`;
};

function FilterableValueCountTable({ rows, valueHeader = "Value", maxHeight = 280 }) {
  const uniqueLabels = sortDistributionAlphanumerically(rows).map((item) => item.label);
  const [searchText, setSearchText] = useState("");
  const [selectedValue, setSelectedValue] = useState("ALL");
  const [sortField, setSortField] = useState("value");
  const [sortDirection, setSortDirection] = useState("asc");
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const label = String(row?.label || "");
    const passesDropdown = selectedValue === "ALL" || label === selectedValue;
    const passesSearch = label.toLowerCase().includes(normalizedSearch);
    return passesDropdown && passesSearch;
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortField === "count") {
      const countDifference = (Number(a?.count) || 0) - (Number(b?.count) || 0);
      if (countDifference !== 0) {
        return sortDirection === "asc" ? countDifference : -countDifference;
      }
    }

    const labelComparison = String(a?.label || "").localeCompare(String(b?.label || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (sortField === "value") {
      return sortDirection === "asc" ? labelComparison : -labelComparison;
    }

    return labelComparison;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "count" ? "desc" : "asc");
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
        <TextField
          select
          size="small"
          variant="outlined"
          label="Filter"
          value={selectedValue}
          onChange={(event) => setSelectedValue(event.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 200 } }}
        >
          <MenuItem value="ALL">All values</MenuItem>
          {uniqueLabels.map((label) => (
            <MenuItem key={label} value={label}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          variant="outlined"
          label="Search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Type to filter (e.g. etas)"
          fullWidth
        />
        <IconButton
          onClick={() => setIsExpanded((previous) => !previous)}
          aria-label={isExpanded ? "Collapse list" : "Expand list"}
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>
      <TableContainer
        sx={{
          maxHeight: isExpanded ? "none" : maxHeight,
          overflow: isExpanded ? "visible" : "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.paper",
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "text.secondary" }}>
                <TableSortLabel
                  active={sortField === "value"}
                  direction={sortField === "value" ? sortDirection : "asc"}
                  onClick={() => handleSort("value")}
                >
                  {valueHeader}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ color: "text.secondary" }}>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <TableSortLabel
                    active={sortField === "count"}
                    direction={sortField === "count" ? sortDirection : "desc"}
                    onClick={() => handleSort("count")}
                  >
                    Count
                  </TableSortLabel>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.length > 0 ? (
              sortedRows.map((item) => (
                <TableRow
                  id={item.id || undefined}
                  key={`${item.label}:${item.count}`}
                  sx={{ "&:nth-of-type(odd)": { bgcolor: "action.hover" } }}
                >
                  <TableCell sx={{ maxWidth: 320, wordBreak: "break-word", color: "text.primary" }}>
                    {item.label}
                  </TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>
                    {Number(item.count).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="body2" color="text.secondary">
                    No matching values.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function SectionJumpLinks({ sectionKey, values, onJump }) {
  if (!values || values.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        columnGap: 1,
        rowGap: 0.5,
      }}
    >
      {values.map((value) => {
        const label = String(value);
        const targetId = getAnchorId(sectionKey, label);

        return (
          <MuiLink
            key={`${sectionKey}:${label}`}
            href={`#${targetId}`}
            underline="hover"
            variant="body2"
            sx={{ color: "text.secondary" }}
            onClick={onJump(sectionKey, label)}
          >
            {label}
          </MuiLink>
        );
      })}
    </Box>
  );
}

function SectionTitle({ title, accent = false }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      {accent ? (
        <Box
          sx={{
            width: 4,
            height: 24,
            borderRadius: 1,
            bgcolor: "primary.main",
            flexShrink: 0,
          }}
        />
      ) : null}
      <Typography variant="h5" component="h2" color="text.primary">
        {title}
      </Typography>
    </Box>
  );
}

function SummaryChart({ distribution }) {
  const theme = useTheme();
  const sortedDistribution = sortDistributionAlphanumerically(distribution);

  if (sortedDistribution.length > MAX_BAR_CHART_VALUES) {
    return <FilterableValueCountTable rows={sortedDistribution} />;
  }

  return (
    <BarChart
      height={260}
      grid={{ horizontal: true }}
      yAxis={[
        {
          width: 84,
          tickLabelStyle: {
            fontSize: 12,
            fill: theme.palette.text.secondary,
          },
          valueFormatter: (value) => Number(value).toLocaleString(),
        },
      ]}
      xAxis={[
        {
          scaleType: "band",
          data: sortedDistribution.map((item) => item.label),
          tickLabelStyle: {
            angle: -35,
            textAnchor: "end",
            fontSize: 12,
            fill: theme.palette.text.secondary,
          },
        },
      ]}
      series={[
        {
          data: sortedDistribution.map((item) => item.count),
          color: alpha(theme.palette.primary.main, 0.85),
        },
      ]}
      margin={{ top: 16, right: 12, bottom: 86, left: 88 }}
      sx={{
        ".MuiChartsGrid-line": {
          stroke: theme.palette.grey[300],
          strokeDasharray: "4 4",
        },
      }}
    />
  );
}

function DebugView() {
  const [omopClasses, setOmopClasses] = useState([]);
  const [omopSummaryByClass, setOmopSummaryByClass] = useState({});
  const [omopErrorsByClass, setOmopErrorsByClass] = useState({});
  const [isOmopLoading, setIsOmopLoading] = useState(true);
  const [omopErrorMessage, setOmopErrorMessage] = useState("");

  const [attributeClasses, setAttributeClasses] = useState([]);
  const [attributeSummaryByClass, setAttributeSummaryByClass] = useState({});
  const [attributeErrorsByClass, setAttributeErrorsByClass] = useState({});
  const [isAttributesLoading, setIsAttributesLoading] = useState(true);
  const [attributesErrorMessage, setAttributesErrorMessage] = useState("");
  const [conceptClasses, setConceptClasses] = useState([]);
  const [conceptSummaryByClass, setConceptSummaryByClass] = useState({});
  const [conceptErrorsByClass, setConceptErrorsByClass] = useState({});
  const [isConceptsLoading, setIsConceptsLoading] = useState(true);
  const [conceptsErrorMessage, setConceptsErrorMessage] = useState("");
  const [cancerClasses, setCancerClasses] = useState([]);
  const [cancerSummaryByClass, setCancerSummaryByClass] = useState({});
  const [cancerErrorsByClass, setCancerErrorsByClass] = useState({});
  const [isCancersLoading, setIsCancersLoading] = useState(true);
  const [cancersErrorMessage, setCancersErrorMessage] = useState("");
  const [expandedSections, setExpandedSections] = useState(DEFAULT_SECTION_STATE);
  const [isSectionTogglePending, setIsSectionTogglePending] = useState(DEFAULT_SECTION_STATE);

  useEffect(() => {
    let isActive = true;

    const loadOmop = async () => {
      setIsOmopLoading(true);
      setOmopErrorMessage("");

      try {
        const result = await getOmopClasses();
        const classList = Array.isArray(result) ? result : [];
        const instanceResults = await Promise.allSettled(
          classList.map(async (className) => {
            const instances = await getOmopInstances(className);
            return {
              className,
              summary: summarizeInstances(className, instances),
            };
          })
        );

        const nextSummaryByClass = {};
        const nextErrorsByClass = {};

        instanceResults.forEach((callResult, index) => {
          const className = String(classList[index]);
          if (callResult.status === "fulfilled") {
            nextSummaryByClass[className] = callResult.value.summary;
            return;
          }
          nextErrorsByClass[className] =
            callResult.reason?.message || "Failed to load OMOP instances.";
        });

        if (isActive) {
          setOmopClasses(classList);
          setOmopSummaryByClass(nextSummaryByClass);
          setOmopErrorsByClass(nextErrorsByClass);
        }
      } catch (error) {
        if (isActive) {
          setOmopErrorMessage(error?.message || "Failed to load OMOP classes.");
        }
      } finally {
        if (isActive) {
          setIsOmopLoading(false);
        }
      }
    };

    loadOmop();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadAttributes = async () => {
      setIsAttributesLoading(true);
      setAttributesErrorMessage("");

      try {
        const classesResult = await getAttributeClasses();
        const attributeClasses = Array.isArray(classesResult) ? classesResult : [];
        const instanceResults = await Promise.allSettled(
          attributeClasses.map(async (className) => {
            const instances = await getAttributeInstances(className);
            return {
              className,
              summary: summarizeInstances(className, instances),
            };
          })
        );

        const nextSummaryByClass = {};
        const nextErrorsByClass = {};

        instanceResults.forEach((callResult, index) => {
          const className = String(attributeClasses[index]);
          if (callResult.status === "fulfilled") {
            nextSummaryByClass[className] = callResult.value.summary;
            return;
          }
          nextErrorsByClass[className] =
            callResult.reason?.message || "Failed to load attribute instances.";
        });

        if (isActive) {
          setAttributeClasses(attributeClasses);
          setAttributeSummaryByClass(nextSummaryByClass);
          setAttributeErrorsByClass(nextErrorsByClass);
        }
      } catch (error) {
        if (isActive) {
          setAttributesErrorMessage(error?.message || "Failed to load Attributes classes.");
        }
      } finally {
        if (isActive) {
          setIsAttributesLoading(false);
        }
      }
    };

    loadAttributes();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadConcepts = async () => {
      setIsConceptsLoading(true);
      setConceptsErrorMessage("");

      try {
        const classesResult = await getConceptClasses();
        const conceptClasses = Array.isArray(classesResult) ? classesResult : [];
        const instanceResults = await Promise.allSettled(
          conceptClasses.map(async (className) => {
            const instances = await getConceptInstances(className);
            return {
              className,
              summary: summarizeInstances(className, instances),
            };
          })
        );

        const nextSummaryByClass = {};
        const nextErrorsByClass = {};

        instanceResults.forEach((callResult, index) => {
          const className = String(conceptClasses[index]);
          if (callResult.status === "fulfilled") {
            nextSummaryByClass[className] = callResult.value.summary;
            return;
          }
          nextErrorsByClass[className] =
            callResult.reason?.message || "Failed to load concept instances.";
        });

        if (isActive) {
          setConceptClasses(conceptClasses);
          setConceptSummaryByClass(nextSummaryByClass);
          setConceptErrorsByClass(nextErrorsByClass);
        }
      } catch (error) {
        if (isActive) {
          setConceptsErrorMessage(error?.message || "Failed to load Concepts classes.");
        }
      } finally {
        if (isActive) {
          setIsConceptsLoading(false);
        }
      }
    };

    loadConcepts();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadCancers = async () => {
      setIsCancersLoading(true);
      setCancersErrorMessage("");

      try {
        const classesResult = await getCancerClasses();
        const cancerClasses = Array.isArray(classesResult) ? classesResult : [];
        const instanceResults = await Promise.allSettled(
          cancerClasses.map(async (className) => {
            const instances = await getCancerInstances(className);
            return {
              className,
              summary: summarizeInstances(className, instances),
            };
          })
        );

        const nextSummaryByClass = {};
        const nextErrorsByClass = {};

        instanceResults.forEach((callResult, index) => {
          const className = String(cancerClasses[index]);
          if (callResult.status === "fulfilled") {
            nextSummaryByClass[className] = callResult.value.summary;
            return;
          }
          nextErrorsByClass[className] =
            callResult.reason?.message || "Failed to load cancer instances.";
        });

        if (isActive) {
          setCancerClasses(cancerClasses);
          setCancerSummaryByClass(nextSummaryByClass);
          setCancerErrorsByClass(nextErrorsByClass);
        }
      } catch (error) {
        if (isActive) {
          setCancersErrorMessage(error?.message || "Failed to load Cancers classes.");
        }
      } finally {
        if (isActive) {
          setIsCancersLoading(false);
        }
      }
    };

    loadCancers();

    return () => {
      isActive = false;
    };
  }, []);

  const cancerCountRows = sortDistributionAlphanumerically(
    cancerClasses.map((className) => {
      const classKey = String(className);
      const classSummary = cancerSummaryByClass[classKey] || [];
      return {
        label: classKey,
        count: getSummaryTotalCount(classSummary),
      };
    })
  );

  const setSectionExpanded = (sectionKey, nextExpanded) => {
    setIsSectionTogglePending((previous) => ({ ...previous, [sectionKey]: true }));

    window.requestAnimationFrame(() => {
      setExpandedSections((previous) => ({
        ...previous,
        [sectionKey]: nextExpanded,
      }));
      window.requestAnimationFrame(() => {
        setIsSectionTogglePending((previous) => ({ ...previous, [sectionKey]: false }));
      });
    });
  };

  const toggleSection = (sectionKey) => {
    if (isSectionTogglePending[sectionKey]) {
      return;
    }

    setSectionExpanded(sectionKey, !expandedSections[sectionKey]);
  };

  const handleJumpTo = (sectionKey, value) => (event) => {
    event.preventDefault();

    const targetId = getAnchorId(sectionKey, value);
    const wasCollapsed = !expandedSections[sectionKey];
    const scrollToTarget = () => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    if (wasCollapsed) {
      setSectionExpanded(sectionKey, true);
      // Let React commit the newly mounted section content before scrolling.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(scrollToTarget);
      });
      return;
    }

    scrollToTarget();
  };

  const omopJumpValues = omopClasses.map((value) => String(value));
  const attributeJumpValues = attributeClasses.map((value) => String(value));
  const conceptJumpValues = conceptClasses.map((value) => String(value));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50", p: { xs: 2, md: 4 } }}>
      <Stack spacing={4}>
        <Typography variant="h4" component="h1" color="text.secondary">
          Debug View
        </Typography>

        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <SectionTitle title="OMOP" accent />
              <IconButton
                onClick={() => toggleSection("omop")}
                aria-label={expandedSections.omop ? "Collapse OMOP section" : "Expand OMOP section"}
                disabled={isSectionTogglePending.omop}
              >
                {isSectionTogglePending.omop ? (
                  <CircularProgress size={18} />
                ) : expandedSections.omop ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </IconButton>
            </Stack>
            <SectionJumpLinks sectionKey="omop" values={omopJumpValues} onJump={handleJumpTo} />
            {expandedSections.omop ? (
              <Stack spacing={2}>
                {isOmopLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading classes...
                    </Typography>
                  </Stack>
                ) : null}

                {omopErrorMessage ? <Alert severity="error">{omopErrorMessage}</Alert> : null}

                {!isOmopLoading && !omopErrorMessage ? (
                  omopClasses.length > 0 ? (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: CARD_GRID_TEMPLATE_COLUMNS,
                        gap: 3,
                      }}
                    >
                      {omopClasses.map((className) => {
                        const normalizedClassName = String(className).toUpperCase();
                        const classSummary = omopSummaryByClass[String(className)] || [];
                        const chartDistribution =
                          normalizedClassName === AGE_AT_DX_ATTRIBUTE
                            ? getAgeDecileDistribution(classSummary)
                            : getCategoryDistribution(classSummary);
                        const anchorId = getAnchorId("omop", className);

                        return (
                          <Card id={anchorId} key={String(className)} elevation={1}>
                            <CardHeader
                              title={
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {String(className)}
                                </Typography>
                              }
                              sx={{ px: 3, pt: 3, pb: 1 }}
                            />
                            <CardContent sx={{ px: 3, pb: 3, pt: 0 }}>
                              {omopErrorsByClass[String(className)] ? (
                                <Alert severity="error">
                                  {omopErrorsByClass[String(className)]}
                                </Alert>
                              ) : classSummary.length > 0 ? (
                                chartDistribution.length > 0 ? (
                                  <SummaryChart distribution={chartDistribution} />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No plottable values returned.
                                  </Typography>
                                )
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No instance values returned.
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No classes returned.
                    </Typography>
                  )
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <SectionTitle title="Attributes" accent />
              <IconButton
                onClick={() => toggleSection("attributes")}
                aria-label={
                  expandedSections.attributes
                    ? "Collapse Attributes section"
                    : "Expand Attributes section"
                }
                disabled={isSectionTogglePending.attributes}
              >
                {isSectionTogglePending.attributes ? (
                  <CircularProgress size={18} />
                ) : expandedSections.attributes ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </IconButton>
            </Stack>
            <SectionJumpLinks
              sectionKey="attributes"
              values={attributeJumpValues}
              onJump={handleJumpTo}
            />
            {expandedSections.attributes ? (
              <Stack spacing={2}>
                {isAttributesLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading attribute classes...
                    </Typography>
                  </Stack>
                ) : null}

                {attributesErrorMessage ? (
                  <Alert severity="error">{attributesErrorMessage}</Alert>
                ) : null}

                {!isAttributesLoading && !attributesErrorMessage ? (
                  attributeClasses.length > 0 ? (
                    <Box
                      sx={{
                        display: "grid",
                        gap: 3,
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      }}
                    >
                      {attributeClasses.map((className) => {
                        const classKey = String(className);
                        const classSummary = attributeSummaryByClass[classKey] || [];
                        const chartDistribution = getCategoryDistribution(classSummary);
                        const anchorId = getAnchorId("attributes", className);

                        return (
                          <Card id={anchorId} key={classKey} elevation={1}>
                            <CardHeader
                              title={
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {classKey}
                                </Typography>
                              }
                              sx={{ px: 3, pt: 3, pb: 1 }}
                            />
                            <CardContent sx={{ px: 3, pb: 3, pt: 0 }}>
                              {attributeErrorsByClass[classKey] ? (
                                <Alert severity="error">{attributeErrorsByClass[classKey]}</Alert>
                              ) : classSummary.length > 0 ? (
                                chartDistribution.length > 0 ? (
                                  <SummaryChart distribution={chartDistribution} />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No plottable values returned.
                                  </Typography>
                                )
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No values returned.
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No attribute classes returned.
                    </Typography>
                  )
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <SectionTitle title="Concepts" />
              <IconButton
                onClick={() => toggleSection("concepts")}
                aria-label={
                  expandedSections.concepts ? "Collapse Concepts section" : "Expand Concepts section"
                }
                disabled={isSectionTogglePending.concepts}
              >
                {isSectionTogglePending.concepts ? (
                  <CircularProgress size={18} />
                ) : expandedSections.concepts ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </IconButton>
            </Stack>
            <SectionJumpLinks sectionKey="concepts" values={conceptJumpValues} onJump={handleJumpTo} />
            {expandedSections.concepts ? (
              <Stack spacing={2}>
                {isConceptsLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading concept classes...
                    </Typography>
                  </Stack>
                ) : null}

                {conceptsErrorMessage ? <Alert severity="error">{conceptsErrorMessage}</Alert> : null}

                {!isConceptsLoading && !conceptsErrorMessage ? (
                  conceptClasses.length > 0 ? (
                    <Box
                      sx={{
                        display: "grid",
                        gap: 3,
                        gridTemplateColumns: CARD_GRID_TEMPLATE_COLUMNS,
                      }}
                    >
                      {conceptClasses.map((className) => {
                        const classKey = String(className);
                        const classSummary = conceptSummaryByClass[classKey] || [];
                        const chartDistribution = getCategoryDistribution(classSummary);
                        const anchorId = getAnchorId("concepts", className);

                        return (
                          <Card id={anchorId} key={classKey} elevation={1}>
                            <CardHeader
                              title={
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {classKey}
                                </Typography>
                              }
                              sx={{ px: 3, pt: 3, pb: 1 }}
                            />
                            <CardContent sx={{ px: 3, pb: 3, pt: 0 }}>
                              {conceptErrorsByClass[classKey] ? (
                                <Alert severity="error">{conceptErrorsByClass[classKey]}</Alert>
                              ) : classSummary.length > 0 ? (
                                chartDistribution.length > 0 ? (
                                  <SummaryChart distribution={chartDistribution} />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No plottable values returned.
                                  </Typography>
                                )
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No values returned.
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No concept classes returned.
                    </Typography>
                  )
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: "divider" }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <SectionTitle title="Cancers" />
              <IconButton
                onClick={() => toggleSection("cancers")}
                aria-label={
                  expandedSections.cancers ? "Collapse Cancers section" : "Expand Cancers section"
                }
                disabled={isSectionTogglePending.cancers}
              >
                {isSectionTogglePending.cancers ? (
                  <CircularProgress size={18} />
                ) : expandedSections.cancers ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </IconButton>
            </Stack>
            {expandedSections.cancers ? (
              <Stack spacing={2}>
                {isCancersLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading cancer classes...
                    </Typography>
                  </Stack>
                ) : null}

                {cancersErrorMessage ? <Alert severity="error">{cancersErrorMessage}</Alert> : null}

                {!isCancersLoading && !cancersErrorMessage ? (
                  cancerClasses.length > 0 ? (
                    <Card elevation={1}>
                      <CardHeader
                        title={
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Cancer Counts
                          </Typography>
                        }
                        sx={{ px: 3, pt: 3, pb: 1 }}
                      />
                      <CardContent sx={{ px: 3, pb: 3, pt: 0 }}>
                        <FilterableValueCountTable
                          rows={cancerCountRows.map((row) => ({
                            ...row,
                            id: getAnchorId("cancers", row.label),
                          }))}
                          valueHeader="Cancer"
                          maxHeight={420}
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No cancer classes returned.
                    </Typography>
                  )
                ) : null}
                {Object.keys(cancerErrorsByClass).length > 0 ? (
                  <Alert severity="warning">
                    Some cancer classes failed to load instance details.
                  </Alert>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Paper>

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

export default DebugView;
