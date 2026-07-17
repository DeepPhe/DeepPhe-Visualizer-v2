import {
  resolveDocumentCountFromPayload,
  transformSummaryToGridRow,
} from "../patientSummaryNormalization";

describe("transformSummaryToGridRow", () => {
  it("preserves the document count from the filter summary", () => {
    const row = transformSummaryToGridRow({
      patient_id: "patient-1",
      doc_count: 12,
    });

    expect(row.docCount).toBe(12);
  });

  it("falls back to the document ID collection length", () => {
    const row = transformSummaryToGridRow({
      patient_id: "patient-2",
      document_ids: ["doc-1", "doc-2", "doc-3"],
    });

    expect(row.docCount).toBe(3);
  });
});

describe("resolveDocumentCountFromPayload", () => {
  it("reads nested document count metadata", () => {
    expect(resolveDocumentCountFromPayload({ data: { document_count: "1,234" } })).toBe(1234);
  });

  it("falls back to nested document arrays", () => {
    expect(resolveDocumentCountFromPayload({ data: { documents: [{ id: "a" }, { id: "b" }] } })).toBe(2);
  });
});
