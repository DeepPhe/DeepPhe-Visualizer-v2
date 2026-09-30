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
  isBeta: DEFAULT_PATIENT_VIEW_PRESENTATION === PATIENT_VIEW_PRESENTATION.BETA,
  isAlpha: DEFAULT_PATIENT_VIEW_PRESENTATION === PATIENT_VIEW_PRESENTATION.ALPHA,
});

/**
 * Which presentation the patient view is set to: `{ presentation,
 * setPresentation, isImproved, isBeta, isAlpha }`. `isImproved` is true for both
 * Improved and Beta (Beta is Improved plus a different cancer table). Outside a
 * PatientViewPresentationProvider it reports the default and ignores writes.
 */
export default function usePatientViewPresentation() {
  return useContext(PatientViewPresentationContext) || FALLBACK;
}
