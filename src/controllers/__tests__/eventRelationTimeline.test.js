import fs from "fs";
import path from "path";
import {
  buildEventRelationTimelineModel,
  createEventRelationSpans,
  filterEventRelationTimelineModel,
  parseEventRelationTimelineTsv,
  shouldShowEventRelationTimeline,
} from "../eventRelationTimeline";
import { EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT } from "../../constants/eventRelationTimeline";

const STATIC_TSV = fs.readFileSync(
  path.join(process.cwd(), "public/data/event-timelines/fake_patient1.tsv"),
  "utf8"
);

const CONCEPT_FIXTURES = [
  ["65", "Metastatic", "Behavior"],
  ["67", "Invasive", "Behavior"],
  ["66", "In Situ", "Behavior"],
  ["22", "Carboplatin", "Chemo/immuno/hormone Therapy Regimen"],
  ["25", "Doxorubicin", "Chemo/immuno/hormone Therapy Regimen"],
  ["24", "Tamoxifen", "Chemo/immuno/hormone Therapy Regimen"],
  ["35", "Estrogen Receptor Status", "Clinical Test Result"],
  ["36", "HER2/Neu Status", "Clinical Test Result"],
  ["33", "Progesterone Receptor Status", "Clinical Test Result"],
  ["1", "Stage IIA", "Disease Stage Qualifier"],
  ["2", "Stage IA", "Disease Stage Qualifier"],
  ["138", "Vomiting", "Finding", true],
  ["142", "Erythema", "Finding", true],
  ["135", "Infection", "Finding", true],
  ["64", "M0", "Generic TNM Finding"],
  ["63", "T1", "Generic TNM Finding"],
  ["62", "N1", "Generic TNM Finding"],
  ["56", "Diagnostic Ultrasound", "Intervention or Procedure"],
  ["45", "Modified Radical Mastectomy", "Intervention or Procedure"],
  ["57", "Chemotherapy", "Intervention or Procedure"],
  ["48", "Pharmacotherapy", "Intervention or Procedure"],
  ["51", "Radiation Ionizing Radiotherapy", "Intervention or Procedure"],
  ["50", "Mammography", "Intervention or Procedure"],
  ["46", "Surgical Incision", "Intervention or Procedure"],
  ["47", "Axillary Lymph Node Dissection", "Intervention or Procedure"],
  ["53", "Axillary Lymph Node Biopsy", "Intervention or Procedure"],
  ["87", "Firm Mass", "Mass"],
  ["120", "Mass", "Mass", true],
  ["86", "Nodule", "Mass"],
  ["93", "Invasive Breast Lobular Carcinoma", "Neoplasm"],
  ["92", "Breast Lobular Carcinoma In Situ", "Neoplasm"],
  ["95", "Malignant Breast Neoplasm", "Neoplasm"],
  ["81", "N0", "Pathologic TNM Finding"],
  ["79", "T1a", "Pathologic TNM Finding"],
  ["69", "Nab-paclitaxel", "Pharmacologic Substance"],
].map(([suffix, name, dpheGroup, negated = false]) => ({
  id: `fake_patient1_30072025201756_C_${suffix}`,
  name,
  dpheGroup,
  negated,
  mentionIds: [`mention-${suffix}`],
}));

function getSpanCountsByLaneGroup(model) {
  return model.spans.reduce((counts, span) => {
    counts[span.laneGroup] = (counts[span.laneGroup] || 0) + 1;
    return counts;
  }, {});
}

describe("event relation timeline controller", () => {
  it("parses the static TSV without dropping the final unterminated row", () => {
    const rows = parseEventRelationTimelineTsv(STATIC_TSV);

    expect(rows).toHaveLength(56);
    expect(rows[0]).toMatchObject({
      patientId: "fake_patient1",
      conceptId: "fake_patient1_30072025201756_C_65",
      relationKey: "Overlaps/Overlaps",
      date1Label: "2010-01-01",
      date2Label: "2010-07-10",
    });
    expect(rows[55]).toMatchObject({
      conceptId: "fake_patient1_30072025201756_C_69",
      relationKey: "Overlaps/Before",
      date1Label: "2010-05-31",
      date2Label: "2010-08-30",
    });
  });

  it("merges rows sharing a lane group and date range into one span", () => {
    const model = buildEventRelationTimelineModel({
      tsvText: STATIC_TSV,
      concepts: CONCEPT_FIXTURES,
    });

    expect(model.sourceRowCount).toBe(56);
    expect(model.matchedRowCount).toBe(56);
    expect(model.unmatchedConceptIds).toEqual([]);
    expect(model.uncategorizedConceptIds).toEqual([]);

    // The alpha keys spans on laneGroup + start + end, so 56 rows collapse to 34
    // drawn marks and the group labels count spans, not rows.
    expect(model.spans).toHaveLength(34);
    expect(getSpanCountsByLaneGroup(model)).toEqual({
      Finding: 5,
      Disease: 5,
      "Stage, Grade": 6,
      Treatment: 18,
    });
    expect(model.laneGroupCounts).toEqual({
      Finding: 5,
      Disease: 5,
      "Stage, Grade": 6,
      Treatment: 18,
    });

    const sharedStageSpan = model.spans.find(
      (span) => span.id === "Stage, Grade_2011-02-01_2011-03-01"
    );
    expect(sharedStageSpan.conceptIds).toHaveLength(4);
    expect(sharedStageSpan.conceptLabels).toEqual(
      expect.arrayContaining(["Invasive", "Stage IA", "N0", "T1a"])
    );
  });

  it("carries the first row's relation pair onto a merged span", () => {
    // Alpha `createSpanData` keeps the first row's relations for the merged
    // span; later rows contribute only their concept ids.
    const spans = createEventRelationSpans([
      {
        laneGroup: "Treatment",
        date1Label: "2010-01-31",
        date2Label: "2010-05-31",
        date1Time: Date.UTC(2010, 0, 31),
        date2Time: Date.UTC(2010, 4, 31),
        relation1: "On",
        relation2: "Before",
        relationKey: "On/Before",
        patientId: "fake_patient1",
        conceptId: "c-22",
        conceptLabel: "Carboplatin",
        dpheGroup: "Chemo",
        negated: false,
        sourceRowNumber: 6,
        inSelectedDocument: false,
      },
      {
        laneGroup: "Treatment",
        date1Label: "2010-01-31",
        date2Label: "2010-05-31",
        date1Time: Date.UTC(2010, 0, 31),
        date2Time: Date.UTC(2010, 4, 31),
        relation1: "After",
        relation2: "Before",
        relationKey: "After/Before",
        patientId: "fake_patient1",
        conceptId: "c-25",
        conceptLabel: "Doxorubicin",
        dpheGroup: "Chemo",
        negated: false,
        sourceRowNumber: 7,
        inSelectedDocument: true,
      },
    ]);

    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      relationKey: "On/Before",
      rowCount: 2,
      inSelectedDocument: true,
    });
    expect(spans[0].conceptIds).toEqual(["c-22", "c-25"]);
  });

  it("filters event relations to concepts present in the selected document", () => {
    const model = buildEventRelationTimelineModel({
      tsvText: STATIC_TSV,
      concepts: CONCEPT_FIXTURES,
      selectedDocument: {
        id: "doc-1",
        mentions: [{ id: "mention-22" }, { id: "mention-138" }],
      },
    });
    const filteredModel = filterEventRelationTimelineModel(
      model,
      EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT
    );

    expect(model.currentReportConceptIds).toEqual([
      "fake_patient1_30072025201756_C_138",
      "fake_patient1_30072025201756_C_22",
    ]);
    expect(filteredModel.matchedRowCount).toBe(5);
    expect(filteredModel.rows.every((row) => row.inSelectedDocument)).toBe(true);
    expect(getSpanCountsByLaneGroup(filteredModel)).toEqual({
      Finding: 3,
      Treatment: 2,
    });
  });

  it("limits timeline availability to the canonical fake patient id", () => {
    expect(shouldShowEventRelationTimeline("fake_patient1")).toBe(true);
    expect(shouldShowEventRelationTimeline("fake_patient_1")).toBe(false);
    expect(shouldShowEventRelationTimeline("patient-2")).toBe(false);
  });

  it("throws a clear error for malformed date values", () => {
    const badTsv = [
      "PatientID\tConceptID\tRelation1\tDate1\tRelation2\tDate2",
      "fake_patient1\tc-1\tOn\t2010-99-99\tOn\t2010-01-01",
    ].join("\n");

    expect(() => parseEventRelationTimelineTsv(badTsv)).toThrow(
      "Invalid Date1 value on row 2"
    );
  });
});
