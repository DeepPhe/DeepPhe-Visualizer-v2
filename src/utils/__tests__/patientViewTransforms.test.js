import { transformCancerSummary } from "../patientView/transformCancerSummary";
import { transformDocumentTimeline } from "../patientView/transformDocumentTimeline";
import { resolveFactSelection } from "../patientView/factLinking";
import { normalizePatientPayload } from "../patientView/normalizePatientPayload";
import { buildTimelineChartModel } from "../patientView/timelineChartLayout";

describe("patient view transforms", () => {
  test("transformCancerSummary keeps collated facts, tumors, and TNM values", () => {
    const cancers = [
      {
        id: "cancer-1",
        attributes: [
          {
            name: "Location",
            values: [{ id: "fact-1", value: "Lung", classUri: "Lung" }],
          },
          {
            name: "T Stage",
            values: [{ id: "fact-tnm-t", value: "T2", classUri: "T2StageFinding" }],
          },
          {
            name: "N Stage",
            values: [{ id: "fact-tnm-n", value: "N1", classUri: "N1StageFinding" }],
          },
          {
            name: "M Stage",
            values: [{ id: "fact-tnm-m", value: "M0", classUri: "M0StageFinding" }],
          },
          {
            name: "Treatments",
            values: [{ id: "ignored-fact", value: "Ignored", classUri: "Ignored" }],
          },
        ],
        tumors: [
          {
            id: "tumor-1",
            attributes: [
              {
                name: "Histology",
                values: [{ id: "tumor-fact-1", value: "Adenocarcinoma", classUri: "Adeno" }],
              },
            ],
          },
        ],
      },
    ];

    const summary = transformCancerSummary(cancers);
    expect(summary).toHaveLength(1);
    expect(summary[0].cancerId).toBe("cancer-1");
    expect(summary[0].collatedCancerFacts.map((factGroup) => factGroup.categoryName)).toEqual([
      "Location",
    ]);
    expect(summary[0].tnm[0].data.T).toHaveLength(1);
    expect(summary[0].tnm[0].data.N).toHaveLength(1);
    expect(summary[0].tnm[0].data.M).toHaveLength(1);
    expect(summary[0].tumors.listViewData).toHaveLength(1);
  });

  test("transformDocumentTimeline groups and counts documents", () => {
    const timeline = transformDocumentTimeline({
      patientId: "patient-1",
      patientName: "Patient One",
      demographics: {
        gender: "F",
        firstEncounterDate: "2019-01-01",
        lastEncounterDate: "2020-03-01",
      },
      documents: [
        {
          id: "doc-1",
          name: "doc-1",
          date: "202001021030",
          type: "Clinical note",
          episode: "Diagnostic",
        },
        {
          id: "doc-2",
          name: "doc-2",
          date: "202001021200",
          type: "Clinical note",
          episode: "Follow-up",
        },
        {
          id: "doc-3",
          name: "doc-3",
          date: "202002011000",
          type: "Radiology",
          episode: "Follow-up",
        },
      ],
    });

    expect(timeline.patientInfo.patientId).toBe("patient-1");
    expect(timeline.reportData).toHaveLength(3);
    expect(timeline.typeCounts["Clinical note"]).toBe(2);
    expect(timeline.typeCounts.Radiology).toBe(1);
    expect(timeline.episodeCounts["Follow-up"]).toBe(2);
    expect(timeline.maxVerticalCountsPerType["Clinical note"]).toBe(2);
    expect(Object.keys(timeline.reportsGroupedByDateAndTypeObj)).toContain("2020/01/02");
  });

  test("buildTimelineChartModel creates positioned points with grouped stacking", () => {
    const timeline = transformDocumentTimeline({
      patientId: "patient-1",
      patientName: "Patient One",
      documents: [
        {
          id: "doc-1",
          name: "doc-1",
          date: "202001021030",
          type: "Clinical note",
          episode: "Diagnostic",
        },
        {
          id: "doc-2",
          name: "doc-2",
          date: "202001021200",
          type: "Clinical note",
          episode: "Diagnostic",
        },
        {
          id: "doc-3",
          name: "doc-3",
          date: "202002011000",
          type: "Radiology",
          episode: "unknown",
        },
      ],
    });

    const model = buildTimelineChartModel(timeline, { svgWidth: 1000 });

    expect(model.totalReports).toBe(3);
    expect(model.rows.map((row) => row.type)).toEqual(["Clinical note", "Radiology"]);
    expect(model.episodes.map((episode) => episode.label)).toEqual(["Unknown", "Diagnostic"]);
    expect(model.points).toHaveLength(3);

    const clinicalDots = model.points.filter((point) => point.type === "Clinical note");
    expect(clinicalDots).toHaveLength(2);
    expect(Math.abs(clinicalDots[0].x - clinicalDots[1].x)).toBeLessThan(2);
    expect(clinicalDots[0].rowIndex).toBe(0);
    expect(clinicalDots[1].rowIndex).toBe(0);
    expect(model.ticks.length).toBeGreaterThan(1);
  });

  test("buildTimelineChartModel flags when all documents resolve to one timestamp", () => {
    const timeline = transformDocumentTimeline({
      patientId: "patient-collapsed",
      patientName: "Collapsed Patient",
      documents: [
        {
          id: "patient-collapsed_16032025025912_D_1",
          name: "Document One",
          date: "202503160259",
          type: "Clinical note",
          episode: "Unknown",
        },
        {
          id: "patient-collapsed_16032025025912_D_2",
          name: "Document Two",
          date: "202503160259",
          type: "Clinical note",
          episode: "Unknown",
        },
      ],
    });

    const model = buildTimelineChartModel(timeline, { svgWidth: 1000 });
    expect(model.dateDiagnostics.hasDateCollapse).toBe(true);
    expect(model.dateDiagnostics.uniqueDateTimeCount).toBe(1);
    expect(model.dateDiagnostics.collapsedDateLabel).toContain("2025/03/16");
  });

  test("transformDocumentTimeline uses identifier timestamps when date field collapses", () => {
    const timeline = transformDocumentTimeline({
      patientId: "patient-fallback",
      patientName: "Fallback Patient",
      documents: [
        {
          id: "patient-fallback_16032025025912_D_1",
          name: "Document One",
          date: "20250316",
          type: "Clinical note",
          episode: "Diagnostic",
        },
        {
          id: "patient-fallback_17032025025912_D_2",
          name: "Document Two",
          date: "20250316",
          type: "Clinical note",
          episode: "Diagnostic",
        },
      ],
    });

    expect(timeline.reportData.every((report) => report.timelineDateSource === "identifier")).toBe(true);

    const model = buildTimelineChartModel(timeline, { svgWidth: 1000 });
    expect(model.dateDiagnostics.hasDateCollapse).toBe(false);
    expect(model.dateDiagnostics.uniqueDateTimeCount).toBe(2);

    const xValues = model.points.map((point) => point.x);
    expect(Math.abs(xValues[0] - xValues[1])).toBeGreaterThan(10);
  });

  test("resolveFactSelection links fact to concept mentions and documents", () => {
    const patientData = {
      cancers: [
        {
          id: "cancer-1",
          attributes: [
            {
              name: "Location",
              values: [
                {
                  id: "fact-1",
                  value: "Lung",
                  conceptIds: ["concept-1"],
                  confidence: 97,
                  negated: false,
                },
              ],
            },
          ],
          tumors: [],
        },
      ],
      concepts: [
        {
          id: "concept-1",
          mentionIds: ["mention-1"],
        },
      ],
      documents: [
        {
          id: "doc-1",
          name: "Document 1",
          mentions: [{ id: "mention-1" }],
        },
        {
          id: "doc-2",
          name: "Document 2",
          mentions: [{ id: "mention-2" }],
        },
      ],
    };

    const result = resolveFactSelection(patientData, "fact-1");
    expect(result).not.toBeNull();
    expect(result.factId).toBe("fact-1");
    expect(result.conceptIds).toEqual(["concept-1"]);
    expect(result.mentionIds).toEqual(["mention-1"]);
    expect(result.documentIds).toEqual(["doc-1"]);
  });

  test("normalizePatientPayload preserves cancers from array-style patient payload", () => {
    const arrayStylePatientPayload = [
      {
        id: "fake_patient1",
        name: "fake_patient1",
        concepts: [
          {
            id: "concept-1",
            classUri: "Melanoma",
            mentionIds: ["mention-1"],
          },
        ],
        cancers: [
          {
            id: "cancer-1",
            attributes: [
              {
                name: "Location",
                values: [
                  {
                    id: "fact-1",
                    value: "Skin",
                    classUri: "Skin",
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
                    values: [
                      {
                        id: "tumor-fact-1",
                        value: "Melanoma",
                        classUri: "Melanoma",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "doc-1",
        name: "Document 1",
        type: "Clinical Note",
        date: "202503180200",
        episode: "Pre-diagnostic",
        text: "Document text",
        mentions: [{ id: "mention-1", begin: 0, end: 4, classUri: "Melanoma" }],
        mentionRelations: [],
      },
    ];

    const normalized = normalizePatientPayload({
      patientPayload: arrayStylePatientPayload,
      fallbackPatientId: "fallback-id",
    });

    expect(normalized.patientId).toBe("fake_patient1");
    expect(normalized.documents).toHaveLength(1);
    expect(normalized.cancers).toHaveLength(1);
    expect(normalized.cancers[0].tumors).toHaveLength(1);

    const cancerSummary = transformCancerSummary(normalized.cancers);
    expect(cancerSummary).toHaveLength(1);
    expect(cancerSummary[0].tumors.listViewData).toHaveLength(1);
  });
});
