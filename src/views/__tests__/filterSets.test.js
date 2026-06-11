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
      "Location",
      "Topography, major",
      "Organ System",
      "Histology",
      "Tissue",
      "Mass",
      "Topography, minor",
      "Quadrant",
      "Clockface",
      "Laterality",
      "Side",
      "Spatial Qualifier",
      "Stage",
      "Disease Stage Qualifier",
      "T Stage",
      "N Stage",
      "M Stage",
      "Lymph Involvement",
      "Metastatic Site",
      "Behavior",
      "Grade",
      "Grade_Numeric",
      "Grade_Differentiated",
      "Grade_Tiered",
      "Grade_Gleason",
      "Test Results",
      "HER2/Neu Status",
      "Estrogen Receptor Status",
      "Progesterone Receptor Status",
      "Receptor Status",
      "Microsatellite Stable",
      "Breast Cancer Type 1 Susceptibility Protein",
      "Breast Cancer Type 2 Susceptibility Protein",
      "Genes",
      "Performance Status",
      "Course",
      "Comorbidities",
      "Treatments",
      "Procedures",
      "Diagnostic Procedures",
      "Diagnostic Procedure",
      "Therapeutic Procedures/Surgery",
      "Therapeutic Procedures",
      "Surgery",
    ]);
  });

  it("resolves configured sets and appends uncategorized API classes", () => {
    const resolvedSets = resolveFilterSetsWithExtras(
      ["Behavior", "T Stage", "Grade_Numeric", "Novel Class"],
      "attributes"
    );

    expect(resolvedSets.map((set) => set.label)).toEqual([
      "Staging & Disease Extent",
      "Pathology & Grade",
      "Uncategorized",
    ]);
    expect(resolvedSets[0].filters.map((filter) => filter.key)).toEqual(["T Stage", "Behavior"]);
    expect(resolvedSets[1].filters.map((filter) => filter.key)).toEqual(["Grade_Numeric"]);
    expect(resolvedSets[2].filters.map((filter) => filter.key)).toEqual(["Novel Class"]);
  });

  it("matches configured classes by normalized key and preserves API class strings", () => {
    const resolvedSets = resolveFilterSetsWithExtras(["grade numeric", "n stage"], "attributes");

    expect(resolvedSets.map((set) => set.label)).toEqual([
      "Staging & Disease Extent",
      "Pathology & Grade",
    ]);
    expect(resolvedSets[0].filters.map((filter) => filter.key)).toEqual(["n stage"]);
    expect(resolvedSets[1].filters.map((filter) => filter.key)).toEqual(["grade numeric"]);
  });

  it("maps topography classes with comma delimiters into primary-site and tumor-anatomy", () => {
    const resolvedSets = resolveFilterSetsWithExtras(
      ["Topography, major", "Topography, minor"],
      "attributes"
    );

    expect(resolvedSets.map((set) => set.label)).toEqual([
      "Cancer Type & Primary Site",
      "Tumor Anatomy",
    ]);
    expect(resolvedSets[0].filters.map((filter) => filter.key)).toEqual([
      "Topography, major",
    ]);
    expect(resolvedSets[1].filters.map((filter) => filter.key)).toEqual(["Topography, minor"]);
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

    expect(resolvedSets.map((set) => set.label)).toEqual(["Staging & Disease Extent", "Uncategorized"]);
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

  it("preserves configured row grouping metadata", () => {
    const omopSets = getFilterSetsForType("omop");
    const demographicsSet = omopSets.find((set) => set.id === "demographics");
    const cancerTypeSet = omopSets.find((set) => set.id === "cancer-type");
    const attributeSets = getFilterSetsForType("attributes");
    const clinicalStatusSet = attributeSets.find(
      (set) => set.id === "clinical-status"
    );

    expect(demographicsSet?.row).toBe("cohort-overview");
    expect(cancerTypeSet?.row).toBe("cohort-overview");
    expect(clinicalStatusSet?.row).toBe("clinical-treatment");
  });
});
