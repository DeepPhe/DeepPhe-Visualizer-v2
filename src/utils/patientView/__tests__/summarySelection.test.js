import { resolveSummarySelection } from "../summarySelection";

describe("resolveSummarySelection", () => {
  const patientData = {
    concepts: [
      { id: "c-insitu", classUri: "http://x#InSitu", name: "In Situ", mentionIds: ["m1", "m2"] },
      { id: "c-other", classUri: "http://x#Invasion", name: "Invasion", mentionIds: ["m9"] },
    ],
    documents: [
      {
        id: "doc-low",
        type: "NOTE",
        mentions: [{ id: "m1", classUri: "InSitu", confidence: 0.6 }],
      },
      {
        id: "doc-high",
        type: "PATH",
        // Confidence supplied as a 0–100 percentage; should normalize to 0.95.
        mentions: [{ id: "m2", classUri: "InSitu", confidence: 95 }],
      },
      {
        id: "doc-unrelated",
        type: "NOTE",
        mentions: [{ id: "m9", classUri: "Invasion", confidence: 0.99 }],
      },
    ],
  };

  it("resolves a finding to its source documents ranked by highest confidence", () => {
    const selection = resolveSummarySelection(
      patientData,
      { name: "In Situ", negated: false },
      { sectionKey: "findings", sectionLabel: "Findings" }
    );

    expect(selection).not.toBeNull();
    // doc-high (0.95) outranks doc-low (0.6); unrelated doc excluded.
    expect(selection.documentIds).toEqual(["doc-high", "doc-low"]);
    expect(selection.bestConfidence).toBeCloseTo(0.95);
    // documentRanking exposes per-document confidence, highest-first.
    expect(selection.documentRanking.map((entry) => entry.documentId)).toEqual([
      "doc-high",
      "doc-low",
    ]);
    expect(selection.documentRanking[0].confidence).toBeCloseTo(0.95);
    expect(selection.documentRanking[1].confidence).toBeCloseTo(0.6);
    expect(selection.documentRanking[0].document.id).toBe("doc-high");
    expect(selection.conceptIds).toEqual(["c-insitu"]);
    expect(selection.prettyName).toBe("In Situ");
    expect(selection.categoryName).toBe("Findings");
    expect(selection.factId).toBe("summary:findings:insitu");
  });

  it("matches on the class token regardless of spacing/case (humanized name vs classUri)", () => {
    const data = {
      concepts: [],
      documents: [
        { id: "d1", mentions: [{ id: "m", classUri: "TumorSize", confidence: 0.8 }] },
      ],
    };

    const selection = resolveSummarySelection(data, { name: "Tumor Size" }, { sectionKey: "findings" });
    expect(selection).not.toBeNull();
    expect(selection.documentIds).toEqual(["d1"]);
    // No concept matched by name, but the class-matched mention still resolves the doc.
    expect(selection.conceptIds).toEqual([]);
  });

  it("links a pathologic stage name to its class, without cross-matching the clinical variant", () => {
    // "pN1" is the humanized form of PN1StageFinding (the "StageFinding" suffix
    // is dropped). The filter-summary API supplies only { name: "pN1" }, so the
    // resolver must bridge that name to the PN1StageFinding concept/mention while
    // NOT matching the separate clinical N1StageFinding (displayed as "N1").
    const data = {
      concepts: [
        { id: "c-pn1", classUri: "http://x#PN1StageFinding", preferredText: "N1", mentionIds: ["mp"] },
        { id: "c-n1", classUri: "http://x#N1StageFinding", preferredText: "N1", mentionIds: ["mc"] },
      ],
      documents: [
        { id: "doc-path", type: "PATH", mentions: [{ id: "mp", classUri: "PN1StageFinding", confidence: 0.9 }] },
        { id: "doc-clin", type: "NOTE", mentions: [{ id: "mc", classUri: "N1StageFinding", confidence: 0.9 }] },
      ],
    };

    const selection = resolveSummarySelection(data, { name: "pN1" }, { sectionKey: "staging" });
    expect(selection).not.toBeNull();
    expect(selection.documentIds).toEqual(["doc-path"]);
    expect(selection.conceptIds).toEqual(["c-pn1"]);
  });

  it("returns null when no source document mentions the term", () => {
    const selection = resolveSummarySelection(
      patientData,
      { name: "Lymphovascular Invasion" },
      { sectionKey: "findings" }
    );
    expect(selection).toBeNull();
  });

  it("returns null for an empty item or missing documents", () => {
    expect(resolveSummarySelection(patientData, {}, {})).toBeNull();
    expect(resolveSummarySelection({ documents: [] }, { name: "In Situ" }, {})).toBeNull();
  });
});
