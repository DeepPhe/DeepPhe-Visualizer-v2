import { toDisplayName } from "../displayNames";

export const DEFAULT_GROUP_COLOR = "#e0e0e0";

export const GROUP_COLOR_BY_NAME = {
  // Anatomy
  "Body Part": "#99E6E6",
  "Lymph Node": "#bfefff",
  Tissue: "#b2dfee",
  "Body Fluid or Substance": "#add8e6",
  Side: "#93ccea",
  "Spatial Qualifier": "#9ac0cd",

  // Device
  "Imaging Device": "#785ef0",

  // Finding
  Finding: "#ffbcdd",
  "Clinical Test Result": "#ffadc1",
  "Gene Product": "#ff9ea4",
  Gene: "#ff9ea4",
  Position: "#CC9999",

  // Disorder
  "Quantitative Concept": "#33991A",
  "Disease or Disorder": "#7fce94",
  Neoplasm: "#96e7ac",
  Mass: "#a8ffc0",

  // Severity
  "Disease Stage Qualifier": "#ef7c0c",
  "Disease Grade Qualifier": "#ffa247",
  "Generic TNM Finding": "#ff9731",
  "Pathologic TNM Finding": "#ff8e20",
  Behavior: "#ff8712",
  Severity: "#ff7e00",

  // Attribute
  "Clinical Course of Disease": "#e5d815",
  "Pathologic Process": "#ffef00",
  "Disease Qualifier": "#ffdb00",
  "Property or Attribute": "#ffc700",
  "General Qualifier": "#ffbf00",
  "Temporal Qualifier": "#ffab00",

  // Intervention
  "Pharmacologic Substance": "#b36cef",
  "Chemo/immuno/hormone Therapy Regimen": "#da9cf5",
  "Intervention or Procedure": "#ca99f4",
};

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeConfidence(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  if (numericValue > 1) {
    return numericValue / 100;
  }

  return numericValue;
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getGroupName(concept = {}) {
  const dpheGroup = String(concept?.dpheGroup || "").trim();
  if (dpheGroup) {
    return dpheGroup;
  }

  return "Unknown";
}

export function getConceptLabel(concept = {}) {
  return (
    String(concept?.name || concept?.preferredText || "").trim() ||
    toDisplayName(String(concept?.classUri || "").trim()) ||
    String(concept?.classUri || concept?.id || "Unknown concept").trim()
  );
}

export function getDocumentConcepts(document = {}, concepts = []) {
  const mentionIdsInDocument = new Set(
    normalizeArray(document?.mentions)
      .map((mention) => String(mention?.id || "").trim())
      .filter(Boolean)
  );

  return normalizeArray(concepts).filter((concept) => {
    const conceptMentionIds = normalizeArray(concept?.mentionIds)
      .map((mentionId) => String(mentionId || "").trim())
      .filter(Boolean);

    return conceptMentionIds.some((mentionId) => mentionIdsInDocument.has(mentionId));
  });
}

export function buildGroupColorByName(concepts = []) {
  const groupNames = [...new Set(normalizeArray(concepts).map((concept) => getGroupName(concept)))];

  return groupNames.reduce((accumulator, groupName) => {
    accumulator[groupName] = GROUP_COLOR_BY_NAME[groupName] || DEFAULT_GROUP_COLOR;
    return accumulator;
  }, {});
}

export function buildConceptRows(document = {}, concepts = []) {
  const conceptsInDocument = getDocumentConcepts(document, concepts);

  return conceptsInDocument
    .map((concept) => {
      const mentionIdsInConcept = normalizeArray(concept?.mentionIds)
        .map((mentionId) => String(mentionId || "").trim())
        .filter(Boolean);
      const mentionCount = mentionIdsInConcept.filter((mentionId) =>
        normalizeArray(document?.mentions).some((mention) => String(mention?.id || "").trim() === mentionId)
      ).length;

      return {
        conceptId: String(concept?.id || "").trim(),
        label: getConceptLabel(concept),
        classUri: String(concept?.classUri || "").trim(),
        group: getGroupName(concept),
        mentionCount,
      };
    })
    .filter((row) => row.conceptId)
    .sort((leftRow, rightRow) => {
      if (rightRow.mentionCount !== leftRow.mentionCount) {
        return rightRow.mentionCount - leftRow.mentionCount;
      }

      return leftRow.label.localeCompare(rightRow.label, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function buildMentionRecords(document = {}, concepts = []) {
  const conceptsInDocument = getDocumentConcepts(document, concepts);
  const conceptByMentionId = new Map();

  conceptsInDocument.forEach((concept) => {
    normalizeArray(concept?.mentionIds)
      .map((mentionId) => String(mentionId || "").trim())
      .filter(Boolean)
      .forEach((mentionId) => {
        if (!conceptByMentionId.has(mentionId)) {
          conceptByMentionId.set(mentionId, concept);
        }
      });
  });

  return normalizeArray(document?.mentions)
    .map((mention) => {
      const mentionId = String(mention?.id || "").trim();
      if (!mentionId) {
        return null;
      }

      const concept = conceptByMentionId.get(mentionId) || {};
      const begin = Number(mention?.begin);
      const end = Number(mention?.end);
      const confidence = normalizeConfidence(
        mention?.confidence ?? concept?.confidence ?? mention?.score ?? 0
      );

      if (!Number.isFinite(begin) || !Number.isFinite(end)) {
        return null;
      }

      return {
        mentionId,
        begin,
        end,
        confidence,
        confidencePercent: Math.round(clamp(confidence, 0, 1) * 100),
        negated: Boolean(mention?.negated ?? concept?.negated),
        uncertain: Boolean(mention?.uncertain ?? concept?.uncertain),
        historic: Boolean(mention?.historic ?? concept?.historic),
        classUri: String(mention?.classUri || concept?.classUri || "").trim(),
        conceptId: String(concept?.id || "").trim(),
        conceptLabel: getConceptLabel(concept),
        group: getGroupName(concept),
      };
    })
    .filter(Boolean)
    .sort((leftRecord, rightRecord) => {
      if (leftRecord.begin !== rightRecord.begin) {
        return leftRecord.begin - rightRecord.begin;
      }

      const leftLength = leftRecord.end - leftRecord.begin;
      const rightLength = rightRecord.end - rightRecord.begin;
      if (rightLength !== leftLength) {
        return rightLength - leftLength;
      }

      return rightRecord.confidence - leftRecord.confidence;
    });
}

function toBucketIndex(confidence, bucketCount) {
  const safeBucketCount = Math.max(1, Number(bucketCount) || 10);
  const normalizedConfidence = clamp(normalizeConfidence(confidence), 0, 1);
  return Math.min(safeBucketCount - 1, Math.floor(normalizedConfidence * safeBucketCount));
}

export function buildConfidenceHistogram({
  mentionRecords = [],
  conceptRows = [],
  bucketCount = 10,
} = {}) {
  const safeBucketCount = Math.max(1, Number(bucketCount) || 10);
  const groupsInDocument = [
    ...new Set(
      normalizeArray(conceptRows)
        .map((row) => String(row?.group || "").trim())
        .filter(Boolean)
    ),
  ];

  const buckets = Array.from({ length: safeBucketCount }, (_, index) => {
    const binStart = index / safeBucketCount;
    const binEnd = (index + 1) / safeBucketCount;
    const bucketLabel = `${Math.round(binEnd * 100)}%`;
    const byMention = {};
    const byConcept = {};
    groupsInDocument.forEach((groupName) => {
      byMention[groupName] = 0;
      byConcept[groupName] = 0;
    });

    return {
      bucket: bucketLabel,
      binStart,
      binEnd,
      byMention,
      byConcept,
    };
  });

  const conceptGroupById = new Map(
    normalizeArray(conceptRows)
      .map((row) => [String(row?.conceptId || "").trim(), String(row?.group || "").trim()])
      .filter(([conceptId]) => Boolean(conceptId))
  );

  const highestConfidenceByConceptId = new Map();

  normalizeArray(mentionRecords).forEach((record) => {
    const groupName = String(record?.group || "").trim() || "Unknown";
    const bucketIndex = toBucketIndex(record?.confidence, safeBucketCount);
    if (!buckets[bucketIndex].byMention[groupName]) {
      buckets[bucketIndex].byMention[groupName] = 0;
    }
    buckets[bucketIndex].byMention[groupName] += 1;

    const conceptId = String(record?.conceptId || "").trim();
    if (!conceptId) {
      return;
    }

    const currentHighestConfidence = highestConfidenceByConceptId.get(conceptId);
    if (
      currentHighestConfidence === undefined ||
      normalizeConfidence(record?.confidence) > normalizeConfidence(currentHighestConfidence)
    ) {
      highestConfidenceByConceptId.set(conceptId, normalizeConfidence(record?.confidence));
      if (!conceptGroupById.has(conceptId)) {
        conceptGroupById.set(conceptId, groupName);
      }
    }
  });

  highestConfidenceByConceptId.forEach((highestConfidence, conceptId) => {
    const groupName = conceptGroupById.get(conceptId) || "Unknown";
    const bucketIndex = toBucketIndex(highestConfidence, safeBucketCount);
    if (!buckets[bucketIndex].byConcept[groupName]) {
      buckets[bucketIndex].byConcept[groupName] = 0;
    }
    buckets[bucketIndex].byConcept[groupName] += 1;
  });

  return buckets;
}

function filterMentionRecords(records = [], {
  minConfidence = 0,
  enabledGroups = new Set(),
  selectedConceptIds = new Set(),
} = {}) {
  const hasGroupFilter = enabledGroups instanceof Set && enabledGroups.size > 0;
  const hasConceptFilter = selectedConceptIds instanceof Set && selectedConceptIds.size > 0;

  return records.filter((record) => {
    if (record.confidence < minConfidence) {
      return false;
    }

    if (hasGroupFilter && !enabledGroups.has(record.group)) {
      return false;
    }

    if (hasConceptFilter && !selectedConceptIds.has(record.conceptId)) {
      return false;
    }

    return true;
  });
}

function toNonOverlappingMentions(records = []) {
  const nonOverlappingRecords = [];

  records.forEach((record) => {
    if (!Number.isFinite(record.begin) || !Number.isFinite(record.end) || record.end <= record.begin) {
      return;
    }

    const previousRecord = nonOverlappingRecords[nonOverlappingRecords.length - 1];
    if (!previousRecord || record.begin >= previousRecord.end) {
      nonOverlappingRecords.push(record);
      return;
    }

    const previousLength = previousRecord.end - previousRecord.begin;
    const nextLength = record.end - record.begin;

    const shouldReplacePreviousRecord =
      record.begin <= previousRecord.begin &&
      record.end >= previousRecord.end &&
      (record.confidence > previousRecord.confidence ||
        (Math.abs(record.confidence - previousRecord.confidence) < 0.001 && nextLength > previousLength));

    if (shouldReplacePreviousRecord) {
      nonOverlappingRecords[nonOverlappingRecords.length - 1] = record;
    }
  });

  return nonOverlappingRecords;
}

function buildTextSegments(documentText = "", mentions = []) {
  const safeText = typeof documentText === "string" ? documentText : "";
  const segments = [];
  let cursor = 0;

  mentions.forEach((mention) => {
    const begin = clamp(mention.begin, 0, safeText.length);
    const end = clamp(mention.end, 0, safeText.length);

    if (begin > cursor) {
      segments.push({
        type: "text",
        text: safeText.slice(cursor, begin),
      });
    }

    if (end > begin) {
      segments.push({
        type: "mention",
        text: safeText.slice(begin, end),
        mention,
      });
      cursor = end;
    }
  });

  if (cursor < safeText.length) {
    segments.push({
      type: "text",
      text: safeText.slice(cursor),
    });
  }

  if (segments.length === 0) {
    segments.push({
      type: "text",
      text: safeText,
    });
  }

  return segments;
}

export function buildMentionHighlightModel({
  document,
  concepts,
  minConfidence = 0,
  enabledGroups = [],
  selectedConceptIds = [],
} = {}) {
  const mentionRecords = buildMentionRecords(document, concepts);
  const enabledGroupSet = new Set(normalizeArray(enabledGroups));
  const selectedConceptIdSet = new Set(normalizeArray(selectedConceptIds));

  const visibleMentions = toNonOverlappingMentions(
    filterMentionRecords(mentionRecords, {
      minConfidence,
      enabledGroups: enabledGroupSet,
      selectedConceptIds: selectedConceptIdSet,
    })
  );

  const conceptsInDocument = getDocumentConcepts(document, concepts);

  return {
    conceptsInDocument,
    conceptRows: buildConceptRows(document, concepts),
    groupColorByName: buildGroupColorByName(conceptsInDocument),
    mentionRecords,
    visibleMentions,
    segments: buildTextSegments(document?.text || "", visibleMentions),
  };
}
