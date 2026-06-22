import { parsePatientIds } from "../utils/patientIds";

const CLASS_NAME_TOKEN_PATTERN = /[^A-Z0-9]+/g;
const STAGE_SUFFIX_PATTERN = /(StageFinding|StageFind)$/i;

const rollupRulesByClassKey = new Map();

function normalizeClassKey(className) {
  return String(className || "")
    .trim()
    .toUpperCase()
    .replace(CLASS_NAME_TOKEN_PATTERN, "");
}

function normalizeLabel(value) {
  return String(value || "").trim();
}

function stripStageSuffix(value) {
  return normalizeLabel(value).replace(STAGE_SUFFIX_PATTERN, "");
}

function defaultStringCompare(leftValue, rightValue) {
  return String(leftValue || "").localeCompare(String(rightValue || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function padRank(value, digits = 3) {
  return String(Math.max(0, Number(value) || 0)).padStart(digits, "0");
}

function toSafeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
}

function normalizeChartRow(row) {
  const label = normalizeLabel(row?.label);
  if (!label) {
    return null;
  }

  const displayLabel = normalizeLabel(row?.displayLabel) || label;
  const patientIds = parsePatientIds(
    row?.patientIds ?? row?.patient_ids ?? row?.patientId ?? row?.patient_id
  );

  return {
    ...row,
    label,
    displayLabel,
    value: toSafeNumber(row?.value),
    patientIds,
  };
}

function getRuleSet(className) {
  return rollupRulesByClassKey.get(normalizeClassKey(className)) || null;
}

function toParsedResult(parsed, rawLabel) {
  if (!parsed || !parsed.parent) {
    return null;
  }

  const raw = normalizeLabel(parsed.raw || rawLabel);
  const parent = normalizeLabel(parsed.parent);

  if (!raw || !parent) {
    return null;
  }

  return {
    axis: parsed.axis || "",
    prefix: normalizeLabel(parsed.prefix || "").toLowerCase(),
    parent,
    child: parsed.child === undefined || parsed.child === null ? null : String(parsed.child),
    normalized: normalizeLabel(parsed.normalized || parent),
    raw,
    childType: normalizeLabel(parsed.childType || ""),
    childSortToken: normalizeLabel(parsed.childSortToken || parsed.child || "").toLowerCase(),
  };
}

function safeParse(ruleSet, rawLabel) {
  if (!ruleSet || typeof ruleSet.parse !== "function") {
    return null;
  }

  const parsed = ruleSet.parse(rawLabel);
  return toParsedResult(parsed, rawLabel);
}

function safeParseWithDisplayFallback(ruleSet, rawLabel, displayLabel) {
  const fromRaw = safeParse(ruleSet, rawLabel);
  if (fromRaw) {
    return fromRaw;
  }

  const normalizedDisplay = normalizeLabel(displayLabel);
  if (!normalizedDisplay || normalizedDisplay === normalizeLabel(rawLabel)) {
    return null;
  }

  return safeParse(ruleSet, normalizedDisplay);
}

function compareParsed(ruleSet, leftParsed, rightParsed, leftFallback, rightFallback) {
  const leftSortKey =
    leftParsed && typeof ruleSet.sortKey === "function"
      ? String(ruleSet.sortKey(leftParsed) || "")
      : "";
  const rightSortKey =
    rightParsed && typeof ruleSet.sortKey === "function"
      ? String(ruleSet.sortKey(rightParsed) || "")
      : "";

  if (leftSortKey && rightSortKey && leftSortKey !== rightSortKey) {
    return defaultStringCompare(leftSortKey, rightSortKey);
  }

  return defaultStringCompare(leftFallback, rightFallback);
}

const STAGE_PARENT_ORDER = {
  T: ["TX", "Tis", "T0", "T1", "T2", "T3", "T4"],
  N: ["NX", "N0", "N1", "N2", "N3"],
  M: ["MX", "M0", "M1"],
};

const STAGE_PREFIX_ORDER = ["", "a", "c", "p", "rc", "rp", "yc", "yp"];

function normalizeStageChildToken(rawToken) {
  const collapsed = String(rawToken || "").replace(/[\s_]+/g, "").trim();
  if (!collapsed) {
    return {
      child: null,
      childType: "nos",
      childSortToken: "",
    };
  }

  const lower = collapsed.toLowerCase();

  if (lower.startsWith("mi")) {
    return {
      child: "mi",
      childType: "mi",
      childSortToken: "mi",
    };
  }

  if (lower === "i+" || lower === "(i+)") {
    return {
      child: "(i+)",
      childType: "annotated",
      childSortToken: "i+",
    };
  }

  if (lower === "mol+" || lower === "(mol+)") {
    return {
      child: "(mol+)",
      childType: "annotated",
      childSortToken: "mol+",
    };
  }

  if (/^[a-d]$/.test(lower)) {
    return {
      child: lower,
      childType: "letter",
      childSortToken: lower,
    };
  }

  return {
    child: lower,
    childType: "other",
    childSortToken: lower,
  };
}

function getStageParentRank(axis, parent) {
  const axisOrder = STAGE_PARENT_ORDER[axis] || [];
  const knownIndex = axisOrder.indexOf(parent);
  if (knownIndex >= 0) {
    return knownIndex;
  }

  const stageToken = String(parent || "").slice(1);
  if (/^\d+$/.test(stageToken)) {
    return axisOrder.length + Number.parseInt(stageToken, 10);
  }

  return axisOrder.length + 99;
}

function getStageChildRank(parsed) {
  const childType = String(parsed?.childType || "");
  const childToken = String(parsed?.childSortToken || "");

  if (!parsed?.child || childType === "nos") {
    return 0;
  }
  if (childType === "mi") {
    return 1;
  }
  if (childType === "letter") {
    return 10 + Math.max(0, childToken.charCodeAt(0) - 97);
  }
  if (childType === "annotated") {
    return 30;
  }
  return 50;
}

function getStagePrefixRank(prefix) {
  const index = STAGE_PREFIX_ORDER.indexOf(prefix || "");
  return index >= 0 ? index : STAGE_PREFIX_ORDER.length + 10;
}

function createStageRuleSet(axis) {
  const normalizedAxis = String(axis || "").trim().toUpperCase();
  const stagePattern = new RegExp(
    "^(yp|yc|rp|rc|p|c|a)?(" + normalizedAxis + ")(is|x|\\d+)(.*)$",
    "i"
  );

  return {
    parse(rawLabel) {
      const raw = normalizeLabel(rawLabel);
      if (!raw) {
        return null;
      }

      const withoutSuffix = stripStageSuffix(raw);
      const collapsed = withoutSuffix.replace(/[\s_]+/g, "");
      const match = collapsed.match(stagePattern);
      if (!match) {
        return null;
      }

      const [, prefixToken = "", axisToken = "", stageToken = "", childToken = ""] = match;
      const axisValue = String(axisToken || "").toUpperCase();
      const prefix = String(prefixToken || "").toLowerCase();
      const stageValue =
        /^is$/i.test(stageToken) ? "is" : /^x$/i.test(stageToken) ? "X" : String(stageToken || "");
      const parent = `${axisValue}${stageValue}`;
      const childMeta = normalizeStageChildToken(childToken);

      return {
        axis: axisValue,
        prefix,
        parent,
        child: childMeta.child,
        childType: childMeta.childType,
        childSortToken: childMeta.childSortToken,
        normalized: `${prefix}${parent}${childMeta.childSortToken}`,
        raw,
      };
    },
    sortKey(parsed) {
      const parentRank = getStageParentRank(normalizedAxis, parsed.parent);
      const childRank = getStageChildRank(parsed);
      const prefixRank = getStagePrefixRank(parsed.prefix);
      const childToken = parsed.childSortToken || "";

      return [
        padRank(parentRank, 3),
        padRank(childRank, 3),
        padRank(prefixRank, 2),
        childToken,
        String(parsed.raw || "").toLowerCase(),
      ].join(":");
    },
    displayLabel(parsed) {
      if (!parsed) {
        return "";
      }

      if (parsed.childType === "other") {
        return parsed.raw;
      }

      const prefix = parsed.prefix || "";
      if (!parsed.child) {
        return `${prefix}${parsed.parent}`;
      }

      return `${prefix}${parsed.parent}${parsed.child}`;
    },
    parentDisplayLabel(parentKey) {
      return normalizeLabel(parentKey);
    },
  };
}

const STAGE_ORDER = ["0", "I", "II", "III", "IV", "V"];

function getOverallStageParentRank(parent) {
  const compactParent = String(parent || "")
    .replace(/^stage\s*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();

  if (compactParent === "IS") {
    return 1;
  }

  const knownIndex = STAGE_ORDER.indexOf(compactParent);
  if (knownIndex >= 0) {
    return knownIndex;
  }

  const romanMatch = compactParent.match(/^[IVX]+$/i);
  if (romanMatch) {
    return STAGE_ORDER.length + compactParent.length;
  }

  const numericMatch = compactParent.match(/^\d+$/);
  if (numericMatch) {
    return STAGE_ORDER.length + Number.parseInt(compactParent, 10);
  }

  return STAGE_ORDER.length + 99;
}

function normalizeOverallStageToken(rawLabel) {
  return normalizeLabel(rawLabel)
    .replace(/^stage[\s_-]*/i, "")
    .replace(/[\s_-]+/g, "")
    .trim();
}

const overallStageRuleSet = {
  parse(rawLabel) {
    const raw = normalizeLabel(rawLabel);
    if (!raw) {
      return null;
    }

    const token = normalizeOverallStageToken(raw);
    if (!token) {
      return null;
    }

    if (/^is$/i.test(token)) {
      return {
        axis: "Stage",
        prefix: "",
        parent: "Stage Is",
        child: null,
        childType: "nos",
        childSortToken: "",
        normalized: "stageis",
        raw,
      };
    }

    const match = token.match(/^([0-9]+|[IVX]+)([A-D]?)(\d{0,2})$/i);
    if (!match) {
      return null;
    }

    const base = String(match[1] || "").toUpperCase();
    const letter = String(match[2] || "").toUpperCase();
    const numericSuffix = String(match[3] || "");
    const child = `${letter}${numericSuffix}` || null;

    return {
      axis: "Stage",
      prefix: "",
      parent: `Stage ${base}`,
      child,
      childType: child ? "child" : "nos",
      childSortToken: child ? child.toLowerCase() : "",
      normalized: `stage${base.toLowerCase()}${child ? child.toLowerCase() : ""}`,
      raw,
    };
  },
  sortKey(parsed) {
    const parentRank = getOverallStageParentRank(parsed.parent);
    const childRank = parsed.child ? 1 : 0;
    const childToken = parsed.childSortToken || "";

    return [
      padRank(parentRank, 3),
      padRank(childRank, 3),
      childToken,
      String(parsed.raw || "").toLowerCase(),
    ].join(":");
  },
  displayLabel(parsed) {
    if (!parsed) {
      return "";
    }

    if (!parsed.child) {
      return parsed.parent;
    }

    return `${parsed.parent}${parsed.child}`;
  },
  parentDisplayLabel(parentKey) {
    return normalizeLabel(parentKey);
  },
};

function parseGradeChildToken(rawToken) {
  const token = normalizeLabel(rawToken).replace(/^[_-]+/, "");
  if (!token) {
    return {
      child: null,
      childType: "nos",
      childSortToken: "",
    };
  }

  const compact = token.replace(/[_\s-]+/g, "").toLowerCase();
  if (!compact) {
    return {
      child: null,
      childType: "nos",
      childSortToken: "",
    };
  }

  const slMatch = compact.match(/^sl(\d+)$/i);
  if (slMatch) {
    const score = slMatch[1];
    return {
      child: `sl_${score}`,
      childType: "sl",
      childSortToken: `sl_${score}`,
    };
  }

  if (/^[a-z]$/.test(compact)) {
    return {
      child: compact,
      childType: "letter",
      childSortToken: compact,
    };
  }

  return {
    child: compact,
    childType: "other",
    childSortToken: compact,
  };
}

function getGradeParentRank(parent) {
  const numericMatch = String(parent || "").match(/^G(\d+)$/i);
  if (numericMatch) {
    return Number.parseInt(numericMatch[1], 10);
  }

  if (String(parent || "").toUpperCase() === "GX") {
    return 98;
  }

  if (String(parent || "").toLowerCase() === "gleason") {
    return 99;
  }

  return 199;
}

function getGradeChildRank(parsed) {
  if (!parsed?.child || parsed.childType === "nos") {
    return 0;
  }
  if (parsed.childType === "letter") {
    return 10 + Math.max(0, String(parsed.childSortToken || "").charCodeAt(0) - 97);
  }
  if (parsed.childType === "sl") {
    return 40;
  }
  return 70;
}

const gradeRuleSet = {
  parse(rawLabel) {
    const raw = normalizeLabel(rawLabel);
    if (!raw) {
      return null;
    }

    const withoutSuffix = stripStageSuffix(raw);
    const compact = withoutSuffix.replace(/\s+/g, "");
    const normalized = compact.replace(/[_-]+/g, "");
    const lowerNormalized = normalized.toLowerCase();

    if (!lowerNormalized) {
      return null;
    }

    if (lowerNormalized.startsWith("gleason")) {
      const remainder = normalized.slice(7);
      const child = remainder ? remainder.toLowerCase() : null;
      return {
        axis: "G",
        prefix: "",
        parent: "Gleason",
        child,
        childType: child ? "named" : "nos",
        childSortToken: child || "",
        normalized: lowerNormalized,
        raw,
      };
    }

    if (/^(grade)?x$/i.test(normalized) || /^gx$/i.test(normalized)) {
      return {
        axis: "G",
        prefix: "",
        parent: "GX",
        child: null,
        childType: "nos",
        childSortToken: "",
        normalized: "gx",
        raw,
      };
    }

    const digitMatch = normalized.match(/^grade(\d+)(.*)$/i) || normalized.match(/^g(\d+)(.*)$/i);
    if (!digitMatch) {
      return null;
    }

    const gradeNumber = Number.parseInt(digitMatch[1], 10);
    if (!Number.isFinite(gradeNumber)) {
      return null;
    }

    const parent = `G${gradeNumber}`;
    const childMeta = parseGradeChildToken(digitMatch[2] || "");

    return {
      axis: "G",
      prefix: "",
      parent,
      child: childMeta.child,
      childType: childMeta.childType,
      childSortToken: childMeta.childSortToken,
      normalized: `${parent.toLowerCase()}${childMeta.childSortToken}`,
      raw,
    };
  },
  sortKey(parsed) {
    const parentRank = getGradeParentRank(parsed.parent);
    const childRank = getGradeChildRank(parsed);
    const childToken = parsed.childSortToken || "";

    return [
      padRank(parentRank, 3),
      padRank(childRank, 3),
      childToken,
      String(parsed.raw || "").toLowerCase(),
    ].join(":");
  },
  displayLabel(parsed) {
    if (!parsed) {
      return "";
    }

    if (parsed.parent === "Gleason") {
      if (!parsed.child) {
        return "Gleason";
      }

      const patternMatch = String(parsed.child).match(/^pattern(\d+)$/i);
      if (patternMatch) {
        return `Gleason Pattern ${patternMatch[1]}`;
      }

      return `Gleason ${parsed.child}`;
    }

    if (!parsed.child) {
      return parsed.parent;
    }

    if (parsed.childType === "letter") {
      return `${parsed.parent}${parsed.child}`;
    }

    if (parsed.childType === "sl") {
      return `${parsed.parent} ${String(parsed.child).replace("_", " ")}`;
    }

    return `${parsed.parent} ${parsed.child}`;
  },
  parentDisplayLabel(parentKey) {
    return normalizeLabel(parentKey);
  },
};

const BEHAVIOR_ORDER = ["Benign", "Borderline", "InSitu", "Malignant"];
const BEHAVIOR_CHILD_ORDER = ["", "Invasive", "LocallyMetastatic", "DistantlyMetastatic"];
const BEHAVIOR_LABEL_MAP = {
  benign: { parent: "Benign", child: null },
  borderline: { parent: "Borderline", child: null },
  insitu: { parent: "InSitu", child: null },
  malignant: { parent: "Malignant", child: null },
  invasive: { parent: "Malignant", child: "Invasive" },
  locallymetastatic: { parent: "Malignant", child: "LocallyMetastatic" },
  distantlymetastatic: { parent: "Malignant", child: "DistantlyMetastatic" },
};

const behaviorRuleSet = {
  parse(rawLabel) {
    const raw = normalizeLabel(rawLabel);
    if (!raw) {
      return null;
    }

    const withoutSuffix = stripStageSuffix(raw);
    const key = withoutSuffix.replace(/[\s_-]+/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const matched = BEHAVIOR_LABEL_MAP[key];
    if (!matched) {
      return null;
    }

    return {
      axis: "Behavior",
      prefix: "",
      parent: matched.parent,
      child: matched.child,
      childType: matched.child ? "child" : "nos",
      childSortToken: matched.child ? matched.child.toLowerCase() : "",
      normalized: key,
      raw,
    };
  },
  sortKey(parsed) {
    const parentRank = Math.max(0, BEHAVIOR_ORDER.indexOf(parsed.parent));
    const childRank = Math.max(0, BEHAVIOR_CHILD_ORDER.indexOf(parsed.child || ""));

    return [
      padRank(parentRank, 3),
      padRank(childRank, 3),
      String(parsed.raw || "").toLowerCase(),
    ].join(":");
  },
  displayLabel(parsed) {
    if (!parsed) {
      return "";
    }

    if (parsed.child) {
      return parsed.child;
    }

    return parsed.parent;
  },
  parentDisplayLabel(parentKey) {
    return normalizeLabel(parentKey);
  },
};

function validateRuleSet(ruleSet) {
  return (
    ruleSet &&
    typeof ruleSet.parse === "function" &&
    typeof ruleSet.sortKey === "function" &&
    typeof ruleSet.displayLabel === "function" &&
    typeof ruleSet.parentDisplayLabel === "function"
  );
}

export function registerRollupRules(className, ruleSet) {
  const classKey = normalizeClassKey(className);
  if (!classKey || !validateRuleSet(ruleSet)) {
    return false;
  }

  rollupRulesByClassKey.set(classKey, ruleSet);
  return true;
}

export function hasRollup(className) {
  return Boolean(getRuleSet(className));
}

export function parseLabel(rawLabel, className) {
  const ruleSet = getRuleSet(className);
  return safeParse(ruleSet, rawLabel);
}

export function buildRolledUpChartData(rows, className) {
  const normalizedRows = (Array.isArray(rows) ? rows : []).map(normalizeChartRow).filter(Boolean);
  const ruleSet = getRuleSet(className);

  if (!ruleSet) {
    return normalizedRows;
  }

  const summaryByParent = new Map();
  const passthroughRows = [];

  normalizedRows.forEach((row) => {
    const parsed = safeParseWithDisplayFallback(ruleSet, row.label, row.displayLabel);
    if (!parsed?.parent) {
      passthroughRows.push({
        ...row,
        _expandable: false,
        _isRolledUp: false,
      });
      return;
    }

    const parentKey = parsed.parent;
    const existingSummary = summaryByParent.get(parentKey) || {
      parentKey,
      childLabels: new Set(),
      patientIds: new Set(),
      sumValue: 0,
    };

    existingSummary.childLabels.add(row.label);
    existingSummary.sumValue += toSafeNumber(row.value);
    row.patientIds.forEach((patientId) => {
      const normalizedId = normalizeLabel(patientId);
      if (normalizedId) {
        existingSummary.patientIds.add(normalizedId);
      }
    });

    summaryByParent.set(parentKey, existingSummary);
  });

  const rolledUpRows = [...summaryByParent.values()]
    .map((summary) => {
      const parentParsed = safeParse(ruleSet, summary.parentKey) || {
        axis: "",
        prefix: "",
        parent: summary.parentKey,
        child: null,
        normalized: summary.parentKey,
        raw: summary.parentKey,
        childType: "nos",
        childSortToken: "",
      };
      const sortedPatientIds = [...summary.patientIds].sort(defaultStringCompare);
      const value = sortedPatientIds.length > 0 ? sortedPatientIds.length : summary.sumValue;

      return {
        label: summary.parentKey,
        displayLabel:
          normalizeLabel(ruleSet.parentDisplayLabel(summary.parentKey, parentParsed)) ||
          summary.parentKey,
        value,
        patientIds: sortedPatientIds,
        _expandable: summary.childLabels.size > 1,
        _isRolledUp: true,
      };
    })
    .sort((leftRow, rightRow) => {
      const leftParsed = safeParse(ruleSet, leftRow.label);
      const rightParsed = safeParse(ruleSet, rightRow.label);
      return compareParsed(
        ruleSet,
        leftParsed,
        rightParsed,
        leftRow.displayLabel || leftRow.label,
        rightRow.displayLabel || rightRow.label
      );
    });

  const sortedPassthroughRows = [...passthroughRows].sort((leftRow, rightRow) =>
    defaultStringCompare(
      leftRow.displayLabel || leftRow.label,
      rightRow.displayLabel || rightRow.label
    )
  );

  return [...rolledUpRows, ...sortedPassthroughRows];
}

export function buildRollupInstanceMap(rows, className) {
  const normalizedRows = (Array.isArray(rows) ? rows : []).map(normalizeChartRow).filter(Boolean);
  const ruleSet = getRuleSet(className);

  if (!ruleSet) {
    return {};
  }

  const instanceMap = new Map();

  normalizedRows.forEach((row) => {
    const parsed = safeParseWithDisplayFallback(ruleSet, row.label, row.displayLabel);
    if (!parsed?.parent) {
      return;
    }

    if (!instanceMap.has(parsed.parent)) {
      instanceMap.set(parsed.parent, new Set());
    }
    instanceMap.get(parsed.parent).add(row.label);
  });

  const sortedParents = [...instanceMap.keys()].sort((leftParent, rightParent) =>
    compareParsed(
      ruleSet,
      safeParse(ruleSet, leftParent),
      safeParse(ruleSet, rightParent),
      leftParent,
      rightParent
    )
  );

  const output = {};
  sortedParents.forEach((parentKey) => {
    const labels = [...instanceMap.get(parentKey)];
    labels.sort((leftLabel, rightLabel) =>
      compareParsed(
        ruleSet,
        safeParse(ruleSet, leftLabel),
        safeParse(ruleSet, rightLabel),
        leftLabel,
        rightLabel
      )
    );

    output[parentKey] = labels;
  });

  return output;
}

export function resolveRollupSelections(selectedValues, className, rollupInstanceMap) {
  const normalizedSelections = Array.isArray(selectedValues)
    ? [...new Set(selectedValues.map((value) => normalizeLabel(value)).filter(Boolean))]
    : [];

  const ruleSet = getRuleSet(className);
  if (!ruleSet) {
    return normalizedSelections;
  }

  return [
    ...new Set(
      normalizedSelections.flatMap((selectedValue) => {
        const mappedValues = rollupInstanceMap?.[selectedValue];
        if (Array.isArray(mappedValues) && mappedValues.length > 0) {
          return mappedValues.map((value) => normalizeLabel(value)).filter(Boolean);
        }
        return [selectedValue];
      })
    ),
  ];
}

export function buildChildChartData(rows, className, parentKey) {
  const normalizedRows = (Array.isArray(rows) ? rows : []).map(normalizeChartRow).filter(Boolean);
  const normalizedParentKey = normalizeLabel(parentKey);
  const ruleSet = getRuleSet(className);

  if (!ruleSet || !normalizedParentKey) {
    return [];
  }

  return normalizedRows
    .map((row) => {
      const parsed = safeParseWithDisplayFallback(ruleSet, row.label, row.displayLabel);
      if (!parsed || parsed.parent !== normalizedParentKey) {
        return null;
      }

      const displayLabel = normalizeLabel(ruleSet.displayLabel(parsed, row)) || row.displayLabel || row.label;

      return {
        ...row,
        displayLabel,
        _isChild: true,
        _expandable: false,
        _parentKey: normalizedParentKey,
      };
    })
    .filter(Boolean)
    .sort((leftRow, rightRow) =>
      compareParsed(
        ruleSet,
        safeParse(ruleSet, leftRow.label),
        safeParse(ruleSet, rightRow.label),
        leftRow.label,
        rightRow.label
      )
    );
}

export function isExpandable(rows, className, parentKey) {
  const normalizedRows = (Array.isArray(rows) ? rows : []).map(normalizeChartRow).filter(Boolean);
  const normalizedParentKey = normalizeLabel(parentKey);
  const ruleSet = getRuleSet(className);

  if (!ruleSet || !normalizedParentKey) {
    return false;
  }

  const childLabels = new Set();

  normalizedRows.forEach((row) => {
    const parsed = safeParseWithDisplayFallback(ruleSet, row.label, row.displayLabel);
    if (parsed?.parent === normalizedParentKey) {
      childLabels.add(row.label);
    }
  });

  return childLabels.size > 1;
}

registerRollupRules("T Stage", createStageRuleSet("T"));
registerRollupRules("N Stage", createStageRuleSet("N"));
registerRollupRules("M Stage", createStageRuleSet("M"));
registerRollupRules("Stage", overallStageRuleSet);
registerRollupRules("Grade", gradeRuleSet);
registerRollupRules("Grade_Numeric", gradeRuleSet);
registerRollupRules("Behavior", behaviorRuleSet);
