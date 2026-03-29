import { useEffect, useState } from "react";
import {
  getCountFromRow,
  getValueFromRow,
  summarizeInstances,
} from "../utils/dataProcessing";

const isPerfLoggingEnabled = process.env.NODE_ENV !== "production";

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function logPerf(context, message, details = {}) {
  if (!isPerfLoggingEnabled) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[useBatchDataLoader:${context}] ${message}`, details);
}

function toPatientIdArray(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    return rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
    const normalizedValue = String(rawValue).trim();
    return normalizedValue ? [normalizedValue] : [];
  }

  return [];
}

function summarizeBatchInstances(attribute, payload) {
  const rows = Array.isArray(payload) ? payload : [];
  if (rows.length === 0) {
    return [];
  }

  const seenValues = new Set();
  const nextSummaryRows = [];
  let hasDuplicateValues = false;

  rows.forEach((row) => {
    if (hasDuplicateValues) {
      return;
    }

    const value = getValueFromRow(attribute, row);
    if (!value || seenValues.has(value)) {
      hasDuplicateValues = true;
      return;
    }

    seenValues.add(value);
    const count = getCountFromRow(row);
    const patientIds = toPatientIdArray(
      row?.patientIds ?? row?.patient_ids ?? row?.patientId ?? row?.patient_id
    );
    const summaryRow = {
      value,
      count,
    };

    if (patientIds.length > 0) {
      summaryRow.patientIds = patientIds;
    }

    nextSummaryRows.push(summaryRow);
  });

  if (hasDuplicateValues) {
    return summarizeInstances(attribute, rows);
  }

  return nextSummaryRows.sort(
    (leftRow, rightRow) =>
      rightRow.count - leftRow.count ||
      leftRow.value.localeCompare(rightRow.value, undefined, {
        numeric: true,
        sensitivity: "base",
      })
  );
}

/**
 * Loader for section class lists and instance summaries from batch endpoints.
 * @param {Function} getSummaryFn
 * @param {string} errorContext
 * @returns {{
 *   classes: string[],
 *   summaryByClass: Record<string, Array<{value: string, count: number, patientIds?: string[]}>>,
 *   errorsByClass: Record<string, string>,
 *   isLoading: boolean,
 *   errorMessage: string
 * }}
 */
export function useBatchDataLoader(getSummaryFn, errorContext) {
  const [classes, setClasses] = useState([]);
  const [summaryByClass, setSummaryByClass] = useState({});
  const [errorsByClass, setErrorsByClass] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      const loadStartTime = nowMs();
      setIsLoading(true);
      setErrorMessage("");

      try {
        const requestStartTime = nowMs();
        const summaryResult = await getSummaryFn();
        const requestEndTime = nowMs();

        if (!isActive) {
          logPerf(errorContext, "stale summary response ignored", {
            requestMs: Math.round(requestEndTime - requestStartTime),
          });
          return;
        }

        const classList = Array.isArray(summaryResult?.classes) ? summaryResult.classes : [];
        const instancesByClass = summaryResult?.instancesByClass || {};
        const nextSummaryByClass = {};
        const nextErrorsByClass = {};
        const summarizeStartTime = nowMs();
        let totalRowsProcessed = 0;

        classList.forEach((className) => {
          const classKey = String(className);
          const classInstances = Array.isArray(instancesByClass?.[classKey])
            ? instancesByClass[classKey]
            : [];

          totalRowsProcessed += classInstances.length;
          nextSummaryByClass[classKey] = summarizeBatchInstances(
            classKey,
            classInstances
          );
        });
        const summarizeEndTime = nowMs();

        if (isActive) {
          setClasses(classList);
          setSummaryByClass(nextSummaryByClass);
          setErrorsByClass(nextErrorsByClass);
          setIsLoading(false);

          logPerf(errorContext, "load complete", {
            classes: classList.length,
            rows: totalRowsProcessed,
            requestMs: Math.round(requestEndTime - requestStartTime),
            summarizeMs: Math.round(summarizeEndTime - summarizeStartTime),
            totalMs: Math.round(summarizeEndTime - loadStartTime),
            serverTimingMs: Number(summaryResult?.timing?.totalMs) || null,
          });
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error?.message || `Failed to load ${errorContext} classes.`);
          setIsLoading(false);

          logPerf(errorContext, "load failed", {
            totalMs: Math.round(nowMs() - loadStartTime),
            message: error?.message || "",
          });
        }
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [errorContext, getSummaryFn]);

  return {
    classes,
    summaryByClass,
    errorsByClass,
    isLoading,
    errorMessage,
  };
}
