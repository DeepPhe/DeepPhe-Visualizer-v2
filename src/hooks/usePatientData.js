import { useCallback, useRef, useState } from "react";
import { loadPatientProfile } from "../controllers/patient";
import { transformCancerSummary } from "../utils/patientView/transformCancerSummary";
import { transformDocumentTimeline } from "../utils/patientView/transformDocumentTimeline";

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
    setIsLoading(true);
    setErrorMessage("");

    try {
      const nextPatientData = await loader(normalized);
      if (requestIdRef.current !== requestId) return null;

      const nextTimeline = transformDocumentTimeline({
        patientId: nextPatientData.patientId,
        patientName: nextPatientData.patientName,
        demographics: nextPatientData.demographics,
        documents: nextPatientData.documents,
      });
      const nextCancerSummary = transformCancerSummary(nextPatientData.cancers);

      setPatientData(nextPatientData);
      setTimelineData(nextTimeline);
      setCancerSummary(nextCancerSummary);
      return { patientData: nextPatientData, timelineData: nextTimeline, cancerSummary: nextCancerSummary };
    } catch (error) {
      if (requestIdRef.current !== requestId) return null;
      setPatientData(null);
      setTimelineData(null);
      setCancerSummary([]);
      setErrorMessage(error?.message || "Failed to load patient details.");
      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  return { patientData, timelineData, cancerSummary, isLoading, errorMessage, loadPatient };
}
