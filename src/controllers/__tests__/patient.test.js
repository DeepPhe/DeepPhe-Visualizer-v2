import {
  loadPatientProfile,
  loadRandomPatientId,
  loadViz2PatientOptions,
  loadViz2PatientProfile,
} from "../patient";
import {
  fetchAttributesSummary,
  fetchCancersSummary,
  fetchConceptsSummary,
  fetchOmopSummary,
  fetchPatient,
  fetchPatientCancers,
  fetchPatientConcepts,
  fetchPatientDocuments,
} from "../../clients/deepphe-data-api";

jest.mock("../../clients/deepphe-data-api", () => ({
  fetchAttributesSummary: jest.fn(),
  fetchCancersSummary: jest.fn(),
  fetchConceptsSummary: jest.fn(),
  fetchOmopSummary: jest.fn(),
  fetchPatient: jest.fn(),
  fetchPatientCancers: jest.fn(),
  fetchPatientConcepts: jest.fn(),
  fetchPatientDocuments: jest.fn(),
}));

describe("loadPatientProfile", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("hydrates cancers and concepts from patient sub-resource endpoints", async () => {
    fetchPatient.mockResolvedValueOnce([
      {
        id: "patient-1",
        name: "patient-1",
        mentions: [],
        mentionRelations: [],
      },
      {
        id: "doc-1",
        name: "Document 1",
        type: "Clinical Note",
        date: "202501010900",
        episode: "Diagnostic",
        mentions: [{ id: "mention-1", begin: 0, end: 4 }],
        mentionRelations: [],
      },
    ]);

    fetchPatientDocuments.mockResolvedValueOnce([
      {
        id: "doc-1",
        name: "Document 1",
        type: "Clinical Note",
        date: "202501010900",
        episode: "Diagnostic",
        text: "Sample report text",
        mentions: [{ id: "mention-1", begin: 0, end: 4 }],
        mentionRelations: [],
      },
    ]);

    fetchPatientCancers.mockResolvedValueOnce([
      {
        id: "cancer-1",
        classUri: "Melanoma",
        attributes: [
          {
            name: "Location",
            id: "attr-1",
            values: [
              {
                id: "fact-1",
                classUri: "Skin",
                value: "Skin",
                conceptIds: ["concept-1"],
              },
            ],
          },
        ],
        tumors: [
          {
            id: "tumor-1",
            attributes: [
              {
                name: "Histology",
                id: "tumor-attr-1",
                values: [{ id: "tumor-fact-1", classUri: "Melanoma", value: "Melanoma" }],
              },
            ],
          },
        ],
      },
    ]);

    fetchPatientConcepts.mockResolvedValueOnce({
      concepts: [
        {
          id: "concept-1",
          classUri: "Melanoma",
          mentionIds: ["mention-1"],
          dpheGroup: "Neoplasm",
        },
      ],
      conceptRelations: [
        {
          type: "hasFinding",
          sourceId: "concept-1",
          targetId: "concept-2",
        },
      ],
    });

    const profile = await loadPatientProfile("patient-1");

    expect(fetchPatient).toHaveBeenCalledWith("patient-1");
    expect(fetchPatientDocuments).toHaveBeenCalledWith("patient-1", {
      documentIds: undefined,
      excludeProperties: undefined,
    });
    expect(fetchPatientCancers).toHaveBeenCalledWith("patient-1");
    expect(fetchPatientConcepts).toHaveBeenCalledWith("patient-1");

    expect(profile.patientId).toBe("patient-1");
    expect(profile.documents).toHaveLength(1);
    expect(profile.cancers).toHaveLength(1);
    expect(profile.cancers[0].tumors).toHaveLength(1);
    expect(profile.concepts).toHaveLength(1);
    expect(profile.conceptRelations).toHaveLength(1);
  });
});

describe("loadRandomPatientId", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("returns a random patient ID aggregated from summary endpoints", async () => {
    fetchAttributesSummary.mockResolvedValueOnce({
      classes: ["Behavior"],
      instancesByClass: {
        Behavior: [
          { classUri: "B1", patient_ids: ["P-1", "P-2"] },
          { classUri: "B2", patient_ids: ["P-3"] },
        ],
      },
    });
    fetchCancersSummary.mockResolvedValueOnce({
      classes: ["Melanoma"],
      instancesByClass: {
        Melanoma: [{ classUri: "Melanoma", patient_ids: ["P-2", "P-4"] }],
      },
    });
    fetchConceptsSummary.mockResolvedValueOnce({
      classes: ["ConceptA"],
      instancesByClass: {
        ConceptA: [{ classUri: "ConceptA", patient_ids: ["P-5"] }],
      },
    });
    fetchOmopSummary.mockResolvedValueOnce({
      classes: ["GENDER"],
      instancesByClass: {
        GENDER: [{ gender: "Female", patient_ids: ["P-6"] }],
      },
    });

    const mathRandomSpy = jest.spyOn(Math, "random").mockReturnValueOnce(0.62);
    const patientId = await loadRandomPatientId();
    mathRandomSpy.mockRestore();

    expect(fetchAttributesSummary).toHaveBeenCalledWith({ includePatientIds: true });
    expect(fetchCancersSummary).toHaveBeenCalledWith({ includePatientIds: true });
    expect(fetchConceptsSummary).toHaveBeenCalledWith({ includePatientIds: true });
    expect(fetchOmopSummary).toHaveBeenCalledWith({ includePatientIds: true });

    expect(["P-1", "P-2", "P-3", "P-4", "P-5", "P-6"]).toContain(patientId);
  });

  test("throws when no patient IDs are available", async () => {
    fetchAttributesSummary.mockResolvedValueOnce({ classes: [], instancesByClass: {} });
    fetchCancersSummary.mockResolvedValueOnce({ classes: [], instancesByClass: {} });
    fetchConceptsSummary.mockResolvedValueOnce({ classes: [], instancesByClass: {} });
    fetchOmopSummary.mockResolvedValueOnce({ classes: [], instancesByClass: {} });

    await expect(loadRandomPatientId()).rejects.toThrow(
      "No patient IDs were available for random selection."
    );
  });
});

describe("Viz2 local docs loaders", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  test("loads Viz2 patient options from the generated index file", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "fake_patient2", label: "Fake_patient_2" }],
    });

    const options = await loadViz2PatientOptions();

    expect(global.fetch).toHaveBeenCalledWith("/docs/viz2/index.json", {
      headers: { Accept: "application/json" },
    });
    expect(options).toEqual([{ id: "fake_patient2", label: "Fake_patient_2" }]);
  });

  test("falls back to default Viz2 patient options when the index is unavailable", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("network down"));

    const options = await loadViz2PatientOptions();

    expect(options.map((option) => option.id)).toEqual(
      expect.arrayContaining(["fake_patient1", "fake_patient7", "patientX"])
    );
  });

  test("loads and normalizes a Viz2 patient payload", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "fake_patient2",
        name: "fake_patient2",
        documents: [
          {
            id: "doc-1",
            name: "Document 1",
            type: "Clinical Note",
            date: "202501010900",
            episode: "Diagnostic",
            text: "Sample report text",
            mentions: [],
            mentionRelations: [],
          },
        ],
        concepts: [{ id: "concept-1", classUri: "Melanoma", mentionIds: [] }],
        conceptRelations: [{ type: "relatedTo", sourceId: "concept-1", targetId: "concept-2" }],
        cancers: [{ id: "cancer-1", classUri: "Melanoma", tumors: [], attributes: [] }],
      }),
    });

    const profile = await loadViz2PatientProfile("fake_patient2");

    expect(global.fetch).toHaveBeenCalledWith("/docs/viz2/fake_patient2.json", {
      headers: { Accept: "application/json" },
    });
    expect(profile.patientId).toBe("fake_patient2");
    expect(profile.documents).toHaveLength(1);
    expect(profile.cancers).toHaveLength(1);
    expect(profile.concepts).toHaveLength(1);
    expect(profile.conceptRelations).toHaveLength(1);
  });
});
