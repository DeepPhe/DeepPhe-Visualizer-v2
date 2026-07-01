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

// A Patient Summary finding must link only to source documents that genuinely
// contain that finding's concept. The resolver matches whole normalized tokens
// (name / preferred text / class token), never substrings, abbreviations, or
// individual words — so it can never invent a link like the ones observed in
// upstream data: "BP" -> Bleomycin/Cisplatin, "dedicated" -> Dedicated Blood
// Product Donation, "Start" -> Collagen Tile Brachytherapy, or "Re-image" ->
// Rasmussen Subacute Encephalitis. These tests lock that contract in so a future
// change can't loosen matching into those false positives.
describe("resolveSummarySelection — no spurious source links", () => {
  function oneConceptDoc({ id, classUri, name, preferredText }) {
    return {
      concepts: [{ id: "c", classUri, name, preferredText, mentionIds: ["m"] }],
      documents: [{ id, type: "NOTE", mentions: [{ id: "m", classUri, confidence: 0.99 }] }],
    };
  }

  it("does not match an abbreviation to an unrelated concept (BP ↛ Bleomycin / Cisplatin)", () => {
    const data = oneConceptDoc({
      id: "doc-chemo",
      classUri: "Bleomycin_sl_Cisplatin",
      name: "Bleomycin / Cisplatin",
    });
    expect(resolveSummarySelection(data, { name: "BP" }, { sectionKey: "treatments" })).toBeNull();
  });

  it("does not match a contained word to a longer concept (dedicated ↛ Dedicated Blood Product Donation)", () => {
    const data = oneConceptDoc({
      id: "doc-donation",
      classUri: "DedicatedBloodProductDonation",
      name: "Dedicated Blood Product Donation",
    });
    expect(resolveSummarySelection(data, { name: "Dedicated" }, { sectionKey: "procedures" })).toBeNull();
  });

  it("does not match a common word to an unrelated concept (Start ↛ Collagen Tile Brachytherapy)", () => {
    const data = oneConceptDoc({
      id: "doc-brachy",
      classUri: "CollagenTileBrachytherapy",
      name: "Collagen Tile Brachytherapy",
    });
    expect(resolveSummarySelection(data, { name: "Start" }, { sectionKey: "treatments" })).toBeNull();
  });

  it("does not match a hyphenated fragment to unrelated concepts (Re-image ↛ Rasmussen / Crohn)", () => {
    const data = {
      concepts: [
        { id: "c1", classUri: "RasmussenSubacuteEncephalitis", name: "Rasmussen Subacute Encephalitis", mentionIds: ["m1"] },
        { id: "c2", classUri: "CrohnDisease", name: "Crohn Disease", mentionIds: ["m2"] },
      ],
      documents: [
        {
          id: "doc-neuro",
          type: "NOTE",
          mentions: [
            { id: "m1", classUri: "RasmussenSubacuteEncephalitis", confidence: 0.99 },
            { id: "m2", classUri: "CrohnDisease", confidence: 0.99 },
          ],
        },
      ],
    };
    expect(resolveSummarySelection(data, { name: "Re-image" }, { sectionKey: "findings" })).toBeNull();
  });

  it("links a real finding to its own concept only, without bleeding into a co-located concept", () => {
    // "Breast Coil" (an imaging device) and "Dedicated Blood Product Donation"
    // are mentioned in the same note. Selecting "Breast Coil" must resolve to the
    // breast-coil concept alone — not the donation concept that shares no whole
    // token — and must not pick up the donation mention.
    const data = {
      concepts: [
        { id: "c-coil", classUri: "BreastCoil", name: "Breast Coil", mentionIds: ["m-coil"] },
        {
          id: "c-donation",
          classUri: "DedicatedBloodProductDonation",
          name: "Dedicated Blood Product Donation",
          mentionIds: ["m-donation"],
        },
      ],
      documents: [
        {
          id: "doc-rad",
          type: "NOTE",
          mentions: [
            { id: "m-coil", classUri: "BreastCoil", confidence: 0.9 },
            { id: "m-donation", classUri: "DedicatedBloodProductDonation", confidence: 0.9 },
          ],
        },
      ],
    };

    const selection = resolveSummarySelection(data, { name: "Breast Coil" }, { sectionKey: "findings" });
    expect(selection).not.toBeNull();
    expect(selection.documentIds).toEqual(["doc-rad"]);
    expect(selection.conceptIds).toEqual(["c-coil"]);
    expect(selection.mentionIds).toContain("m-coil");
    expect(selection.mentionIds).not.toContain("m-donation");

    // The lone word "Coil" is not a whole-token match for any concept.
    expect(resolveSummarySelection(data, { name: "Coil" }, { sectionKey: "findings" })).toBeNull();
  });
});
