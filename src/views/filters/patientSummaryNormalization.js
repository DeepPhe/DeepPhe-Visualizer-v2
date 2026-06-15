import { normalizeClassName } from "../../utils/dataProcessing";
import { prettifyClassName } from "./filterDefinitions";

const CANCER_TYPE_MAP = { B: "Breast", M: "Melanoma", O: "Ovarian Cancer" };
const GENDER_MAP = { M: "Male", F: "Female", U: "Unknown" };

export function formatMs(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0.0";
  }
  return numericValue.toFixed(1);
}

export function formatItemCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }
  return numericValue.toLocaleString();
}

export function normalizeCountResponse(payload) {
  const rawCount = payload?.count;
  let count = Number(rawCount);
  if (!Number.isFinite(count) && typeof rawCount === "string") {
    const parsedValue = Number(String(rawCount).replace(/,/g, "").trim());
    if (Number.isFinite(parsedValue)) {
      count = parsedValue;
    }
  }
  const rawPatientIds = Array.isArray(payload?.patient_ids)
    ? payload.patient_ids
    : Array.isArray(payload?.patientIds)
    ? payload.patientIds
    : [];
  const patientIds = rawPatientIds.map((id) => String(id));
  const timing = {
    queryMs: Number(payload?.timing?.queryMs || 0),
    bitmapMs: Number(payload?.timing?.bitmapMs || 0),
    resolveMs: Number(payload?.timing?.resolveMs || 0),
    totalMs: Number(payload?.timing?.totalMs || 0),
    itemCounts: Array.isArray(payload?.timing?.itemCounts) ? payload.timing.itemCounts : [],
  };

  return {
    count: Number.isFinite(count) ? count : 0,
    patientIds,
    timing,
  };
}

export function normalizePatientIds(patientIds = []) {
  return [...new Set((Array.isArray(patientIds) ? patientIds : []).map((id) => String(id || "").trim()))]
    .filter(Boolean)
    .sort((leftId, rightId) => leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: "base" }));
}

function normalizeSummaryRecordForGrid(summary) {
  const parsedSummary =
    parsePatientSummaryJson(summary?.json_text ?? summary?.jsonText) ||
    parsePatientSummaryJson(summary?.summary_json ?? summary?.summaryJson) ||
    parsePatientSummaryJson(summary);

  if (!parsedSummary || typeof parsedSummary !== "object") {
    return null;
  }

  const demographics =
    parsedSummary?.demographics && typeof parsedSummary.demographics === "object"
      ? parsedSummary.demographics
      : parsedSummary?.demographic && typeof parsedSummary.demographic === "object"
      ? parsedSummary.demographic
      : summary?.demographics && typeof summary.demographics === "object"
      ? summary.demographics
      : summary?.demographic && typeof summary.demographic === "object"
      ? summary.demographic
      : {};

  const normalizeAttributeValue = (value) => {
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "string" || typeof value === "number") {
      return String(value).trim();
    }

    if (typeof value === "object") {
      const primitiveCandidate =
        value?.value ??
        value?.name ??
        value?.label ??
        value?.display ??
        value?.displayLabel ??
        value?.instance ??
        value?.instance_label;

      if (primitiveCandidate !== undefined && primitiveCandidate !== null && typeof primitiveCandidate !== "object") {
        return String(primitiveCandidate).trim();
      }
    }

    return "";
  };

  const collectAttributeValues = (rawValue, accumulator) => {
    if (rawValue === undefined || rawValue === null) {
      return;
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach((item) => collectAttributeValues(item, accumulator));
      return;
    }

    if (typeof rawValue === "object") {
      const nestedLists = [rawValue?.instances, rawValue?.values, rawValue?.items, rawValue?.data];
      nestedLists.forEach((list) => {
        if (Array.isArray(list)) {
          list.forEach((item) => collectAttributeValues(item, accumulator));
        }
      });

      const normalizedValue = normalizeAttributeValue(rawValue);
      if (normalizedValue) {
        accumulator.push(normalizedValue);
      }
      return;
    }

    const normalizedValue = normalizeAttributeValue(rawValue);
    if (normalizedValue) {
      accumulator.push(normalizedValue);
    }
  };

  const pushAttributeValues = (targetMap, rawClassName, rawValue) => {
    const classKey = normalizeClassName(rawClassName);
    if (!classKey) {
      return;
    }

    const nextValues = [];
    collectAttributeValues(rawValue, nextValues);
    if (nextValues.length === 0) {
      return;
    }

    const existingValues = Array.isArray(targetMap[classKey]) ? targetMap[classKey] : [];
    targetMap[classKey] = [...new Set([...existingValues, ...nextValues])];
  };

  const attributeValuesByClass = {};
  const attributeMapSources = [
    parsedSummary?.attributesByClass,
    parsedSummary?.attributes_by_class,
    parsedSummary?.attributeValuesByClass,
    parsedSummary?.attribute_values_by_class,
    parsedSummary?.instancesByClass,
    parsedSummary?.instances_by_class,
    summary?.attributesByClass,
    summary?.attributes_by_class,
    summary?.attributeValuesByClass,
    summary?.attribute_values_by_class,
    summary?.instancesByClass,
    summary?.instances_by_class,
  ];

  attributeMapSources.forEach((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return;
    }

    Object.entries(source).forEach(([className, values]) => {
      pushAttributeValues(attributeValuesByClass, className, values);
    });
  });

  const attributeListSources = [
    parsedSummary?.attributes,
    parsedSummary?.attribute_values,
    parsedSummary?.attributeValues,
    summary?.attributes,
    summary?.attribute_values,
    summary?.attributeValues,
  ];

  attributeListSources.forEach((source) => {
    if (!Array.isArray(source)) {
      return;
    }

    source.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      const className =
        item?.class ??
        item?.className ??
        item?.groupname ??
        item?.group_name ??
        item?.attributeClass ??
        item?.attribute_class;

      if (!className) {
        return;
      }

      const values =
        item?.instances ??
        item?.values ??
        item?.items ??
        item?.value ??
        item?.label ??
        item?.display ??
        item?.displayLabel ??
        item?.instance;

      pushAttributeValues(attributeValuesByClass, className, values);
    });
  });

  return {
    ...parsedSummary,
    patient_id: String(
      parsedSummary?.patient_id ?? parsedSummary?.patientId ?? summary?.patient_id ?? summary?.patientId ?? ""
    ).trim(),
    demographics,
    diagnoses: Array.isArray(parsedSummary?.diagnoses) ? parsedSummary.diagnoses : [],
    staging: Array.isArray(parsedSummary?.staging) ? parsedSummary.staging : [],
    grading: Array.isArray(parsedSummary?.grading) ? parsedSummary.grading : [],
    biomarkers: Array.isArray(parsedSummary?.biomarkers) ? parsedSummary.biomarkers : [],
    procedures: Array.isArray(parsedSummary?.procedures) ? parsedSummary.procedures : [],
    treatments: Array.isArray(parsedSummary?.treatments) ? parsedSummary.treatments : [],
    findings: Array.isArray(parsedSummary?.findings) ? parsedSummary.findings : [],
    behavior: Array.isArray(parsedSummary?.behavior) ? parsedSummary.behavior : [],
    attributeValuesByClass,
  };
}

export function transformSummaryToGridRow(summary) {
  const normalizedSummary = normalizeSummaryRecordForGrid(summary);
  const demographics = normalizedSummary?.demographics || {};
  const staging = Array.isArray(normalizedSummary?.staging) ? normalizedSummary.staging : [];
  const gradingFromNlp = (Array.isArray(normalizedSummary?.grading) ? normalizedSummary.grading : [])[0];
  const normalizeGradeLabel = (value) =>
    String(value || "")
      .replace(/^grade[_\s]*(numeric)?\s*/i, "")
      .trim();
  const getFirstNonEmptyGrade = (rawValues) => {
    const values = Array.isArray(rawValues) ? rawValues : [rawValues];
    for (const value of values) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        const nestedValue = getFirstNonEmptyGrade(value);
        if (nestedValue) {
          return nestedValue;
        }
        continue;
      }
      if (typeof value === "object") {
        const nestedObjectValue = getFirstNonEmptyGrade([
          value?.name,
          value?.value,
          value?.label,
          value?.display,
          value?.displayLabel,
        ]);
        if (nestedObjectValue) {
          return nestedObjectValue;
        }
        continue;
      }

      const normalizedValue = normalizeGradeLabel(value);
      if (normalizedValue) {
        return normalizedValue;
      }
    }
    return "";
  };
  const gradingFromAttributes = getFirstNonEmptyGrade([
    normalizedSummary?.attributeValuesByClass?.GRADE_NUMERIC,
    normalizedSummary?.GRADE_NUMERIC,
    normalizedSummary?.grade_numeric,
    normalizedSummary?.gradeNumeric,
    summary?.GRADE_NUMERIC,
    summary?.grade_numeric,
    summary?.gradeNumeric,
  ]);
  const grading = getFirstNonEmptyGrade([gradingFromNlp?.name, gradingFromNlp?.value, gradingFromAttributes]) || "—";
  const diagnoses = Array.isArray(normalizedSummary?.diagnoses) ? normalizedSummary.diagnoses : [];
  const STAGE_GROUP_RANK = {
    0: 0,
    IA: 1,
    IB: 2,
    IC: 3,
    IIA: 4,
    IIB: 5,
    IIC: 6,
    IIIA: 7,
    IIIB: 8,
    IIIC: 9,
    IIID: 10,
    IV: 11,
    IVA: 12,
    IVB: 13,
    IVC: 14,
  };
  const CANCER_KEYWORDS =
    /carcinoma|melanoma|neoplasm|lymphoma|leukemia|sarcoma|tumou?r|cancer|adenocarcinoma|myeloma|mesothelioma|glioma|blastoma|dcis|in\ssitu/i;

  const normalizeStageName = (value) => String(value || "").trim();
  const getStageNames = (rows) =>
    (Array.isArray(rows) ? rows : []).map((entry) => normalizeStageName(entry?.name ?? entry?.value)).filter(Boolean);
  const getTnmScore = (value, prefix) => {
    const normalized = normalizeStageName(value).replace(/\s+/g, "");
    const upperPrefix = String(prefix || "").toUpperCase();
    if (!normalized.toUpperCase().startsWith(upperPrefix)) {
      return Number.NEGATIVE_INFINITY;
    }

    const remainder = normalized.slice(upperPrefix.length);
    if (!remainder) {
      return -1;
    }

    if (/^X/i.test(remainder)) {
      return -1;
    }
    if (/^is/i.test(remainder)) {
      return 0.2;
    }
    if (/^mi/i.test(remainder)) {
      return 0.3;
    }

    const numberMatch = remainder.match(/^(\d+)/);
    const base = numberMatch ? Number.parseInt(numberMatch[1], 10) : 0;
    const suffix = numberMatch ? remainder.slice(numberMatch[1].length) : remainder;
    const letter = suffix.match(/^([A-D])/i)?.[1]?.toUpperCase();
    const letterBoost = letter ? (letter.charCodeAt(0) - 64) / 10 : 0;

    return base + letterBoost;
  };
  const pickHighestByScore = (names, prefix) => {
    let bestName = "";
    let bestScore = Number.NEGATIVE_INFINITY;

    names.forEach((name) => {
      const score = getTnmScore(name, prefix);
      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      }
    });

    return { name: bestName, score: bestScore };
  };
  const pickDisplayStage = (rows) => {
    const names = getStageNames(rows);
    if (names.length === 0) {
      return { label: "—", rank: Number.NEGATIVE_INFINITY };
    }

    const overallGroups = names.filter((name) => /^Stage\s+/i.test(name));
    if (overallGroups.length > 0) {
      const bestGroup = overallGroups.reduce((best, current) => {
        const bestKey = best.replace(/^Stage\s+/i, "").toUpperCase();
        const currentKey = current.replace(/^Stage\s+/i, "").toUpperCase();
        const bestRank = STAGE_GROUP_RANK[bestKey] ?? -1;
        const currentRank = STAGE_GROUP_RANK[currentKey] ?? -1;
        return currentRank > bestRank ? current : best;
      });
      const bestKey = bestGroup.replace(/^Stage\s+/i, "").toUpperCase();

      return {
        label: bestGroup,
        rank: 1000 + (STAGE_GROUP_RANK[bestKey] ?? -1),
      };
    }

    const pathologicT = pickHighestByScore(
      names.filter((name) => /^pT/i.test(name)),
      "pT"
    );
    if (pathologicT.name) {
      return { label: pathologicT.name, rank: 800 + pathologicT.score };
    }

    const clinicalT = pickHighestByScore(
      names.filter((name) => /^T\d/i.test(name) && !/^pT/i.test(name)),
      "T"
    );
    if (clinicalT.name) {
      return { label: clinicalT.name, rank: 700 + clinicalT.score };
    }

    const nStage = pickHighestByScore(
      names.filter((name) => /^N/i.test(name)),
      "N"
    );
    if (nStage.name) {
      return { label: nStage.name, rank: 600 + nStage.score };
    }

    const mStage = pickHighestByScore(
      names.filter((name) => /^M/i.test(name)),
      "M"
    );
    if (mStage.name) {
      return { label: mStage.name, rank: 500 + mStage.score };
    }

    return { label: names[0], rank: 0 };
  };
  const pickActiveDx = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    const nonNegated = items.filter((item) => !item?.negated);
    if (nonNegated.length === 0) {
      return null;
    }

    const tier1 = nonNegated.find(
      (item) =>
        !item?.historic &&
        (String(item?.source || "").toLowerCase() === "cancer" || String(item?.source || "").toLowerCase() === "tumor")
    );
    if (tier1) {
      return tier1;
    }

    const tier2 = nonNegated.find((item) => !item?.historic && CANCER_KEYWORDS.test(String(item?.name || "")));
    if (tier2) {
      return tier2;
    }

    const tier3 = nonNegated.find((item) => ["cancer", "tumor"].includes(String(item?.source || "").toLowerCase()));
    if (tier3) {
      return tier3;
    }

    const tier4 = nonNegated.find((item) => CANCER_KEYWORDS.test(String(item?.name || "")));
    if (tier4) {
      return tier4;
    }

    return nonNegated[0] || null;
  };
  const stageSelection = pickDisplayStage(staging);
  const activeDxEntry = pickActiveDx(diagnoses);
  const activeDxName = String(activeDxEntry?.name || "").trim() || "—";
  const activeDxHistoric = Boolean(activeDxEntry?.historic);
  const activeDxUncertain = Boolean(activeDxEntry?.uncertain);
  const activeDxDisplayText =
    activeDxName === "—"
      ? "—"
      : `${activeDxName}${activeDxHistoric ? " (historic)" : ""}${activeDxUncertain ? " (uncertain)" : ""}`;
  const rawAge = demographics?.age_at_dx;
  const parsedAge = rawAge != null && rawAge !== "" && String(rawAge) !== "0" ? Number(rawAge) : null;
  const ageAtDx = parsedAge != null && Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : null;

  const normalizeCancerType = (value) => {
    const rawCancerType = String(value || "").trim();
    if (!rawCancerType) {
      return "";
    }

    const normalizedCode = rawCancerType.toUpperCase();
    return CANCER_TYPE_MAP[normalizedCode] || rawCancerType;
  };

  const inferCancerTypeFromDiagnoses = (items) => {
    const diagnosisNames = (Array.isArray(items) ? items : [])
      .map((item) =>
        String(item?.name || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);

    if (diagnosisNames.some((name) => name.includes("melanoma"))) {
      return "Melanoma";
    }
    if (diagnosisNames.some((name) => name.includes("ovar"))) {
      return "Ovarian Cancer";
    }
    if (diagnosisNames.some((name) => name.includes("breast"))) {
      return "Breast";
    }

    return "";
  };

  const resolvedCancerType =
    normalizeCancerType(
      demographics?.cancer_type ??
        demographics?.cancerType ??
        demographics?.cancer ??
        normalizedSummary?.cancer_type ??
        normalizedSummary?.cancerType ??
        normalizedSummary?.cancer
    ) || inferCancerTypeFromDiagnoses(diagnoses);

  const summarizeArray = (items, cap = 3, excludeItem = null) => {
    if (!Array.isArray(items)) {
      return { display: "—", full: "" };
    }

    const nonNegatedNames = items
      .filter((item) => !item?.negated)
      .filter((item) => (excludeItem ? item !== excludeItem : true))
      .map((item) => String(item?.name || "").trim())
      .filter(Boolean);

    if (nonNegatedNames.length === 0) {
      return { display: "—", full: "" };
    }

    const full = nonNegatedNames.join(", ");
    if (nonNegatedNames.length <= cap) {
      return { display: full, full };
    }

    return {
      display: nonNegatedNames.slice(0, cap).join(", "),
      overflow: nonNegatedNames.length - cap,
      full,
    };
  };

  return {
    patientId: String(
      normalizedSummary?.patient_id ?? normalizedSummary?.patientId ?? summary?.patient_id ?? summary?.patientId ?? ""
    ).trim(),
    ageAtDx,
    gender: GENDER_MAP[demographics?.gender] || demographics?.gender || "Unknown",
    race: demographics?.race || "Unknown",
    ethnicity: demographics?.ethnicity || "Unknown",
    cancerType: resolvedCancerType || "—",
    stage: stageSelection.label || "—",
    stageSortRank: stageSelection.rank,
    grade: String(grading || "—"),
    activeDx: activeDxDisplayText,
    activeDxMeta: {
      name: activeDxName,
      historic: activeDxHistoric,
      uncertain: activeDxUncertain,
    },
    diagnosesSummary: summarizeArray(normalizedSummary?.diagnoses, 3, activeDxEntry),
    biomarkersSummary: summarizeArray(normalizedSummary?.biomarkers, 3),
    treatmentsSummary: summarizeArray(normalizedSummary?.treatments, 2),
    proceduresSummary: summarizeArray(normalizedSummary?.procedures, 2),
    findingsSummary: summarizeArray(normalizedSummary?.findings, 2),
    _raw: normalizedSummary || summary,
  };
}

function createEmptyPatientSummary(patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  return {
    patientId: normalizedPatientId,
    docCount: 0,
    activeDx: [],
    negatedDx: [],
    staging: [],
    biomarkers: [],
    procedures: [],
    treatments: [],
    activeFindings: [],
    negatedFindings: [],
  };
}

function normalizePatientSummaryRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.summaries)) {
    return payload.summaries;
  }

  return [];
}

function parsePatientSummaryJson(value) {
  let nextValue = value;

  for (let parsePass = 0; parsePass < 3; parsePass += 1) {
    if (!nextValue) {
      return null;
    }

    if (typeof nextValue === "object") {
      return nextValue;
    }

    if (typeof nextValue === "string") {
      const trimmedValue = nextValue.trim();
      if (!trimmedValue) {
        return null;
      }

      try {
        nextValue = JSON.parse(trimmedValue);
        continue;
      } catch {
        return null;
      }
    }

    return null;
  }

  return typeof nextValue === "object" && nextValue ? nextValue : null;
}

function normalizeSummaryList(items, { includeUncertain = false } = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = String(item?.name ?? item?.label ?? item?.value ?? "").trim();
      if (!name) {
        return null;
      }

      const docFreq = Number(item?.docFreq ?? item?.doc_freq);
      const summaryItem = { name };
      if (includeUncertain) {
        summaryItem.uncertain = Boolean(item?.uncertain);
      }
      if (Number.isFinite(docFreq) && docFreq > 0) {
        summaryItem.docFreq = docFreq;
      }
      return summaryItem;
    })
    .filter(Boolean);
}

export function buildPatientSummaryFromFilterSummary(payload, patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  const summaryRows = normalizePatientSummaryRows(payload);
  const matchingRow =
    summaryRows.find((row) => {
      const rowPatientId = String(row?.patient_id ?? row?.patientId ?? "").trim();
      return rowPatientId && rowPatientId === normalizedPatientId;
    }) || summaryRows[0];

  if (!matchingRow) {
    return createEmptyPatientSummary(normalizedPatientId);
  }

  const summaryPayload =
    parsePatientSummaryJson(matchingRow?.json_text ?? matchingRow?.jsonText) || parsePatientSummaryJson(matchingRow);

  if (!summaryPayload || typeof summaryPayload !== "object") {
    return createEmptyPatientSummary(normalizedPatientId);
  }

  const summaryPatientId = String(
    summaryPayload?.patient_id ??
      summaryPayload?.patientId ??
      matchingRow?.patient_id ??
      matchingRow?.patientId ??
      normalizedPatientId
  ).trim();

  const diagnosisItems = Array.isArray(summaryPayload?.diagnoses) ? summaryPayload.diagnoses : [];
  const findingItems = Array.isArray(summaryPayload?.findings) ? summaryPayload.findings : [];
  const docCountField = Number(
    summaryPayload?.doc_count ??
      summaryPayload?.docCount ??
      summaryPayload?.document_count ??
      summaryPayload?.documentCount ??
      summaryPayload?.note_count ??
      summaryPayload?.noteCount
  );
  const docCountArrayFallback =
    (Array.isArray(summaryPayload?.documents) && summaryPayload.documents.length) ||
    (Array.isArray(summaryPayload?.docs) && summaryPayload.docs.length) ||
    (Array.isArray(summaryPayload?.notes) && summaryPayload.notes.length) ||
    (Array.isArray(summaryPayload?.note_ids) && summaryPayload.note_ids.length) ||
    (Array.isArray(summaryPayload?.noteIds) && summaryPayload.noteIds.length) ||
    (Array.isArray(summaryPayload?.document_ids) && summaryPayload.document_ids.length) ||
    (Array.isArray(summaryPayload?.documentIds) && summaryPayload.documentIds.length) ||
    0;

  return {
    patientId: summaryPatientId || normalizedPatientId,
    docCount: Number.isFinite(docCountField) && docCountField > 0 ? docCountField : docCountArrayFallback,
    activeDx: normalizeSummaryList(
      diagnosisItems.filter((item) => !Boolean(item?.negated)),
      { includeUncertain: true }
    ),
    negatedDx: normalizeSummaryList(diagnosisItems.filter((item) => Boolean(item?.negated))),
    staging: normalizeSummaryList(summaryPayload?.staging),
    biomarkers: normalizeSummaryList(summaryPayload?.biomarkers),
    procedures: normalizeSummaryList(summaryPayload?.procedures),
    treatments: normalizeSummaryList(summaryPayload?.treatments),
    activeFindings: normalizeSummaryList(findingItems.filter((item) => !Boolean(item?.negated))),
    negatedFindings: normalizeSummaryList(findingItems.filter((item) => Boolean(item?.negated))),
  };
}

export function resolveDocumentCountFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (Array.isArray(payload?.documents)) {
    return payload.documents.length;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data.length;
  }

  const numericCount = Number(payload?.count);
  if (Number.isFinite(numericCount) && numericCount >= 0) {
    return numericCount;
  }

  return 0;
}

export function getZeroResultHint(filters, itemCounts) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return "";
  }

  if (Array.isArray(itemCounts)) {
    const firstZeroMatchIndex = itemCounts.findIndex((value) => Number(value) === 0);
    if (firstZeroMatchIndex >= 0 && firstZeroMatchIndex < filters.length) {
      const filter = filters[firstZeroMatchIndex];
      return `${prettifyClassName(
        filter.class,
        filter.type
      )} matched 0 patients before intersection. Check spelling and selected values.`;
    }
  }

  return "Each filter matches patients independently, but their overlap is 0. Try broadening one filter.";
}
