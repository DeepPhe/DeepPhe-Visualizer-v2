import { transformSummaryToGridRow } from "../patientSummaryNormalization";

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
