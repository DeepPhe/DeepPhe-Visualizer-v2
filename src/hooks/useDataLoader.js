import { useEffect, useState } from "react";
import { summarizeInstances } from "../utils/dataProcessing";
import { endSpan, startSpan } from "../utils/perfTracker";

const isPerfLoggingEnabled = process.env.NODE_ENV !== "production";

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function logPerf(context, message, details = {}) {
  if (!isPerfLoggingEnabled) return;
  // eslint-disable-next-line no-console
  console.log(`[useDataLoader:${context}] ${message}`, details);
}

const INSTANCE_CONTEXT_BY_SECTION = {
  OMOP: "OMOP",
  Attributes: "attribute",
  Concepts: "concept",
  Cancers: "cancer",
};

/**
 * Generic loader for section class lists and instance summaries.
 * @param {Function} getClassesFn
 * @param {Function} getInstancesFn
 * @param {string} errorContext
 * @param {Record<string, unknown>} instanceOptions
 * @returns {{
 *   classes: string[],
 *   summaryByClass: Record<string, Array<{value: string, count: number, patientIds?: string[]}>>,
 *   errorsByClass: Record<string, string>,
 *   isLoading: boolean,
 *   errorMessage: string
 * }}
 */
export function useDataLoader(
  getClassesFn,
  getInstancesFn,
  errorContext,
  instanceOptions
) {
  const [classes, setClasses] = useState([]);
  const [summaryByClass, setSummaryByClass] = useState({});
  const [errorsByClass, setErrorsByClass] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const optionsKey = JSON.stringify(instanceOptions || {});

  useEffect(() => {
    let isActive = true;
    let parsedInstanceOptions = {};

    try {
      parsedInstanceOptions = optionsKey ? JSON.parse(optionsKey) : {};
    } catch {
      parsedInstanceOptions = {};
    }

    const loadData = async () => {
      const loadStartTime = nowMs();
      const span = startSpan(`batch:${errorContext}`, "api_call", { context: errorContext });
      setIsLoading(true);
      setErrorMessage("");

      try {
        const classesStartTime = nowMs();
        const classesResult = await getClassesFn();
        const classList = Array.isArray(classesResult) ? classesResult : [];
        const classesMs = Math.round(nowMs() - classesStartTime);

        const instancesStartTime = nowMs();
        const instanceResults = await Promise.allSettled(
          classList.map(async (className) => {
            const instances = await getInstancesFn(className, parsedInstanceOptions);
            return {
              className,
              summary: summarizeInstances(className, instances),
            };
          })
        );
        const instancesMs = Math.round(nowMs() - instancesStartTime);

        const nextSummaryByClass = {};
        const nextErrorsByClass = {};
        const instanceContext =
          INSTANCE_CONTEXT_BY_SECTION[errorContext] || String(errorContext || "").toLowerCase();

        instanceResults.forEach((callResult, index) => {
          const className = String(classList[index]);
          if (callResult.status === "fulfilled") {
            nextSummaryByClass[className] = callResult.value.summary;
            return;
          }

          nextErrorsByClass[className] =
            callResult.reason?.message || `Failed to load ${instanceContext} instances.`;
        });

        if (!isActive) {
          logPerf(errorContext, "stale response ignored", {
            classesMs,
            instancesMs,
          });
          endSpan(span, "cancelled", { errorMessage: "stale response ignored" });
          return;
        }

        setClasses(classList);
        setSummaryByClass(nextSummaryByClass);
        setErrorsByClass(nextErrorsByClass);
        setIsLoading(false);

        logPerf(errorContext, "load complete", {
          classes: classList.length,
          classesMs,
          instancesMs,
          totalMs: Math.round(nowMs() - loadStartTime),
        });
        endSpan(span, "ok", {
          classes: classList.length,
          classesMs,
          instancesMs,
        });
      } catch (error) {
        if (isActive) {
          setErrorMessage(error?.message || `Failed to load ${errorContext} classes.`);
          setIsLoading(false);

          logPerf(errorContext, "load failed", {
            totalMs: Math.round(nowMs() - loadStartTime),
            message: error?.message || "",
          });
          endSpan(span, "error", { errorMessage: error?.message || "" });
          return;
        }

        endSpan(span, "cancelled", { errorMessage: error?.message || "" });
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [errorContext, getClassesFn, getInstancesFn, optionsKey]);

  return {
    classes,
    summaryByClass,
    errorsByClass,
    isLoading,
    errorMessage,
  };
}
