// How the patient view presents its panels.
//
// "alpha" keeps the reading the Event Timeline was ported with, faithful to
// DeepPhe-Viz-v2-alpha's committed code, and the panel layouts that shipped
// with it. "improved" applies the readability work: one containment level, a
// four-step type scale, a cancer comparison matrix, demoted unknown values, and
// timeline chrome that names what it is showing.
//
// Both are kept so the two can be compared side by side in a demo.

export const PATIENT_VIEW_PRESENTATION_STORAGE_KEY = "patientViewPresentation";

export const PATIENT_VIEW_PRESENTATION = Object.freeze({
  ALPHA: "alpha",
  IMPROVED: "improved",
});

export const DEFAULT_PATIENT_VIEW_PRESENTATION = PATIENT_VIEW_PRESENTATION.IMPROVED;

export const PATIENT_VIEW_PRESENTATION_OPTIONS = Object.freeze([
  {
    value: PATIENT_VIEW_PRESENTATION.ALPHA,
    label: "Alpha",
    description: "The original reading, faithful to the alpha",
  },
  {
    value: PATIENT_VIEW_PRESENTATION.IMPROVED,
    label: "Improved",
    description: "Readability work: comparison matrix, one type scale, clearer timelines",
  },
]);

export function normalizePatientViewPresentation(value) {
  return PATIENT_VIEW_PRESENTATION_OPTIONS.some((option) => option.value === value)
    ? value
    : DEFAULT_PATIENT_VIEW_PRESENTATION;
}
