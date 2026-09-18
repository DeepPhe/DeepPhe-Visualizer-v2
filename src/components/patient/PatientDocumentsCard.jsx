import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  buildDocumentOverviewRows,
  buildTimelineChartModel,
  resolveResponsiveTickCount,
  resolveTicks,
  resolveTimelineDateDomain,
} from "../../utils/patientView/timelineChartLayout";
import {
  computeOverviewStripLayout,
  describeViewportRange,
  formatHandleDate,
  getMinimumWindowRatio,
  viewportToDateWindow,
} from "../../utils/patientView/timelineViewport";
import { clientXToSvgX } from "../../hooks/useTimelineViewport";
import useLinkedTimelineViewport from "../../hooks/useLinkedTimelineViewport";
import usePatientViewPresentation from "../../hooks/usePatientViewPresentation";
import {
  COMPACT_TIMELINE_WIDTH,
  DOCUMENT_CHART_BORDER_WIDTH,
  TIMELINE_CONTENT_PADDING_X,
  TIMELINE_PLOT_INSET,
} from "../../constants/timelineFrame";
import { getReadableTextColor } from "../../utils/colorContrast";
import { PATIENT_VIEW_TYPE } from "../../constants/patientViewTypography";
import SectionCollapseToggle from "./SectionCollapseToggle";
import TimelineAxis from "./timeline/TimelineAxis";
import TimelineOverviewStrip from "./timeline/TimelineOverviewStrip";
import TimelineZoomControls from "./timeline/TimelineZoomControls";

export { resolveResponsiveTickCount };

const EPISODE_SELECT_ALL = "__all__";
const EPISODE_SELECT_HIDDEN = "__hidden__";

// Below this rendered width the left label gutter would swallow the plot, so we
// switch to a "compact" layout: report-type labels sit above each lane, fonts
// and dots grow, and fewer date ticks are drawn.
const COMPACT_WIDTH_BREAKPOINT = COMPACT_TIMELINE_WIDTH;
// Space between the detail axis's labels and the top of the overview strip.
const OVERVIEW_STRIP_GAP = 6;

const ZOOM_CONTROL_LABELS = {
  group: "Document timeline zoom controls",
  zoomIn: "Zoom in timeline",
  zoomOut: "Zoom out timeline",
  panEarlier: "Pan timeline earlier",
  panLater: "Pan timeline later",
  reset: "Reset timeline zoom",
};

const OVERVIEW_STRIP_LABELS = {
  group: "Document timeline date range",
  window: "Pan document timeline date range",
  start: "Start of document timeline date range",
  end: "End of document timeline date range",
};

const visuallyHiddenSx = {
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
};

export function getTimelineSvgColors(theme) {
  const textColor = theme?.palette?.text?.secondary || "#505A5F";
  const axisColor = theme?.palette?.text?.disabled || textColor;
  const selectedMarkerColor = theme?.palette?.text?.primary || textColor;
  const relatedStrokeColor = theme?.palette?.primary?.main || textColor;
  const eventRelatedStrokeColor =
    theme?.palette?.mode === "dark" ? "#F6C744" : "#8A6400";
  const pointStrokeColor =
    theme?.palette?.mode === "dark"
      ? theme?.palette?.background?.default || "#0B1220"
      : alpha(theme?.palette?.common?.black || "#000000", 0.55);
  const docCountBadgeBackground = theme?.palette?.info?.main || relatedStrokeColor;
  const docCountBadgeText = getReadableTextColor(docCountBadgeBackground, {
    candidates: [theme?.palette?.info?.contrastText],
  });

  // The overview strip's colors are shared with the Event Timeline; see
  // getOverviewStripColors in timeline/TimelineOverviewStrip.jsx.
  return {
    axisColor,
    docCountBadgeBackground,
    docCountBadgeText,
    eventRelatedStrokeColor,
    pointStrokeColor,
    relatedStrokeColor,
    selectedMarkerColor,
    textColor,
  };
}

// Derives a content-sized viewBox from the measured width and report-type count.
// Width remains responsive, while height is the exact space needed for the
// lanes and date axis. This prevents a short timeline from being stretched into
// a large, mostly empty canvas on wide screens.
function computeChartLayout({ width }) {
  const compact = width < COMPACT_WIDTH_BREAKPOINT;

  const plotTop = compact ? 10 : 8;
  // Footer holds the detail date axis and its labels. The overview strip below
  // it grows with the report-type count, so the card adds its height.
  const tickLabelOffset = compact ? 20 : 19;
  const footerHeight = 5 + tickLabelOffset + 4;
  // Wide layouts share their plot edges with the Event Timeline so the two line
  // up (constants/timelineFrame.js). The chart's own border is inside the frame.
  const plotLeft = compact ? 16 : TIMELINE_PLOT_INSET.left - DOCUMENT_CHART_BORDER_WIDTH;
  const plotRight = compact ? 16 : TIMELINE_PLOT_INSET.right - DOCUMENT_CHART_BORDER_WIDTH;
  // Vertical distance between report-type lanes. Kept just above the selected
  // ring diameter so lanes stay tight without dots colliding across rows.
  const rowHeight = compact ? 42 : 30;

  const dimensions = {
    // Keep the viewBox at the rendered width so preserveAspectRatio never
    // letterboxes the timeline vertically on phone-sized containers.
    svgWidth: Math.max(compact ? 160 : COMPACT_WIDTH_BREAKPOINT, Math.round(width)),
    plotLeft,
    plotRight,
    plotTop,
    rowHeight: Math.round(rowHeight),
    footerHeight,
    stackSpacing: compact ? 11 : 8,
  };
  const plotWidth = dimensions.svgWidth - plotLeft - plotRight;
  const maxTickCount = compact ? 4 : 7;

  const typeScale = {
    compact,
    labelMode: compact ? "top" : "left",
    rowLabelFont: compact ? 13 : 12,
    tickFont: 12,
    tickLabelOffset,
    axisTitleFont: compact ? 12 : 11,
    tickCount: resolveResponsiveTickCount(plotWidth, maxTickCount),
    pointRadius: compact ? 5 : 4,
    selectedRadius: compact ? 7 : 5.5,
    selectedRingRadius: compact ? 13 : 10,
    relatedRingRadius: compact ? 8 : 6.5,
    eventRelatedRingRadius: compact ? 11 : 8.5,
  };

  return { dimensions, typeScale };
}

function getPointAriaLabel(point, { isRelated = false, isEventRelated = false } = {}) {
  const states = [
    isRelated ? "Linked to selected cancer or tumor fact" : "",
    isEventRelated ? "Linked to selected event timeline concept" : "",
  ].filter(Boolean);

  return [
    `Document ${point.name || point.id}`,
    `ID ${point.id}`,
    `Type ${point.type}`,
    `Episode ${point.episodeLabel}`,
    `Date ${point.dateLabel}`,
    ...states,
  ].join(". ");
}

function formatEpisodeDocumentOption(point) {
  return `${point.dateLabel} • ${point.type} • ${point.name}`;
}

function EpisodeFilterDropdown({
  episode,
  points = [],
  value = EPISODE_SELECT_ALL,
  onChange = undefined,
}) {
  const selectId = `episode-filter-${episode.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <FormControl size="small" sx={{ minWidth: 260, flex: "1 1 260px", maxWidth: 380 }}>
      <InputLabel id={`${selectId}-label`} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box
          component="span"
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: episode.color,
            border: `1px solid ${alpha("#000", 0.35)}`,
          }}
        />
        {`${episode.label} (${episode.count})`}
      </InputLabel>
      <Select
        native
        labelId={`${selectId}-label`}
        id={selectId}
        value={value}
        label={`${episode.label} (${episode.count})`}
        onChange={(event) => onChange?.(episode.label, event.target.value)}
      >
        <option value={EPISODE_SELECT_ALL}>Show all documents</option>
        <option value={EPISODE_SELECT_HIDDEN}>Hide this episode</option>
        {points.map((point) => (
          <option key={`${episode.key}:${point.id}`} value={point.id}>
            {formatEpisodeDocumentOption(point)}
          </option>
        ))}
      </Select>
    </FormControl>
  );
}

EpisodeFilterDropdown.propTypes = {
  episode: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    count: PropTypes.number.isRequired,
    color: PropTypes.string.isRequired,
  }).isRequired,
  points: PropTypes.arrayOf(PropTypes.object),
  value: PropTypes.string,
  onChange: PropTypes.func,
};

export default function PatientDocumentsCard({
  timelineData = null,
  selectedDocumentId = "",
  relatedDocumentIds = [],
  eventRelatedDocumentIds = [],
  onSelectDocument = undefined,
  embedded = false,
  expanded = true,
  onToggleExpanded = undefined,
  collapsiblePanelId = undefined,
  sectionLabel = "Patient Document Timeline",
}) {
  const theme = useTheme();
  const { isImproved } = usePatientViewPresentation();
  const timelineColors = getTimelineSvgColors(theme);
  // High-contrast foreground for the "currently viewed" marker so its ring stays
  // visible on every theme (near-black on light themes, near-white on dark ones).
  // A hardcoded near-black ring is ~1.2:1 on the dark theme's navy panel.
  const selectedMarkerColor = timelineColors.selectedMarkerColor;
  const [hiddenEpisodes, setHiddenEpisodes] = useState(() => new Set());
  const [episodeSelections, setEpisodeSelections] = useState({});
  const svgRef = useRef(null);
  // Rendered width of the chart container, tracked so labels and ticks can
  // respond without coupling the chart to an arbitrary panel height.
  const [chartWidth, setChartWidth] = useState(1200);
  const resizeObserverRef = useRef(null);

  // Callback ref: (re)attaches a ResizeObserver whenever the chart container
  // mounts — including when it reappears after leaving collapsed-timestamp mode.
  const chartContainerRef = useCallback((node) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (!node) {
      return;
    }
    // Measure now rather than waiting for the observer's first callback, so the
    // first paint is already at the real width and lines up with the Event
    // Timeline (which measures the same way).
    const initialWidth = node.clientWidth;
    if (initialWidth > 0) {
      setChartWidth((previous) => (Math.abs(previous - initialWidth) < 2 ? previous : initialWidth));
    }
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width } = entry.contentRect;
      setChartWidth((previous) => {
        // Ignore sub-pixel jitter to avoid re-laying out on every scroll frame.
        if (Math.abs(previous - width) < 2) {
          return previous;
        }
        return width;
      });
    });
    observer.observe(node);
    resizeObserverRef.current = observer;
  }, []);

  const relatedIdSet = useMemo(
    () =>
      new Set(
        (Array.isArray(relatedDocumentIds) ? relatedDocumentIds : [])
          .map((documentId) => String(documentId || "").trim())
          .filter(Boolean)
      ),
    [relatedDocumentIds]
  );
  const eventRelatedIdSet = useMemo(
    () =>
      new Set(
        (Array.isArray(eventRelatedDocumentIds) ? eventRelatedDocumentIds : [])
          .map((documentId) => String(documentId || "").trim())
          .filter(Boolean)
      ),
    [eventRelatedDocumentIds]
  );

  // The model applies the measured width and derives height directly from its
  // report-type row count.
  const { dimensions: layoutDimensions, typeScale } = useMemo(
    () =>
      computeChartLayout({
        width: chartWidth,
      }),
    [chartWidth]
  );
  const timelineSignature = useMemo(
    () =>
      (Array.isArray(timelineData?.reportData) ? timelineData.reportData : [])
        .map((report) => String(report?.id || "").trim())
        .filter(Boolean)
        .join("|"),
    [timelineData]
  );

  useEffect(() => {
    setHiddenEpisodes(new Set());
    setEpisodeSelections({});
  }, [timelineSignature]);

  // Horizontal (time-axis) zoom and pan. Under a TimelineLinkProvider this is
  // shared with the Event Timeline, over a date domain covering both; alone, it
  // is this card's own and resets when the set of documents changes.
  const ownDateDomain = useMemo(() => resolveTimelineDateDomain(timelineData || {}), [timelineData]);
  const {
    viewport,
    setViewport,
    zoomIn,
    zoomOut,
    panEarlier,
    panLater,
    reset: handleResetView,
    handlePlotKeyDown,
    handlePlotPointerDown,
    consumeDragClick,
    isDragging,
    announcement: rangeAnnouncement,
    isAnnouncer,
    domain: sharedDateDomain,
    isZoomed,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    canPanEarlier,
    canPanLater,
    canReset,
  } = useLinkedTimelineViewport({
    id: "document-timeline",
    priority: 0,
    domain: ownDateDomain,
    resetKey: timelineSignature,
    describeRange: (nextViewport) =>
      ownDateDomain
        ? describeViewportRange(nextViewport, ownDateDomain.startDate, ownDateDomain.endDate)
        : "",
  });

  const chartModel = useMemo(
    () =>
      buildTimelineChartModel(timelineData || {}, {
        ...layoutDimensions,
        dateDomain: sharedDateDomain,
      }),
    [timelineData, layoutDimensions, sharedDateDomain]
  );
  const { dateDomain } = chartModel;

  const visiblePoints = useMemo(
    () =>
      chartModel.points.filter((point) => {
        return !hiddenEpisodes.has(point.episodeLabel);
      }),
    [chartModel.points, hiddenEpisodes]
  );
  const isCollapsedTimestampMode = Boolean(chartModel.dateDiagnostics?.hasDateCollapse);

  const selectedPoint = useMemo(() => {
    const normalizedSelectedId = String(selectedDocumentId || "").trim();
    if (!normalizedSelectedId) {
      return null;
    }

    return chartModel.points.find((point) => point.id === normalizedSelectedId) || null;
  }, [chartModel.points, selectedDocumentId]);

  const pointsByEpisode = useMemo(() => {
    const map = new Map();
    chartModel.episodes.forEach((episode) => {
      map.set(
        episode.label,
        chartModel.points.filter((point) => point.episodeLabel === episode.label)
      );
    });
    return map;
  }, [chartModel.episodes, chartModel.points]);

  const handleEpisodeSelection = (episodeLabel, nextValue) => {
    const normalizedLabel = String(episodeLabel || "").trim();
    if (!normalizedLabel) {
      return;
    }

    const normalizedValue = String(nextValue || "").trim() || EPISODE_SELECT_ALL;
    setEpisodeSelections((previousSelections) => ({
      ...previousSelections,
      [normalizedLabel]: normalizedValue,
    }));

    if (normalizedValue === EPISODE_SELECT_HIDDEN) {
      setHiddenEpisodes((previousSet) => {
        const nextSet = new Set(previousSet);
        nextSet.add(normalizedLabel);
        return nextSet;
      });
      return;
    }

    setHiddenEpisodes((previousSet) => {
      if (!previousSet.has(normalizedLabel)) {
        return previousSet;
      }
      const nextSet = new Set(previousSet);
      nextSet.delete(normalizedLabel);
      return nextSet;
    });

    if (normalizedValue !== EPISODE_SELECT_ALL) {
      onSelectDocument?.(normalizedValue);
    }
  };

  // --- Time-axis zoom + pan -------------------------------------------------
  const { dimensions } = chartModel;
  const plotLeft = dimensions.plotLeft;
  const plotWidth = dimensions.plotWidth;
  const clipPathId = useId();
  const axisY = dimensions.baselineY + 5;
  const minWindowRatio = getMinimumWindowRatio(plotWidth);

  // The overview strip sits under the detail axis and grows with the number of
  // report-type rows it miniaturizes.
  const overviewTop = dimensions.svgHeight + OVERVIEW_STRIP_GAP;
  const chartHeight =
    overviewTop +
    computeOverviewStripLayout({ rowCount: chartModel.rows.length, compact: typeScale.compact })
      .height;
  const overviewRows = useMemo(
    () =>
      buildDocumentOverviewRows(chartModel.rows, visiblePoints, {
        stroke: timelineColors.pointStrokeColor,
      }),
    [chartModel.rows, visiblePoints, timelineColors.pointStrokeColor]
  );

  // Map a base (full-domain) x-coordinate into the current zoom/pan window.
  const transformX = useCallback(
    (baseX) =>
      plotLeft +
      viewport.zoom * (baseX - plotLeft) -
      plotWidth * viewport.zoom * viewport.panRatio,
    [plotLeft, plotWidth, viewport.zoom, viewport.panRatio]
  );

  // The detail axis covers exactly the visible window, so its first and last
  // labels are the selection's edges.
  const displayTicks = useMemo(() => {
    const { startDate, endDate } = viewportToDateWindow(
      viewport,
      dateDomain.startDate,
      dateDomain.endDate
    );
    return resolveTicks(startDate, endDate, plotWidth, plotLeft, typeScale.tickCount);
  }, [viewport, dateDomain, plotWidth, plotLeft, typeScale.tickCount]);

  const clientToSvgX = useCallback((clientX) => clientXToSvgX(svgRef.current, clientX), []);

  const formatRange = (startDate, endDate) =>
    `${formatHandleDate(startDate, { includeYear: true })} – ${formatHandleDate(endDate, {
      includeYear: true,
    })}`;
  const visibleWindow = viewportToDateWindow(viewport, dateDomain.startDate, dateDomain.endDate);
  const visibleRangeLabel = formatRange(visibleWindow.startDate, visibleWindow.endDate);
  const fullRangeLabel = formatRange(dateDomain.startDate, dateDomain.endDate);

  const handlePointerDown = (event) => {
    handlePlotPointerDown(event, { clientToX: clientToSvgX, plotWidth });
  };

  const handleSelectPoint = (documentId) => {
    if (consumeDragClick()) {
      return;
    }
    onSelectDocument?.(documentId);
  };

  // Zoom/pan controls live in the card header, on the same line as the title.
  // Only meaningful when the zoomable chart is shown (not the collapsed-timestamp
  // dropdown mode and with at least one dated report).
  const showZoomControls =
    expanded && !isCollapsedTimestampMode && chartModel.totalReports > 0;
  const zoomControls = (
    <TimelineZoomControls
      zoomPercent={zoomPercent}
      onZoomIn={() => zoomIn()}
      onZoomOut={() => zoomOut()}
      onPanEarlier={panEarlier}
      onPanLater={panLater}
      onReset={handleResetView}
      canZoomIn={canZoomIn}
      canZoomOut={canZoomOut}
      canPanEarlier={canPanEarlier}
      canPanLater={canPanLater}
      canReset={canReset}
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
          ? {
              display: "flex",
              flexDirection: "column",
              height: "auto",
              minHeight: 0,
              overflow: "visible",
            }
          : {}),
      }}
    >
      <CardHeader
        title="Patient Document Timeline"
        titleTypographyProps={{
          variant: "subtitle1",
          sx: { fontWeight: 700, lineHeight: 1.25, ...(isImproved ? PATIENT_VIEW_TYPE.panelTitle : {}) },
        }}
        sx={{
          py: 0.5,
          px: 1.25,
          minHeight: 40,
          "& .MuiCardHeader-content": { minWidth: 0 },
          "& .MuiCardHeader-action": { alignSelf: "center", m: 0 },
        }}
        action={
          <Stack direction="row" spacing={0.25} alignItems="center">
            {showZoomControls ? zoomControls : null}
            {chartModel.totalReports > 0 ? (
              <Typography
                variant="caption"
                sx={{
                  display: "inline-block",
                  px: 0.75,
                  py: 0.2,
                  borderRadius: 0.75,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  bgcolor: timelineColors.docCountBadgeBackground,
                  color: timelineColors.docCountBadgeText,
                }}
              >
                {chartModel.totalReports} doc{chartModel.totalReports !== 1 ? "s" : ""}
              </Typography>
            ) : null}
            {onToggleExpanded ? (
              <SectionCollapseToggle
                expanded={expanded}
                onToggle={onToggleExpanded}
                label={sectionLabel}
                panelId={collapsiblePanelId}
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
          data-testid="document-timeline-range-status"
          sx={visuallyHiddenSx}
        >
          {rangeAnnouncement}
        </Typography>
      ) : null}
      {expanded ? (
        <>
      <Divider />
      <CardContent
        id={collapsiblePanelId}
        sx={{
          px: TIMELINE_CONTENT_PADDING_X,
          py: 0.75,
          "&:last-child": { pb: 0.75 },
          ...(embedded
            ? {
                minHeight: 0,
                // The patient tab is the single vertical scroll owner. Nested
                // scrolling here makes wheel gestures feel trapped over the SVG.
                overflow: "visible",
              }
            : {}),
        }}
      >
        {chartModel.totalReports === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No documents were returned for this patient.
          </Typography>
        ) : (
          <Stack spacing={0.5} sx={embedded ? { minHeight: 0 } : undefined}>
            {isCollapsedTimestampMode ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Document Episode Type:
                </Typography>
                {chartModel.episodes.map((episode) => (
                  <EpisodeFilterDropdown
                    key={episode.key}
                    episode={episode}
                    points={pointsByEpisode.get(episode.label) || []}
                    value={episodeSelections[episode.label] || EPISODE_SELECT_ALL}
                    onChange={handleEpisodeSelection}
                  />
                ))}
              </Stack>
            ) : null}

            {!isCollapsedTimestampMode ? (
              <>
                <Box
                  ref={chartContainerRef}
                  sx={{
                    position: "relative",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "background.paper",
                    width: "100%",
                    // The SVG holds exactly one compact lane per report type, the
                    // date axis and the overview strip—no viewport-sized filler.
                    // Add the two border pixels outside the content-sized SVG.
                    height: `calc(${chartHeight}px + 2px)`,
                  }}
                >
                  <svg
                    ref={svgRef}
                    role="img"
                    aria-label="Patient document timeline chart"
                    viewBox={`0 0 ${chartModel.dimensions.svgWidth} ${chartHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                    onPointerDown={handlePointerDown}
                    onKeyDown={handlePlotKeyDown}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      display: "block",
                      cursor: isDragging ? "grabbing" : isZoomed ? "grab" : "default",
                      // A press-and-drag pans the date axis; disable selection so
                      // the drag never turns into a text/element selection.
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      // Vertical gestures always belong to the surrounding scroll
                      // container. Horizontal drag remains available for panning.
                      touchAction: "pan-y",
                    }}
                  >
                    <defs>
                      <clipPath id={clipPathId}>
                        <rect
                          x={chartModel.dimensions.plotLeft}
                          y={0}
                          width={chartModel.dimensions.plotWidth}
                          height={chartModel.dimensions.svgHeight}
                        />
                      </clipPath>
                    </defs>
                    <desc>
                      Timeline chart showing one row per report type with clickable document points
                      positioned by report date. Zoomable and pannable along the date axis using the
                      zoom controls, the keyboard, or the handles on the overview strip, which shows
                      every document across the full date range.
                    </desc>

                    {chartModel.rows.map((row) => (
                      <g key={`row:${row.type}`}>
                        <line
                          x1={chartModel.dimensions.plotLeft}
                          y1={row.y}
                          x2={chartModel.dimensions.plotLeft + chartModel.dimensions.plotWidth}
                          y2={row.y}
                          stroke={timelineColors.axisColor}
                          strokeWidth={1}
                        />
                        {typeScale.labelMode === "top" ? (
                          // Narrow layout: label rides above its lane so the plot can
                          // use the full width instead of a wide left gutter.
                          <text
                            className="patient-timeline-row-label"
                            x={chartModel.dimensions.plotLeft}
                            y={row.y - chartModel.dimensions.rowHeight * 0.28}
                            textAnchor="start"
                            fill={timelineColors.textColor}
                            fontSize={typeScale.rowLabelFont}
                            fontWeight="600"
                          >
                            {`${row.type} (${row.count})`}
                          </text>
                        ) : (
                          <text
                            className="patient-timeline-row-label"
                            x={chartModel.dimensions.plotLeft - 10}
                            y={row.y + 4}
                            textAnchor="end"
                            fill={timelineColors.textColor}
                            fontSize={typeScale.rowLabelFont}
                            fontWeight="500"
                          >
                            {`${row.type} (${row.count}):`}
                          </text>
                        )}
                      </g>
                    ))}

                    <TimelineAxis
                      ticks={displayTicks}
                      x1={chartModel.dimensions.plotLeft}
                      x2={chartModel.dimensions.plotLeft + chartModel.dimensions.plotWidth}
                      y={axisY}
                      tickSize={5}
                      labelOffset={typeScale.tickLabelOffset}
                      lineColor={timelineColors.axisColor}
                      textColor={timelineColors.textColor}
                      lineWidth={1.2}
                      fontSize={typeScale.tickFont}
                      testId="document-timeline-detail-axis"
                      labelClassName="patient-timeline-tick-label"
                    />

                    {typeScale.labelMode === "left" ? (
                      <text
                        className="patient-timeline-axis-title"
                        x={chartModel.dimensions.plotLeft - 38}
                        y={axisY + typeScale.tickLabelOffset}
                        textAnchor="end"
                        fill={timelineColors.textColor}
                        fontSize={typeScale.axisTitleFont}
                        fontWeight="600"
                      >
                        Date
                      </text>
                    ) : null}

                    <TimelineOverviewStrip
                      plotLeft={chartModel.dimensions.plotLeft}
                      plotWidth={chartModel.dimensions.plotWidth}
                      top={overviewTop}
                      rows={overviewRows}
                      viewport={viewport}
                      onViewportChange={setViewport}
                      minWindowRatio={minWindowRatio}
                      domainStart={dateDomain.startDate}
                      domainEnd={dateDomain.endDate}
                      tickCount={typeScale.tickCount}
                      compact={typeScale.compact}
                      fontSize={typeScale.tickFont}
                      clientToX={clientToSvgX}
                      labels={OVERVIEW_STRIP_LABELS}
                      testIdPrefix="document-timeline"
                      className="patient-document-timeline-overview"
                      labelClassName="patient-timeline-overview-label"
                    />

                    <g clipPath={`url(#${clipPathId})`}>
                      {visiblePoints.map((point) => {
                        const isSelected = point.id === selectedDocumentId;
                        const isRelated = relatedIdSet.has(point.id);
                        const isEventRelated = eventRelatedIdSet.has(point.id);
                        const pointX = transformX(point.x);
                        const pointLabel = getPointAriaLabel(point, {
                          isRelated,
                          isEventRelated,
                        });

                        return (
                          <g key={`point:${point.id}`}>
                            {isEventRelated ? (
                              <circle
                                className="patient-timeline-event-related-ring"
                                data-document-id={point.id}
                                cx={pointX}
                                cy={point.y}
                                r={
                                  isSelected
                                    ? typeScale.selectedRingRadius + 4
                                    : typeScale.eventRelatedRingRadius
                                }
                                fill="none"
                                stroke={timelineColors.eventRelatedStrokeColor}
                                strokeWidth={2}
                                pointerEvents="none"
                                aria-hidden="true"
                              />
                            ) : null}

                            {isRelated && !isSelected ? (
                              <circle
                                cx={pointX}
                                cy={point.y}
                                r={typeScale.relatedRingRadius}
                                fill="none"
                                stroke={timelineColors.relatedStrokeColor}
                                strokeWidth={1.4}
                                strokeDasharray="2 2"
                                pointerEvents="none"
                              />
                            ) : null}

                            {isSelected ? (
                              // Prominent hollow ring marking the document currently
                              // open in the viewer — ~3x a normal dot so it's easy to
                              // spot, but see-through so it never hides neighbors.
                              <circle
                                cx={pointX}
                                cy={point.y}
                                r={typeScale.selectedRingRadius}
                                fill="none"
                                stroke={selectedMarkerColor}
                                strokeWidth={2.25}
                                pointerEvents="none"
                              />
                            ) : null}

                            <circle
                              className="patient-timeline-point-hitbox"
                              cx={pointX}
                              cy={point.y}
                              r={Math.max(12, typeScale.selectedRingRadius + 2)}
                              fill="transparent"
                              pointerEvents="all"
                              aria-hidden="true"
                              style={{ cursor: "pointer" }}
                              onClick={() => handleSelectPoint(point.id)}
                            />

                            <circle
                              className="patient-timeline-point"
                              data-document-id={point.id}
                              data-episode={point.episodeLabel}
                              data-related={isRelated ? "true" : "false"}
                              data-event-related={isEventRelated ? "true" : "false"}
                              data-selected={isSelected ? "true" : "false"}
                              cx={pointX}
                              cy={point.y}
                              r={isSelected ? typeScale.selectedRadius : typeScale.pointRadius}
                              fill={point.episodeColor}
                              fillOpacity={isSelected ? 0.95 : 0.72}
                              stroke={
                                isSelected
                                  ? selectedMarkerColor
                                  : isEventRelated
                                  ? timelineColors.eventRelatedStrokeColor
                                  : isRelated
                                  ? timelineColors.relatedStrokeColor
                                  : timelineColors.pointStrokeColor
                              }
                              strokeWidth={isSelected ? 2 : isEventRelated || isRelated ? 1.4 : 1}
                              tabIndex={0}
                              role="button"
                              aria-label={pointLabel}
                              style={{ cursor: "pointer" }}
                              onClick={() => handleSelectPoint(point.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  onSelectDocument?.(point.id);
                                }
                              }}
                            >
                              <title>{pointLabel}</title>
                            </circle>
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </Box>

                {isImproved ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    data-testid="document-timeline-range-caption"
                    sx={{ lineHeight: 1.35 }}
                  >
                    {isZoomed
                      ? `Viewing ${visibleRangeLabel} of ${fullRangeLabel}`
                      : `Showing the full range: ${fullRangeLabel}`}
                  </Typography>
                ) : null}

                <Typography variant="caption" color="text.secondary" sx={visuallyHiddenSx}>
                  Click a point to load that document (Tab + Enter/Space for keyboard selection).
                  Use the zoom buttons, the + and − keys, or the handles on the overview strip below
                  the chart to choose the date range; drag the chart or press ←/→ to pan. The
                  overview strip always shows the full date range, and its handles respond to ←/→,
                  Home, and End. Scrolling moves through the patient view.
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Timeline chart is hidden because all documents share one timestamp. Use the episode
                dropdowns to select documents.
              </Typography>
            )}

            <Stack
              direction="row"
              spacing={1.25}
              alignItems="center"
              useFlexGap
              sx={{ flexWrap: "wrap", rowGap: 0, minHeight: 20 }}
            >
              {selectedPoint ? (
                <Tooltip title={selectedPoint.id} placement="top-start">
                  <Typography
                    variant="caption"
                    sx={{ cursor: "default", color: "text.primary", lineHeight: 1.35 }}
                  >
                    <strong>Selected:</strong> {selectedPoint.name} • {selectedPoint.type} •{" "}
                    {selectedPoint.dateLabel}
                  </Typography>
                </Tooltip>
              ) : null}

              {hiddenEpisodes.size > 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                  Hidden: {chartModel.points.length - visiblePoints.length} doc(s)
                </Typography>
              ) : null}

              {relatedIdSet.size > 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                  Dashed outline: fact-linked documents
                </Typography>
              ) : null}

              {eventRelatedIdSet.size > 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                  Gold outline: event-linked documents
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        )}
      </CardContent>
        </>
      ) : null}
    </Card>
  );
}

PatientDocumentsCard.propTypes = {
  timelineData: PropTypes.shape({
    reportData: PropTypes.arrayOf(PropTypes.object),
    reportTypes: PropTypes.arrayOf(PropTypes.string),
    episodeCounts: PropTypes.object,
  }),
  selectedDocumentId: PropTypes.string,
  relatedDocumentIds: PropTypes.arrayOf(PropTypes.string),
  eventRelatedDocumentIds: PropTypes.arrayOf(PropTypes.string),
  onSelectDocument: PropTypes.func,
  embedded: PropTypes.bool,
  expanded: PropTypes.bool,
  onToggleExpanded: PropTypes.func,
  collapsiblePanelId: PropTypes.string,
  sectionLabel: PropTypes.string,
};
