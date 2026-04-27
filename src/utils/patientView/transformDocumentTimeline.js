import { parseDocumentDate } from "./normalizePatientPayload";

function toValidDateOrNull(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  return value;
}

function toDateFromParts(year, month, day, hour = 0, minute = 0, second = 0) {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  if (year < 1900 || year > 2300 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  return toValidDateOrNull(date);
}

function parseFourteenDigitTimestamp(rawTimestamp) {
  const digits = String(rawTimestamp || "").replace(/[^0-9]/g, "");
  if (digits.length !== 14) {
    return null;
  }

  const yyyyMMddCandidate = toDateFromParts(
    Number(digits.slice(0, 4)),
    Number(digits.slice(4, 6)),
    Number(digits.slice(6, 8)),
    Number(digits.slice(8, 10)),
    Number(digits.slice(10, 12)),
    Number(digits.slice(12, 14))
  );
  if (yyyyMMddCandidate) {
    return yyyyMMddCandidate;
  }

  const ddMMyyyyCandidate = toDateFromParts(
    Number(digits.slice(4, 8)),
    Number(digits.slice(2, 4)),
    Number(digits.slice(0, 2)),
    Number(digits.slice(8, 10)),
    Number(digits.slice(10, 12)),
    Number(digits.slice(12, 14))
  );
  if (ddMMyyyyCandidate) {
    return ddMMyyyyCandidate;
  }

  return null;
}

function extractDateFromDocumentIdentifier(document = {}) {
  const candidates = [document.id, document.documentId, document.name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const matches = candidate.match(/\d{14}/g);
    if (!Array.isArray(matches) || matches.length === 0) {
      continue;
    }

    for (const match of matches) {
      const parsed = parseFourteenDigitTimestamp(match);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function countUniqueTimestamps(dateValues = []) {
  const uniqueTimestamps = new Set();

  dateValues.forEach((dateValue) => {
    const normalizedDate = toValidDateOrNull(dateValue);
    if (!normalizedDate) {
      return;
    }

    uniqueTimestamps.add(normalizedDate.getTime());
  });

  return uniqueTimestamps.size;
}

function formatTimelineDateValue(dateObject) {
  const date = toValidDateOrNull(dateObject);
  if (!date) {
    return "";
  }

  const year = `${date.getFullYear()}`.padStart(4, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function formatDateForKey(dateValue) {
  const rawValue = String(dateValue || "").trim();
  if (!rawValue) {
    return "Unknown";
  }

  const digitsOnly = rawValue.replace(/[^0-9]/g, "");
  if (digitsOnly.length >= 8) {
    const year = digitsOnly.slice(0, 4);
    const month = digitsOnly.slice(4, 6);
    const day = digitsOnly.slice(6, 8);
    return `${year}/${month}/${day}`;
  }

  const parsedDate = parseDocumentDate(rawValue);
  if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  const year = parsedDate.getFullYear();
  const month = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsedDate.getDate()}`.padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function resolveDocumentDateCandidates(documents = []) {
  const rows = (Array.isArray(documents) ? documents : []).map((document) => {
    const dateFromField = toValidDateOrNull(parseDocumentDate(document?.date));
    const dateFromIdentifier = extractDateFromDocumentIdentifier(document);
    return {
      document,
      dateFromField,
      dateFromIdentifier,
    };
  });

  const uniqueFieldDateCount = countUniqueTimestamps(rows.map((row) => row.dateFromField));
  const uniqueIdentifierDateCount = countUniqueTimestamps(
    rows.map((row) => row.dateFromIdentifier)
  );

  const shouldPreferIdentifierDate =
    uniqueIdentifierDateCount > uniqueFieldDateCount && uniqueIdentifierDateCount > 1;

  return rows.map((row) => {
    const chosenDate = shouldPreferIdentifierDate
      ? row.dateFromIdentifier || row.dateFromField
      : row.dateFromField || row.dateFromIdentifier;
    const dateSource = shouldPreferIdentifierDate
      ? row.dateFromIdentifier
        ? "identifier"
        : row.dateFromField
          ? "date"
          : "unknown"
      : row.dateFromField
        ? "date"
        : row.dateFromIdentifier
          ? "identifier"
          : "unknown";

    return {
      document: row.document,
      timelineDateObject: chosenDate,
      timelineDateValue: formatTimelineDateValue(chosenDate),
      timelineDateSource: dateSource,
    };
  });
}

function sortDocumentsByDate(resolvedDocuments = []) {
  return [...resolvedDocuments].sort((leftDocument, rightDocument) => {
    const leftDate = leftDocument.timelineDateObject;
    const rightDate = rightDocument.timelineDateObject;

    if (leftDate && rightDate) {
      return leftDate.getTime() - rightDate.getTime();
    }

    if (leftDate) {
      return -1;
    }

    if (rightDate) {
      return 1;
    }

    return String(leftDocument.document?.id || "").localeCompare(
      String(rightDocument.document?.id || ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      }
    );
  });
}

function buildReportData(documents = []) {
  const resolvedDocuments = resolveDocumentDateCandidates(documents);

  return sortDocumentsByDate(resolvedDocuments).map((resolvedDocument) => {
    const document = resolvedDocument.document || {};
    const preferredDateValue =
      resolvedDocument.timelineDateValue || String(document.date || "").trim();

    return {
      id: String(document.id || "").trim(),
      date: String(document.date || "").trim(),
      timelineDate: preferredDateValue,
      timelineDateSource: resolvedDocument.timelineDateSource,
      formattedDate: formatDateForKey(preferredDateValue),
      type: String(document.type || "Unknown").trim() || "Unknown",
      episode: String(document.episode || "Unknown").trim() || "Unknown",
      name: String(document.name || document.id || "Untitled document").trim(),
    };
  });
}

function countByKey(items, key) {
  return items.reduce((accumulator, item) => {
    const itemKey = String(item?.[key] || "Unknown").trim() || "Unknown";
    const currentCount = accumulator[itemKey] || 0;
    accumulator[itemKey] = currentCount + 1;
    return accumulator;
  }, {});
}

function getDistinctValues(items, key) {
  return [...new Set(items.map((item) => String(item?.[key] || "Unknown").trim() || "Unknown"))];
}

function buildEpisodeDates(reportData = []) {
  return reportData.reduce((accumulator, report) => {
    const episode = String(report.episode || "Unknown").trim() || "Unknown";
    if (!accumulator[episode]) {
      accumulator[episode] = [];
    }
    accumulator[episode].push(report.formattedDate);
    return accumulator;
  }, {});
}

function buildMaxSameDateCountPerType(reportData = []) {
  const groupedCounts = {};

  reportData.forEach((report) => {
    const type = String(report.type || "Unknown").trim() || "Unknown";
    const date = String(report.formattedDate || "Unknown").trim() || "Unknown";

    if (!groupedCounts[type]) {
      groupedCounts[type] = {};
    }
    if (!groupedCounts[type][date]) {
      groupedCounts[type][date] = 0;
    }

    groupedCounts[type][date] += 1;
  });

  return Object.entries(groupedCounts).reduce((accumulator, [type, countsByDate]) => {
    const maxCount = Math.max(...Object.values(countsByDate));
    accumulator[type] = Number.isFinite(maxCount) ? maxCount : 0;
    return accumulator;
  }, {});
}

function buildReportsGroupedByDateAndType(reportData = []) {
  return reportData.reduce((accumulator, report) => {
    const date = String(report.formattedDate || "Unknown").trim() || "Unknown";
    const type = String(report.type || "Unknown").trim() || "Unknown";

    if (!accumulator[date]) {
      accumulator[date] = {};
    }

    if (!accumulator[date][type]) {
      accumulator[date][type] = [];
    }

    accumulator[date][type].push(report);
    return accumulator;
  }, {});
}

function buildPatientInfo({ patientId, patientName, demographics }) {
  return {
    patientId: String(patientId || "").trim(),
    patientName: String(patientName || demographics?.patientName || "").trim(),
    birthDate: String(demographics?.birthDate || "").trim(),
    gender: String(demographics?.gender || "").trim(),
    firstEncounterDate: String(demographics?.firstEncounterDate || "").trim(),
    lastEncounterDate: String(demographics?.lastEncounterDate || "").trim(),
  };
}

export function transformDocumentTimeline({
  patientId,
  patientName,
  demographics,
  documents,
} = {}) {
  const reportData = buildReportData(documents);

  return {
    patientInfo: buildPatientInfo({ patientId, patientName, demographics }),
    reportData,
    typeCounts: countByKey(reportData, "type"),
    episodes: getDistinctValues(reportData, "episode"),
    episodeCounts: countByKey(reportData, "episode"),
    reportTypes: getDistinctValues(reportData, "type"),
    episodeDates: buildEpisodeDates(reportData),
    maxVerticalCountsPerType: buildMaxSameDateCountPerType(reportData),
    reportsGroupedByDateAndTypeObj: buildReportsGroupedByDateAndType(reportData),
  };
}
