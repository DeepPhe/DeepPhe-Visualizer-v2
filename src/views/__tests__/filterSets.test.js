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
      "Grade_Numeric",
      "Grade_Differentiated",
      "Grade_Tiered",
      "Grade_Gleason",
    ]);
  });

  it("resolves configured sets and appends uncategorized API classes", () => {
    const resolvedSets = resolveFilterSetsWithExtras(
      ["Behavior", "T Stage", "Grade_Numeric", "Novel Class"],
      "attributes"
    );

    expect(resolvedSets.map((set) => set.label)).toEqual(["Staging", "Grading", "Uncategorized"]);
    expect(resolvedSets[0].filters.map((filter) => filter.key)).toEqual(["T Stage"]);
    expect(resolvedSets[1].filters.map((filter) => filter.key)).toEqual(["Grade_Numeric"]);
    expect(resolvedSets[2].filters.map((filter) => filter.key)).toEqual(["Novel Class"]);
  });

  it("matches configured classes by normalized key and preserves API class strings", () => {
    const resolvedSets = resolveFilterSetsWithExtras(["grade numeric", "n stage"], "attributes");

    expect(resolvedSets.map((set) => set.label)).toEqual(["Staging", "Grading"]);
    expect(resolvedSets[0].filters.map((filter) => filter.key)).toEqual(["n stage"]);
    expect(resolvedSets[1].filters.map((filter) => filter.key)).toEqual(["grade numeric"]);
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
    expect(FILTER_ENTRY_BY_TYPE_CLASS.get("attributes:Lymph Involvement")).toMatchObject({
      type: "attributes",
      key: "Lymph Involvement",
      maxHeightPx: 300,
      enabled: true,
    });
  });

  it("passes maxHeightPx through configured set resolution and defaults to undefined otherwise", () => {
    const resolvedSets = resolveFilterSetsWithExtras(
      ["lymph involvement", "novel class"],
      "attributes"
    );

    expect(resolvedSets.map((set) => set.label)).toEqual(["Staging", "Uncategorized"]);
    expect(resolvedSets[0].filters[0]).toMatchObject({
      key: "lymph involvement",
      maxHeightPx: 300,
    });
    expect(resolvedSets[1].filters[0].maxHeightPx).toBeUndefined();
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
