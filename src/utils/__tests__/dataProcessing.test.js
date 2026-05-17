import {
  asRowArray,
  getAgeDecileDistribution,
  getAgeDecileLabel,
  getAnchorId,
  getCategoryDistribution,
  getCountFromRow,
  getSummaryTotalCount,
  getValueFromRow,
  sortDistributionAlphanumerically,
  summarizeInstances,
} from "../dataProcessing";
import { AGE_AT_DX_ATTRIBUTE, AGE_DECILE_LABELS } from "../dataProcessing";

describe("dataProcessing utilities", () => {
  describe("asRowArray", () => {
    it("returns array input as-is", () => {
      const rows = [{ value: "a" }];
      expect(asRowArray(rows)).toBe(rows);
    });

    it("extracts rows array", () => {
      expect(asRowArray({ rows: [{ value: "a" }] })).toEqual([{ value: "a" }]);
    });

    it("extracts data array", () => {
      expect(asRowArray({ data: [{ value: "a" }] })).toEqual([{ value: "a" }]);
    });

    it("returns empty array for nullish or invalid payload", () => {
      expect(asRowArray(null)).toEqual([]);
      expect(asRowArray(undefined)).toEqual([]);
      expect(asRowArray({})).toEqual([]);
      expect(asRowArray("value")).toEqual([]);
      expect(asRowArray(123)).toEqual([]);
    });
  });

  describe("getValueFromRow", () => {
    it("extracts age field values in priority order", () => {
      expect(getValueFromRow(AGE_AT_DX_ATTRIBUTE, { age_at_dx: " 43 " })).toBe("43");
      expect(getValueFromRow(AGE_AT_DX_ATTRIBUTE, { value: "44" })).toBe("44");
      expect(getValueFromRow(AGE_AT_DX_ATTRIBUTE, { age: "45" })).toBe("45");
    });

    it("extracts attribute-specific fields", () => {
      expect(getValueFromRow("ETHNICITY", { ethnicity: "Hispanic" })).toBe("Hispanic");
      expect(getValueFromRow("GENDER", { gender: "Female" })).toBe("Female");
      expect(getValueFromRow("RACE", { race: "White" })).toBe("White");
      expect(getValueFromRow("CANCER", { classUri: "CancerA" })).toBe("CancerA");
    });

    it("supports case-insensitive attribute matching", () => {
      expect(getValueFromRow("age_at_dx", { age: "55" })).toBe("55");
    });

    it("falls back to generic value-like fields", () => {
      expect(getValueFromRow("UNKNOWN", { value: "X" })).toBe("X");
      expect(getValueFromRow("UNKNOWN", { label: "Y" })).toBe("Y");
      expect(getValueFromRow("UNKNOWN", { name: "Z" })).toBe("Z");
    });

    it("returns undefined for null/empty/whitespace values", () => {
      expect(getValueFromRow("UNKNOWN", { value: "" })).toBeUndefined();
      expect(getValueFromRow("UNKNOWN", { value: "   " })).toBeUndefined();
      expect(getValueFromRow("UNKNOWN", { value: null })).toBeUndefined();
      expect(getValueFromRow("UNKNOWN", { value: undefined })).toBeUndefined();
    });
  });

  describe("getCountFromRow", () => {
    it("uses known count fields", () => {
      expect(getCountFromRow({ count: 10 })).toBe(10);
      expect(getCountFromRow({ patient_count: 11 })).toBe(11);
      expect(getCountFromRow({ patientCount: 12 })).toBe(12);
      expect(getCountFromRow({ num_patients: 13 })).toBe(13);
      expect(getCountFromRow({ frequency: 14 })).toBe(14);
    });

    it("parses numeric strings", () => {
      expect(getCountFromRow({ count: "42" })).toBe(42);
    });

    it("handles zero and negative values", () => {
      expect(getCountFromRow({ count: 0 })).toBe(0);
      expect(getCountFromRow({ count: -7 })).toBe(-7);
    });

    it("falls back to patient_ids cardinality", () => {
      expect(getCountFromRow({ patient_ids: ["a", "b", "c"] })).toBe(3);
      expect(getCountFromRow({ patient_ids: "a, b, c" })).toBe(3);
      expect(getCountFromRow({ patient_ids: "a, , b  , c " })).toBe(3);
    });

    it("defaults to 1 when count cannot be resolved", () => {
      expect(getCountFromRow({ count: "abc" })).toBe(1);
      expect(getCountFromRow({})).toBe(1);
    });
  });

  describe("summarizeInstances", () => {
    it("returns empty array for empty payload", () => {
      expect(summarizeInstances("RACE", [])).toEqual([]);
      expect(summarizeInstances("RACE", { rows: [] })).toEqual([]);
      expect(summarizeInstances("RACE", { data: [] })).toEqual([]);
    });

    it("aggregates counts by value", () => {
      const payload = [
        { race: "White", count: 2 },
        { race: "White", count: 3 },
        { race: "Black", count: 1 },
      ];
      expect(summarizeInstances("RACE", payload)).toEqual([
        { value: "White", count: 5 },
        { value: "Black", count: 1 },
      ]);
    });

    it("skips rows without valid values", () => {
      const payload = [
        { race: "", count: 2 },
        { count: 3 },
        { race: "Asian", count: 1 },
      ];
      expect(summarizeInstances("RACE", payload)).toEqual([{ value: "Asian", count: 1 }]);
    });

    it("sorts by count desc then value asc", () => {
      const payload = [
        { value: "Beta", count: 5 },
        { value: "Alpha", count: 5 },
        { value: "Gamma", count: 2 },
      ];
      expect(summarizeInstances("UNKNOWN", payload)).toEqual([
        { value: "Alpha", count: 5 },
        { value: "Beta", count: 5 },
        { value: "Gamma", count: 2 },
      ]);
    });
  });

  describe("getAgeDecileLabel", () => {
    it("maps plain ages to deciles", () => {
      expect(getAgeDecileLabel(5)).toBe("0-9");
      expect(getAgeDecileLabel(15)).toBe("10-19");
      expect(getAgeDecileLabel(35)).toBe("30-39");
      expect(getAgeDecileLabel(95)).toBe("90+");
    });

    it("maps range and plus formats", () => {
      expect(getAgeDecileLabel("30-39")).toBe("30-39");
      expect(getAgeDecileLabel("60-69")).toBe("60-69");
      expect(getAgeDecileLabel("90+")).toBe("90+");
      expect(getAgeDecileLabel("80+")).toBe("80-89");
    });

    it("handles boundaries", () => {
      expect(getAgeDecileLabel(0)).toBe("0-9");
      expect(getAgeDecileLabel(9)).toBe("0-9");
      expect(getAgeDecileLabel(10)).toBe("10-19");
      expect(getAgeDecileLabel(89)).toBe("80-89");
      expect(getAgeDecileLabel(90)).toBe("90+");
      expect(getAgeDecileLabel(99)).toBe("90+");
    });

    it("extracts first number in free text", () => {
      expect(getAgeDecileLabel("Age: 45")).toBe("40-49");
    });

    it("returns undefined for invalid inputs", () => {
      expect(getAgeDecileLabel(null)).toBeUndefined();
      expect(getAgeDecileLabel(undefined)).toBeUndefined();
      expect(getAgeDecileLabel("")).toBeUndefined();
      expect(getAgeDecileLabel("abc")).toBeUndefined();
    });
  });

  describe("getAgeDecileDistribution", () => {
    it("returns all deciles with zero counts for empty summary", () => {
      const result = getAgeDecileDistribution([]);
      expect(result).toHaveLength(10);
      expect(result.map((item) => item.label)).toEqual(AGE_DECILE_LABELS);
      expect(result.every((item) => item.count === 0)).toBe(true);
    });

    it("aggregates counts across deciles", () => {
      const summary = [
        { value: "5", count: 2 },
        { value: "8", count: 3 },
        { value: "15", count: 4 },
        { value: "90+", count: 1 },
      ];
      const result = getAgeDecileDistribution(summary);
      const lookup = Object.fromEntries(result.map((item) => [item.label, item.count]));

      expect(lookup["0-9"]).toBe(5);
      expect(lookup["10-19"]).toBe(4);
      expect(lookup["90+"]).toBe(1);
    });

    it("ignores invalid ages and non-finite counts", () => {
      const summary = [
        { value: "abc", count: 100 },
        { value: "40", count: NaN },
        { value: "41", count: 2 },
      ];
      const result = getAgeDecileDistribution(summary);
      const lookup = Object.fromEntries(result.map((item) => [item.label, item.count]));
      expect(lookup["40-49"]).toBe(2);
    });
  });

  describe("getCategoryDistribution", () => {
    it("maps summary rows into label/count rows", () => {
      expect(
        getCategoryDistribution([
          { value: "A", count: 2 },
          { value: "B", count: "3" },
        ])
      ).toEqual([
        { label: "A", count: 2 },
        { label: "B", count: 3 },
      ]);
    });

    it("filters empty labels and defaults missing counts to 0", () => {
      expect(
        getCategoryDistribution([
          { value: "", count: 3 },
          { count: 4 },
          { value: "C" },
        ])
      ).toEqual([{ label: "C", count: 0 }]);
    });
  });

  describe("getSummaryTotalCount", () => {
    it("returns 0 for empty summary", () => {
      expect(getSummaryTotalCount([])).toBe(0);
    });

    it("sums all valid numeric counts", () => {
      expect(getSummaryTotalCount([{ count: 1 }, { count: "2" }, { count: 3 }])).toBe(6);
    });

    it("treats invalid counts as 0", () => {
      expect(getSummaryTotalCount([{ count: "abc" }, { count: NaN }, { count: 5 }])).toBe(5);
    });
  });

  describe("sortDistributionAlphanumerically", () => {
    it("sorts numeric labels naturally", () => {
      const input = [
        { label: "10", count: 1 },
        { label: "2", count: 1 },
        { label: "1", count: 1 },
      ];
      expect(sortDistributionAlphanumerically(input).map((item) => item.label)).toEqual([
        "1",
        "2",
        "10",
      ]);
    });

    it("sorts alpha and mixed labels case-insensitively", () => {
      const input = [
        { label: "cancer10", count: 1 },
        { label: "Cancer2", count: 1 },
        { label: "Cancer1", count: 1 },
      ];
      expect(sortDistributionAlphanumerically(input).map((item) => item.label)).toEqual([
        "Cancer1",
        "Cancer2",
        "cancer10",
      ]);
    });

    it("does not mutate the original array", () => {
      const input = [{ label: "B", count: 1 }, { label: "A", count: 1 }];
      const clone = [...input];
      sortDistributionAlphanumerically(input);
      expect(input).toEqual(clone);
    });
  });

  describe("getAnchorId", () => {
    it("builds normalized anchor ids", () => {
      expect(getAnchorId("omop", "Gender")).toBe("omop-gender");
      expect(getAnchorId("section", "Age@Dx")).toBe("section-age-dx");
      expect(getAnchorId("sec", "Multi  Space")).toBe("sec-multi-space");
    });

    it("removes leading/trailing separators", () => {
      expect(getAnchorId("sec", " --Value-- ")).toBe("sec-value");
    });

    it("falls back to item for missing value", () => {
      expect(getAnchorId("section", "")).toBe("section-item");
      expect(getAnchorId(null, "")).toBe("-item");
    });
  });
});
