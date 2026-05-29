import { useCallback, useRef, useState } from "react";
import { loadPatientProfile } from "../controllers/patient";
import { transformCancerSummary } from "../utils/patientView/transformCancerSummary";
import { transformDocumentTimeline } from "../utils/patientView/transformDocumentTimeline";
import { endSpan, startSpan } from "../utils/perfTracker";

const isPerfLoggingEnabled = process.env.NODE_ENV !== "production";

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function logPerf(message, details = {}) {
  if (!isPerfLoggingEnabled) return;
  // eslint-disable-next-line no-console
  console.log(`[usePatientData] ${message}`, details);
}

/**
 * Manages patient profile state with request-ID-based cancellation.
 * Returns stable `loadPatient(id, loader?)` — call it imperatively (button
 * handler or useEffect) to kick off a load. The optional `loader` param
 * lets callers substitute an alternative profile fetcher (e.g. Viz2 mode).
 *
 * @returns {{ patientData, timelineData, cancerSummary, isLoading, errorMessage, loadPatient }}
 */
export function usePatientData() {
  const [patientData, setPatientData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [cancerSummary, setCancerSummary] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestIdRef = useRef(0);

  const loadPatient = useCallback(async (patientId, loader = loadPatientProfile) => {
    const normalized = String(patientId || "").trim();
    if (!normalized) return null;

    const requestId = ++requestIdRef.current;
    const loadStartTime = nowMs();
    const span = startSpan(`patient:load:${normalized}`, "user_interaction", {
      patientId: normalized,
    });
    setIsLoading(true);
    setErrorMessage("");

    try {
      const fetchStartTime = nowMs();
      const nextPatientData = await loader(normalized);
      const fetchMs = Math.round(nowMs() - fetchStartTime);

      if (requestIdRef.current !== requestId) {
        endSpan(span, "cancelled", { fetchMs });
        return null;
      }

      const transformStartTime = nowMs();
      const nextTimeline = transformDocumentTimeline({
        patientId: nextPatientData.patientId,
        patientName: nextPatientData.patientName,
        demographics: nextPatientData.demographics,
        documents: nextPatientData.documents,
      });
      const nextCancerSummary = transformCancerSummary(nextPatientData.cancers);
      const transformMs = Math.round(nowMs() - transformStartTime);

      setPatientData(nextPatientData);
      setTimelineData(nextTimeline);
      setCancerSummary(nextCancerSummary);

      const totalMs = Math.round(nowMs() - loadStartTime);
      logPerf("load complete", { patientId: normalized, fetchMs, transformMs, totalMs });
      endSpan(span, "ok", { fetchMs, transformMs, totalMs });

      return { patientData: nextPatientData, timelineData: nextTimeline, cancerSummary: nextCancerSummary };
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        endSpan(span, "cancelled", { errorMessage: error?.message || "" });
        return null;
      }
      setPatientData(null);
      setTimelineData(null);
      setCancerSummary([]);
      setErrorMessage(error?.message || "Failed to load patient details.");

      const totalMs = Math.round(nowMs() - loadStartTime);
      logPerf("load failed", { patientId: normalized, totalMs, message: error?.message || "" });
      endSpan(span, "error", { errorMessage: error?.message || "", totalMs });

      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  return { patientData, timelineData, cancerSummary, isLoading, errorMessage, loadPatient };
}
