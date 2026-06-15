import { normalizeClassName } from "../../utils/dataProcessing";
import { prettifyClassName, toDisplayInstanceValue } from "./filterDefinitions";

export function formatSelectionText(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "None";
  }
  return values.join(", ");
}

function joinWithConjunction(values, conjunction = "or") {
  const normalized = Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : [];

  if (normalized.length === 0) {
    return "";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  if (normalized.length === 2) {
    return `${normalized[0]} ${conjunction} ${normalized[1]}`;
  }

  return `${normalized.slice(0, -1).join(", ")}, ${conjunction} ${normalized[normalized.length - 1]}`;
}

function toNarrativeLabel(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^[A-Z0-9+\-−/]+$/.test(text) && text.length <= 6) {
    return text;
  }

  return text.toLowerCase();
}

function joinCohortConditions(conditions) {
  const normalized = Array.isArray(conditions)
    ? conditions.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (normalized.length === 0) {
    return "";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  if (normalized.length === 2) {
    return `${normalized[0]}, and ${normalized[1]}`;
  }

  return `${normalized.slice(0, -1).join(", ")}, and ${normalized[normalized.length - 1]}`;
}

function getDisplayInstances(filter) {
  if (!filter || !Array.isArray(filter.instances)) {
    return [];
  }

  return filter.instances
    .map((value) => toDisplayInstanceValue(filter.type, filter.class, value))
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function formatCancerValue(value) {
  const rawLabel = String(value || "").trim();
  if (!rawLabel) {
    return "";
  }
  if (/cancer/i.test(rawLabel)) {
    return rawLabel;
  }
  return `${rawLabel} cancer`;
}

function formatAgeValues(values) {
  const normalizedValues = Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (normalizedValues.length === 0) {
    return "";
  }

  const uniqueValues = [...new Set(normalizedValues)];
  const allWholeNumbers = uniqueValues.every((value) => /^\d+$/.test(value));
  if (allWholeNumbers) {
    const numbers = uniqueValues
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value))
      .sort((leftValue, rightValue) => leftValue - rightValue);

    const ranges = [];
    let rangeStart = numbers[0];
    let rangeEnd = numbers[0];

    for (let index = 1; index < numbers.length; index += 1) {
      const value = numbers[index];
      if (value === rangeEnd + 1) {
        rangeEnd = value;
      } else {
        ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
        rangeStart = value;
        rangeEnd = value;
      }
    }
    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

    return joinWithConjunction(ranges, "or");
  }

  const allAgeRanges = uniqueValues.every((value) => /^\d+\s*-\s*\d+$/.test(value));
  if (allAgeRanges) {
    return joinWithConjunction(uniqueValues, "or");
  }

  return joinWithConjunction(uniqueValues, "or");
}

export function buildIdentifiedSummary(filters, count) {
  const normalizedFilters = Array.isArray(filters) ? filters : [];
  const numericCount = Number(count);

  if (normalizedFilters.length === 0 || !Number.isFinite(numericCount)) {
    return "";
  }

  const safeCount = Math.max(0, Math.round(numericCount));
  if (safeCount === 0) {
    return "No patients matched these criteria.";
  }

  const omopFiltersByClass = {};
  const attributeFiltersByClass = {};

  normalizedFilters.forEach((filter) => {
    const filterType = String(filter?.type || "").toLowerCase();
    const classKey = normalizeClassName(filter?.class);
    if (!classKey) {
      return;
    }
    if (filterType === "omop") {
      omopFiltersByClass[classKey] = filter;
      return;
    }
    if (filterType === "attributes") {
      attributeFiltersByClass[classKey] = filter;
    }
  });

  const ageValues = getDisplayInstances(omopFiltersByClass.AGE_AT_DX);
  const raceValues = getDisplayInstances(omopFiltersByClass.RACE).map((value) => toNarrativeLabel(value));
  const ethnicityValues = getDisplayInstances(omopFiltersByClass.ETHNICITY).map((value) => toNarrativeLabel(value));
  const genderValues = getDisplayInstances(omopFiltersByClass.GENDER).map((value) => toNarrativeLabel(value));
  const cancerValues = getDisplayInstances(omopFiltersByClass.CANCER).map((value) => formatCancerValue(value));

  const subjectDescriptors = [];
  const conditionClauses = [];

  const ageText = formatAgeValues(ageValues);
  if (ageText) {
    subjectDescriptors.push(`${ageText} year old`);
  }

  const raceText = joinWithConjunction(raceValues, "or");
  if (raceText) {
    subjectDescriptors.push(raceText);
  }

  const genderText = joinWithConjunction(genderValues, "or");
  if (genderText) {
    subjectDescriptors.push(genderText);
  }

  const ethnicityText = joinWithConjunction(ethnicityValues, "or");
  if (ethnicityText) {
    conditionClauses.push(`ethnicity ${ethnicityText}`);
  }

  const cancerText = joinWithConjunction(
    cancerValues.map((value) => toNarrativeLabel(value)),
    "or"
  );
  if (cancerText) {
    conditionClauses.push(cancerText);
  }

  const behaviorValues = getDisplayInstances(attributeFiltersByClass.BEHAVIOR).map((value) => toNarrativeLabel(value));
  if (behaviorValues.length > 0) {
    conditionClauses.push(`${joinWithConjunction(behaviorValues, "or")} neoplasm behavior`);
  }

  const gradeValues = getDisplayInstances(attributeFiltersByClass.GRADE_NUMERIC).map((value) =>
    toNarrativeLabel(
      String(value || "")
        .replace(/^grade[_\s]*(numeric)?\s*/i, "")
        .trim()
    )
  );
  if (gradeValues.length > 0) {
    conditionClauses.push(`grade ${joinWithConjunction(gradeValues, "or")}`);
  }

  const tStageValues = getDisplayInstances(attributeFiltersByClass["T STAGE"]);
  if (tStageValues.length > 0) {
    conditionClauses.push(`T stage ${joinWithConjunction(tStageValues, "or")}`);
  }

  const nStageValues = getDisplayInstances(attributeFiltersByClass["N STAGE"]);
  if (nStageValues.length > 0) {
    conditionClauses.push(`N stage ${joinWithConjunction(nStageValues, "or")}`);
  }

  const mStageValues = getDisplayInstances(attributeFiltersByClass["M STAGE"]);
  if (mStageValues.length > 0) {
    conditionClauses.push(`M stage ${joinWithConjunction(mStageValues, "or")}`);
  }

  const handledAttributeClasses = new Set(["BEHAVIOR", "GRADE_NUMERIC", "T STAGE", "N STAGE", "M STAGE"]);
  normalizedFilters
    .filter((filter) => String(filter?.type || "").toLowerCase() === "attributes")
    .forEach((filter) => {
      const classKey = normalizeClassName(filter.class);
      if (!classKey || handledAttributeClasses.has(classKey)) {
        return;
      }

      const values = getDisplayInstances(filter).map((value) => toNarrativeLabel(value));
      if (values.length === 0) {
        return;
      }

      const classLabel = prettifyClassName(filter.class, "attributes").toLowerCase();
      conditionClauses.push(`${classLabel} ${joinWithConjunction(values, "or")}`);
    });

  const subjectText = subjectDescriptors.length > 0 ? subjectDescriptors.join(" ") : "patients";
  const conditionsText = joinCohortConditions(conditionClauses);

  if (conditionsText) {
    return `${safeCount.toLocaleString()} ${subjectText} with ${conditionsText}.`;
  }

  return `${safeCount.toLocaleString()} ${subjectText} matched the selected filters.`;
}
