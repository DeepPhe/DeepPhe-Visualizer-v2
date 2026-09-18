import { parseDocumentDate } from "./normalizePatientPayload";

export const EPISODE_ORDER = [
  "Medical Decision-making",
  "Pre-diagnostic",
  "Unknown",
  "Diagnostic",
  "Treatment",
  "Follow-up",
];

export const EPISODE_COLORS = {
  "Medical Decision-making": "#A5D6A7",
  "Pre-diagnostic": "#90CAF9",
  Unknown: "#90CAF9",
  Diagnostic: "#FFAB91",
  Treatment: "#CE93D8",
  "Follow-up": "#80CBC4",
};

const DEFAULT_DIMENSIONS = {
  svgWidth: 1320,
  plotLeft: 236,
  plotRight: 20,
  plotTop: 16,
  rowHeight: 52,
  stackSpacing: 8,
  footerHeight: 44,
  datePaddingDays: 21,
};

function normalizeString(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeEpisodeLabel(episodeValue) {
  const rawLabel = normalizeString(episodeValue, "Unknown");
  const normalized = rawLabel.toLowerCase();

  if (normalized.includes("medical") && normalized.includes("decision")) {
    return "Medical Decision-making";
  }

  if (normalized.includes("pre") && normalized.includes("diagnostic")) {
    return "Pre-diagnostic";
  }

  if (normalized === "unknown") {
    return "Unknown";
  }

  if (normalized.includes("diagnostic")) {
    return "Diagnostic";
  }

  if (normalized.includes("treat")) {
    return "Treatment";
  }

  if (normalized.includes("follow")) {
    return "Follow-up";
  }

  return rawLabel;
}

function formatDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function formatDateTimeLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// Below this many pixels per tick, labels start to crowd each other.
export const MIN_TICK_SPACING = 150;

export function resolveResponsiveTickCount(plotWidth, maxTickCount = 7) {
  const numericPlotWidth = Math.max(0, Number(plotWidth) || 0);
  const numericMaxTickCount = Math.max(2, Number(maxTickCount) || 7);
  return Math.min(
    numericMaxTickCount,
    Math.max(2, Math.floor(numericPlotWidth / MIN_TICK_SPACING) + 1)
  );
}

// `timeZone` must match how the timeline built its dates: document dates are
// local (`new Date(year, month, day)`), event dates are UTC midnight. Formatting
// a UTC-midnight date in local time prints the previous day across the Americas.
export function formatTickLabel(date, dateRangeDays, { timeZone } = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const options =
    dateRangeDays >= 370
      ? { month: "short", year: "numeric" }
      : { month: "short", day: "numeric" };

  return new Intl.DateTimeFormat("en-US", timeZone ? { ...options, timeZone } : options).format(
    date
  );
}

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return formatDateTimeLabel(date);
}

function resolveDateDomain(reports, datePaddingDays) {
  const datedReports = reports.filter((report) => report.dateObject instanceof Date);

  if (datedReports.length === 0) {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 1);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 1);

    return { startDate, endDate };
  }

  const minDate = new Date(
    Math.min(...datedReports.map((report) => report.dateObject.getTime()))
  );
  const maxDate = new Date(
    Math.max(...datedReports.map((report) => report.dateObject.getTime()))
  );

  const startDate = new Date(minDate);
  const endDate = new Date(maxDate);

  if (startDate.getTime() === endDate.getTime()) {
    startDate.setDate(startDate.getDate() - datePaddingDays);
    endDate.setDate(endDate.getDate() + datePaddingDays);
    return { startDate, endDate };
  }

  startDate.setDate(startDate.getDate() - datePaddingDays);
  endDate.setDate(endDate.getDate() + datePaddingDays);
  return { startDate, endDate };
}

function resolveReportTypes(reports, reportTypes = []) {
  const normalizedProvidedTypes = (Array.isArray(reportTypes) ? reportTypes : [])
    .map((reportType) => normalizeString(reportType))
    .filter(Boolean);

  const ordered = [];
  const seen = new Set();

  normalizedProvidedTypes.forEach((reportType) => {
    if (!seen.has(reportType)) {
      seen.add(reportType);
      ordered.push(reportType);
    }
  });

  reports.forEach((report) => {
    if (!seen.has(report.type)) {
      seen.add(report.type);
      ordered.push(report.type);
    }
  });

  return ordered;
}

function resolveEpisodeLegend(reports, episodeCounts = {}) {
  const countsFromReports = reports.reduce((accumulator, report) => {
    const episodeLabel = report.episodeLabel;
    accumulator[episodeLabel] = (accumulator[episodeLabel] || 0) + 1;
    return accumulator;
  }, {});

  const mergedCounts = { ...countsFromReports };
  Object.entries(episodeCounts || {}).forEach(([episodeName, count]) => {
    const episodeLabel = normalizeEpisodeLabel(episodeName);
    mergedCounts[episodeLabel] = Math.max(
      Number(mergedCounts[episodeLabel] || 0),
      Number(count || 0)
    );
  });

  const sortEpisodes = (leftEpisode, rightEpisode) => {
    const leftOrder = EPISODE_ORDER.indexOf(leftEpisode);
    const rightOrder = EPISODE_ORDER.indexOf(rightEpisode);

    if (leftOrder !== -1 || rightOrder !== -1) {
      if (leftOrder === -1) {
        return 1;
      }
      if (rightOrder === -1) {
        return -1;
      }
      return leftOrder - rightOrder;
    }

    return leftEpisode.localeCompare(rightEpisode, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  };

  return Object.keys(mergedCounts)
    .sort(sortEpisodes)
    .map((label) => ({
      label,
      key: label,
      count: Number(mergedCounts[label] || 0),
      color: EPISODE_COLORS[label] || "#9E9E9E",
    }))
    .filter((episode) => episode.count > 0);
}

export function resolveTicks(
  startDate,
  endDate,
  width,
  plotLeft,
  tickCount = 7,
  { timeZone } = {}
) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    return [];
  }

  const domainStart = startDate.getTime();
  const domainEnd = endDate.getTime();
  const domainSpan = Math.max(1, domainEnd - domainStart);
  const dateRangeDays = domainSpan / (1000 * 60 * 60 * 24);
  const plotWidth = width;

  return Array.from({ length: tickCount }).map((_, index) => {
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
    const date = new Date(domainStart + domainSpan * ratio);

    return {
      date,
      x: plotLeft + plotWidth * ratio,
      label: formatTickLabel(date, dateRangeDays, { timeZone }),
    };
  });
}

/**
 * Overview-strip rows for the document timeline: one row per report type, in
 * lane order, with a zero-width mark per dated document at its full-domain x.
 * `stroke` outlines each mark like the detail dots, so pale episode colors
 * stay visible on the strip.
 */
export function buildDocumentOverviewRows(rows = [], points = [], { stroke } = {}) {
  return (rows || []).map((row) => ({
    key: row.type,
    marks: (points || [])
      .filter(
        (point) =>
          point.type === row.type &&
          point.dateObject instanceof Date &&
          !Number.isNaN(point.dateObject.getTime())
      )
      .map((point) => ({
        key: point.id,
        x1: point.x,
        x2: point.x,
        color: point.episodeColor,
        ...(stroke ? { stroke } : {}),
      })),
  }));
}

function buildPointLayout({ reports, reportTypes, dimensions, dateDomain }) {
  const rowByType = new Map(
    reportTypes.map((reportType, index) => [
      reportType,
      {
        type: reportType,
        rowIndex: index,
        y: dimensions.plotTop + index * dimensions.rowHeight + dimensions.rowHeight / 2,
      },
    ])
  );

  const reportGroups = new Map();
  reports.forEach((report) => {
    const dateKey = report.dateObject ? formatDateKey(report.dateObject) : `Unknown:${report.id}`;
    const groupKey = `${report.type}:::${dateKey}`;
    if (!reportGroups.has(groupKey)) {
      reportGroups.set(groupKey, []);
    }
    reportGroups.get(groupKey).push(report);
  });

  reportGroups.forEach((groupedReports) => {
    groupedReports.sort((leftReport, rightReport) =>
      leftReport.id.localeCompare(rightReport.id, undefined, {
        sensitivity: "base",
        numeric: true,
      })
    );
  });

  const domainStartMs = dateDomain.startDate.getTime();
  const domainEndMs = dateDomain.endDate.getTime();
  const domainSpan = Math.max(1, domainEndMs - domainStartMs);

  const scaleX = (dateObject) => {
    if (!(dateObject instanceof Date) || Number.isNaN(dateObject.getTime())) {
      return dimensions.plotLeft;
    }

    const ratio = Math.max(0, Math.min(1, (dateObject.getTime() - domainStartMs) / domainSpan));
    return dimensions.plotLeft + dimensions.plotWidth * ratio;
  };

  const points = [];

  reports.forEach((report) => {
    const row = rowByType.get(report.type);
    if (!row) {
      return;
    }

    const dateKey = report.dateObject ? formatDateKey(report.dateObject) : `Unknown:${report.id}`;
    const groupKey = `${report.type}:::${dateKey}`;
    const groupedReports = reportGroups.get(groupKey) || [report];
    const stackIndex = Math.max(0, groupedReports.findIndex((candidate) => candidate.id === report.id));
    const stackCount = Math.max(1, groupedReports.length);
    const stackCenter = (stackCount - 1) / 2;
    const offsetY = (stackIndex - stackCenter) * dimensions.stackSpacing;

    points.push({
      id: report.id,
      type: report.type,
      name: report.name,
      episodeLabel: report.episodeLabel,
      episodeColor: report.episodeColor,
      dateObject: report.dateObject,
      dateLabel: report.dateLabel,
      formattedDate: report.formattedDate,
      rowIndex: row.rowIndex,
      x: scaleX(report.dateObject),
      y: row.y + offsetY,
      rowY: row.y,
      stackIndex,
      stackCount,
    });
  });

  const rows = reportTypes.map((reportType, index) => ({
    type: reportType,
    rowIndex: index,
    y: dimensions.plotTop + index * dimensions.rowHeight + dimensions.rowHeight / 2,
    count: points.filter((point) => point.type === reportType).length,
  }));

  return {
    points,
    rows,
  };
}

function resolveReportDate(report) {
  return parseDocumentDate(report?.timelineDate || report?.date) || parseDocumentDate(report?.date);
}

/**
 * The document timeline's own date domain: its dated documents padded by
 * `datePaddingDays`. Null whenever the chart isn't drawn (no dated documents,
 * or every document sharing one timestamp), so a linked timeline never widens
 * the shared domain for a chart nobody can see.
 */
export function resolveTimelineDateDomain(
  timelineData = {},
  { datePaddingDays = DEFAULT_DIMENSIONS.datePaddingDays } = {}
) {
  const reportsWithIds = (Array.isArray(timelineData?.reportData) ? timelineData.reportData : [])
    .filter((report) => normalizeString(report?.id));
  const datedReports = reportsWithIds
    .map((report) => ({ dateObject: resolveReportDate(report) }))
    .filter((report) => report.dateObject instanceof Date && !Number.isNaN(report.dateObject.getTime()));
  const uniqueTimestamps = new Set(datedReports.map((report) => report.dateObject.getTime()));

  // Mirrors buildTimelineChartModel's `hasDateCollapse`.
  if (datedReports.length === 0 || (reportsWithIds.length > 1 && uniqueTimestamps.size === 1)) {
    return null;
  }
  return resolveDateDomain(datedReports, datePaddingDays);
}

/**
 * `options` holds the layout dimensions, plus an optional `dateDomain` that
 * replaces the documents' own domain (used when the timeline is linked to the
 * Event Timeline and both share one).
 */
export function buildTimelineChartModel(timelineData = {}, options = {}) {
  const { dateDomain: dateDomainOverride, ...layoutOptions } = options || {};
  const reportData = Array.isArray(timelineData?.reportData) ? timelineData.reportData : [];

  const reports = reportData
    .map((report) => {
      const id = normalizeString(report?.id);
      if (!id) {
        return null;
      }

      const episodeLabel = normalizeEpisodeLabel(report?.episode);
      const resolvedDate = resolveReportDate(report);

      return {
        id,
        type: normalizeString(report?.type, "Unknown"),
        name: normalizeString(report?.name, id),
        formattedDate: normalizeString(report?.formattedDate),
        dateObject: resolvedDate,
        dateLabel: formatDateLabel(resolvedDate),
        dateTimeLabel: formatDateTimeLabel(resolvedDate),
        episodeLabel,
        episodeColor: EPISODE_COLORS[episodeLabel] || "#9E9E9E",
        dateSource: normalizeString(report?.timelineDateSource, "date"),
      };
    })
    .filter(Boolean)
    .sort((leftReport, rightReport) => {
      const leftMs = leftReport.dateObject instanceof Date ? leftReport.dateObject.getTime() : Number.NaN;
      const rightMs = rightReport.dateObject instanceof Date ? rightReport.dateObject.getTime() : Number.NaN;

      if (Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs !== rightMs) {
        return leftMs - rightMs;
      }

      if (Number.isFinite(leftMs) && !Number.isFinite(rightMs)) {
        return -1;
      }

      if (!Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
        return 1;
      }

      return leftReport.id.localeCompare(rightReport.id, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    });

  const reportTypes = resolveReportTypes(reports, timelineData?.reportTypes);
  const hasDomainOverride =
    dateDomainOverride?.startDate instanceof Date &&
    dateDomainOverride?.endDate instanceof Date &&
    dateDomainOverride.endDate.getTime() > dateDomainOverride.startDate.getTime();
  const dateDomain = hasDomainOverride
    ? {
        startDate: new Date(dateDomainOverride.startDate.getTime()),
        endDate: new Date(dateDomainOverride.endDate.getTime()),
      }
    : resolveDateDomain(
        reports,
        Number(layoutOptions.datePaddingDays || DEFAULT_DIMENSIONS.datePaddingDays)
      );

  const dimensions = {
    ...DEFAULT_DIMENSIONS,
    ...layoutOptions,
    plotWidth:
      Number(layoutOptions.svgWidth || DEFAULT_DIMENSIONS.svgWidth) -
      Number(layoutOptions.plotLeft || DEFAULT_DIMENSIONS.plotLeft) -
      Number(layoutOptions.plotRight || DEFAULT_DIMENSIONS.plotRight),
  };

  const { points, rows } = buildPointLayout({
    reports,
    reportTypes,
    dimensions,
    dateDomain,
  });

  const chartHeight =
    dimensions.plotTop + reportTypes.length * dimensions.rowHeight + dimensions.footerHeight;
  const episodes = resolveEpisodeLegend(reports, timelineData?.episodeCounts);
  const validDatePoints = points.filter(
    (point) => point.dateObject instanceof Date && !Number.isNaN(point.dateObject.getTime())
  );
  const uniqueDateTimeValues = new Set(validDatePoints.map((point) => point.dateObject.getTime()));
  const uniqueDateDays = new Set(
    validDatePoints.map((point) => {
      const date = point.dateObject;
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    })
  );
  const hasDateCollapse = points.length > 1 && uniqueDateTimeValues.size === 1;
  const collapsedDateLabel =
    hasDateCollapse && validDatePoints.length > 0
      ? formatDateTimeLabel(validDatePoints[0].dateObject)
      : "";

  return {
    dimensions: {
      ...dimensions,
      svgHeight: chartHeight,
      baselineY: dimensions.plotTop + reportTypes.length * dimensions.rowHeight,
    },
    dateDomain,
    ticks: resolveTicks(
      dateDomain.startDate,
      dateDomain.endDate,
      dimensions.plotWidth,
      dimensions.plotLeft
    ),
    points,
    rows,
    episodes,
    totalReports: points.length,
    dateDiagnostics: {
      uniqueDateTimeCount: uniqueDateTimeValues.size,
      uniqueDateCount: uniqueDateDays.size,
      hasDateCollapse,
      collapsedDateLabel,
    },
  };
}
