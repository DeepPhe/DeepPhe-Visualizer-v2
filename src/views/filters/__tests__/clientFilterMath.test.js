import {
  buildPatientIdIndex,
  computeFilterPatientSet,
  indexCoversFilters,
} from "../clientFilterMath";

function buildSampleIndex() {
  return buildPatientIdIndex([
    {
      type: "omop",
      summaryByClass: {
        Gender: [
          { value: "female", patientIds: ["p1", "p2", "p3", "p5"] },
          { value: "male", patientIds: ["p4"] },
        ],
        Race: [
          { value: "white", patientIds: ["p1", "p2", "p4"] },
          { value: "black", patientIds: ["p3"] },
          { value: "asian", patientIds: ["p5"] },
        ],
      },
    },
    {
      type: "attributes",
      summaryByClass: {
        Stage: [
          { value: "Stage I", patientIds: ["p1"] },
          { value: "Stage II", patientIds: ["p2", "p3"] },
          { value: "Stage III", patientIds: ["p4", "p5"] },
        ],
      },
    },
  ]);
}

describe("buildPatientIdIndex", () => {
  it("keys instances by class and normalizes patient ids into sets", () => {
    const index = buildSampleIndex();
    expect(index.get("omop:Gender").get("female")).toEqual(new Set(["p1", "p2", "p3", "p5"]));
    expect(index.get("attributes:Stage").get("Stage II")).toEqual(new Set(["p2", "p3"]));
  });

  it("trims instance keys and patient ids and skips rows without patient ids", () => {
    const index = buildPatientIdIndex([
      {
        type: "omop",
        summaryByClass: {
          Gender: [
            { value: "  female  ", patientIds: [" p1 ", "p2"] },
            { value: "male", patientIds: [] },
            { value: "", patientIds: ["p9"] },
          ],
        },
      },
    ]);
    expect(index.get("omop:Gender").get("female")).toEqual(new Set(["p1", "p2"]));
    expect(index.get("omop:Gender").has("male")).toBe(false);
    expect(index.get("omop:Gender").has("")).toBe(false);
  });
});

describe("computeFilterPatientSet", () => {
  it("returns the patients of a single instance", () => {
    const index = buildSampleIndex();
    const result = computeFilterPatientSet(
      [{ type: "omop", class: "Race", instances: ["black"] }],
      index
    );
    expect(result).toEqual(new Set(["p3"]));
  });

  it("unions instances within a class (OR)", () => {
    const index = buildSampleIndex();
    const result = computeFilterPatientSet(
      [{ type: "omop", class: "Race", instances: ["black", "asian"] }],
      index
    );
    expect(result).toEqual(new Set(["p3", "p5"]));
  });

  it("intersects across classes (AND)", () => {
    const index = buildSampleIndex();
    // female = {p1,p2,p3,p5}; white = {p1,p2,p4} -> {p1,p2}
    const result = computeFilterPatientSet(
      [
        { type: "omop", class: "Gender", instances: ["female"] },
        { type: "omop", class: "Race", instances: ["white"] },
      ],
      index
    );
    expect(result).toEqual(new Set(["p1", "p2"]));
  });

  it("mirrors a numerator query: selection AND a candidate row", () => {
    const index = buildSampleIndex();
    // Selection: Gender=female {p1,p2,p3,p5}. Candidate row: Stage=Stage III {p4,p5}.
    // Numerator = intersection = {p5} -> size 1 (non-zero, so the row stays enabled).
    const result = computeFilterPatientSet(
      [
        { type: "omop", class: "Gender", instances: ["female"] },
        { type: "attributes", class: "Stage", instances: ["Stage III"] },
      ],
      index
    );
    expect(result).toEqual(new Set(["p5"]));
    expect(result.size).toBe(1);
  });

  it("yields an empty set (numerator 0 -> row disabled) when there is no overlap", () => {
    const index = buildSampleIndex();
    // Gender=male {p4}; Stage=Stage II {p2,p3} -> no overlap.
    const result = computeFilterPatientSet(
      [
        { type: "omop", class: "Gender", instances: ["male"] },
        { type: "attributes", class: "Stage", instances: ["Stage II"] },
      ],
      index
    );
    expect(result.size).toBe(0);
  });

  it("returns null when a filter references an unindexed class (forces server fallback)", () => {
    const index = buildSampleIndex();
    const result = computeFilterPatientSet(
      [{ type: "concepts", class: "Behavior", instances: ["Invasive"] }],
      index
    );
    expect(result).toBeNull();
  });

  it("returns null when the index is missing", () => {
    expect(computeFilterPatientSet([{ type: "omop", class: "Gender", instances: ["female"] }], null)).toBeNull();
  });
});

describe("indexCoversFilters", () => {
  it("is true only when every filter class is indexed", () => {
    const index = buildSampleIndex();
    expect(
      indexCoversFilters(index, [
        { type: "omop", class: "Gender", instances: ["female"] },
        { type: "attributes", class: "Stage", instances: ["Stage I"] },
      ])
    ).toBe(true);
    expect(
      indexCoversFilters(index, [{ type: "concepts", class: "Behavior", instances: ["Invasive"] }])
    ).toBe(false);
  });
});
