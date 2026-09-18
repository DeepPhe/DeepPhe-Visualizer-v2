// Shared zoom, pan and overview-strip math for the patient timelines (the
// Patient Document Timeline and the Event Timeline).
//
// A viewport is `{ zoom, panRatio }`. `zoom` 1 shows the whole date domain;
// `panRatio` is the visible window's left edge as a fraction of that domain.
// At a given zoom the window is 1/zoom wide, so the left edge can travel from 0
// to 1 - 1/zoom. Everything here works in domain ratios (0..1), which lets one
// implementation drive both timelines whatever their pixel offsets.
//
// Pure functions only: no React, no DOM.

import { resolveTicks } from "./timelineChartLayout";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 16;
export const ZOOM_STEP = 1.5;
// Pan buttons and the ←/→ keys move the window by this fraction of its width.
export const PAN_STEP_RATIO = 0.2;
// Smallest selection window in SVG units; MAX_ZOOM takes over on wide plots.
export const SLIDER_MIN_WIDTH = 8;
// Handle and window keyboard steps, as a fraction of the full domain.
export const SLIDER_KEY_STEP_RATIO = 0.05;
export const SLIDER_KEY_LARGE_STEP_RATIO = 0.2;
// A handle or window edge dragged this close (in SVG units) to either end of
// the strip snaps to it. Without it a handle released a few pixels short reads
// "100%" while still being zoomed.
export const SNAP_DISTANCE_PX = 6;

const EPSILON = 1e-6;

export const DEFAULT_VIEWPORT = Object.freeze({ zoom: MIN_ZOOM, panRatio: 0 });

export function clampZoom(zoom) {
  if (!Number.isFinite(zoom)) {
    return MIN_ZOOM;
  }
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function clampPanRatio(panRatio, zoom) {
  const maxPan = Math.max(0, 1 - 1 / clampZoom(zoom));
  if (!Number.isFinite(panRatio)) {
    return 0;
  }
  return Math.min(maxPan, Math.max(0, panRatio));
}

export function normalizeViewport(viewport) {
  const zoom = clampZoom(Number(viewport?.zoom));
  return { zoom, panRatio: clampPanRatio(Number(viewport?.panRatio), zoom) };
}

export function viewportsEqual(left, right) {
  return (
    Math.abs((left?.zoom ?? NaN) - (right?.zoom ?? NaN)) < EPSILON &&
    Math.abs((left?.panRatio ?? NaN) - (right?.panRatio ?? NaN)) < EPSILON
  );
}

export function isViewportZoomed(viewport) {
  return normalizeViewport(viewport).zoom > MIN_ZOOM + EPSILON;
}

export function canZoomIn(viewport) {
  return normalizeViewport(viewport).zoom < MAX_ZOOM - EPSILON;
}

export function canPanEarlier(viewport) {
  const { zoom, panRatio } = normalizeViewport(viewport);
  return zoom > MIN_ZOOM + EPSILON && panRatio > EPSILON;
}

export function canPanLater(viewport) {
  const { zoom, panRatio } = normalizeViewport(viewport);
  return zoom > MIN_ZOOM + EPSILON && panRatio < 1 - 1 / zoom - EPSILON;
}

/** The visible window as start and end ratios of the full domain. */
export function getViewportWindow(viewport) {
  const { zoom, panRatio } = normalizeViewport(viewport);
  return { startRatio: panRatio, endRatio: Math.min(1, panRatio + 1 / zoom) };
}

/** Narrowest window allowed on a plot this wide, as a domain ratio. */
export function getMinimumWindowRatio(plotWidth) {
  const width = Number(plotWidth);
  const pixelRatio = width > 0 ? SLIDER_MIN_WIDTH / width : 0;
  return Math.min(1, Math.max(1 / MAX_ZOOM, pixelRatio));
}

function resolveMinimumWindowRatio(minWindowRatio) {
  const ratio = Number(minWindowRatio);
  return Math.min(1, Math.max(1 / MAX_ZOOM, Number.isFinite(ratio) ? ratio : 0));
}

/** The viewport that shows [startRatio, endRatio], kept inside the domain. */
export function viewportFromWindow(startRatio, endRatio, minWindowRatio) {
  const start = Number(startRatio);
  const end = Number(endRatio);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ...DEFAULT_VIEWPORT };
  }

  const width = Math.min(1, Math.max(resolveMinimumWindowRatio(minWindowRatio), end - start));
  // Floating-point window edges like 0.3 + 0.7 can land a hair short of 1.
  if (width >= 1 - EPSILON) {
    return { ...DEFAULT_VIEWPORT };
  }
  const zoom = clampZoom(1 / width);
  return { zoom, panRatio: clampPanRatio(Math.min(1 - width, Math.max(0, start)), zoom) };
}

/**
 * Zoom by `factor`, keeping the date at `anchorFraction` of the visible plot
 * (0 = left edge, 1 = right edge) in place. Defaults to the plot center.
 */
export function zoomViewport(viewport, factor, anchorFraction = 0.5) {
  const current = normalizeViewport(viewport);
  const nextZoom = clampZoom(current.zoom * Number(factor));
  const anchor = Number.isFinite(anchorFraction) ? Math.min(1, Math.max(0, anchorFraction)) : 0.5;
  const anchorRatio = current.panRatio + anchor / current.zoom;
  return {
    zoom: nextZoom,
    panRatio: clampPanRatio(anchorRatio - anchor / nextZoom, nextZoom),
  };
}

/** Move the window by PAN_STEP_RATIO of its own width; -1 is earlier. */
export function panViewport(viewport, direction, stepRatio = PAN_STEP_RATIO) {
  const current = normalizeViewport(viewport);
  return {
    zoom: current.zoom,
    panRatio: clampPanRatio(
      current.panRatio + (Math.sign(direction) * stepRatio) / current.zoom,
      current.zoom
    ),
  };
}

/** Move the window's left edge to `startRatio`, keeping its width. */
export function moveViewportWindow(viewport, startRatio) {
  const current = normalizeViewport(viewport);
  return { zoom: current.zoom, panRatio: clampPanRatio(startRatio, current.zoom) };
}

/** Snaps a ratio within `snapRatio` of either end of the domain to that end. */
export function snapRatioToEnds(ratio, snapRatio) {
  const value = Number(ratio);
  const threshold = Math.max(0, Number(snapRatio) || 0);
  if (value <= threshold) {
    return 0;
  }
  if (value >= 1 - threshold) {
    return 1;
  }
  return value;
}

/** The snap distance as a domain ratio, for a plot this wide. */
export function getSnapRatio(plotWidth) {
  const width = Number(plotWidth);
  return width > 0 ? SNAP_DISTANCE_PX / width : 0;
}

/** Recenter the window on `ratio`, keeping its width. */
export function centerViewportOn(viewport, ratio) {
  const current = normalizeViewport(viewport);
  return moveViewportWindow(current, Number(ratio) - 1 / (2 * current.zoom));
}

/**
 * Move one edge of the window and leave the other where it is. The moving edge
 * stops `minWindowRatio` short of the other one, so the handles never cross.
 */
export function moveViewportEdge(viewport, edge, ratio, minWindowRatio) {
  const minWidth = resolveMinimumWindowRatio(minWindowRatio);
  const { startRatio, endRatio } = getViewportWindow(viewport);
  const target = Number.isFinite(Number(ratio)) ? Number(ratio) : edge === "end" ? endRatio : startRatio;

  if (edge === "start") {
    const nextStart = Math.min(Math.max(0, endRatio - minWidth), Math.max(0, target));
    return viewportFromWindow(nextStart, endRatio, minWidth);
  }

  const nextEnd = Math.max(Math.min(1, startRatio + minWidth), Math.min(1, target));
  return viewportFromWindow(startRatio, nextEnd, minWidth);
}

/**
 * Keyboard behavior of the overview strip's three sliders (`start`, `end` and
 * the `window` between them). Returns the next viewport, or null for keys the
 * sliders don't handle.
 */
export function applySliderKey(viewport, mode, key, { shiftKey = false, minWindowRatio } = {}) {
  const minWidth = resolveMinimumWindowRatio(minWindowRatio);
  const step = shiftKey ? SLIDER_KEY_LARGE_STEP_RATIO : SLIDER_KEY_STEP_RATIO;
  const { startRatio, endRatio } = getViewportWindow(viewport);
  const width = endRatio - startRatio;

  switch (key) {
    case "ArrowLeft":
    case "ArrowRight": {
      const delta = key === "ArrowLeft" ? -step : step;
      if (mode === "start") {
        return moveViewportEdge(viewport, "start", startRatio + delta, minWidth);
      }
      if (mode === "end") {
        return moveViewportEdge(viewport, "end", endRatio + delta, minWidth);
      }
      return moveViewportWindow(viewport, startRatio + delta);
    }
    case "Home":
      if (mode === "end") {
        return moveViewportEdge(viewport, "end", startRatio + minWidth, minWidth);
      }
      return moveViewportWindow(viewport, 0);
    case "End":
      if (mode === "start") {
        return moveViewportEdge(viewport, "start", endRatio - minWidth, minWidth);
      }
      return moveViewportWindow(viewport, 1 - width);
    default:
      return null;
  }
}

function toMs(date) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  return Number.isFinite(ms) ? ms : NaN;
}

export function ratioToDate(ratio, domainStart, domainEnd) {
  const startMs = toMs(domainStart);
  const spanMs = Math.max(1, toMs(domainEnd) - startMs);
  return new Date(startMs + Number(ratio) * spanMs);
}

export function dateToRatio(date, domainStart, domainEnd) {
  const startMs = toMs(domainStart);
  const spanMs = Math.max(1, toMs(domainEnd) - startMs);
  return (toMs(date) - startMs) / spanMs;
}

/** The dates at the visible window's left and right edges. */
export function viewportToDateWindow(viewport, domainStart, domainEnd) {
  const { startRatio, endRatio } = getViewportWindow(viewport);
  return {
    startDate: ratioToDate(startRatio, domainStart, domainEnd),
    endDate: ratioToDate(endRatio, domainStart, domainEnd),
  };
}

export function dateWindowToViewport(startDate, endDate, domainStart, domainEnd, minWindowRatio) {
  return viewportFromWindow(
    dateToRatio(startDate, domainStart, domainEnd),
    dateToRatio(endDate, domainStart, domainEnd),
    minWindowRatio
  );
}

/**
 * The smallest date domain covering every given `{ startDate, endDate }`, or
 * null when none is valid. Linked timelines share it so the same date lands at
 * the same x in each.
 */
export function unionDateDomains(domains = []) {
  let startMs = Infinity;
  let endMs = -Infinity;
  (domains || []).forEach((domain) => {
    const domainStartMs = toMs(domain?.startDate);
    const domainEndMs = toMs(domain?.endDate);
    if (Number.isFinite(domainStartMs) && Number.isFinite(domainEndMs)) {
      startMs = Math.min(startMs, domainStartMs);
      endMs = Math.max(endMs, domainEndMs);
    }
  });
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }
  return { startDate: new Date(startMs), endDate: new Date(endMs) };
}

export function sameDateDomain(left, right) {
  return (
    toMs(left?.startDate) === toMs(right?.startDate) && toMs(left?.endDate) === toMs(right?.endDate)
  );
}

/**
 * Carries a viewport across a domain change. A reader at 100% stays at 100% of
 * the new domain; a zoomed reader keeps the same dates on screen, clamped to the
 * new domain.
 */
export function rebaseViewport(viewport, fromDomain, toDomain) {
  if (!isViewportZoomed(viewport) || !fromDomain || !toDomain) {
    return { ...DEFAULT_VIEWPORT };
  }
  const { startDate, endDate } = viewportToDateWindow(
    viewport,
    fromDomain.startDate,
    fromDomain.endDate
  );
  return dateWindowToViewport(startDate, endDate, toDomain.startDate, toDomain.endDate);
}

export function ratioToX(ratio, plotLeft, plotWidth) {
  return Number(plotLeft) + Number(ratio) * Number(plotWidth);
}

export function xToRatio(x, plotLeft, plotWidth) {
  const width = Number(plotWidth);
  return width > 0 ? (Number(x) - Number(plotLeft)) / width : 0;
}

// Dates ---------------------------------------------------------------------

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function formatDate(date, options, timeZone) {
  return new Intl.DateTimeFormat("en-US", timeZone ? { ...options, timeZone } : options).format(
    date
  );
}

/** True when the two dates fall in different calendar years in `timeZone`. */
export function spansMultipleYears(startDate, endDate, timeZone) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return false;
  }
  return (
    formatDate(startDate, { year: "numeric" }, timeZone) !==
    formatDate(endDate, { year: "numeric" }, timeZone)
  );
}

/**
 * Handle labels are `MMM D`, plus the year when the domain crosses a calendar
 * year: `Jan 27` alone is ambiguous on a 2010–2011 timeline. Not
 * `formatTickLabel`, which drops the day on ranges of a year or more.
 */
export function formatHandleDate(date, { includeYear = false, timeZone } = {}) {
  if (!isValidDate(date)) {
    return "Unknown date";
  }
  const options = includeYear
    ? { month: "short", day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric" };
  return formatDate(date, options, timeZone);
}

/** `Showing Nov 12, 2010 to Mar 4, 2011`, for the range live region. */
export function describeViewportRange(viewport, domainStart, domainEnd, { timeZone } = {}) {
  const { startDate, endDate } = viewportToDateWindow(viewport, domainStart, domainEnd);
  const includeYear = spansMultipleYears(domainStart, domainEnd, timeZone);
  return `Showing ${formatHandleDate(startDate, { includeYear, timeZone })} to ${formatHandleDate(
    endDate,
    { includeYear, timeZone }
  )}`;
}

// Labels --------------------------------------------------------------------

export const LABEL_GAP = 8;
const LABEL_EDGE_INSET = 6;

/** Rough rendered width of a label. SVG text can't be measured in jsdom. */
export function estimateLabelWidth(label, fontSize = 12) {
  return String(label ?? "").length * Number(fontSize) * 0.58;
}

/**
 * Fixed overview-axis ticks. Both domain ends are always labeled; an interior
 * tick is dropped when its label would run into either end label.
 */
export function resolveOverviewTicks({
  startDate,
  endDate,
  plotLeft,
  plotWidth,
  tickCount = 5,
  timeZone,
  fontSize = 12,
  endLabelsOnly = false,
}) {
  const ticks = resolveTicks(startDate, endDate, plotWidth, plotLeft, Math.max(2, tickCount), {
    timeZone,
  });
  if (ticks.length < 2) {
    return ticks;
  }

  const first = ticks[0];
  const last = ticks[ticks.length - 1];
  const firstLabelRight = first.x + LABEL_EDGE_INSET + estimateLabelWidth(first.label, fontSize);
  const lastLabelLeft = last.x - LABEL_EDGE_INSET - estimateLabelWidth(last.label, fontSize);
  const interior = endLabelsOnly
    ? []
    : ticks.slice(1, -1).filter((tick) => {
        const halfWidth = estimateLabelWidth(tick.label, fontSize) / 2;
        return (
          tick.x - halfWidth >= firstLabelRight + LABEL_GAP &&
          tick.x + halfWidth <= lastLabelLeft - LABEL_GAP
        );
      });

  return [
    { ...first, anchor: "start" },
    ...interior.map((tick) => ({ ...tick, anchor: "middle" })),
    { ...last, anchor: "end" },
  ];
}

/**
 * One label centered under each handle, clamped inside the plot. When the two
 * would overlap they merge into one range label centered under the window.
 * Hidden at 100% zoom, where they would repeat the fixed axis's end labels.
 */
export function layoutHandleLabels({
  startX,
  endX,
  startLabel,
  endLabel,
  plotLeft,
  plotWidth,
  fontSize = 12,
  zoomed = true,
}) {
  if (!zoomed) {
    return { visible: false, merged: false, labels: [] };
  }

  const plotRight = plotLeft + plotWidth;
  const place = (key, centerX, label) => {
    const width = estimateLabelWidth(label, fontSize);
    const halfWidth = width / 2;
    const x =
      width >= plotWidth
        ? plotLeft + plotWidth / 2
        : Math.min(plotRight - halfWidth, Math.max(plotLeft + halfWidth, centerX));
    return { key, label, x, left: x - halfWidth, right: x + halfWidth };
  };

  const start = place("start", startX, startLabel);
  const end = place("end", endX, endLabel);
  if (start.right + LABEL_GAP <= end.left) {
    return { visible: true, merged: false, labels: [start, end] };
  }

  return {
    visible: true,
    merged: true,
    labels: [place("range", (startX + endX) / 2, `${startLabel} – ${endLabel}`)],
  };
}

// Strip geometry ------------------------------------------------------------

/**
 * Vertical layout of the overview strip, top to bottom, relative to its top:
 * handle overhang, the miniature band (one mini-row per lane), handle overhang,
 * the handle date labels, then the fixed axis. Both timelines size their SVG
 * from `height`.
 */
export function computeOverviewStripLayout({ rowCount = 1, compact = false } = {}) {
  const rows = Math.max(1, Math.round(Number(rowCount) || 1));
  const miniRowHeight = compact ? 5 : 4;
  const miniRowGap = 2;
  const handleOverhang = compact ? 5 : 4;
  const bandTop = handleOverhang;
  const bandHeight = rows * miniRowHeight + (rows - 1) * miniRowGap;
  const bandBottom = bandTop + bandHeight;
  const handleLabelRowTop = bandBottom + handleOverhang;
  const handleLabelBaseline = handleLabelRowTop + 11;
  const axisLineY = handleLabelRowTop + 14 + 2;
  const axisLabelBaseline = axisLineY + 14;

  return {
    rowCount: rows,
    miniRowHeight,
    miniRowGap,
    handleOverhang,
    bandTop,
    bandHeight,
    bandBottom,
    handleLabelBaseline,
    axisLineY,
    axisTickSize: 3,
    axisLabelBaseline,
    height: axisLabelBaseline + 4,
  };
}

export function getMiniRowY(layout, rowIndex) {
  return layout.bandTop + rowIndex * (layout.miniRowHeight + layout.miniRowGap);
}
