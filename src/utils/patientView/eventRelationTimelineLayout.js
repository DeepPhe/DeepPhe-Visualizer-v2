import { scaleTime, scaleSequential } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";
import {
  AGE_AREA,
  GAPS,
  HEATMAP_BIN_COUNT,
  HEATMAP_RANGE,
  LANE,
  LANE_GROUP_ORDER,
  LEGEND,
  MARGINS,
  NEGATED_RELATION_COLOR,
  OVERVIEW_TOP_GAP,
  PLOT_RIGHT_GUTTER,
  RELATION_COLOR,
  TIMELINE_PADDING_DAYS,
  VIEWBOX_TOP,
} from "../../constants/eventRelationTimeline";
import { getAgeOnDate } from "../../controllers/patientDemographics";
import { computeOverviewStripLayout } from "./timelineViewport";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Alpha: `checkOverlapWithPadding` -- two pixel ranges collide when, after each
 * is grown by `padding` on both sides, they still intersect.
 */
export function checkOverlapWithPadding(a, b, padding = 0) {
  const aStart = a[0] - padding;
  const aEnd = a[1] + padding;
  const bStart = b[0] - padding;
  const bEnd = b[1] + padding;
  return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
}

/**
 * Alpha: `getLaneCount` -- greedy first-fit packing of spans into overlap-free
 * lanes, in start-date order. Mutates nothing; returns the lane index per span
 * id plus the lane count. A collapsed group is a single lane.
 */
export function packSpansIntoLanes(spans = [], { expanded = true, padding = 0 } = {}) {
  if (!expanded) {
    return {
      laneCount: 1,
      laneIndexById: new Map((spans || []).map((span) => [span.id, 0])),
    };
  }

  const ordered = [...(spans || [])].sort((left, right) =>
    left.start < right.start ? -1 : left.start > right.start ? 1 : 0
  );
  const lanes = [];
  const laneIndexById = new Map();

  ordered.forEach((span) => {
    const range = [span.x1, span.x2];
    let placed = false;

    for (let index = 0; index < lanes.length; index += 1) {
      const collides = lanes[index].some((occupied) =>
        checkOverlapWithPadding(occupied, range, padding)
      );
      if (!collides) {
        lanes[index].push(range);
        laneIndexById.set(span.id, index);
        placed = true;
        break;
      }
    }

    if (!placed) {
      laneIndexById.set(span.id, lanes.length);
      lanes.push([range]);
    }
  });

  return { laneCount: Math.max(1, lanes.length), laneIndexById };
}

/**
 * Data extent padded by TIMELINE_PADDING_DAYS on each side (alpha behaviour:
 * the domain follows the data, it is never hardcoded).
 */
export function computeEventRelationDomain(spans = []) {
  const times = (spans || []).flatMap((span) => [span.startTime, span.endTime]);

  if (times.length === 0) {
    const now = new Date(2010, 0, 1).getTime();
    return { startDate: new Date(now), endDate: new Date(now + MS_PER_DAY) };
  }

  // Pad by calendar days (dates are local midnight), so a daylight-saving
  // change inside the padding can't move the domain ends off midnight.
  const startDate = new Date(Math.min(...times));
  startDate.setDate(startDate.getDate() - TIMELINE_PADDING_DAYS);
  const endDate = new Date(Math.max(...times));
  endDate.setDate(endDate.getDate() + TIMELINE_PADDING_DAYS);
  return { startDate, endDate };
}

/**
 * Full chart geometry. Mirrors the alpha's layout maths in renderTimeline.js and
 * setUpTimelineLayout.js, including the layer offsets, so the chart lays out
 * identically at a given container width.
 */
export function computeEventRelationTimelineLayout({
  containerWidth = 1040,
  spans = [],
  domain: suppliedDomain,
  collapsedGroups = new Set(),
  showAgeAxis = true,
  // Label gutter and right gutter, in px. The alpha's by default; the card
  // passes the frame it shares with the document timeline.
  plotInsets = { left: MARGINS.left, right: PLOT_RIGHT_GUTTER },
} = {}) {
  const measuredWidth = Math.round(Number(containerWidth) || 1040);
  const insetLeft = Number(plotInsets?.left ?? MARGINS.left);
  const insetRight = Number(plotInsets?.right ?? PLOT_RIGHT_GUTTER);
  const svgWidth = Math.max(240, measuredWidth - insetLeft - insetRight);
  const domain = suppliedDomain || computeEventRelationDomain(spans);
  const mainX = scaleTime()
    .domain([domain.startDate, domain.endDate])
    .range([0, svgWidth]);

  const positionedSpans = (spans || []).map((span) => ({
    ...span,
    x1: mainX(new Date(span.startTime)),
    x2: mainX(new Date(span.endTime)),
  }));

  const collapsed =
    collapsedGroups instanceof Set ? collapsedGroups : new Set(collapsedGroups || []);

  let yGroupOffset = 0;
  const groups = [];

  LANE_GROUP_ORDER.forEach((key) => {
    const spansForGroup = positionedSpans.filter((span) => span.laneGroup === key);
    if (spansForGroup.length === 0) {
      return;
    }

    const expanded = !collapsed.has(key);
    const { laneCount, laneIndexById } = packSpansIntoLanes(spansForGroup, { expanded });
    const height = laneCount * LANE.height;

    groups.push({
      key,
      expanded,
      laneCount,
      height,
      yOffset: yGroupOffset,
      spans: spansForGroup.map((span) => ({
        ...span,
        laneIndex: laneIndexById.get(span.id) || 0,
      })),
    });

    yGroupOffset += height + LANE.GROUP_TOP_PADDING;
  });

  const totalContentHeight = yGroupOffset;
  const mainTop = MARGINS.top + LEGEND.height + GAPS.legendToMain;
  const ageTop = mainTop + totalContentHeight + GAPS.pad;
  const ageBandHeight = showAgeAxis ? AGE_AREA.height + AGE_AREA.bottomPad : 0;
  const overviewTop = ageTop + ageBandHeight + OVERVIEW_TOP_GAP;
  // The overview strip has one mini-row per drawn lane group.
  const overview = computeOverviewStripLayout({ rowCount: groups.length });
  // The viewBox starts VIEWBOX_TOP down (the legend is HTML above the SVG), so
  // the drawable height runs from there to the bottom of the overview strip.
  const svgTotalHeight = overviewTop + overview.height + MARGINS.bottom - VIEWBOX_TOP;

  // Unique event dates get a dashed vertical guideline across every lane.
  const uniqueDates = [
    ...new Set(positionedSpans.flatMap((span) => [span.startTime, span.endTime])),
  ]
    .sort((left, right) => left - right)
    .map((time) => new Date(time));

  return {
    domain,
    mainX,
    dimensions: {
      containerWidth: measuredWidth,
      // The plot has a minimum width, so on a narrow container the drawn area
      // is wider than the container. The viewBox must describe the content, not
      // the container, or the right-hand end of the chart is clipped away.
      viewBoxWidth: insetLeft + svgWidth + insetRight,
      viewBoxTop: VIEWBOX_TOP,
      svgWidth,
      svgTotalHeight,
      totalContentHeight,
      marginLeft: insetLeft,
      mainTop,
      ageTop,
      overviewTop,
      overviewHeight: overview.height,
      showAgeAxis,
    },
    groups,
    uniqueDates,
    spans: positionedSpans,
  };
}

/**
 * Overview-strip rows for the event timeline: one row per drawn lane group, in
 * chart order, with each merged span at its full-domain (`mainX`) position.
 * Collapsed groups keep their row.
 */
export function buildEventRelationOverviewRows(groups = []) {
  return (groups || []).map((group) => ({
    key: group.key,
    marks: (group.spans || []).map((span) => ({
      key: span.id,
      x1: span.x1,
      x2: span.x2,
      color: span.negated ? NEGATED_RELATION_COLOR : RELATION_COLOR,
    })),
  }));
}

/**
 * Alpha `drawLanes`: which end caps a relation pair gets. `kind: "tick"` is the
 * same-day On/On case the alpha draws as a bare vertical stroke rather than a
 * span. Overlaps deliberately has no cap -- an open end reads as "extends past".
 */
export function getEventRelationGlyph(span = {}, { expanded = true } = {}) {
  const { relation1, relation2, x1, x2 } = span;
  const sameInstant = x1 === x2;

  if (relation1 === "On" && relation2 === "On" && sameInstant) {
    return { kind: "tick", markerStart: null, markerEnd: null };
  }

  if (!expanded) {
    if (relation1 === "On" && relation2 === "On") {
      return { kind: "span", markerStart: "verticalLineCap", markerEnd: "verticalLineCap" };
    }
    if (relation1 === "Overlaps" && relation2 === "On") {
      return { kind: "span", markerStart: null, markerEnd: "collapsedVerticalLineCap" };
    }
    if (relation1 === "On" && relation2 === "Overlaps") {
      return { kind: "span", markerStart: "collapsedVerticalLineCap", markerEnd: null };
    }
    return { kind: "span", markerStart: null, markerEnd: null };
  }

  const markerStart =
    relation1 === "After"
      ? "rightArrow"
      : relation1 === "Before"
        ? "leftArrow"
        : relation1 === "On"
          ? "verticalLineCap"
          : null;

  const markerEnd =
    relation2 === "Before"
      ? "leftArrow"
      : relation2 === "On"
        ? "verticalLineCap"
        : null;

  // After/After and Before/Before are drawn as a bare span in the alpha -- the
  // arrow marker is only ever applied to the *other* end of the pair.
  if (relation1 === relation2 && (relation1 === "After" || relation1 === "Before")) {
    return { kind: "span", markerStart: null, markerEnd: null };
  }

  return { kind: "span", markerStart, markerEnd };
}

/** Alpha `timeBetween` -- "1 year, 2 months, 3 days". */
export function formatEventRelationDuration(startLabel, endLabel) {
  let diffMs = new Date(endLabel) - new Date(startLabel);

  const units = [
    { label: "year", ms: 1000 * 60 * 60 * 24 * 365 },
    { label: "month", ms: 1000 * 60 * 60 * 24 * 30 },
    { label: "day", ms: 1000 * 60 * 60 * 24 },
  ];

  const parts = [];
  units.forEach((unit) => {
    if (diffMs >= unit.ms) {
      const amount = Math.floor(diffMs / unit.ms);
      diffMs -= amount * unit.ms;
      parts.push(`${amount} ${unit.label}${amount !== 1 ? "s" : ""}`);
    }
  });

  return parts.join(", ");
}

/** Alpha tooltip text, including its "Name (xN)" duplicate collapsing. */
export function buildEventRelationTooltip(span = {}, { includeDuration = true } = {}) {
  const nameCounts = {};
  (span.conceptLabels || []).forEach((name) => {
    const key = name || "Unknown";
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  });

  const conceptNamesDisplay = Object.entries(nameCounts)
    .map(([name, count]) => (count > 1 ? `${name} (x${count})` : name))
    .join(", ");

  const durationLine =
    includeDuration && span.start !== span.end
      ? `Duration: ${formatEventRelationDuration(span.start, span.end)}\n`
      : "";

  return `${durationLine}${span.relation1}: ${span.start}\n${span.relation2}: ${span.end}\nConcept Name: ${conceptNamesDisplay}`;
}

/**
 * Alpha `createLaneHeatmap` -- HEATMAP_BIN_COUNT bins across the visible domain,
 * counting how many spans cover each bin, coloured white -> dark green.
 */
export function buildEventRelationHeatmap(spans = [], xScale) {
  if (!spans || spans.length === 0 || !xScale) {
    return [];
  }

  const [domainStart, domainEnd] = xScale.domain();
  const binWidthMs = (domainEnd.getTime() - domainStart.getTime()) / HEATMAP_BIN_COUNT;
  if (!Number.isFinite(binWidthMs) || binWidthMs <= 0) {
    return [];
  }

  const bins = new Array(HEATMAP_BIN_COUNT).fill(0);

  spans.forEach((span) => {
    const startBin = Math.floor((span.startTime - domainStart.getTime()) / binWidthMs);
    const endBin = Math.floor((span.endTime - domainStart.getTime()) / binWidthMs);
    for (
      let index = Math.max(0, startBin);
      index < Math.min(HEATMAP_BIN_COUNT - 1, endBin);
      index += 1
    ) {
      bins[index] += 1;
    }
  });

  const maxCount = Math.max(...bins);
  const colorScale = scaleSequential(interpolateRgb(HEATMAP_RANGE[0], HEATMAP_RANGE[1])).domain([
    0,
    maxCount || 1,
  ]);
  const pixelWidth =
    xScale(new Date(domainStart.getTime() + binWidthMs)) - xScale(domainStart);

  return bins.map((count, index) => ({
    x: xScale(new Date(domainStart.getTime() + index * binWidthMs)),
    width: Math.max(1, pixelWidth),
    count,
    color: count > 0 ? colorScale(count) : HEATMAP_RANGE[0],
  }));
}

/**
 * Age axis derived from the patient's date of birth: the two domain edges carry
 * the patient's age there, and every birthday inside the domain gets a tick.
 * Returns `available: false` when no birth date is known -- the alpha showed a
 * hardcoded 53..56 in that case, which contradicts the loaded record.
 */
export function computeEventRelationAgeAxis(domain, xScale, birthDate = null) {
  const empty = { available: false, encounters: [], interiors: [] };

  if (!xScale || !domain || !(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) {
    return empty;
  }

  const startAge = getAgeOnDate(birthDate, domain.startDate);
  const endAge = getAgeOnDate(birthDate, domain.endDate);

  if (!Number.isFinite(startAge) || !Number.isFinite(endAge) || startAge < 0) {
    return empty;
  }

  const range = typeof xScale.range === "function" ? xScale.range() : [0, 0];
  const rangeStart = Math.min(...range);
  const rangeEnd = Math.max(...range);
  const isVisibleTick = ({ x }) => x >= rangeStart && x <= rangeEnd;

  const encounters = [domain.startDate, domain.endDate]
    .map((date) => ({
      date,
      age: getAgeOnDate(birthDate, date),
      x: xScale(date),
    }))
    .filter(isVisibleTick);

  // Each birthday strictly inside the domain, labelled with the age reached.
  const interiors = [];
  for (let age = startAge + 1; age <= endAge; age += 1) {
    const birthday = new Date(
      birthDate.getFullYear() + age,
      birthDate.getMonth(),
      birthDate.getDate()
    );

    if (birthday > domain.startDate && birthday < domain.endDate) {
      const tick = { date: birthday, age, x: xScale(birthday) };
      if (isVisibleTick(tick)) {
        interiors.push(tick);
      }
    }
  }

  return { available: true, startAge, endAge, encounters, interiors };
}
