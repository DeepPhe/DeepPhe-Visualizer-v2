import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import { brushX, brushSelection } from "d3-brush";
import { axisBottom, axisTop } from "d3-axis";
import {
  AGE_AREA,
  COLLAPSED_CAP_COLOR,
  DATE_ANCHOR_COLOR,
  EVENT_RELATION_TIMELINE_SCOPE_ALL,
  EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT,
  GAPS,
  LANE,
  LEGEND,
  MARGINS,
  NEGATED_RELATION_COLOR,
  OVERVIEW,
  PADDING,
  RELATION_COLOR,
  SELECTED_OUTLINE_COLOR,
  TEXT,
} from "../../constants/eventRelationTimeline";
import { fetchStaticEventRelationTimeline } from "../../clients/eventRelationTimeline";
import { fetchPatientDemographics } from "../../clients/patientDemographics";
import {
  buildEventRelationTimelineModel,
  filterEventRelationTimelineModel,
  findDemographicsBirthDate,
  parsePatientBirthDate,
  shouldShowEventRelationTimeline,
} from "../../controllers/eventRelationTimeline";
import {
  buildEventRelationHeatmap,
  buildEventRelationTooltip,
  computeEventRelationAgeAxis,
  computeEventRelationTimelineLayout,
  getEventRelationGlyph,
} from "../../utils/patientView/eventRelationTimelineLayout";
import SectionCollapseToggle from "./SectionCollapseToggle";

const DEFAULT_CONTAINER_WIDTH = 1040;

/**
 * Focusable SVG group. `outline: none` on a tabbable element strips the focus
 * indicator (WCAG 2.4.7), so keep a visible ring for keyboard users while
 * leaving mouse clicks unadorned.
 */
const FocusableGroup = styled("g")(({ theme }) => {
  const custom = theme.custom || {};
  const focusRing = custom.focusRing || theme.palette.primary.main;
  const focusRingWidth = Number.parseFloat(custom.focusRingWidth) || 2;

  return {
    cursor: "pointer",
    "&:focus": { outline: "none" },
    "&:focus-visible": {
      outline: `${focusRingWidth}px solid ${focusRing}`,
      outlineOffset: custom.focusRingOffset || "2px",
    },
  };
});

const RELATION_LEGEND_PATHS = {
  On: "M 6 0 L 6 12",
  Before: "M 12 0 L 0 6 L 12 12",
  Overlaps: "M 0 6 L 12 6",
  After: "M 0 0 L 12 6 L 0 12",
};

const RELATION_LEGEND_TITLES = {
  Before: "Event occurs *before* time/date",
  On: "Event occurs *within* time span",
  Overlaps: "Event *overlaps* time span",
  After: "Event occurs *after* time/date",
};

const visuallyHiddenSx = {
  position: "absolute",
  // "1px", not 1: MUI's sx treats a bare 1 on width/height as 100%, which makes
  // the hidden text full-width and pushes a horizontal scrollbar onto the page.
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
};

function normalizeString(value) {
  return String(value || "").trim();
}

/**
 * Marker defs ported from the alpha. Note the arrow/cap fills are green even on
 * a negated (red) span -- that is what the alpha draws.
 */
function TimelineMarkerDefs({ idPrefix }) {
  const marker = (id, children, refX = 6) => (
    <marker
      key={id}
      id={`${idPrefix}-${id}`}
      viewBox="0 0 12 12"
      refX={refX}
      refY={6}
      markerWidth={2.5}
      markerHeight={2.5}
      orient="auto"
    >
      {children}
    </marker>
  );

  return (
    <>
      {marker("rightArrow", <path d="M 0 0 L 12 6 L 0 12 Z" fill={RELATION_COLOR} />, 4)}
      {marker(
        "selectedRightArrow",
        <path
          d="M 0 0 L 12 6 L 0 12 Z"
          fill={RELATION_COLOR}
          stroke={SELECTED_OUTLINE_COLOR}
          strokeWidth={1}
        />,
        4
      )}
      {marker("leftArrow", <path d="M 12 0 L 0 6 L 12 12" fill={RELATION_COLOR} />)}
      {marker(
        "selectedLeftArrow",
        <path
          d="M 12 0 L 0 6 L 12 12 Z"
          fill={RELATION_COLOR}
          stroke={SELECTED_OUTLINE_COLOR}
          strokeWidth={1}
        />
      )}
      {marker(
        "verticalLineCap",
        <path d="M6 0 L6 12" stroke={RELATION_COLOR} strokeWidth={3} strokeOpacity={0.75} />
      )}
      {marker(
        "collapsedVerticalLineCap",
        <path d="M6 0 L6 12" stroke={COLLAPSED_CAP_COLOR} strokeWidth={3} strokeOpacity={0.3} />
      )}
      {marker(
        "selectedVerticalLineCap",
        <>
          <path d="M6 0 L6 12" stroke={SELECTED_OUTLINE_COLOR} strokeWidth={5} />
          <path d="M6 0 L6 12" stroke={RELATION_COLOR} strokeWidth={3} strokeOpacity={0.75} />
        </>
      )}
    </>
  );
}

TimelineMarkerDefs.propTypes = { idPrefix: PropTypes.string.isRequired };

function markerUrl(idPrefix, name, isSelected) {
  if (!name) {
    return undefined;
  }
  if (!isSelected) {
    return `url(#${idPrefix}-${name})`;
  }
  const selectedName = {
    rightArrow: "selectedRightArrow",
    leftArrow: "selectedLeftArrow",
    verticalLineCap: "selectedVerticalLineCap",
    collapsedVerticalLineCap: "collapsedVerticalLineCap",
  }[name];
  return `url(#${idPrefix}-${selectedName || name})`;
}

/**
 * One merged span. Geometry follows the alpha's drawTimeSpan / drawOnRelation:
 * a 5px stroke at y=0, a hidden 7px black outline that appears when selected,
 * and a same-day On/On drawn as a bare vertical tick instead.
 */
function SpanMark({ span, x1, x2, expanded, isSelected, idPrefix, onToggle }) {
  const glyph = getEventRelationGlyph({ ...span, x1, x2 }, { expanded });
  const stroke = span.negated ? NEGATED_RELATION_COLOR : RELATION_COLOR;
  const strokeOpacity = expanded ? 0.75 : 0.5;
  const tooltip = buildEventRelationTooltip(span, { includeDuration: glyph.kind === "span" });
  const label = `${span.conceptLabels.join(", ")}. ${span.laneGroup}. ${span.relation1} ${
    span.start
  }; ${span.relation2} ${span.end}.${span.negated ? " Negated." : ""}`;

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(span);
    }
  };

  const common = {
    tabIndex: 0,
    role: "button",
    "aria-pressed": isSelected,
    "aria-label": label,
    onClick: () => onToggle(span),
    onKeyDown: handleKeyDown,
  };

  if (glyph.kind === "tick") {
    return (
      <FocusableGroup
        data-event-relation-id={span.id}
        data-concept-ids={span.conceptIds.join(",")}
        data-lane-group={span.laneGroup}
        data-relation-key={span.relationKey}
        data-negated={span.negated ? "true" : "false"}
        data-selected={isSelected ? "true" : "false"}
        {...common}
      >
        <title>{tooltip}</title>
        <line
          className="relation-outline"
          x1={x1}
          y1={-7}
          x2={x1}
          y2={7}
          stroke={SELECTED_OUTLINE_COLOR}
          strokeWidth={5}
          strokeOpacity={isSelected ? 1 : 0}
        />
        <line
          className="relation-icon"
          x1={x1}
          y1={-6}
          x2={x1}
          y2={6}
          stroke={stroke}
          strokeWidth={4}
          strokeOpacity={strokeOpacity}
        />
      </FocusableGroup>
    );
  }

  return (
    <FocusableGroup
      data-event-relation-id={span.id}
      data-concept-ids={span.conceptIds.join(",")}
      data-lane-group={span.laneGroup}
      data-relation-key={span.relationKey}
      data-negated={span.negated ? "true" : "false"}
      data-selected={isSelected ? "true" : "false"}
      {...common}
    >
      <title>{tooltip}</title>
      <line
        className="relation-outline"
        x1={x1}
        y1={0}
        x2={x2}
        y2={0}
        stroke={SELECTED_OUTLINE_COLOR}
        strokeWidth={7}
        strokeOpacity={isSelected ? 1 : 0}
      />
      <line
        className="relation-icon"
        x1={x1}
        y1={0}
        x2={x2}
        y2={0}
        stroke={stroke}
        strokeWidth={5}
        strokeOpacity={strokeOpacity}
        markerStart={markerUrl(idPrefix, glyph.markerStart, isSelected)}
        markerEnd={markerUrl(idPrefix, glyph.markerEnd, isSelected)}
      />
      {/* Alpha adds transparent endpoint discs to widen the hit target. */}
      <circle cx={x1} cy={0} r={8} fill="transparent" pointerEvents="all" />
      <circle cx={x2} cy={0} r={8} fill="transparent" pointerEvents="all" />
    </FocusableGroup>
  );
}

SpanMark.propTypes = {
  span: PropTypes.object.isRequired,
  x1: PropTypes.number.isRequired,
  x2: PropTypes.number.isRequired,
  expanded: PropTypes.bool.isRequired,
  isSelected: PropTypes.bool.isRequired,
  idPrefix: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
};

/** d3-axis rendered into a ref'd <g> so tick selection stays d3's job. */
function TimeAxis({ scale, orientation, transform, className }) {
  const groupRef = useRef(null);

  useEffect(() => {
    if (!groupRef.current || !scale) {
      return;
    }
    const axis = (orientation === "top" ? axisTop(scale) : axisBottom(scale))
      .tickSizeInner(5)
      .tickSizeOuter(0);
    select(groupRef.current).call(axis);
  }, [scale, orientation]);

  return <g ref={groupRef} className={className} transform={transform} />;
}

TimeAxis.propTypes = {
  scale: PropTypes.func,
  orientation: PropTypes.oneOf(["top", "bottom"]).isRequired,
  transform: PropTypes.string,
  className: PropTypes.string,
};

export default function EventRelationTimelineCard({
  patientId = "",
  concepts = [],
  selectedDocument = null,
  embedded = false,
  expanded = true,
  onToggleExpanded = undefined,
  collapsiblePanelId = undefined,
  sectionLabel = "Event Timeline",
  birthDate = "",
  selectedConceptIds = undefined,
  onSelectConceptIds = undefined,
}) {
  const shouldRender = shouldShowEventRelationTimeline(patientId);
  const generatedId = useId().replace(/:/g, "");
  const panelBodyId = collapsiblePanelId || `${generatedId}-event-relation-timeline-body`;
  const descriptionId = `${generatedId}-event-relation-description`;
  const statusId = `${generatedId}-event-relation-status`;

  const resizeObserverRef = useRef(null);
  const zoomRectRef = useRef(null);
  const brushGroupRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const brushBehaviorRef = useRef(null);
  const isSyncingRef = useRef(false);

  const [rawTimelineText, setRawTimelineText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [viewMode, setViewMode] = useState(EVENT_RELATION_TIMELINE_SCOPE_ALL);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [containerWidth, setContainerWidth] = useState(DEFAULT_CONTAINER_WIDTH);
  const [zoomTransform, setZoomTransform] = useState(() => zoomIdentity);
  const [demographics, setDemographics] = useState(null);
  const [internalSelection, setInternalSelection] = useState([]);

  const isSelectionControlled = Array.isArray(selectedConceptIds);
  const activeSelection = isSelectionControlled ? selectedConceptIds : internalSelection;
  const activeSelectionSet = useMemo(
    () => new Set((activeSelection || []).map(normalizeString).filter(Boolean)),
    [activeSelection]
  );

  // The observer's whole lifecycle lives in this callback ref: React calls it
  // with null on unmount, and a separate cleanup effect would race StrictMode's
  // double-mount and tear down the observer after it had been re-attached.
  const setContainerNode = useCallback((node) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;

    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const initialWidth = node.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setContainerWidth(initialWidth);
    }

    const observer = new ResizeObserver((entries) => {
      const width = Number(entries[0]?.contentRect?.width);
      if (!Number.isFinite(width) || width <= 0) {
        return;
      }
      setContainerWidth((previous) => (Math.abs(previous - width) < 2 ? previous : width));
    });
    observer.observe(node);
    resizeObserverRef.current = observer;
  }, []);

  useEffect(() => {
    let didCancel = false;

    if (!shouldRender) {
      setRawTimelineText("");
      setLoadError("");
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setLoadError("");

    fetchStaticEventRelationTimeline(patientId)
      .then((timelineText) => {
        if (!didCancel) {
          setRawTimelineText(timelineText);
        }
      })
      .catch((error) => {
        if (!didCancel) {
          setLoadError(error?.message || "Unable to load event relation timeline data.");
          setRawTimelineText("");
        }
      })
      .finally(() => {
        if (!didCancel) {
          setIsLoading(false);
        }
      });

    return () => {
      didCancel = true;
    };
  }, [patientId, shouldRender]);

  const parsedBirthDate = useMemo(() => parsePatientBirthDate(birthDate), [birthDate]);

  useEffect(() => {
    let didCancel = false;

    if (!shouldRender || parsedBirthDate) {
      return undefined;
    }

    fetchPatientDemographics().then((records) => {
      if (!didCancel) {
        setDemographics(records);
      }
    });

    return () => {
      didCancel = true;
    };
  }, [shouldRender, parsedBirthDate]);

  // Prefer the patient payload's own birth date; the bundled demographics asset
  // covers the fake patients, whose API `demographics` object is empty.
  const resolvedBirthDate = useMemo(
    () => parsedBirthDate || findDemographicsBirthDate(demographics, patientId),
    [parsedBirthDate, demographics, patientId]
  );

  const modelState = useMemo(() => {
    if (!rawTimelineText) {
      return { model: null, error: "" };
    }
    try {
      return {
        model: buildEventRelationTimelineModel({
          tsvText: rawTimelineText,
          concepts,
          selectedDocument,
        }),
        error: "",
      };
    } catch (error) {
      return {
        model: null,
        error: error?.message || "Unable to parse event relation timeline data.",
      };
    }
  }, [rawTimelineText, concepts, selectedDocument]);

  const baseModel = modelState.model;
  const canFilterToCurrentReport = Boolean(selectedDocument);
  const effectiveViewMode = canFilterToCurrentReport
    ? viewMode
    : EVENT_RELATION_TIMELINE_SCOPE_ALL;
  const visibleModel = useMemo(
    () => filterEventRelationTimelineModel(baseModel, effectiveViewMode),
    [baseModel, effectiveViewMode]
  );

  const layout = useMemo(
    () =>
      computeEventRelationTimelineLayout({
        containerWidth,
        spans: visibleModel?.spans || [],
        collapsedGroups,
        showAgeAxis: Boolean(resolvedBirthDate),
      }),
    [containerWidth, visibleModel, collapsedGroups, resolvedBirthDate]
  );

  const { dimensions, mainX, domain, groups, uniqueDates } = layout;

  // The zoomed x scale drives every mark; the unzoomed one drives the overview.
  const visibleX = useMemo(() => zoomTransform.rescaleX(mainX), [zoomTransform, mainX]);

  const ageAxis = useMemo(
    () => computeEventRelationAgeAxis(domain, visibleX, resolvedBirthDate),
    [domain, visibleX, resolvedBirthDate]
  );

  // --- zoom ------------------------------------------------------------
  useEffect(() => {
    const node = zoomRectRef.current;
    if (!node || dimensions.svgWidth <= 0) {
      return undefined;
    }

    const behavior = d3Zoom()
      .scaleExtent([1, Infinity])
      .translateExtent([
        [0, 0],
        [dimensions.svgWidth, dimensions.totalContentHeight],
      ])
      .extent([
        [0, 0],
        [dimensions.svgWidth, dimensions.totalContentHeight],
      ])
      .on("zoom", (event) => {
        if (isSyncingRef.current) {
          return;
        }
        setZoomTransform(event.transform);

        const brushNode = brushGroupRef.current;
        if (brushNode && brushBehaviorRef.current) {
          isSyncingRef.current = true;
          try {
            select(brushNode).call(
              brushBehaviorRef.current.move,
              [0, dimensions.svgWidth].map(event.transform.invertX, event.transform)
            );
          } finally {
            isSyncingRef.current = false;
          }
        }
      });

    zoomBehaviorRef.current = behavior;

    isSyncingRef.current = true;
    try {
      select(node).call(behavior).call(behavior.transform, zoomIdentity);
    } finally {
      isSyncingRef.current = false;
    }
    setZoomTransform(zoomIdentity);

    return () => {
      select(node).on(".zoom", null);
      zoomBehaviorRef.current = null;
    };
  }, [dimensions.svgWidth, dimensions.totalContentHeight]);

  // --- overview brush --------------------------------------------------
  useEffect(() => {
    const node = brushGroupRef.current;
    if (!node || dimensions.svgWidth <= 0) {
      return undefined;
    }

    const behavior = brushX()
      .extent([
        [0, 0],
        [dimensions.svgWidth, OVERVIEW.height],
      ])
      .on("brush", () => {
        if (isSyncingRef.current) {
          return;
        }
        const selection = brushSelection(node);
        if (!selection || selection[1] - selection[0] <= 0) {
          return;
        }

        const nextTransform = zoomIdentity
          .scale(dimensions.svgWidth / (selection[1] - selection[0]))
          .translate(-selection[0], 0);

        setZoomTransform(nextTransform);

        if (zoomRectRef.current && zoomBehaviorRef.current) {
          isSyncingRef.current = true;
          try {
            select(zoomRectRef.current).call(
              zoomBehaviorRef.current.transform,
              nextTransform
            );
          } finally {
            isSyncingRef.current = false;
          }
        }
      });

    brushBehaviorRef.current = behavior;
    const selection = select(node);

    isSyncingRef.current = true;
    try {
      selection.call(behavior);
      selection.call(behavior.move, [0, dimensions.svgWidth]);
    } finally {
      isSyncingRef.current = false;
    }

    return () => {
      selection.on(".brush", null);
      brushBehaviorRef.current = null;
    };
  }, [dimensions.svgWidth]);

  const toggleGroup = useCallback((groupKey) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  /**
   * Alpha `handleClick`: a span toggles its whole concept-id set on or off.
   */
  const handleSpanToggle = useCallback(
    (span) => {
      const spanConceptIds = span.conceptIds || [];
      const hasAnyClicked = spanConceptIds.some((id) => activeSelectionSet.has(id));
      const nextSelection = hasAnyClicked
        ? (activeSelection || []).filter((id) => !spanConceptIds.includes(id))
        : [...(activeSelection || []), ...spanConceptIds];

      if (!isSelectionControlled) {
        setInternalSelection(nextSelection);
      }
      onSelectConceptIds?.(nextSelection, { span, isDeselecting: hasAnyClicked });
    },
    [activeSelection, activeSelectionSet, isSelectionControlled, onSelectConceptIds]
  );

  if (!shouldRender) {
    return null;
  }

  const cardError = loadError || modelState.error;
  const visibleSpans = visibleModel?.spans || [];
  const presentRelations = visibleModel?.presentRelations || [];
  const relationChipLabel =
    effectiveViewMode === EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT
      ? `${visibleModel?.matchedRowCount || 0} of ${baseModel?.matchedRowCount || 0} relations`
      : `${baseModel?.matchedRowCount || baseModel?.sourceRowCount || 0} relations`;

  const selectedSpanCount = visibleSpans.filter((span) =>
    (span.conceptIds || []).some((id) => activeSelectionSet.has(id))
  ).length;

  return (
    <Card
      elevation={0}
      sx={{
        border: embedded ? 0 : 1,
        borderColor: "divider",
        borderRadius: embedded ? 0 : 1,
        ...(embedded
          ? { display: "flex", flexDirection: "column", minHeight: 0, overflow: "visible" }
          : {}),
      }}
    >
      <CardHeader
        title={sectionLabel}
        titleTypographyProps={{ variant: "subtitle1", sx: { fontWeight: 700 } }}
        sx={{ py: 1, px: 1.5, "& .MuiCardHeader-action": { alignSelf: "center", m: 0 } }}
        action={
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            {baseModel ? (
              <Chip size="small" label={relationChipLabel} sx={{ height: 24, fontWeight: 600 }} />
            ) : null}
            {onToggleExpanded ? (
              <SectionCollapseToggle
                expanded={expanded}
                onToggle={onToggleExpanded}
                label={sectionLabel}
                panelId={panelBodyId}
              />
            ) : null}
          </Stack>
        }
      />
      {expanded ? (
        <>
          <Divider />
          <CardContent
            id={panelBodyId}
            sx={{
              px: 1.5,
              py: 1.25,
              "&:last-child": { pb: 1.25 },
              ...(embedded ? { minHeight: 0, overflow: "visible" } : {}),
            }}
          >
            <Typography id={descriptionId} variant="caption" component="p" sx={visuallyHiddenSx}>
              Event relation timeline. Temporal relations are packed into
              overlap-free lanes grouped by Finding, Disease, Stage Grade and
              Treatment. Marks are green, or red when the concept is negated.
              Drag the overview band below the chart, or scroll over the chart,
              to zoom the date range.
            </Typography>

            {isLoading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Loading event relations...
                </Typography>
              </Stack>
            ) : cardError ? (
              <Alert severity="error">{cardError}</Alert>
            ) : !baseModel ? (
              <Typography variant="body2" color="text.secondary">
                No event relation timeline data is available for this patient.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {baseModel.unmatchedConceptIds.length > 0 ? (
                  <Alert severity="warning">
                    {baseModel.unmatchedConceptIds.length} timeline concept
                    {baseModel.unmatchedConceptIds.length === 1 ? "" : "s"} did not match the
                    loaded patient concepts.
                  </Alert>
                ) : null}
                {baseModel.uncategorizedConceptIds.length > 0 ? (
                  <Alert severity="warning">
                    {baseModel.uncategorizedConceptIds.length} concept
                    {baseModel.uncategorizedConceptIds.length === 1 ? "" : "s"} fall outside the
                    four drawn lane groups and are not shown.
                  </Alert>
                ) : null}

                {visibleSpans.length === 0 ? (
                  <Alert severity="info">
                    {effectiveViewMode === EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT
                      ? "No event relations match the current report."
                      : "No matched event relations are available to display."}
                  </Alert>
                ) : (
                  <Box ref={setContainerNode} sx={{ width: "100%", minWidth: 0 }}>
                    {/* ---- legend svg (alpha: legendSvg) ---- */}
                    <Box
                      component="svg"
                      aria-hidden="true"
                      focusable="false"
                      width="100%"
                      viewBox={`0 0 ${dimensions.containerWidth} ${LEGEND.height}`}
                      sx={{ display: "block", height: LEGEND.height, overflow: "visible" }}
                    >
                      <text x={10} y={MARGINS.top + LEGEND.anchorY} dy=".5ex" fontSize={14}>
                        Event Occurrence:
                      </text>
                      <g transform={`translate(130, ${MARGINS.top})`}>
                        {presentRelations.map((relation, index) => (
                          <g key={relation} transform={`translate(${index * 110}, 0)`}>
                            <path
                              d={RELATION_LEGEND_PATHS[relation]}
                              fill={RELATION_COLOR}
                              stroke={RELATION_COLOR}
                              strokeWidth={relation === "Overlaps" ? 4 : 2}
                            />
                            <text x={25} y={10} alignmentBaseline="middle" fontSize={14}>
                              {relation}
                              <title>{RELATION_LEGEND_TITLES[relation]}</title>
                            </text>
                          </g>
                        ))}
                      </g>
                      <line
                        x1={10}
                        y1={LEGEND.height}
                        x2={dimensions.containerWidth}
                        y2={LEGEND.height}
                        stroke="#dbdbdb"
                        strokeWidth={1}
                        shapeRendering="crispEdges"
                      />
                    </Box>

                    {/* ---- "Showing:" scope select (alpha: legend dropdown) ---- */}
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="flex-end"
                      sx={{ mt: -3.5, mb: 1, pr: 1, position: "relative", zIndex: 1 }}
                    >
                      <Typography component="label" htmlFor={`${generatedId}-scope`} variant="caption">
                        Showing:
                      </Typography>
                      <Select
                        native
                        id={`${generatedId}-scope`}
                        size="small"
                        value={effectiveViewMode}
                        onChange={(event) => setViewMode(event.target.value)}
                        sx={{ fontSize: 12, height: 26, minWidth: 180, bgcolor: "background.paper" }}
                        inputProps={{
                          "aria-label": "Event relation timeline scope",
                          "data-testid": "event-relation-scope",
                        }}
                      >
                        <option value={EVENT_RELATION_TIMELINE_SCOPE_ALL}>
                          All Patient Events
                        </option>
                        <option
                          value={EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT}
                          disabled={!canFilterToCurrentReport}
                        >
                          Filtered Patient Events
                        </option>
                      </Select>
                    </Stack>

                    {/* ---- main timeline svg ---- */}
                    <Box
                      component="svg"
                      width="100%"
                      viewBox={`0 20 ${dimensions.containerWidth} ${dimensions.svgTotalHeight}`}
                      preserveAspectRatio="xMidYMid meet"
                      role="group"
                      aria-label="Event relation timeline chart"
                      aria-describedby={descriptionId}
                      sx={{ display: "block", overflow: "visible" }}
                    >
                      <defs>
                        <TimelineMarkerDefs idPrefix={generatedId} />
                        <clipPath id={`${generatedId}-secondary_area_clip`} clipPathUnits="userSpaceOnUse">
                          <rect
                            x={0}
                            y={-PADDING.top}
                            width={dimensions.svgWidth}
                            height={dimensions.totalContentHeight + GAPS.legendToMain + PADDING.top}
                          />
                        </clipPath>
                      </defs>

                      <rect
                        ref={zoomRectRef}
                        className="zoom_ER"
                        width={dimensions.svgWidth}
                        height={dimensions.totalContentHeight + GAPS.legendToMain}
                        transform={`translate(${MARGINS.left}, ${MARGINS.top + LEGEND.height})`}
                        fill="transparent"
                        style={{ cursor: "grab" }}
                      />

                      {/* axes (not clipped) */}
                      <g
                        className="axis-layer"
                        transform={`translate(${MARGINS.left}, ${dimensions.mainTop})`}
                      >
                        <TimeAxis scale={visibleX} orientation="top" className="main-ER-x-axis-top" />
                        <TimeAxis
                          scale={visibleX}
                          orientation="bottom"
                          className="main-ER-x-axis-bottom"
                          transform={`translate(0, ${dimensions.totalContentHeight})`}
                        />
                      </g>

                      <g className="main_ER_root" transform={`translate(${MARGINS.left}, ${dimensions.mainTop})`}>
                        {/* labels + toggles */}
                        <g className="main_ER_ui">
                          {groups.map((group) => (
                            <g
                              key={`ui:${group.key}`}
                              transform={`translate(0, ${group.yOffset + LANE.GROUP_TOP_PADDING})`}
                            >
                              <text
                                className="report_type_label"
                                transform={`translate(${-TEXT.marginLeft}, ${group.height / 2 - 5})`}
                                dy="0.35em"
                                textAnchor="end"
                                fontSize={14}
                              >
                                {`${group.key} (${group.spans.length}):`}
                              </text>
                              <FocusableGroup
                                className="group-toggle"
                                transform={`translate(${dimensions.svgWidth + 10}, ${group.height / 2 - 5})`}
                                role="button"
                                tabIndex={0}
                                aria-expanded={group.expanded}
                                aria-label={`${group.expanded ? "Collapse" : "Expand"} ${group.key} lane group`}
                                onClick={() => toggleGroup(group.key)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    toggleGroup(group.key);
                                  }
                                }}
                              >
                                <circle r={10} fill="transparent" />
                                <path
                                  className="toggle-icon"
                                  d="M -4 -2.67 L 0 1.33 L 4 -2.67"
                                  transform={group.expanded ? "rotate(0)" : "rotate(-90)"}
                                  fill="none"
                                  stroke="#666"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </FocusableGroup>
                            </g>
                          ))}
                        </g>

                        {/* data */}
                        <g className="main_ER_data" clipPath={`url(#${generatedId}-secondary_area_clip)`}>
                          <g className="date-anchors">
                            {uniqueDates.map((date) => (
                              <line
                                key={`anchor:${date.getTime()}`}
                                className="date-anchor-line"
                                x1={visibleX(date)}
                                x2={visibleX(date)}
                                y1={0}
                                y2={dimensions.totalContentHeight}
                                stroke={DATE_ANCHOR_COLOR}
                                strokeWidth={2}
                                strokeDasharray="3,3"
                                opacity={0.9}
                                pointerEvents="none"
                              />
                            ))}
                          </g>

                          {groups.map((group, groupIndex) => {
                            const isLastGroup = groupIndex === groups.length - 1;
                            const heatmap = group.expanded
                              ? []
                              : buildEventRelationHeatmap(group.spans, visibleX);

                            return (
                              <g
                                key={`data:${group.key}`}
                                className={`group group-data group-${group.key.replace(/\s+/g, "-")}`}
                                data-group-key={group.key}
                                transform={`translate(0, ${group.yOffset + LANE.GROUP_TOP_PADDING})`}
                              >
                                {!group.expanded ? (
                                  <g className="heatmap">
                                    {heatmap.map((bin, binIndex) => (
                                      <rect
                                        key={`bin:${binIndex}`}
                                        x={bin.x}
                                        y={0}
                                        width={bin.width}
                                        height={10}
                                        fill={bin.color}
                                        opacity={0.8}
                                      />
                                    ))}
                                    <rect
                                      x={0}
                                      y={0}
                                      width={dimensions.svgWidth}
                                      height={10}
                                      fill="none"
                                      stroke="#ccc"
                                      strokeWidth={1}
                                    />
                                  </g>
                                ) : null}

                                {group.spans.map((span) => (
                                  <g
                                    key={span.id}
                                    className="lane"
                                    transform={`translate(0, ${
                                      group.expanded ? span.laneIndex * LANE.height : 0
                                    })`}
                                  >
                                    <SpanMark
                                      span={span}
                                      x1={visibleX(new Date(span.startTime))}
                                      x2={visibleX(new Date(span.endTime))}
                                      expanded={group.expanded}
                                      isSelected={(span.conceptIds || []).some((id) =>
                                        activeSelectionSet.has(id)
                                      )}
                                      idPrefix={generatedId}
                                      onToggle={handleSpanToggle}
                                    />
                                  </g>
                                ))}

                                {!isLastGroup ? (
                                  <line
                                    className="group-divider"
                                    x1={0}
                                    x2={dimensions.svgWidth}
                                    y1={group.height}
                                    y2={group.height}
                                    stroke="#ccc"
                                    strokeWidth={1}
                                  />
                                ) : null}
                              </g>
                            );
                          })}
                        </g>
                      </g>

                      {/* age axis, only when a birth date is known */}
                      {ageAxis.available ? (
                        <g
                          className="age_ER"
                          transform={`translate(${MARGINS.left}, ${dimensions.ageTop})`}
                        >
                          <text
                            className="age_label"
                            x={-TEXT.marginLeft}
                            y={AGE_AREA.height / 2}
                            dy=".5ex"
                            textAnchor="end"
                            fontSize={14}
                          >
                            Patient Age
                          </text>
                          {ageAxis.encounters.map((encounter, index) => (
                            <g key={`age-edge:${index}`}>
                              <text
                                className="encounter_age"
                                x={encounter.x}
                                y={AGE_AREA.height / 2}
                                dy=".5ex"
                                textAnchor="middle"
                                fontSize={11}
                                fill="#444"
                              >
                                {encounter.age}
                              </text>
                              <line
                                className="encounter_age_guideline"
                                x1={encounter.x}
                                y1={12}
                                x2={encounter.x}
                                y2={25}
                                stroke="red"
                                strokeWidth={1}
                                shapeRendering="crispEdges"
                              />
                            </g>
                          ))}
                          {ageAxis.interiors.map((interior) => (
                            <g key={`age-birthday:${interior.age}`}>
                              <line
                                className="interior_age_guideline"
                                x1={interior.x}
                                y1={12}
                                x2={interior.x}
                                y2={25}
                                stroke="red"
                                strokeWidth={1}
                                shapeRendering="crispEdges"
                              />
                              <text
                                className="years_since_label"
                                x={interior.x}
                                y={AGE_AREA.height / 2}
                                textAnchor="middle"
                                fontSize={11}
                                fill="#444"
                              >
                                {interior.age}
                              </text>
                            </g>
                          ))}
                        </g>
                      ) : null}

                      {/* overview + brush */}
                      <g className="overview" transform={`translate(${MARGINS.left}, ${dimensions.overviewTop})`}>
                        <text
                          className="overview_label"
                          x={-TEXT.marginLeft}
                          y={OVERVIEW.height}
                          dy=".5ex"
                          textAnchor="end"
                          fontSize={14}
                        >
                          Date
                        </text>
                        <TimeAxis
                          scale={mainX}
                          orientation="bottom"
                          className="overview-x-axis"
                          transform={`translate(0, ${OVERVIEW.height})`}
                        />
                        <g ref={brushGroupRef} className="brush" />
                      </g>
                    </Box>

                    <Typography
                      id={statusId}
                      role="status"
                      aria-live="polite"
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mt: 0.5 }}
                    >
                      {`${baseModel.patientId || patientId} | ${visibleSpans.length} spans from ${
                        visibleModel?.matchedRowCount || 0
                      } relations`}
                      {selectedSpanCount > 0 ? ` | ${selectedSpanCount} selected` : ""}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </CardContent>
        </>
      ) : null}
    </Card>
  );
}

EventRelationTimelineCard.propTypes = {
  patientId: PropTypes.string,
  concepts: PropTypes.arrayOf(PropTypes.object),
  selectedDocument: PropTypes.object,
  embedded: PropTypes.bool,
  expanded: PropTypes.bool,
  onToggleExpanded: PropTypes.func,
  collapsiblePanelId: PropTypes.string,
  sectionLabel: PropTypes.string,
  birthDate: PropTypes.string,
  selectedConceptIds: PropTypes.arrayOf(PropTypes.string),
  onSelectConceptIds: PropTypes.func,
};
