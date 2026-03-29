import {
  FILTER_ENTRY_BY_TYPE_CLASS,
  getFilterSetsForType,
  getOrderedClassesByType,
  resolveFilterSetsWithExtras,
} from "../filterSets";

describe("filterSets", () => {
  it("returns configured ordered classes by type", () => {
    expect(getOrderedClassesByType("omop")).toEqual([
      "AGE_AT_DX",
      "RACE",
      "GENDER",
      "ETHNICITY",
      "CANCER",
    ]);

    expect(getOrderedClassesByType("attributes")).toEqual([
      "Stage",
      "T Stage",
      "N Stage",
      "M Stage",
      "Lymph Involvement",
    ]);
  });

  it("resolves configured sets and appends uncategorized API classes", () => {
    const resolvedSets = resolveFilterSetsWithExtras(
      ["Behavior", "T Stage", "Grade_Numeric", "Novel Class"],
      "attributes"
    );

    expect(resolvedSets.map((set) => set.label)).toEqual(["Staging", "Uncategorized"]);
    expect(resolvedSets[0].filters.map((filter) => filter.key)).toEqual(["T Stage"]);
    expect(resolvedSets[1].filters.map((filter) => filter.key)).toEqual(["Novel Class"]);
  });

  it("matches configured classes by normalized key and preserves API class strings", () => {
    const resolvedSets = resolveFilterSetsWithExtras(["grade numeric", "n stage"], "attributes");

    expect(resolvedSets.map((set) => set.label)).toEqual(["Staging"]);
    expect(resolvedSets[0].filters.map((filter) => filter.key)).toEqual(["n stage"]);
  });

  it("provides a flat lookup map keyed by type:class", () => {
    expect(FILTER_ENTRY_BY_TYPE_CLASS.get("omop:AGE_AT_DX")).toMatchObject({
      type: "omop",
      key: "AGE_AT_DX",
      specialBehavior: "ageDecile",
      enabled: true,
    });
    expect(FILTER_ENTRY_BY_TYPE_CLASS.get("attributes:T Stage")).toMatchObject({
      type: "attributes",
      key: "T Stage",
      hasRollup: true,
      enabled: true,
    });
  });

  it("returns only sets for the requested type", () => {
    const omopSets = getFilterSetsForType("omop");
    const attributeSets = getFilterSetsForType("attributes");

    expect(omopSets.every((set) => set.filters.every((filter) => filter.type === "omop"))).toBe(
      true
    );
    expect(
      attributeSets.every((set) => set.filters.every((filter) => filter.type === "attributes"))
    ).toBe(true);
  });
});
