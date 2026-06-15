import { normalizeClassName } from "../../utils/dataProcessing";
import { resolveRollupSelections } from "../rollup";
import {
  AGE_AT_DX_CLASS,
  AGE_SELECTION_MODE,
  isAttributeRollupClass,
  normalizeInstanceValues,
} from "./filterDefinitions";

export function toFilterItem(type, className, values) {
  const instances = normalizeInstanceValues(values);

  if (instances.length === 0) {
    return null;
  }

  return {
    type,
    class: className,
    instances,
  };
}

function getFilterClassKey(type, className) {
  return `${String(type || "")
    .trim()
    .toLowerCase()}:${String(className || "").trim()}`;
}

export function getFilterRowKey(type, className, rowLabel) {
  return `${getFilterClassKey(type, className)}:${String(rowLabel || "").trim()}`;
}

export function isSameFilterClass(filter, type, className) {
  return getFilterClassKey(filter?.type, filter?.class) === getFilterClassKey(type, className);
}

export function getRowInstancesForClass({
  type,
  className,
  rowLabel,
  ageAtDxSelectionMode,
  ageDecileInstanceMap,
  rollupInstanceMapByClass,
}) {
  const normalizedType = String(type || "").toLowerCase();
  const isAgeAtDxDecileClass =
    normalizedType === "omop" &&
    normalizeClassName(className) === AGE_AT_DX_CLASS &&
    ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE;
  const isAttributeRollupFilter = normalizedType === "attributes" && isAttributeRollupClass(className);

  if (isAgeAtDxDecileClass) {
    const mappedInstances = ageDecileInstanceMap?.[rowLabel];
    if (Array.isArray(mappedInstances) && mappedInstances.length > 0) {
      return mappedInstances;
    }
  }

  if (isAttributeRollupFilter) {
    return resolveRollupSelections([rowLabel], className, rollupInstanceMapByClass?.[className]);
  }

  return [rowLabel];
}

export function buildActiveFilters({
  selectedOmopValuesByClass,
  omopClasses,
  selectedAttributeValuesByClass,
  attributeClasses,
  selectedConceptValuesByClass,
  conceptClasses,
}) {
  const omopFilters = Array.isArray(omopClasses)
    ? omopClasses
        .map((className) => toFilterItem("omop", className, selectedOmopValuesByClass?.[className]))
        .filter(Boolean)
    : [];
  const attributeFilters = Array.isArray(attributeClasses)
    ? attributeClasses
        .map((className) => toFilterItem("attributes", className, selectedAttributeValuesByClass?.[className]))
        .filter(Boolean)
    : [];
  const conceptFilters = Array.isArray(conceptClasses)
    ? conceptClasses
        .map((className) => toFilterItem("concepts", className, selectedConceptValuesByClass?.[className]))
        .filter(Boolean)
    : [];

  return [...omopFilters, ...attributeFilters, ...conceptFilters];
}

export function resolveRequestFilters({ filters, ageAtDxSelectionMode, ageDecileInstanceMap, rollupInstanceMapByClass }) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map((filter) => {
      const normalizedFilterType = String(filter?.type || "").toLowerCase();
      const isAgeAtDxFilter = normalizedFilterType === "omop" && normalizeClassName(filter?.class) === AGE_AT_DX_CLASS;
      const isAttributeRollupFilter = normalizedFilterType === "attributes" && isAttributeRollupClass(filter?.class);

      if (!isAgeAtDxFilter && !isAttributeRollupFilter) {
        return {
          type: filter.type,
          class: filter.class,
          instances: normalizeInstanceValues(filter.instances),
        };
      }

      if (isAgeAtDxFilter && ageAtDxSelectionMode !== AGE_SELECTION_MODE.DECILE) {
        return {
          type: filter.type,
          class: filter.class,
          instances: normalizeInstanceValues(filter.instances),
        };
      }

      let expandedInstances = normalizeInstanceValues(filter.instances);

      if (isAgeAtDxFilter && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE) {
        expandedInstances = normalizeInstanceValues(
          expandedInstances.flatMap((selectedValue) => {
            const mappedInstances = ageDecileInstanceMap?.[selectedValue];
            if (Array.isArray(mappedInstances) && mappedInstances.length > 0) {
              return mappedInstances;
            }
            return [selectedValue];
          })
        );
      }

      if (isAttributeRollupFilter) {
        expandedInstances = resolveRollupSelections(
          expandedInstances,
          filter.class,
          rollupInstanceMapByClass?.[filter.class]
        );
      }

      expandedInstances = normalizeInstanceValues(expandedInstances).sort((leftValue, rightValue) =>
        leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );

      return {
        type: filter.type,
        class: filter.class,
        instances: expandedInstances,
      };
    })
    .filter((filter) => filter.instances.length > 0);
}

export function syncSelectionByClass(previousSelections, classes) {
  const nextSelections = {};

  classes.forEach((className) => {
    const existingValues = Array.isArray(previousSelections?.[className]) ? previousSelections[className] : [];
    nextSelections[className] = [...new Set(existingValues.map((value) => String(value).trim()).filter(Boolean))];
  });

  return nextSelections;
}

export function syncExpandedParentsByClass(previousState, classes, rolledUpChartDataByClass) {
  const nextState = {};

  classes.forEach((className) => {
    if (!isAttributeRollupClass(className)) {
      nextState[className] = [];
      return;
    }

    const existingParents = Array.isArray(previousState?.[className]) ? previousState[className] : [];
    const availableParents = new Set(
      (rolledUpChartDataByClass?.[className] || []).map((row) => String(row?.label || "").trim()).filter(Boolean)
    );

    nextState[className] = [
      ...new Set(existingParents.map((value) => String(value || "").trim()).filter(Boolean)),
    ].filter((parentKey) => availableParents.has(parentKey));
  });

  return nextState;
}
