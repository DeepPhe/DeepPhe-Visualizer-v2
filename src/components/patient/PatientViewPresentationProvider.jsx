import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  DEFAULT_PATIENT_VIEW_PRESENTATION,
  PATIENT_VIEW_PRESENTATION,
  PATIENT_VIEW_PRESENTATION_STORAGE_KEY,
  normalizePatientViewPresentation,
} from "../../constants/patientViewPresentation";

export const PatientViewPresentationContext = createContext(null);

function readStoredPresentation() {
  try {
    return normalizePatientViewPresentation(
      localStorage.getItem(PATIENT_VIEW_PRESENTATION_STORAGE_KEY)
    );
  } catch {
    // localStorage unavailable (private window, blocked site data).
    return DEFAULT_PATIENT_VIEW_PRESENTATION;
  }
}

/**
 * Holds the patient view's presentation choice for every panel under it, and
 * remembers it across visits. Renders no DOM. Panels read it through
 * usePatientViewPresentation, which falls back to the default without a
 * provider, so a panel rendered on its own still works.
 */
export default function PatientViewPresentationProvider({ children }) {
  const [presentation, setPresentationState] = useState(readStoredPresentation);

  const setPresentation = useCallback((nextPresentation) => {
    setPresentationState(normalizePatientViewPresentation(nextPresentation));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PATIENT_VIEW_PRESENTATION_STORAGE_KEY, presentation);
    } catch {
      // Not remembering the choice is better than breaking the view.
    }
  }, [presentation]);

  const value = useMemo(
    () => ({
      presentation,
      setPresentation,
      isImproved: presentation === PATIENT_VIEW_PRESENTATION.IMPROVED,
      isAlpha: presentation === PATIENT_VIEW_PRESENTATION.ALPHA,
    }),
    [presentation, setPresentation]
  );

  return (
    <PatientViewPresentationContext.Provider value={value}>
      {children}
    </PatientViewPresentationContext.Provider>
  );
}

PatientViewPresentationProvider.propTypes = {
  children: PropTypes.node,
};
