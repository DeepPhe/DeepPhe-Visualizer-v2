import {
  AGE_DECILE_LABELS,
  ATTRIBUTES_GRID_TEMPLATE_COLUMNS,
  COUNT_FIELDS,
  GRID_TEMPLATE_COLUMNS,
  MAX_BAR_CHART_VALUES,
  VALUE_FIELDS_BY_ATTRIBUTE,
} from "../debugConstants";

describe("debugConstants", () => {
  it("has expected age decile labels", () => {
    expect(AGE_DECILE_LABELS).toHaveLength(10);
    expect(AGE_DECILE_LABELS).toEqual([
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
    ]);
  });

  it("defines valid chart limits and grid templates", () => {
    expect(MAX_BAR_CHART_VALUES).toBe(12);
    expect(typeof GRID_TEMPLATE_COLUMNS).toBe("string");
    expect(GRID_TEMPLATE_COLUMNS).toContain("minmax(240px, 1fr)");
    expect(ATTRIBUTES_GRID_TEMPLATE_COLUMNS).toEqual({ xs: "1fr", md: "1fr 1fr" });
  });

  it("defines value and count field mappings", () => {
    expect(VALUE_FIELDS_BY_ATTRIBUTE).toHaveProperty("AGE_AT_DX");
    expect(VALUE_FIELDS_BY_ATTRIBUTE).toHaveProperty("ETHNICITY");
    expect(VALUE_FIELDS_BY_ATTRIBUTE).toHaveProperty("GENDER");
    expect(VALUE_FIELDS_BY_ATTRIBUTE).toHaveProperty("RACE");
    expect(VALUE_FIELDS_BY_ATTRIBUTE).toHaveProperty("CANCER");
    expect(Array.isArray(COUNT_FIELDS)).toBe(true);
    expect(COUNT_FIELDS.length).toBeGreaterThan(0);
  });
});
