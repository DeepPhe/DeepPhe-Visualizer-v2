import { useContext } from "react";
import { PatientViewPresentationContext } from "../components/patient/PatientViewPresentationProvider";
import {
  DEFAULT_PATIENT_VIEW_PRESENTATION,
  PATIENT_VIEW_PRESENTATION,
} from "../constants/patientViewPresentation";

const FALLBACK = Object.freeze({
  presentation: DEFAULT_PATIENT_VIEW_PRESENTATION,
  setPresentation: () => {},
  isImproved: DEFAULT_PATIENT_VIEW_PRESENTATION === PATIENT_VIEW_PRESENTATION.IMPROVED,
  isAlpha: DEFAULT_PATIENT_VIEW_PRESENTATION === PATIENT_VIEW_PRESENTATION.ALPHA,
});

/**
 * Which presentation the patient view is set to: `{ presentation,
 * setPresentation, isImproved, isAlpha }`. Outside a
 * PatientViewPresentationProvider it reports the default and ignores writes.
 */
export default function usePatientViewPresentation() {
  return useContext(PatientViewPresentationContext) || FALLBACK;
}
