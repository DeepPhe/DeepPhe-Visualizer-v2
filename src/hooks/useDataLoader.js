import { useEffect, useState } from "react";
import { summarizeInstances } from "../utils/dataProcessing";

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
      setIsLoading(true);
      setErrorMessage("");

      try {
        const classesResult = await getClassesFn();
        const classList = Array.isArray(classesResult) ? classesResult : [];
        const instanceResults = await Promise.allSettled(
          classList.map(async (className) => {
            const instances = await getInstancesFn(className, parsedInstanceOptions);
            return {
              className,
              summary: summarizeInstances(className, instances),
            };
          })
        );

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

        if (isActive) {
          setClasses(classList);
          setSummaryByClass(nextSummaryByClass);
          setErrorsByClass(nextErrorsByClass);
          setIsLoading(false);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error?.message || `Failed to load ${errorContext} classes.`);
          setIsLoading(false);
        }
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
