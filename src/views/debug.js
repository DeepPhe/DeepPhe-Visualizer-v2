import React, { useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  IconButton,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
import {
  AGE_AT_DX_ATTRIBUTE,
  ATTRIBUTES_GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_COLUMNS,
} from "../constants/debugConstants";
import {
  getAgeDecileDistribution,
  getCategoryDistribution,
  getSummaryTotalCount,
  getAnchorId,
  sortDistributionAlphanumerically,
} from "../utils/dataProcessing";
import { useDataLoader } from "../hooks/useDataLoader";
import FilterableValueCountTable from "../components/debug/FilterableValueCountTable";
import SectionJumpLinks from "../components/debug/SectionJumpLinks";
import SummaryChart from "../components/debug/SummaryChart";

const DEFAULT_SECTION_STATE = {
  omop: false,
  attributes: false,
  concepts: false,
  cancers: false,
};

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

function DebugView() {
  const omopData = useDataLoader(getOmopClasses, getOmopInstances, "OMOP");
  const attributeData = useDataLoader(getAttributeClasses, getAttributeInstances, "Attributes");
  const conceptData = useDataLoader(getConceptClasses, getConceptInstances, "Concepts");
  const cancerData = useDataLoader(getCancerClasses, getCancerInstances, "Cancers");

  const [expandedSections, setExpandedSections] = useState(DEFAULT_SECTION_STATE);
  const [isSectionTogglePending, setIsSectionTogglePending] = useState(DEFAULT_SECTION_STATE);

  const cancerCountRows = sortDistributionAlphanumerically(
    cancerData.classes.map((className) => {
      const classKey = String(className);
      const classSummary = cancerData.summaryByClass[classKey] || [];
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

  const omopJumpValues = omopData.classes.map((value) => String(value));
  const attributeJumpValues = attributeData.classes.map((value) => String(value));
  const conceptJumpValues = conceptData.classes.map((value) => String(value));

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
                {omopData.isLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading classes...
                    </Typography>
                  </Stack>
                ) : null}

                {omopData.errorMessage ? <Alert severity="error">{omopData.errorMessage}</Alert> : null}

                {!omopData.isLoading && !omopData.errorMessage ? (
                  omopData.classes.length > 0 ? (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
                        gap: 3,
                      }}
                    >
                      {omopData.classes.map((className) => {
                        const normalizedClassName = String(className).toUpperCase();
                        const classSummary = omopData.summaryByClass[String(className)] || [];
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
                              {omopData.errorsByClass[String(className)] ? (
                                <Alert severity="error">
                                  {omopData.errorsByClass[String(className)]}
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
                {attributeData.isLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading attribute classes...
                    </Typography>
                  </Stack>
                ) : null}

                {attributeData.errorMessage ? (
                  <Alert severity="error">{attributeData.errorMessage}</Alert>
                ) : null}

                {!attributeData.isLoading && !attributeData.errorMessage ? (
                  attributeData.classes.length > 0 ? (
                    <Box
                      sx={{
                        display: "grid",
                        gap: 3,
                        gridTemplateColumns: ATTRIBUTES_GRID_TEMPLATE_COLUMNS,
                      }}
                    >
                      {attributeData.classes.map((className) => {
                        const classKey = String(className);
                        const classSummary = attributeData.summaryByClass[classKey] || [];
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
                              {attributeData.errorsByClass[classKey] ? (
                                <Alert severity="error">{attributeData.errorsByClass[classKey]}</Alert>
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
            <SectionJumpLinks
              sectionKey="concepts"
              values={conceptJumpValues}
              onJump={handleJumpTo}
            />
            {expandedSections.concepts ? (
              <Stack spacing={2}>
                {conceptData.isLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading concept classes...
                    </Typography>
                  </Stack>
                ) : null}

                {conceptData.errorMessage ? <Alert severity="error">{conceptData.errorMessage}</Alert> : null}

                {!conceptData.isLoading && !conceptData.errorMessage ? (
                  conceptData.classes.length > 0 ? (
                    <Box
                      sx={{
                        display: "grid",
                        gap: 3,
                        gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
                      }}
                    >
                      {conceptData.classes.map((className) => {
                        const classKey = String(className);
                        const classSummary = conceptData.summaryByClass[classKey] || [];
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
                              {conceptData.errorsByClass[classKey] ? (
                                <Alert severity="error">{conceptData.errorsByClass[classKey]}</Alert>
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
                {cancerData.isLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Loading cancer classes...
                    </Typography>
                  </Stack>
                ) : null}

                {cancerData.errorMessage ? <Alert severity="error">{cancerData.errorMessage}</Alert> : null}

                {!cancerData.isLoading && !cancerData.errorMessage ? (
                  cancerData.classes.length > 0 ? (
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
                {Object.keys(cancerData.errorsByClass).length > 0 ? (
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
