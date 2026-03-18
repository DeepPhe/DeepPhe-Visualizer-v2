export const AGE_AT_DX_ATTRIBUTE = "AGE_AT_DX";

export const AGE_DECILE_LABELS = [
  "0-9",
  "10-19",
  "20-29",
  "30-39",
  "40-49",
  "50-59",
  "60-69",
  "70-79",
  "80-89",
  "90+",
];

export const MAX_BAR_CHART_VALUES = 12;

export const GRID_TEMPLATE_COLUMNS = "repeat(auto-fit, minmax(240px, 1fr))";

export const ATTRIBUTES_GRID_TEMPLATE_COLUMNS = {
  xs: "1fr",
  md: "1fr 1fr",
};

export const VALUE_FIELDS_BY_ATTRIBUTE = {
  [AGE_AT_DX_ATTRIBUTE]: ["age_at_dx", "value", "age"],
  ETHNICITY: ["ethnicity", "value"],
  GENDER: ["gender", "value"],
  RACE: ["race", "value"],
  CANCER: ["cancer", "value", "classUri"],
};

export const COUNT_FIELDS = [
  "count",
  "patient_count",
  "patientCount",
  "num_patients",
  "frequency",
];
