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
  Button,
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
import { alpha, styled, useTheme } from "@mui/material/styles";
import { scaleTime } from "d3-scale";
import {
  AGE_AREA,
  COLLAPSED_CAP_COLOR,
  EVENT_RELATION_TIMELINE_SCOPE_ALL,
  EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT,
  GAPS,
  LANE,
  LEGEND,
  MARGINS,
  NEGATED_RELATION_COLOR,
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
  buildEventRelationOverviewRows,
  buildEventRelationTooltip,
  computeEventRelationAgeAxis,
  computeEventRelationDomain,
  computeEventRelationTimelineLayout,
  getEventRelationGlyph,
} from "../../utils/patientView/eventRelationTimelineLayout";
import {
  resolveResponsiveTickCount,
  resolveTicks,
} from "../../utils/patientView/timelineChartLayout";
import {
  describeViewportRange,
  getMinimumWindowRatio,
  viewportToDateWindow,
} from "../../utils/patientView/timelineViewport";
import { clientXToSvgX } from "../../hooks/useTimelineViewport";
import useLinkedTimelineViewport from "../../hooks/useLinkedTimelineViewport";
import { TIMELINE_CONTENT_PADDING_X, TIMELINE_PLOT_INSET } from "../../constants/timelineFrame";
import SectionCollapseToggle from "./SectionCollapseToggle";
import TimelineAxis from "./timeline/TimelineAxis";
import TimelineOverviewStrip from "./timeline/TimelineOverviewStrip";
import TimelineZoomControls from "./timeline/TimelineZoomControls";

const DEFAULT_CONTAINER_WIDTH = 1040;
const AXIS_FONT_SIZE = 10;

const ZOOM_CONTROL_LABELS = {
  group: "Event timeline zoom controls",
  zoomIn: "Zoom in event timeline",
  zoomOut: "Zoom out event timeline",
  panEarlier: "Pan event timeline earlier",
  panLater: "Pan event timeline later",
  reset: "Reset event timeline zoom",
};

const OVERVIEW_STRIP_LABELS = {
  group: "Event timeline date range",
  window: "Pan event timeline date range",
  start: "Start of event timeline date range",
  end: "End of event timeline date range",
};

/**
 * Theme-aware colors for the event timeline chrome (axes, gridlines and the
 * selection halo). The alpha hardcoded light-mode grays and a black selection
 * outline, which disappear or turn glaringly bright on the dark themes. The
 * semantic mark colors (green relations, red negation) are intentionally left
 * out — they carry meaning and read on every palette.
 */
export function getEventTimelineColors(theme) {
  const palette = theme?.palette || {};
  const textSecondary = palette.text?.secondary || "#505A5F";
  const textPrimary = palette.text?.primary || "#0B0C0C";
  const isDark = palette.mode === "dark";

  return {
    // Row and axis titles: the lane labels ("Finding (5):"), "Patient Age" and
    // "Date". The alpha left these unstyled, so they rendered black in every
    // theme — invisible on the dark ones.
    labelText: textPrimary,
    // Age-axis tick labels (alpha: #444) — read as text, so aim for AA contrast.
    ageText: textSecondary,
    // Structural hairlines: lane-group dividers, heatmap frame, legend rule, and
    // the scope <Select> outline (alpha: #ccc / #dbdbdb, ~11:1 and harsh on
    // dark). A muted text-derived tint keeps the lane grouping readable in both
    // modes without the near-white line the raw dark divider token can't match.
    structureLine: alpha(textSecondary, isDark ? 0.24 : 0.45),
    // Group collapse chevrons (alpha: #666) — a UI control, so keep them visible.
    toggleIcon: textSecondary,
    // Reference gridline at each unique date (alpha: #d3d3d3, ~12:1 and far too
    // loud on dark). Slightly stronger than the dividers since dashing lightens
    // its perceived weight, but still muted against the marks.
    dateAnchor: alpha(textSecondary, isDark ? 0.34 : 0.55),
    // Halo drawn behind a selected span/marker (alpha: black — invisible on a
    // dark panel). The primary text color contrasts with the panel either way.
    selectedOutline: textPrimary,
    // Date axes above and below the lanes. The overview strip's colors are
    // shared with the document timeline (getOverviewStripColors).
    axisText: textSecondary,
    axisLine: palette.text?.disabled || textSecondary,
  };
}

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

function RelationLegendItem({ relation }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minWidth: 86,
        fontFamily: "Roboto, Helvetica, Arial, sans-serif",
        fontSize: 14,
      }}
    >
      <Box
        component="svg"
        role="img"
        aria-label={`${relation}: ${RELATION_LEGEND_TITLES[relation] || relation}`}
        width={18}
        height={14}
        viewBox="0 0 18 14"
        sx={{ flex: "0 0 auto", overflow: "visible" }}
      >
        <title>{RELATION_LEGEND_TITLES[relation] || relation}</title>
        <path
          d={RELATION_LEGEND_PATHS[relation]}
          transform="translate(3, 1)"
          fill={RELATION_COLOR}
          stroke={RELATION_COLOR}
          strokeWidth={relation === "Overlaps" ? 4 : 2}
        />
      </Box>
      <Box component="span">{relation}</Box>
    </Box>
  );
}

RelationLegendItem.propTypes = {
  relation: PropTypes.string.isRequired,
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
function TimelineMarkerDefs({ idPrefix, selectedOutlineColor = SELECTED_OUTLINE_COLOR }) {
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
          stroke={selectedOutlineColor}
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
          stroke={selectedOutlineColor}
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
          <path d="M6 0 L6 12" stroke={selectedOutlineColor} strokeWidth={5} />
          <path d="M6 0 L6 12" stroke={RELATION_COLOR} strokeWidth={3} strokeOpacity={0.75} />
        </>
      )}
    </>
  );
}

TimelineMarkerDefs.propTypes = {
  idPrefix: PropTypes.string.isRequired,
  selectedOutlineColor: PropTypes.string,
};

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
function SpanMark({
  span,
  x1,
  x2,
  expanded,
  isSelected,
  hasActiveSelection,
  idPrefix,
  onToggle,
  selectedOutlineColor = SELECTED_OUTLINE_COLOR,
}) {
  const glyph = getEventRelationGlyph({ ...span, x1, x2 }, { expanded });
  const stroke = span.negated ? NEGATED_RELATION_COLOR : RELATION_COLOR;
  const isDimmed = hasActiveSelection && !isSelected;
  const strokeOpacity = isDimmed ? 0.3 : expanded ? 0.75 : 0.5;
  const tooltip = buildEventRelationTooltip(span, { includeDuration: glyph.kind === "span" });
  const label = `${span.conceptLabels.join(", ")}. ${span.laneGroup}. ${span.relation1} ${
    span.start
  }; ${span.relation2} ${span.end}.${span.negated ? " Negated." : ""}`;
  const selectionClass = isSelected ? "selected" : isDimmed ? "unselected" : "";

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
        className={`event-relation-mark ${selectionClass}`.trim()}
        data-event-relation-id={span.id}
        data-concept-ids={span.conceptIds.join(",")}
        data-lane-group={span.laneGroup}
        data-relation-key={span.relationKey}
        data-negated={span.negated ? "true" : "false"}
        data-selected={isSelected ? "true" : "false"}
        data-selection-state={selectionClass || "none"}
        {...common}
      >
        <title>{tooltip}</title>
        <line
          className="relation-outline"
          x1={x1}
          y1={-7}
          x2={x1}
          y2={7}
          stroke={selectedOutlineColor}
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
      className={`event-relation-mark ${selectionClass}`.trim()}
      data-event-relation-id={span.id}
      data-concept-ids={span.conceptIds.join(",")}
      data-lane-group={span.laneGroup}
      data-relation-key={span.relationKey}
      data-negated={span.negated ? "true" : "false"}
      data-selected={isSelected ? "true" : "false"}
      data-selection-state={selectionClass || "none"}
      {...common}
    >
      <title>{tooltip}</title>
      <line
        className="relation-outline"
        x1={x1}
        y1={0}
        x2={x2}
        y2={0}
        stroke={selectedOutlineColor}
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
  hasActiveSelection: PropTypes.bool.isRequired,
  idPrefix: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
  selectedOutlineColor: PropTypes.string,
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
  onOpenReport = undefined,
}) {
  const shouldRender = shouldShowEventRelationTimeline(patientId);
  const theme = useTheme();
  const colors = useMemo(() => getEventTimelineColors(theme), [theme]);
  const generatedId = useId().replace(/:/g, "");
  const panelBodyId = collapsiblePanelId || `${generatedId}-event-relation-timeline-body`;
  const descriptionId = `${generatedId}-event-relation-description`;
  const statusId = `${generatedId}-event-relation-status`;

  const resizeObserverRef = useRef(null);
  const svgRef = useRef(null);

  const [rawTimelineText, setRawTimelineText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [viewMode, setViewMode] = useState(EVENT_RELATION_TIMELINE_SCOPE_ALL);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [containerWidth, setContainerWidth] = useState(DEFAULT_CONTAINER_WIDTH);
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

  // Keep dates in the same positions when the report filter changes.
  const patientDomain = useMemo(
    () => computeEventRelationDomain(baseModel?.spans || []),
    [baseModel]
  );
  const hasVisibleChart = expanded && !isLoading && Boolean(visibleModel?.spans.length);

  // --- zoom and pan ----------------------------------------------------
  // Under a TimelineLinkProvider this is shared with the document timeline,
  // over a date domain covering both, and the two line up. The viewport is
  // ratio-based, so a resize or a collapsed lane keeps the reader's range. The
  // domain comes from every span, not the "Showing" filter, so switching scope
  // keeps it too.
  const hasEventData = shouldRender && Boolean(baseModel?.spans?.length);
  const {
    viewport,
    setViewport,
    zoomIn,
    zoomOut,
    panEarlier,
    panLater,
    reset: resetZoom,
    handlePlotKeyDown,
    handlePlotPointerDown,
    isDragging,
    announcement: rangeAnnouncement,
    isAnnouncer,
    domain: sharedDomain,
    isZoomed,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    canPanEarlier,
    canPanLater,
    canReset,
  } = useLinkedTimelineViewport({
    id: "event-timeline",
    priority: 1,
    domain: hasEventData ? patientDomain : null,
    resetKey: `${patientId}|${patientDomain.startDate.getTime()}|${patientDomain.endDate.getTime()}`,
    describeRange: (nextViewport) =>
      describeViewportRange(nextViewport, patientDomain.startDate, patientDomain.endDate),
  });

  const layout = useMemo(
    () =>
      computeEventRelationTimelineLayout({
        containerWidth,
        spans: visibleModel?.spans || [],
        domain: sharedDomain || patientDomain,
        collapsedGroups,
        showAgeAxis: Boolean(resolvedBirthDate),
        plotInsets: TIMELINE_PLOT_INSET,
      }),
    [containerWidth, visibleModel, sharedDomain, patientDomain, collapsedGroups, resolvedBirthDate]
  );

  const { dimensions, mainX, domain, groups, uniqueDates } = layout;

  // The zoomed x scale drives every mark and both main axes; `mainX` (the full
  // domain) drives the overview strip.
  const visibleX = useMemo(() => {
    const { startDate, endDate } = viewportToDateWindow(
      viewport,
      domain.startDate,
      domain.endDate
    );
    return scaleTime().domain([startDate, endDate]).range(mainX.range());
  }, [viewport, domain, mainX]);

  const mainAxisTicks = useMemo(() => {
    const [startDate, endDate] = visibleX.domain();
    return resolveTicks(
      startDate,
      endDate,
      dimensions.svgWidth,
      0,
      resolveResponsiveTickCount(dimensions.svgWidth)
    );
  }, [visibleX, dimensions.svgWidth]);

  const overviewRows = useMemo(() => buildEventRelationOverviewRows(groups), [groups]);

  const ageAxis = useMemo(
    () => computeEventRelationAgeAxis(domain, visibleX, resolvedBirthDate),
    [domain, visibleX, resolvedBirthDate]
  );

  // Pointer x in the plot's own units: the plot starts `marginLeft` into the SVG.
  const plotOffsetX = dimensions.marginLeft;
  const clientToPlotX = useCallback(
    (clientX) => {
      const svgX = clientXToSvgX(svgRef.current, clientX);
      return svgX == null ? null : svgX - plotOffsetX;
    },
    [plotOffsetX]
  );

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
  const zoomControls = (
    <TimelineZoomControls
      zoomPercent={zoomPercent}
      onZoomIn={() => zoomIn()}
      onZoomOut={() => zoomOut()}
      onPanEarlier={panEarlier}
      onPanLater={panLater}
      onReset={resetZoom}
      canZoomIn={canZoomIn}
      canZoomOut={canZoomOut}
      canPanEarlier={canPanEarlier}
      canPanLater={canPanLater}
      canReset={canReset}
      disabled={!hasVisibleChart}
      labels={ZOOM_CONTROL_LABELS}
    />
  );

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
      {/* Outside the collapsible body, so linked range changes are still
          announced while this section is collapsed. One linked timeline owns it. */}
      {isAnnouncer ? (
        <Typography
          variant="caption"
          aria-live="polite"
          data-testid="event-timeline-range-status"
          sx={visuallyHiddenSx}
        >
          {rangeAnnouncement}
        </Typography>
      ) : null}
      {expanded ? (
        <>
          <Divider />
          <CardContent
            id={panelBodyId}
            sx={{
              // Matches the document timeline, so the two plots line up.
              px: TIMELINE_CONTENT_PADDING_X,
              py: 1.25,
              "&:last-child": { pb: 1.25 },
              ...(embedded ? { minHeight: 0, overflow: "visible" } : {}),
            }}
          >
            <Typography id={descriptionId} variant="caption" component="p" sx={visuallyHiddenSx}>
              Event relation timeline. Temporal relations are packed into
              overlap-free lanes grouped by Finding, Disease, Stage Grade and
              Treatment. Marks are green, or red when the concept is negated.
              Use the zoom buttons, the + and − keys, or the handles on the
              overview strip below the chart to choose the date range; drag the
              chart or press ← and → to pan. The overview strip always shows the
              full date range.
            </Typography>

            {isLoading ? (
              <Stack direction="row" spacing={1} alignItems="center" role="status" aria-live="polite">
                <CircularProgress size={18} aria-label="Loading event relations" />
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

                <Box ref={setContainerNode} sx={{ width: "100%", minWidth: 0 }}>
                    <Box
                      className="event-relation-legend"
                      sx={{
                        minHeight: LEGEND.height,
                        borderBottom: `1px solid ${colors.structureLine}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        flexWrap: "wrap",
                        px: 1.25,
                        py: 0.5,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.25}
                        alignItems="center"
                        sx={{ flexWrap: "wrap", rowGap: 0.5, minWidth: 0 }}
                      >
                        <Typography
                          component="span"
                          sx={{
                            fontFamily: "Roboto, Helvetica, Arial, sans-serif",
                            fontSize: 14,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Event Occurrence:
                        </Typography>
                        {presentRelations.map((relation) => (
                          <RelationLegendItem key={relation} relation={relation} />
                        ))}
                      </Stack>

                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        justifyContent="flex-end"
                        sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                      >
                        {zoomControls}
                        <Typography
                          component="label"
                          htmlFor={`${generatedId}-scope`}
                          sx={{
                            fontFamily: "Roboto, Helvetica, Arial, sans-serif",
                            fontSize: 14,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Showing:
                        </Typography>
                        <Select
                          native
                          id={`${generatedId}-scope`}
                          size="small"
                          value={effectiveViewMode}
                          onChange={(event) => setViewMode(event.target.value)}
                          sx={{
                            fontFamily: "Arial, sans-serif",
                            fontSize: 12,
                            height: 24,
                            minWidth: 165,
                            bgcolor: "background.paper",
                            "& .MuiNativeSelect-select": {
                              py: 0,
                              height: 24,
                              lineHeight: "24px",
                            },
                            "& fieldset": { borderColor: colors.structureLine },
                          }}
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
                        {selectedDocument && onOpenReport ? (
                          <Button size="small" onClick={onOpenReport}>
                            Open report
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                    {selectedDocument ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5 }}
                      >
                        Current report: {selectedDocument.name || selectedDocument.id}
                      </Typography>
                    ) : null}

                    {visibleSpans.length === 0 ? (
                      <Alert severity="info" role="status" sx={{ mt: 1 }}>
                        {effectiveViewMode === EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT
                          ? "No event relations match the current report."
                          : "No matched event relations are available to display."}
                      </Alert>
                    ) : (
                      <>
                    {/* ---- main timeline svg ---- */}
                    <Box
                      component="svg"
                      ref={svgRef}
                      width="100%"
                      viewBox={`0 ${dimensions.viewBoxTop} ${dimensions.viewBoxWidth} ${dimensions.svgTotalHeight}`}
                      preserveAspectRatio="xMidYMid meet"
                      role="group"
                      aria-label="Event relation timeline chart"
                      aria-describedby={descriptionId}
                      onKeyDown={handlePlotKeyDown}
                      sx={{
                        display: "block",
                        overflow: "visible",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        "& .main-ER-x-axis-top text, & .main-ER-x-axis-bottom text, & .overview-x-axis text": {
                          fontFamily: "Monaco, monospace",
                          fontSize: "10px",
                        },
                        "& .report_type_label, & .age_label, & .overview_label": {
                          fontFamily: "Roboto, Helvetica, Arial, sans-serif",
                          fontSize: "14px",
                        },
                        "& .encounter_age, & .years_since_label": {
                          fontFamily: "Roboto, Helvetica, Arial, sans-serif",
                          fontSize: "11px",
                        },
                      }}
                    >
                      <defs>
                        <TimelineMarkerDefs
                          idPrefix={generatedId}
                          selectedOutlineColor={colors.selectedOutline}
                        />
                        <clipPath id={`${generatedId}-secondary_area_clip`} clipPathUnits="userSpaceOnUse">
                          <rect
                            x={0}
                            y={-PADDING.top}
                            width={dimensions.svgWidth}
                            height={dimensions.totalContentHeight + GAPS.legendToMain + PADDING.top}
                          />
                        </clipPath>
                        <clipPath id={`${generatedId}-age_axis_clip`} clipPathUnits="userSpaceOnUse">
                          <rect
                            x={-16}
                            y={-8}
                            width={dimensions.svgWidth + 32}
                            height={40}
                          />
                        </clipPath>
                      </defs>

                      {/* Press-and-drag here pans a zoomed chart. Spans sit above it. */}
                      <rect
                        className="zoom_ER"
                        width={dimensions.svgWidth}
                        height={dimensions.totalContentHeight + GAPS.legendToMain}
                        transform={`translate(${dimensions.marginLeft}, ${MARGINS.top + LEGEND.height})`}
                        fill="transparent"
                        style={{
                          cursor: isDragging ? "grabbing" : isZoomed ? "grab" : "default",
                          // Vertical gestures still scroll the page.
                          touchAction: "pan-y",
                        }}
                        onPointerDown={(event) =>
                          handlePlotPointerDown(event, {
                            clientToX: clientToPlotX,
                            plotWidth: dimensions.svgWidth,
                          })
                        }
                      />

                      {/* axes (not clipped) */}
                      <g
                        className="axis-layer"
                        transform={`translate(${dimensions.marginLeft}, ${dimensions.mainTop})`}
                      >
                        <TimelineAxis
                          ticks={mainAxisTicks}
                          x1={0}
                          x2={dimensions.svgWidth}
                          y={0}
                          orientation="top"
                          labelOffset={8}
                          lineColor={colors.axisLine}
                          textColor={colors.axisText}
                          fontSize={AXIS_FONT_SIZE}
                          className="main-ER-x-axis-top"
                        />
                        <TimelineAxis
                          ticks={mainAxisTicks}
                          x1={0}
                          x2={dimensions.svgWidth}
                          y={dimensions.totalContentHeight}
                          orientation="bottom"
                          labelOffset={15}
                          lineColor={colors.axisLine}
                          textColor={colors.axisText}
                          fontSize={AXIS_FONT_SIZE}
                          className="main-ER-x-axis-bottom"
                        />
                      </g>

                      <g className="main_ER_root" transform={`translate(${dimensions.marginLeft}, ${dimensions.mainTop})`}>
                        {/* labels + toggles */}
                        <g className="main_ER_ui">
                          {groups.map((group) => (
                            <g
                              key={`ui:${group.key}`}
                              transform={`translate(0, ${group.yOffset + LANE.GROUP_TOP_PADDING})`}
                            >
                              <text
                                className="report_type_label"
                                fill={colors.labelText}
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
                                  stroke={colors.toggleIcon}
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
                                stroke={colors.dateAnchor}
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
                                      stroke={colors.structureLine}
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
                                      hasActiveSelection={activeSelectionSet.size > 0}
                                      idPrefix={generatedId}
                                      onToggle={handleSpanToggle}
                                      selectedOutlineColor={colors.selectedOutline}
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
                                    stroke={colors.structureLine}
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
                          transform={`translate(${dimensions.marginLeft}, ${dimensions.ageTop})`}
                        >
                          <text
                            className="age_label"
                            fill={colors.labelText}
                            x={-TEXT.marginLeft}
                            y={AGE_AREA.height / 2}
                            dy=".5ex"
                            textAnchor="end"
                            fontSize={14}
                          >
                            Patient Age
                          </text>
                          <g clipPath={`url(#${generatedId}-age_axis_clip)`}>
                            {ageAxis.encounters.map((encounter, index) => (
                              <g key={`age-edge:${index}`}>
                                <text
                                  className="encounter_age"
                                  x={encounter.x}
                                  y={AGE_AREA.height / 2}
                                  dy=".5ex"
                                  textAnchor="middle"
                                  fontSize={11}
                                  fill={colors.ageText}
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
                                  fill={colors.ageText}
                                >
                                  {interior.age}
                                </text>
                              </g>
                            ))}
                          </g>
                        </g>
                      ) : null}

                      {/* overview strip: the full date range, never zoomed */}
                      <g className="overview" transform={`translate(${dimensions.marginLeft}, ${dimensions.overviewTop})`}>
                        <text
                          className="overview_label"
                          fill={colors.labelText}
                          x={-TEXT.marginLeft}
                          y={dimensions.overviewHeight / 2}
                          dy=".5ex"
                          textAnchor="end"
                          fontSize={14}
                        >
                          Date
                        </text>
                        <TimelineOverviewStrip
                          plotLeft={0}
                          plotWidth={dimensions.svgWidth}
                          top={0}
                          rows={overviewRows}
                          viewport={viewport}
                          onViewportChange={setViewport}
                          minWindowRatio={getMinimumWindowRatio(dimensions.svgWidth)}
                          domainStart={domain.startDate}
                          domainEnd={domain.endDate}
                          tickCount={resolveResponsiveTickCount(dimensions.svgWidth)}
                          fontSize={AXIS_FONT_SIZE}
                          clientToX={clientToPlotX}
                          labels={OVERVIEW_STRIP_LABELS}
                          testIdPrefix="event-timeline"
                          className="overview-x-axis"
                        />
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
                      </>
                    )}
                  </Box>
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
  onOpenReport: PropTypes.func,
};
