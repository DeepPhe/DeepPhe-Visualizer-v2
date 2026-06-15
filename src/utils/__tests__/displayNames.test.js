import { buildAttributeDisplayMap, buildOmopDisplayMap, buildSummary, toDisplayName } from "../displayNames";

describe("toDisplayName — explicit overrides", () => {
  it("resolves context-sensitive demographic codes by source", () => {
    expect(toDisplayName("F", "gender")).toBe("Female");
    expect(toDisplayName("M", "gender")).toBe("Male");
    expect(toDisplayName("M", "cancer")).toBe("Melanoma");
    expect(toDisplayName("B", "cancer")).toBe("Breast");
    expect(toDisplayName("O", "cancer")).toBe("Ovarian Cancer");
  });

  it("falls back to the first override value when no source matches", () => {
    // 'M' maps to { gender: 'Male', cancer: 'Melanoma' }; first value wins.
    expect(toDisplayName("M")).toBe("Male");
  });

  it("uses clinician-standard receptor shorthand", () => {
    expect(toDisplayName("EstrogenReceptorPositive")).toBe("ER+");
    expect(toDisplayName("HER2_sl_NeuPositive")).toBe("HER2+");
    expect(toDisplayName("MicrosatelliteInstabilityHigh")).toBe("MSI-High");
  });

  it("expands behavior and grade overrides", () => {
    expect(toDisplayName("InSitu")).toBe("In Situ");
    expect(toDisplayName("WellDifferentiated")).toBe("Well Differentiated");
    expect(toDisplayName("Grade2_sl_3")).toBe("Grade 2/3");
  });
});

describe("toDisplayName — pattern handlers", () => {
  it("formats clockface positions", () => {
    expect(toDisplayName("n_2O_qt_clockPosition")).toBe("2 o'clock");
    expect(toDisplayName("n_2_dot_30O_qt_clockPosition")).toBe("2:30 o'clock");
  });

  it("formats overall stage URIs", () => {
    expect(toDisplayName("StageIIA")).toBe("Stage IIA");
    expect(toDisplayName("StageIV")).toBe("Stage IV");
  });

  it("formats TNM stage findings, including pathologic prefixes and encoded parentheses", () => {
    expect(toDisplayName("N1aStageFinding")).toBe("N1a");
    expect(toDisplayName("PT1aStageFinding")).toBe("pT1a");
    expect(toDisplayName("N0_lpn_i_add__rpn_StageFinding")).toBe("N0(i+)");
  });

  it("formats numeric grades only when the source identifies a grade facet", () => {
    expect(toDisplayName("Grade3a", "Grade_Numeric")).toBe("Grade 3a");
  });
});

describe("toDisplayName — camelCase / URI fallback", () => {
  it("splits camelCase labels into words", () => {
    expect(toDisplayName("AxillaryLymphNode")).toBe("Axillary Lymph Node");
    expect(toDisplayName("InvasiveBreastCarcinomaOfNoSpecialType")).toBe(
      "Invasive Breast Carcinoma Of No Special Type"
    );
  });

  it("keeps leading acronyms together", () => {
    expect(toDisplayName("ABVDRegimen")).toBe("ABVD Regimen");
  });

  it("converts leftover underscores to hyphens", () => {
    expect(toDisplayName("Intra_Abdominal")).toBe("Intra-Abdominal");
  });

  it("returns an empty string for nullish or empty input", () => {
    expect(toDisplayName("")).toBe("");
    expect(toDisplayName(null)).toBe("");
    expect(toDisplayName(undefined)).toBe("");
  });
});

describe("display map builders", () => {
  it("buildAttributeDisplayMap keys by attribute/classUri and de-duplicates", () => {
    const map = buildAttributeDisplayMap([
      { attribute_name: "Behavior", classUri: "InSitu" },
      { attribute_name: "Behavior", classUri: "InSitu" },
    ]);

    expect(map.size).toBe(1);
    expect(map.get("Behavior::InSitu").displayName).toBe("In Situ");
  });

  it("buildOmopDisplayMap resolves source-specific labels", () => {
    const map = buildOmopDisplayMap([
      { source: "gender", label: "F" },
      { source: "cancer", label: "B" },
    ]);

    expect(map.get("gender::F").displayName).toBe("Female");
    expect(map.get("cancer::B").displayName).toBe("Breast");
  });
});

describe("buildSummary", () => {
  it("builds a natural-language cohort sentence with gender, cancer, and stage", () => {
    const summary = buildSummary(122, { gender: ["F"], cancer: ["B"], Stage: ["StageI"] });
    expect(summary).toBe("122 female patients with breast, and Stage I");
  });

  it("uses singular 'patient' for a cohort of one", () => {
    expect(buildSummary(1, { gender: ["M"] })).toBe("1 male patient");
  });

  it("omits the gender adjective when none is selected", () => {
    expect(buildSummary(42, {})).toBe("42 patients");
  });

  it("includes other attribute facets in the 'with' clause", () => {
    const summary = buildSummary(5, { "Lymph Involvement": ["AxillaryLymphNode"] });
    expect(summary).toBe("5 patients with axillary lymph node");
  });
});
