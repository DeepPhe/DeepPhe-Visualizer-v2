import {
  EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT,
  FAKE_PATIENT_EVENT_TIMELINE_ID,
  LANE_GROUPS,
  LANE_GROUP_ORDER,
  TEMPORAL_RELATIONS,
  UNCATEGORIZED_LANE_GROUP,
} from "../constants/eventRelationTimeline";
import {
  getConceptLabel,
  getDocumentConcepts,
} from "../utils/patientView/documentMentions";
// Birth-date parsing and age maths live with the demographics controller;
// re-exported here so timeline callers keep a single import site.
export {
  findDemographicsBirthDate,
  getAgeOnDate,
  parsePatientBirthDate,
} from "./patientDemographics";

const REQUIRED_TSV_COLUMNS = Object.freeze([
  "PatientID",
  "ConceptID",
  "Relation1",
  "Date1",
  "Relation2",
  "Date2",
]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeRelation(value) {
  const normalized = normalizeString(value).toLowerCase();
  const relation = TEMPORAL_RELATIONS.find(
    (candidate) => candidate.toLowerCase() === normalized
  );
  return relation || "";
}

function parseUtcDate(value, rowNumber, columnName) {
  const normalized = normalizeString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new Error(`Invalid ${columnName} value on row ${rowNumber}: ${normalized || "(blank)"}`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ${columnName} value on row ${rowNumber}: ${normalized}`);
  }

  return date;
}

function formatDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeString(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function shouldShowEventRelationTimeline(patientId) {
  return normalizeString(patientId) === FAKE_PATIENT_EVENT_TIMELINE_ID;
}

export function parseEventRelationTimelineTsv(tsvText) {
  const lines = String(tsvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headerColumns = lines[0].split("\t").map(normalizeString);
  const missingColumns = REQUIRED_TSV_COLUMNS.filter(
    (columnName) => !headerColumns.includes(columnName)
  );

  if (missingColumns.length > 0) {
    throw new Error(`Event timeline TSV is missing column(s): ${missingColumns.join(", ")}`);
  }

  const columnIndexByName = headerColumns.reduce((accumulator, columnName, index) => {
    accumulator[columnName] = index;
    return accumulator;
  }, {});

  return lines.slice(1).map((line, index) => {
    const rowNumber = index + 2;
    const columns = line.split("\t");
    const patientId = normalizeString(columns[columnIndexByName.PatientID]);
    const conceptId = normalizeString(columns[columnIndexByName.ConceptID]);
    const relation1 = normalizeRelation(columns[columnIndexByName.Relation1]);
    const relation2 = normalizeRelation(columns[columnIndexByName.Relation2]);
    const date1 = parseUtcDate(columns[columnIndexByName.Date1], rowNumber, "Date1");
    const date2 = parseUtcDate(columns[columnIndexByName.Date2], rowNumber, "Date2");

    if (!patientId) {
      throw new Error(`Missing PatientID value on row ${rowNumber}.`);
    }
    if (!conceptId) {
      throw new Error(`Missing ConceptID value on row ${rowNumber}.`);
    }
    if (!relation1) {
      throw new Error(`Invalid Relation1 value on row ${rowNumber}.`);
    }
    if (!relation2) {
      throw new Error(`Invalid Relation2 value on row ${rowNumber}.`);
    }

    return {
      sourceRowNumber: rowNumber,
      patientId,
      conceptId,
      relation1,
      relation2,
      relationKey: `${relation1}/${relation2}`,
      date1,
      date2,
      date1Label: formatDateLabel(date1),
      date2Label: formatDateLabel(date2),
      date1Time: date1.getTime(),
      date2Time: date2.getTime(),
    };
  });
}

/**
 * dpheGroup -> lane group label, matching the alpha's LANE_GROUPS lookup.
 * Unmapped groups fall back to "Uncategorized" exactly as the alpha does; only
 * the four groups in LANE_GROUP_ORDER are ever drawn.
 */
export function resolveEventRelationLaneGroup(concept = {}) {
  const normalizedGroup = normalizeString(concept?.dpheGroup).toLowerCase();
  if (!normalizedGroup) {
    return "";
  }
  return LANE_GROUPS[normalizedGroup] || UNCATEGORIZED_LANE_GROUP;
}

function buildConceptMap(concepts = []) {
  return (Array.isArray(concepts) ? concepts : []).reduce((map, concept) => {
    const conceptId = normalizeString(concept?.id);
    if (conceptId) {
      map.set(conceptId, concept);
    }
    return map;
  }, new Map());
}

function getSelectedDocumentConceptIds(selectedDocument, concepts) {
  if (!selectedDocument) {
    return new Set();
  }

  return new Set(
    getDocumentConcepts(selectedDocument, concepts)
      .map((concept) => normalizeString(concept?.id))
      .filter(Boolean)
  );
}

/**
 * Collapse rows into spans keyed on laneGroup + start + end, merging their
 * concept ids and dpheGroups. This is the alpha's `createSpanData`: rows sharing
 * a lane group and an identical date range become ONE drawn mark, and the
 * winning row's relation1/relation2/negated describe it.
 */
export function createEventRelationSpans(rows = []) {
  const spanMap = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = `${row.laneGroup}_${row.date1Label}_${row.date2Label}`;
    const existingSpan = spanMap.get(key);

    if (existingSpan) {
      if (!existingSpan.patientIds.includes(row.patientId)) {
        existingSpan.patientIds.push(row.patientId);
      }
      if (!existingSpan.dpheGroups.includes(row.dpheGroup)) {
        existingSpan.dpheGroups.push(row.dpheGroup);
      }
      if (!existingSpan.conceptIds.includes(row.conceptId)) {
        existingSpan.conceptIds.push(row.conceptId);
        existingSpan.conceptLabels.push(row.conceptLabel);
      }
      existingSpan.rowCount += 1;
      existingSpan.sourceRowNumbers.push(row.sourceRowNumber);
      existingSpan.inSelectedDocument =
        existingSpan.inSelectedDocument || row.inSelectedDocument;
      return;
    }

    spanMap.set(key, {
      id: key,
      start: row.date1Label,
      end: row.date2Label,
      startTime: row.date1Time,
      endTime: row.date2Time,
      laneGroup: row.laneGroup,
      relation1: row.relation1,
      relation2: row.relation2,
      relationKey: row.relationKey,
      negated: row.negated,
      patientIds: [row.patientId],
      dpheGroups: [row.dpheGroup],
      conceptIds: [row.conceptId],
      conceptLabels: [row.conceptLabel],
      sourceRowNumbers: [row.sourceRowNumber],
      rowCount: 1,
      inSelectedDocument: row.inSelectedDocument,
    });
  });

  return [...spanMap.values()];
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    if (key) {
      counts[key] = Number(counts[key] || 0) + 1;
    }
    return counts;
  }, {});
}

export function buildEventRelationTimelineModel({
  tsvText = "",
  relations = undefined,
  concepts = [],
  selectedDocument = null,
} = {}) {
  const parsedRows = Array.isArray(relations)
    ? relations
    : parseEventRelationTimelineTsv(tsvText);
  const conceptById = buildConceptMap(concepts);
  const selectedDocumentConceptIds = getSelectedDocumentConceptIds(selectedDocument, concepts);
  const unmatchedConceptIds = new Set();
  const uncategorizedConceptIds = new Set();
  const rows = [];

  parsedRows.forEach((row) => {
    const concept = conceptById.get(row.conceptId);
    if (!concept) {
      unmatchedConceptIds.add(row.conceptId);
      return;
    }

    const laneGroup = resolveEventRelationLaneGroup(concept);
    if (!LANE_GROUP_ORDER.includes(laneGroup)) {
      uncategorizedConceptIds.add(row.conceptId);
      return;
    }

    rows.push({
      ...row,
      laneGroup,
      dpheGroup: normalizeString(concept?.dpheGroup) || "Unknown",
      conceptLabel: getConceptLabel(concept),
      negated: normalizeBoolean(concept?.negated),
      inSelectedDocument: selectedDocumentConceptIds.has(row.conceptId),
    });
  });

  const spans = createEventRelationSpans(rows);

  return {
    patientId: parsedRows[0]?.patientId || "",
    sourceRowCount: parsedRows.length,
    matchedRowCount: rows.length,
    rows,
    spans,
    // Lane group label counts use merged spans, matching the alpha's
    // `${groupKey} (${spans.length})` group label.
    laneGroupCounts: countBy(spans, (span) => span.laneGroup),
    dpheGroupCounts: countBy(rows, (row) => row.dpheGroup),
    relationCounts: countBy(spans, (span) => span.relationKey),
    // Distinct relations present, for the legend (alpha: allRelations).
    presentRelations: TEMPORAL_RELATIONS.filter((relation) =>
      spans.some((span) => span.relation1 === relation || span.relation2 === relation)
    ),
    unmatchedConceptIds: [...unmatchedConceptIds].sort(),
    uncategorizedConceptIds: [...uncategorizedConceptIds].sort(),
    currentReportConceptIds: [...selectedDocumentConceptIds].sort(),
    hasSelectedDocument: Boolean(selectedDocument),
  };
}

export function filterEventRelationTimelineModel(model, scope) {
  if (!model || scope !== EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT) {
    return model;
  }

  const rows = model.rows.filter((row) => row.inSelectedDocument);
  const spans = createEventRelationSpans(rows);

  return {
    ...model,
    matchedRowCount: rows.length,
    rows,
    spans,
    laneGroupCounts: countBy(spans, (span) => span.laneGroup),
    relationCounts: countBy(spans, (span) => span.relationKey),
    presentRelations: TEMPORAL_RELATIONS.filter((relation) =>
      spans.some((span) => span.relation1 === relation || span.relation2 === relation)
    ),
  };
}
