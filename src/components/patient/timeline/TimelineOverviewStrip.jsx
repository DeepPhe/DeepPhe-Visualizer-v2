import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { styled, useTheme } from "@mui/material/styles";
import TimelineAxis from "./TimelineAxis";
import {
  applySliderKey,
  centerViewportOn,
  computeOverviewStripLayout,
  formatHandleDate,
  getMiniRowY,
  getSnapRatio,
  getViewportWindow,
  isViewportZoomed,
  layoutHandleLabels,
  moveViewportEdge,
  moveViewportWindow,
  ratioToDate,
  ratioToX,
  resolveOverviewTicks,
  snapRatioToEnds,
  spansMultipleYears,
  xToRatio,
} from "../../../utils/patientView/timelineViewport";

// Pointer target around each 6px-wide handle. It reaches 12px outward, and at
// most a third of the window inward, so a narrow window stays draggable.
const HANDLE_HIT_OUTER = 12;
const HANDLE_HIT_INNER_MAX = 12;
const HANDLE_HALF_WIDTH = 3;
const MINI_MARK_MIN_WIDTH = 3;

/**
 * Overview-strip colors, shared by both timelines so the control looks the
 * same in each. Text and outlines come from theme tokens that meet WCAG AA on
 * every palette.
 */
export function getOverviewStripColors(theme) {
  const palette = theme?.palette || {};
  const textSecondary = palette.text?.secondary || "#505A5F";
  const textPrimary = palette.text?.primary || "#0B0C0C";
  const mutedLine = palette.text?.disabled || textSecondary;
  const accent = palette.primary?.main || textSecondary;

  return {
    // Light enough that pale miniature marks still show through.
    trackFill: mutedLine,
    trackOpacity: 0.16,
    trackStroke: mutedLine,
    windowFill: accent,
    windowFillOpacity: 0.1,
    windowStroke: accent,
    handleFill: accent,
    handleStroke: textPrimary,
    // Dims the band outside the selection. The opaque page background, not the
    // (translucent on Vapor) paper, so it darkens or lightens on every theme.
    shade: palette.background?.default || "#FFFFFF",
    shadeOpacity: 0.5,
    handleLabelText: textPrimary,
    axisText: textSecondary,
    axisLine: mutedLine,
  };
}

const focusRingStyles = ({ theme }) => {
  const custom = theme.custom || {};
  const focusRing = custom.focusRing || theme.palette.primary.main;
  const focusRingWidth = Number.parseFloat(custom.focusRingWidth) || 2;

  return {
    "&:focus": { outline: "none" },
    "&:focus-visible": {
      outline: `${focusRingWidth}px solid ${focusRing}`,
      outlineOffset: custom.focusRingOffset || "2px",
    },
  };
};

const FocusableRect = styled("rect")(focusRingStyles);
const FocusablePath = styled("path")(focusRingStyles);

/**
 * The overview half of a timeline's overview + detail view, drawn as a `<g>`
 * inside the chart's SVG. It shows the whole date range and never moves: a
 * miniature of every mark, a window over the range the detail view shows, two
 * handles to resize that window, each handle's date, and a fixed date axis whose
 * ends always show the domain limits.
 *
 * Everything here is in full-domain coordinates. The strip knows nothing about
 * documents or events: each timeline passes generic rows of marks.
 */
export default function TimelineOverviewStrip({
  plotLeft,
  plotWidth,
  top,
  rows = [],
  viewport,
  onViewportChange,
  minWindowRatio,
  domainStart,
  domainEnd,
  timeZone = undefined,
  tickCount = 5,
  compact = false,
  fontSize = 12,
  clientToX,
  labels,
  testIdPrefix,
  className = undefined,
  labelClassName = undefined,
}) {
  const theme = useTheme();
  const colors = useMemo(() => getOverviewStripColors(theme), [theme]);
  const [dragMode, setDragMode] = useState(null);
  const endDragRef = useRef(null);

  useEffect(
    () => () => {
      endDragRef.current?.();
    },
    []
  );

  const layout = useMemo(
    () => computeOverviewStripLayout({ rowCount: rows.length, compact }),
    [rows.length, compact]
  );
  const plotRight = plotLeft + plotWidth;
  const { startRatio, endRatio } = getViewportWindow(viewport);
  const windowX = ratioToX(startRatio, plotLeft, plotWidth);
  const windowEndX = ratioToX(endRatio, plotLeft, plotWidth);
  const windowWidth = Math.max(0, windowEndX - windowX);
  const isZoomed = isViewportZoomed(viewport);

  const includeYear = spansMultipleYears(domainStart, domainEnd, timeZone);
  const startLabel = formatHandleDate(ratioToDate(startRatio, domainStart, domainEnd), {
    includeYear,
    timeZone,
  });
  const endLabel = formatHandleDate(ratioToDate(endRatio, domainStart, domainEnd), {
    includeYear,
    timeZone,
  });
  const handleLabels = layoutHandleLabels({
    startX: windowX,
    endX: windowEndX,
    startLabel,
    endLabel,
    plotLeft,
    plotWidth,
    fontSize,
    zoomed: isZoomed,
  });

  // Memoized on the domain and width only: dragging a handle never moves these.
  const domainStartMs = domainStart instanceof Date ? domainStart.getTime() : NaN;
  const domainEndMs = domainEnd instanceof Date ? domainEnd.getTime() : NaN;
  const axisTicks = useMemo(
    () =>
      resolveOverviewTicks({
        startDate: new Date(domainStartMs),
        endDate: new Date(domainEndMs),
        plotLeft,
        plotWidth,
        tickCount,
        timeZone,
        fontSize,
        endLabelsOnly: compact,
      }),
    [domainStartMs, domainEndMs, plotLeft, plotWidth, tickCount, timeZone, fontSize, compact]
  );

  // Aria bounds are in thousandths of the domain. Each handle is bounded by the
  // other, less the minimum window.
  const toAriaValue = (ratio) => Math.round(Math.min(1, Math.max(0, ratio)) * 1000);
  const minimumWidthRatio = Math.max(0, Number(minWindowRatio) || 0);

  const handlePointerDown = (mode, event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const initialX = clientToX(event.clientX);
    if (initialX == null) {
      return;
    }
    const initialRatio = xToRatio(initialX, plotLeft, plotWidth);

    if (mode === "track") {
      onViewportChange(centerViewportOn(viewport, initialRatio));
      return;
    }

    const initialViewport = viewport;
    const initialStartRatio = startRatio;
    const windowRatio = endRatio - startRatio;
    const snapRatio = getSnapRatio(plotWidth);
    endDragRef.current?.();
    setDragMode(mode);

    const handleMove = (moveEvent) => {
      const x = clientToX(moveEvent.clientX);
      if (x == null) {
        return;
      }
      const ratio = xToRatio(x, plotLeft, plotWidth);
      if (mode === "start" || mode === "end") {
        onViewportChange(
          moveViewportEdge(
            initialViewport,
            mode,
            snapRatioToEnds(ratio, snapRatio),
            minWindowRatio
          )
        );
        return;
      }
      // Snap whichever edge of the moving window reaches an end of the strip.
      const nextStart = initialStartRatio + (ratio - initialRatio);
      const snappedStart =
        nextStart <= snapRatio
          ? 0
          : nextStart + windowRatio >= 1 - snapRatio
            ? 1 - windowRatio
            : nextStart;
      onViewportChange(moveViewportWindow(initialViewport, snappedStart));
    };
    const endDrag = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      endDragRef.current = null;
      setDragMode(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    endDragRef.current = endDrag;
  };

  const handleKeyDown = (mode, event) => {
    const next = applySliderKey(viewport, mode, event.key, {
      shiftKey: event.shiftKey,
      minWindowRatio,
    });
    if (!next) {
      return;
    }
    event.preventDefault();
    // Keep the plot's own ←/→ panning from also firing.
    event.stopPropagation();
    onViewportChange(next);
  };

  const handleInnerReach = Math.min(HANDLE_HIT_INNER_MAX, windowWidth / 3);
  const handleBottom = layout.bandBottom + layout.handleOverhang;
  const handles = [
    {
      key: "start",
      x: windowX,
      hitX: windowX - HANDLE_HIT_OUTER,
      label: labels.start,
      valueText: startLabel,
      valueNow: toAriaValue(startRatio),
      valueMin: 0,
      valueMax: toAriaValue(endRatio - minimumWidthRatio),
    },
    {
      key: "end",
      x: windowEndX,
      hitX: windowEndX - handleInnerReach,
      label: labels.end,
      valueText: endLabel,
      valueNow: toAriaValue(endRatio),
      valueMin: toAriaValue(startRatio + minimumWidthRatio),
      valueMax: 1000,
    },
  ];

  return (
    <g
      className={className}
      data-testid={`${testIdPrefix}-overview`}
      transform={`translate(0, ${top})`}
      role="group"
      aria-label={labels.group}
      style={{ touchAction: "none" }}
    >
      <rect
        data-testid={`${testIdPrefix}-overview-band`}
        x={plotLeft}
        y={layout.bandTop}
        width={plotWidth}
        height={layout.bandHeight}
        fill={colors.trackFill}
        fillOpacity={colors.trackOpacity}
        stroke={colors.trackStroke}
        strokeWidth={0.8}
        cursor="pointer"
        aria-hidden="true"
        onPointerDown={(event) => handlePointerDown("track", event)}
      />

      {/* Decorative: the detail marks carry each item's accessible name. */}
      <g aria-hidden="true" pointerEvents="none">
        {rows.map((row, rowIndex) =>
          (row.marks || []).map((mark, markIndex) => {
            const left = Math.min(mark.x1, mark.x2);
            const width = Math.abs(mark.x2 - mark.x1);
            const drawnWidth = Math.max(MINI_MARK_MIN_WIDTH, width);
            return (
              <rect
                key={`${row.key}:${mark.key ?? markIndex}`}
                data-testid={`${testIdPrefix}-overview-tick`}
                data-row={row.key}
                x={left - (drawnWidth - width) / 2}
                y={getMiniRowY(layout, rowIndex)}
                width={drawnWidth}
                height={layout.miniRowHeight}
                fill={mark.color}
                stroke={mark.stroke}
                strokeWidth={mark.stroke ? 0.75 : undefined}
              />
            );
          })
        )}
      </g>

      {isZoomed ? (
        <g aria-hidden="true" pointerEvents="none">
          <rect
            x={plotLeft}
            y={layout.bandTop}
            width={Math.max(0, windowX - plotLeft)}
            height={layout.bandHeight}
            fill={colors.shade}
            fillOpacity={colors.shadeOpacity}
          />
          <rect
            x={windowEndX}
            y={layout.bandTop}
            width={Math.max(0, plotRight - windowEndX)}
            height={layout.bandHeight}
            fill={colors.shade}
            fillOpacity={colors.shadeOpacity}
          />
        </g>
      ) : null}

      <FocusableRect
        data-testid={`${testIdPrefix}-slider-selection`}
        x={windowX}
        y={layout.bandTop}
        width={windowWidth}
        height={layout.bandHeight}
        fill={colors.windowFill}
        fillOpacity={colors.windowFillOpacity}
        stroke={colors.windowStroke}
        strokeWidth={1}
        cursor={dragMode === "window" ? "grabbing" : "grab"}
        tabIndex={0}
        role="slider"
        aria-label={labels.window}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={toAriaValue(1 - (endRatio - startRatio))}
        aria-valuenow={toAriaValue(startRatio)}
        aria-valuetext={`${startLabel} to ${endLabel}`}
        onPointerDown={(event) => handlePointerDown("window", event)}
        onKeyDown={(event) => handleKeyDown("window", event)}
      />

      {handles.map((handle) => (
        <g key={handle.key}>
          <rect
            x={handle.hitX}
            y={0}
            width={HANDLE_HIT_OUTER + handleInnerReach}
            height={handleBottom}
            fill="transparent"
            pointerEvents="all"
            cursor="ew-resize"
            aria-hidden="true"
            onPointerDown={(event) => handlePointerDown(handle.key, event)}
          />
          <FocusablePath
            data-testid={`${testIdPrefix}-slider-${handle.key}`}
            d={`M ${handle.x - HANDLE_HALF_WIDTH} ${layout.bandTop - layout.handleOverhang} H ${
              handle.x + HANDLE_HALF_WIDTH
            } V ${handleBottom} H ${handle.x - HANDLE_HALF_WIDTH} Z`}
            fill={colors.handleFill}
            fillOpacity={0.9}
            stroke={colors.handleStroke}
            strokeWidth={1}
            cursor="ew-resize"
            tabIndex={0}
            role="slider"
            aria-label={handle.label}
            aria-orientation="horizontal"
            aria-valuemin={handle.valueMin}
            aria-valuemax={handle.valueMax}
            aria-valuenow={handle.valueNow}
            aria-valuetext={handle.valueText}
            onPointerDown={(event) => handlePointerDown(handle.key, event)}
            onKeyDown={(event) => handleKeyDown(handle.key, event)}
          />
        </g>
      ))}

      {/* Same text as each slider's aria-valuetext, so hidden from the a11y tree. */}
      {handleLabels.visible ? (
        <g aria-hidden="true" pointerEvents="none">
          {handleLabels.labels.map((label) => (
            <text
              key={label.key}
              className={labelClassName}
              data-testid={`${testIdPrefix}-slider-${label.key}-label`}
              x={label.x}
              y={layout.handleLabelBaseline}
              textAnchor="middle"
              fill={colors.handleLabelText}
              fontSize={fontSize}
            >
              {label.label}
            </text>
          ))}
        </g>
      ) : null}

      <TimelineAxis
        ticks={axisTicks}
        x1={plotLeft}
        x2={plotRight}
        y={layout.axisLineY}
        tickSize={layout.axisTickSize}
        labelOffset={layout.axisLabelBaseline - layout.axisLineY}
        lineColor={colors.axisLine}
        textColor={colors.axisText}
        fontSize={fontSize}
        testId={`${testIdPrefix}-overview-axis`}
        labelClassName={labelClassName}
      />
    </g>
  );
}

TimelineOverviewStrip.propTypes = {
  plotLeft: PropTypes.number.isRequired,
  plotWidth: PropTypes.number.isRequired,
  top: PropTypes.number.isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      marks: PropTypes.arrayOf(
        PropTypes.shape({
          key: PropTypes.string,
          x1: PropTypes.number.isRequired,
          x2: PropTypes.number.isRequired,
          color: PropTypes.string.isRequired,
          // Optional outline, e.g. to match the detail view's marks.
          stroke: PropTypes.string,
        })
      ),
    })
  ),
  viewport: PropTypes.shape({
    zoom: PropTypes.number.isRequired,
    panRatio: PropTypes.number.isRequired,
  }).isRequired,
  onViewportChange: PropTypes.func.isRequired,
  minWindowRatio: PropTypes.number.isRequired,
  domainStart: PropTypes.instanceOf(Date).isRequired,
  domainEnd: PropTypes.instanceOf(Date).isRequired,
  timeZone: PropTypes.string,
  tickCount: PropTypes.number,
  compact: PropTypes.bool,
  fontSize: PropTypes.number,
  clientToX: PropTypes.func.isRequired,
  labels: PropTypes.shape({
    group: PropTypes.string.isRequired,
    window: PropTypes.string.isRequired,
    start: PropTypes.string.isRequired,
    end: PropTypes.string.isRequired,
  }).isRequired,
  testIdPrefix: PropTypes.string.isRequired,
  className: PropTypes.string,
  labelClassName: PropTypes.string,
};
