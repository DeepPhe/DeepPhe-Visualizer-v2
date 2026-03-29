import { buildPatientSummary } from "../patientSummary";

describe("buildPatientSummary", () => {
  it("builds an oncologist-friendly snapshot with relation metadata", () => {
    const summary = buildPatientSummary({
      patientId: "TEST_PATIENT_ALPHA",
      documents: [
        {
          id: "doc-1",
          mentions: [
            {
              id: "m-dx-1",
              classUri: "BasalCellCarcinoma",
              confidence: 0.92,
              negated: false,
              uncertain: true,
            },
            { id: "m-site-1", classUri: "Breast", confidence: 0.95, negated: false, uncertain: false },
            { id: "m-lat-1", classUri: "Left", confidence: 0.99, negated: false, uncertain: false },
            {
              id: "m-tx-1",
              classUri: "Cisplatin_sl_Cyclophosphamide_sl_Doxorubicin",
              confidence: 1,
              negated: false,
              uncertain: false,
            },
            { id: "m-stage-1", classUri: "PT1sStageFinding", confidence: 0.8, negated: false, uncertain: false },
            { id: "m-find-1", classUri: "InSitu", confidence: 0.8, negated: false, uncertain: false },
            { id: "m-neg-dx", classUri: "MalignantNeoplasm", confidence: 0.9, negated: true, uncertain: false },
          ],
          mentionRelations: [
            { fromId: "m-dx-1", toId: "m-site-1", relation: "hasAssociatedSite" },
            { fromId: "m-dx-1", toId: "m-lat-1", relation: "hasLaterality" },
            { fromId: "m-dx-1", toId: "m-tx-1", relation: "hasTreatment" },
          ],
        },
        {
          id: "doc-2",
          mentions: [
            { id: "m-dx-2", classUri: "BasalCellCarcinoma", confidence: 90, negated: false, uncertain: false },
            { id: "m-proc-1", classUri: "Mastectomy", confidence: 0.95, negated: false, uncertain: false },
          ],
          mentionRelations: [],
        },
      ],
    });

    expect(summary.patientId).toBe("TEST_PATIENT_ALPHA");
    expect(summary.docCount).toBe(2);
    expect(summary.activeDx).toEqual([
      {
        name: "Basal Cell Carcinoma",
        site: "Breast",
        laterality: "L",
        uncertain: true,
        docFreq: 2,
      },
    ]);
    expect(summary.negatedDx).toEqual([{ name: "Malignant Neoplasm" }]);
    expect(summary.staging).toEqual([{ name: "pT1s" }]);
    expect(summary.treatments).toEqual([
      {
        name: "Cisplatin / Cyclophosphamide / Doxorubicin (CAP)",
        docFreq: 1,
      },
    ]);
    expect(summary.procedures).toEqual([{ name: "Mastectomy", docFreq: 1 }]);
    expect(summary.activeFindings).toEqual([{ name: "In Situ" }]);
    expect(summary.negatedFindings).toEqual([]);
  });

  it("drops low-confidence and unmatched mentions", () => {
    const summary = buildPatientSummary({
      patientId: "TEST_PATIENT_BRAVO",
      documents: [
        {
          id: "doc-1",
          mentions: [
            { id: "m-low", classUri: "BasalCellCarcinoma", confidence: 0.4, negated: false, uncertain: false },
            { id: "m-unknown", classUri: "UnknownThing", confidence: 0.9, negated: false, uncertain: false },
          ],
          mentionRelations: [],
        },
      ],
    });

    expect(summary.activeDx).toEqual([]);
    expect(summary.staging).toEqual([]);
    expect(summary.biomarkers).toEqual([]);
    expect(summary.procedures).toEqual([]);
    expect(summary.treatments).toEqual([]);
    expect(summary.activeFindings).toEqual([]);
    expect(summary.negatedFindings).toEqual([]);
  });
});
