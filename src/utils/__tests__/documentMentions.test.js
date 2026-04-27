import {
  buildConfidenceHistogram,
  buildGroupColorByName,
} from "../patientView/documentMentions";

describe("documentMentions utilities", () => {
  test("buildGroupColorByName uses fixed semantic colors with grey fallback", () => {
    const groupColorByName = buildGroupColorByName([
      { id: "c1", dpheGroup: "Neoplasm" },
      { id: "c2", dpheGroup: "Imaging Device" },
      { id: "c3", dpheGroup: "Unexpected Group" },
      { id: "c4" },
    ]);

    expect(groupColorByName.Neoplasm).toBe("#96e7ac");
    expect(groupColorByName["Imaging Device"]).toBe("#785ef0");
    expect(groupColorByName["Unexpected Group"]).toBe("#e0e0e0");
    expect(groupColorByName.Unknown).toBe("#e0e0e0");
  });

  test("buildConfidenceHistogram returns 10 buckets with byMention and byConcept counts", () => {
    const histogram = buildConfidenceHistogram({
      mentionRecords: [
        { mentionId: "m1", conceptId: "c1", group: "Neoplasm", confidence: 0.22 },
        { mentionId: "m2", conceptId: "c1", group: "Neoplasm", confidence: 0.81 },
        { mentionId: "m3", conceptId: "c2", group: "Finding", confidence: 0.4 },
        { mentionId: "m4", conceptId: "c3", group: "Finding", confidence: 1.0 },
        { mentionId: "m5", conceptId: "c4", group: "Unexpected Group", confidence: 0.05 },
      ],
      conceptRows: [
        { conceptId: "c1", group: "Neoplasm" },
        { conceptId: "c2", group: "Finding" },
        { conceptId: "c3", group: "Finding" },
        { conceptId: "c4", group: "Unexpected Group" },
      ],
      bucketCount: 10,
    });

    expect(histogram).toHaveLength(10);
    expect(histogram[0].bucket).toBe("10%");
    expect(histogram[9].bucket).toBe("100%");

    expect(histogram[0].byMention["Unexpected Group"]).toBe(1);
    expect(histogram[2].byMention.Neoplasm).toBe(1);
    expect(histogram[4].byMention.Finding).toBe(1);
    expect(histogram[8].byMention.Neoplasm).toBe(1);
    expect(histogram[9].byMention.Finding).toBe(1);

    expect(histogram[0].byConcept["Unexpected Group"]).toBe(1);
    expect(histogram[4].byConcept.Finding).toBe(1);
    expect(histogram[8].byConcept.Neoplasm).toBe(1);
    expect(histogram[9].byConcept.Finding).toBe(1);
    expect(histogram[2].byConcept.Neoplasm).toBe(0);
  });
});
