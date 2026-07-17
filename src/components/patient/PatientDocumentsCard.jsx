import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { alpha, useTheme } from "@mui/material/styles";
import {
  buildTimelineChartModel,
  resolveTicks,
} from "../../utils/patientView/timelineChartLayout";
import { getReadableTextColor } from "../../utils/colorContrast";
import SectionCollapseToggle from "./SectionCollapseToggle";

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const ZOOM_STEP = 1.5;
// Pointer travel (in viewBox units) beyond which a press is treated as a pan
// drag rather than a document click.
const DRAG_THRESHOLD = 5;

function clampZoom(zoom) {
  if (!Number.isFinite(zoom)) {
    return MIN_ZOOM;
  }
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// panRatio is the visible window's left edge expressed as a fraction of the full
// date domain. At a given zoom the window is 1/zoom wide, so the furthest the
// left edge can travel is 1 - 1/zoom.
function clampPanRatio(panRatio, zoom) {
  const maxPan = Math.max(0, 1 - 1 / zoom);
  if (!Number.isFinite(panRatio)) {
    return 0;
  }
  return Math.min(maxPan, Math.max(0, panRatio));
}

const EPISODE_SELECT_ALL = "__all__";
const EPISODE_SELECT_HIDDEN = "__hidden__";

// Below this rendered width the left label gutter would swallow the plot, so we
// switch to a "compact" layout: report-type labels sit above each lane, fonts
// and dots grow, and fewer date ticks are drawn.
const COMPACT_WIDTH_BREAKPOINT = 620;
const MIN_TICK_SPACING = 150;

export function resolveResponsiveTickCount(plotWidth, maxTickCount = 7) {
  const numericPlotWidth = Math.max(0, Number(plotWidth) || 0);
  const numericMaxTickCount = Math.max(2, Number(maxTickCount) || 7);
  return Math.min(
    numericMaxTickCount,
    Math.max(2, Math.floor(numericPlotWidth / MIN_TICK_SPACING) + 1)
  );
}

export function getTimelineSvgColors(theme) {
  const textColor = theme?.palette?.text?.secondary || "#505A5F";
  const axisColor = theme?.palette?.text?.disabled || textColor;
  const selectedMarkerColor = theme?.palette?.text?.primary || textColor;
  const relatedStrokeColor = theme?.palette?.primary?.main || textColor;
  const pointStrokeColor =
    theme?.palette?.mode === "dark"
      ? theme?.palette?.background?.default || "#0B1220"
      : alpha(theme?.palette?.common?.black || "#000000", 0.55);
  const docCountBadgeBackground = theme?.palette?.info?.main || relatedStrokeColor;
  const docCountBadgeText = getReadableTextColor(docCountBadgeBackground, {
    candidates: [theme?.palette?.info?.contrastText],
  });

  return {
    axisColor,
    docCountBadgeBackground,
    docCountBadgeText,
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

  const plotTop = compact ? 12 : 10;
  // Footer holds the date axis line, tick marks, tick labels (~baselineY+28) and
  // the "Date" title (~baselineY+30); trimmed to just clear the label descenders.
  const footerHeight = compact ? 40 : 38;
  const plotLeft = compact ? 16 : 236;
  const plotRight = compact ? 16 : 20;
  // Vertical distance between report-type lanes. Kept just above the selected
  // ring diameter so lanes stay tight without dots colliding across rows.
  const rowHeight = compact ? 52 : 40;

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
    rowLabelFont: compact ? 15 : 13,
    tickFont: compact ? 14 : 13.5,
    axisTitleFont: compact ? 13 : 12,
    tickCount: resolveResponsiveTickCount(plotWidth, maxTickCount),
    pointRadius: compact ? 6 : 4.5,
    selectedRadius: compact ? 9 : 7,
    selectedRingRadius: compact ? 17 : 14,
    relatedRingRadius: compact ? 9 : 7,
  };

  return { dimensions, typeScale };
}

function getPointAriaLabel(point) {
  return [
    `Document ${point.name || point.id}`,
    `ID ${point.id}`,
    `Type ${point.type}`,
    `Episode ${point.episodeLabel}`,
    `Date ${point.dateLabel}`,
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
  onSelectDocument = undefined,
  embedded = false,
  expanded = true,
  onToggleExpanded = undefined,
  collapsiblePanelId = undefined,
  sectionLabel = "Patient Document Timeline",
}) {
  const theme = useTheme();
  const timelineColors = getTimelineSvgColors(theme);
  // High-contrast foreground for the "currently viewed" marker so its ring stays
  // visible on every theme (near-black on light themes, near-white on dark ones).
  // A hardcoded near-black ring is ~1.2:1 on the dark theme's navy panel.
  const selectedMarkerColor = timelineColors.selectedMarkerColor;
  const [hiddenEpisodes, setHiddenEpisodes] = useState(() => new Set());
  const [episodeSelections, setEpisodeSelections] = useState({});
  // Horizontal (time-axis) zoom + pan. zoom === 1 shows the full date domain;
  // panRatio is the visible window's left edge as a fraction of that domain.
  const [viewport, setViewport] = useState({ zoom: MIN_ZOOM, panRatio: 0 });
  const svgRef = useRef(null);
  const dragStateRef = useRef(null);
  // True while a click-drag pan is in progress, so the cursor can switch to
  // "grabbing" for immediate feedback.
  const [isDragging, setIsDragging] = useState(false);
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
    if (!node || typeof ResizeObserver === "undefined") {
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

  // The model applies the measured width and derives height directly from its
  // report-type row count.
  const { dimensions: layoutDimensions, typeScale } = useMemo(
    () =>
      computeChartLayout({
        width: chartWidth,
      }),
    [chartWidth]
  );
  const chartModel = useMemo(
    () => buildTimelineChartModel(timelineData || {}, layoutDimensions),
    [timelineData, layoutDimensions]
  );
  const timelineSignature = useMemo(
    () => chartModel.points.map((point) => point.id).join("|"),
    [chartModel.points]
  );

  useEffect(() => {
    setHiddenEpisodes(new Set());
    setEpisodeSelections({});
    setViewport({ zoom: MIN_ZOOM, panRatio: 0 });
  }, [timelineSignature]);

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
  const { dimensions, dateDomain } = chartModel;
  const plotLeft = dimensions.plotLeft;
  const plotWidth = dimensions.plotWidth;
  const domainStartMs = dateDomain.startDate.getTime();
  const fullSpanMs = Math.max(1, dateDomain.endDate.getTime() - domainStartMs);
  const isZoomed = viewport.zoom > MIN_ZOOM + 1e-6;
  const clipPathId = useId();

  // Map a base (full-domain) x-coordinate into the current zoom/pan window.
  const transformX = useCallback(
    (baseX) =>
      plotLeft +
      viewport.zoom * (baseX - plotLeft) -
      plotWidth * viewport.zoom * viewport.panRatio,
    [plotLeft, plotWidth, viewport.zoom, viewport.panRatio]
  );

  // Re-derive axis ticks for the visible date window so labels stay meaningful
  // (and pick finer granularity) as the user zooms in.
  const displayTicks = useMemo(() => {
    const visibleSpanMs = fullSpanMs / viewport.zoom;
    const visibleStartMs = domainStartMs + viewport.panRatio * fullSpanMs;
    return resolveTicks(
      new Date(visibleStartMs),
      new Date(visibleStartMs + visibleSpanMs),
      plotWidth,
      plotLeft,
      typeScale.tickCount
    );
  }, [
    fullSpanMs,
    domainStartMs,
    viewport.zoom,
    viewport.panRatio,
    plotWidth,
    plotLeft,
    typeScale.tickCount,
  ]);

  const clientToSvgX = useCallback((clientX) => {
    const svg = svgRef.current;
    if (
      !svg ||
      typeof svg.getScreenCTM !== "function" ||
      typeof svg.createSVGPoint !== "function"
    ) {
      return null;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return null;
    }
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = clientX;
    svgPoint.y = 0;
    return svgPoint.matrixTransform(ctm.inverse()).x;
  }, []);

  // Zoom by a multiplicative factor while keeping the date under `anchorSvgX`
  // pinned in place (defaults to the plot center when no anchor is given).
  const applyZoomFactor = useCallback(
    (factor, anchorSvgX) => {
      setViewport((current) => {
        const nextZoom = clampZoom(current.zoom * factor);
        if (nextZoom === current.zoom) {
          return current;
        }
        const anchor = Number.isFinite(anchorSvgX) ? anchorSvgX : plotLeft + plotWidth / 2;
        const anchorRatioFull =
          current.panRatio + (anchor - plotLeft) / (plotWidth * current.zoom);
        const nextPanRatio = clampPanRatio(
          anchorRatioFull - (anchor - plotLeft) / (plotWidth * nextZoom),
          nextZoom
        );
        return { zoom: nextZoom, panRatio: nextPanRatio };
      });
    },
    [plotLeft, plotWidth]
  );

  const nudgePan = useCallback((direction) => {
    setViewport((current) => ({
      zoom: current.zoom,
      panRatio: clampPanRatio(
        current.panRatio + direction * (0.2 / current.zoom),
        current.zoom
      ),
    }));
  }, []);

  const handleResetView = useCallback(() => {
    setViewport({ zoom: MIN_ZOOM, panRatio: 0 });
  }, []);

  // Drag-to-pan. Window listeners (rather than pointer capture) keep child
  // circle clicks working normally; a moved drag suppresses the trailing click.
  const justDraggedRef = useRef(false);
  const handlePointerDown = (event) => {
    if (event.button !== 0 || viewport.zoom <= MIN_ZOOM) {
      return;
    }
    const startSvgX = clientToSvgX(event.clientX);
    if (startSvgX == null) {
      return;
    }
    // Suppress the browser's native text/element selection so a horizontal
    // press-and-drag reads as a pan rather than a selection gesture.
    event.preventDefault();
    setIsDragging(true);
    const drag = { startSvgX, startPanRatio: viewport.panRatio, moved: false };
    dragStateRef.current = drag;

    const handleMove = (moveEvent) => {
      const svgX = clientToSvgX(moveEvent.clientX);
      if (svgX == null) {
        return;
      }
      const deltaSvgX = svgX - drag.startSvgX;
      if (!drag.moved && Math.abs(deltaSvgX) < DRAG_THRESHOLD) {
        return;
      }
      drag.moved = true;
      setViewport((current) => ({
        zoom: current.zoom,
        panRatio: clampPanRatio(
          drag.startPanRatio - deltaSvgX / (plotWidth * current.zoom),
          current.zoom
        ),
      }));
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setIsDragging(false);
      if (drag.moved) {
        // Swallow the click synthesized from this pointerup, then clear.
        justDraggedRef.current = true;
        window.setTimeout(() => {
          justDraggedRef.current = false;
        }, 0);
      }
      dragStateRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleSelectPoint = (documentId) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onSelectDocument?.(documentId);
  };

  const handleChartKeyDown = (event) => {
    switch (event.key) {
      case "+":
      case "=":
        event.preventDefault();
        applyZoomFactor(ZOOM_STEP);
        break;
      case "-":
      case "_":
        event.preventDefault();
        applyZoomFactor(1 / ZOOM_STEP);
        break;
      case "0":
        event.preventDefault();
        handleResetView();
        break;
      case "ArrowLeft":
        event.preventDefault();
        nudgePan(-1);
        break;
      case "ArrowRight":
        event.preventDefault();
        nudgePan(1);
        break;
      default:
        break;
    }
  };

  // Zoom/pan controls live in the card header, on the same line as the title.
  // Only meaningful when the zoomable chart is shown (not the collapsed-timestamp
  // dropdown mode and with at least one dated report).
  const showZoomControls =
    expanded && !isCollapsedTimestampMode && chartModel.totalReports > 0;
  const zoomControls = (
    <Stack direction="row" spacing={0.25} alignItems="center">
      <Typography
        variant="caption"
        color="text.secondary"
        aria-live="polite"
        sx={{ mr: 0.25, fontVariantNumeric: "tabular-nums" }}
      >
        {`${Math.round(viewport.zoom * 100)}%`}
      </Typography>
      <Tooltip title="Zoom out (−)">
        <span>
          <IconButton
            size="small"
            aria-label="Zoom out timeline"
            onClick={() => applyZoomFactor(1 / ZOOM_STEP)}
            disabled={viewport.zoom <= MIN_ZOOM + 1e-6}
          >
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Zoom in (+)">
        <span>
          <IconButton
            size="small"
            aria-label="Zoom in timeline"
            onClick={() => applyZoomFactor(ZOOM_STEP)}
            disabled={viewport.zoom >= MAX_ZOOM - 1e-6}
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Reset zoom (0)">
        <span>
          <IconButton
            size="small"
            aria-label="Reset timeline zoom"
            onClick={handleResetView}
            disabled={!isZoomed && viewport.panRatio === 0}
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
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
        titleTypographyProps={{ variant: "subtitle1", sx: { fontWeight: 700 } }}
        sx={{ py: 1, px: 1.5, "& .MuiCardHeader-action": { alignSelf: "center", m: 0 } }}
        action={
          <Stack direction="row" spacing={0.5} alignItems="center">
            {showZoomControls ? zoomControls : null}
            {chartModel.totalReports > 0 ? (
              <Typography
                variant="caption"
                sx={{
                  display: "inline-block",
                  px: 1,
                  py: 0.25,
                  borderRadius: 999,
                  fontWeight: 600,
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
      {expanded ? (
        <>
      <Divider />
      <CardContent
        id={collapsiblePanelId}
        sx={{
          px: 1.5,
          py: 1.25,
          "&:last-child": { pb: 1.25 },
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
          <Stack spacing={1} sx={embedded ? { minHeight: 0 } : undefined}>
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
                    // The SVG model includes exactly one compact lane per report
                    // type plus the date-axis footer—no viewport-sized filler.
                    // Add the two border pixels outside the content-sized SVG.
                    height: `calc(${chartModel.dimensions.svgHeight}px + 2px)`,
                  }}
                >
                  <svg
                    ref={svgRef}
                    role="img"
                    aria-label="Patient document timeline chart"
                    viewBox={`0 0 ${chartModel.dimensions.svgWidth} ${chartModel.dimensions.svgHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                    onPointerDown={handlePointerDown}
                    onKeyDown={handleChartKeyDown}
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
                      zoom controls or keyboard, and pannable by drag or arrow keys.
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

                    <line
                      x1={chartModel.dimensions.plotLeft}
                      y1={chartModel.dimensions.baselineY + 8}
                      x2={chartModel.dimensions.plotLeft + chartModel.dimensions.plotWidth}
                      y2={chartModel.dimensions.baselineY + 8}
                      stroke={timelineColors.axisColor}
                      strokeWidth={1.2}
                    />

                    {displayTicks.map((tick, tickIndex) => {
                      const isFirstTick = tickIndex === 0;
                      const isLastTick = tickIndex === displayTicks.length - 1;
                      const tickLabelX = isFirstTick ? tick.x + 6 : isLastTick ? tick.x - 6 : tick.x;
                      const tickTextAnchor = isFirstTick ? "start" : isLastTick ? "end" : "middle";

                      return (
                        <g key={`tick:${tick.date.toISOString()}`}>
                          <line
                            x1={tick.x}
                            y1={chartModel.dimensions.baselineY + 8}
                            x2={tick.x}
                            y2={chartModel.dimensions.baselineY + 14}
                            stroke={timelineColors.axisColor}
                            strokeWidth={1}
                          />
                          <text
                            className="patient-timeline-tick-label"
                            x={tickLabelX}
                            y={chartModel.dimensions.baselineY + 28}
                            textAnchor={tickTextAnchor}
                            fill={timelineColors.textColor}
                            fontSize={typeScale.tickFont}
                          >
                            {tick.label}
                          </text>
                        </g>
                      );
                    })}

                    {typeScale.labelMode === "left" ? (
                      <text
                        className="patient-timeline-axis-title"
                        x={chartModel.dimensions.plotLeft - 38}
                        y={chartModel.dimensions.baselineY + 30}
                        textAnchor="end"
                        fill={timelineColors.textColor}
                        fontSize={typeScale.axisTitleFont}
                        fontWeight="600"
                      >
                        Date
                      </text>
                    ) : null}

                    <g clipPath={`url(#${clipPathId})`}>
                      {visiblePoints.map((point) => {
                        const isSelected = point.id === selectedDocumentId;
                        const isRelated = relatedIdSet.has(point.id);
                        const pointX = transformX(point.x);

                        return (
                          <g key={`point:${point.id}`}>
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
                              className="patient-timeline-point"
                              data-document-id={point.id}
                              data-episode={point.episodeLabel}
                              data-related={isRelated ? "true" : "false"}
                              data-selected={isSelected ? "true" : "false"}
                              cx={pointX}
                              cy={point.y}
                              r={isSelected ? typeScale.selectedRadius : typeScale.pointRadius}
                              fill={point.episodeColor}
                              fillOpacity={isSelected ? 0.95 : 0.72}
                              stroke={
                                isSelected
                                  ? selectedMarkerColor
                                  : isRelated
                                  ? timelineColors.relatedStrokeColor
                                  : timelineColors.pointStrokeColor
                              }
                              strokeWidth={isSelected ? 2 : isRelated ? 1.4 : 1}
                              tabIndex={0}
                              role="button"
                              aria-label={getPointAriaLabel(point)}
                              style={{ cursor: "pointer" }}
                              onClick={() => handleSelectPoint(point.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  onSelectDocument?.(point.id);
                                }
                              }}
                            >
                              <title>{getPointAriaLabel(point)}</title>
                            </circle>
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Click a point to load that document (Tab + Enter/Space for keyboard selection).
                  Use the +/− buttons to zoom the date axis; drag or press ←/→ to pan. Scrolling
                  moves through the patient view.
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Timeline chart is hidden because all documents share one timestamp. Use the episode
                dropdowns to select documents.
              </Typography>
            )}

            {selectedPoint ? (
              <Tooltip title={selectedPoint.id} placement="top-start">
                <Typography variant="body2" sx={{ cursor: "default" }}>
                  <strong>Selected:</strong> {selectedPoint.name} • {selectedPoint.type} •{" "}
                  {selectedPoint.dateLabel}
                </Typography>
              </Tooltip>
            ) : null}

            {hiddenEpisodes.size > 0 ? (
              <Typography variant="caption" color="text.secondary">
                Hidden by episode filter: {chartModel.points.length - visiblePoints.length} document(s).
              </Typography>
            ) : null}

            {relatedIdSet.size > 0 ? (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Dashed-outline points are fact-linked documents derived from the selected cancer/tumor
                  fact.
                </Typography>
              </Box>
            ) : null}
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
  onSelectDocument: PropTypes.func,
  embedded: PropTypes.bool,
  expanded: PropTypes.bool,
  onToggleExpanded: PropTypes.func,
  collapsiblePanelId: PropTypes.string,
  sectionLabel: PropTypes.string,
};
