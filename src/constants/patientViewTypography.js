// Four type steps for the patient view, and no more.
//
// Panel titles, field labels, values and axis ticks all used to sit within a
// couple of pixels of each other, so nothing ranked and the eye had nowhere to
// land. These are the only sizes the improved view uses for those four roles.

export const PATIENT_VIEW_TYPE = Object.freeze({
  // 16/600 — panel titles.
  panelTitle: Object.freeze({ fontSize: "1rem", fontWeight: 600, lineHeight: 1.25 }),
  // 12/600 muted — field labels. Pair with color="text.secondary".
  fieldLabel: Object.freeze({
    fontSize: "0.75rem",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: 0.2,
  }),
  // 14/500 — values.
  value: Object.freeze({ fontSize: "0.875rem", fontWeight: 500, lineHeight: 1.3 }),
  // 11/400 muted — axis ticks and other chart chrome.
  axisTick: Object.freeze({ fontSize: "0.6875rem", fontWeight: 400, lineHeight: 1.2 }),
});
