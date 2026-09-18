import { buildCancerComparisonMatrix } from "../cancerComparison";

const fact = (id, value) => ({ id, value });

const CANCERS = [
  {
    cancerId: "cancer-1",
    title: "patient_cancer_1",
    collatedCancerFacts: [
      { categoryName: "Location", facts: [fact("c1-loc", "Lower-Outer Quadrant of the Breast")] },
      { categoryName: "Grade", facts: [fact("c1-grade", "3")] },
      { categoryName: "Genes", facts: [fact("c1-gene", "ERBB2 Gene")] },
    ],
    tnm: [{ data: { T: [fact("c1-t", "1")], N: [], M: [fact("c1-m", "0")] } }],
    tumors: {
      listViewData: [
        {
          id: "tumor-1",
          data: [
            { category: "Location", facts: [fact("t1-loc", "Lower-Outer Quadrant of the Breast")] },
            { category: "Laterality", facts: [fact("t1-lat", "Right")] },
          ],
        },
      ],
    },
  },
  {
    cancerId: "cancer-2",
    title: "patient_cancer_2",
    collatedCancerFacts: [
      { categoryName: "Location", facts: [fact("c2-loc", "Lower-Outer Quadrant of the Breast")] },
      { categoryName: "Grade", facts: [fact("c2-grade", "1")] },
    ],
    tnm: [{ data: { T: [], N: [], M: [] } }],
    tumors: {
      listViewData: [
        {
          id: "tumor-2",
          data: [{ category: "Location", facts: [fact("t2-loc", "Nipple")] }],
        },
      ],
    },
  },
];

const rowByLabel = (matrix, sectionKey, label) =>
  matrix.sections
    .find((section) => section.key === sectionKey)
    .rows.find((row) => row.label === label);

describe("cancer comparison matrix", () => {
  it("puts one column per cancer, with how much of each is documented", () => {
    const matrix = buildCancerComparisonMatrix(CANCERS);

    expect(matrix.hasData).toBe(true);
    expect(matrix.columns.map((column) => column.label)).toEqual(["Cancer 1", "Cancer 2"]);
    expect(matrix.columns[0].title).toBe("patient_cancer_1");
    // Same denominator for both, so the columns are comparable.
    expect(matrix.columns[0].fieldCount).toBe(matrix.columns[1].fieldCount);
    expect(matrix.columns[0].documentedCount).toBeGreaterThan(matrix.columns[1].documentedCount);
  });

  it("orders attributes clinically and keeps every TNM row", () => {
    const matrix = buildCancerComparisonMatrix(CANCERS);
    const labels = matrix.sections.find((section) => section.key === "cancer").rows.map((row) => row.label);

    expect(labels.slice(0, 3)).toEqual(["Location", "Grade", "Gene(s)"]);
    expect(labels).toEqual(expect.arrayContaining(["TNM T", "TNM N", "TNM M"]));
  });

  it("marks the rows where the cancers disagree", () => {
    const matrix = buildCancerComparisonMatrix(CANCERS);

    // The whole point of the matrix: grade 3 vs 1, and a gene on cancer 1 only.
    expect(rowByLabel(matrix, "cancer", "Grade").differs).toBe(true);
    expect(rowByLabel(matrix, "cancer", "Gene(s)").differs).toBe(true);
    // Shared values are not noise to flag.
    expect(rowByLabel(matrix, "cancer", "Location").differs).toBe(false);
  });

  it("flags undocumented cells instead of dropping them", () => {
    const matrix = buildCancerComparisonMatrix(CANCERS);
    const nodes = rowByLabel(matrix, "cancer", "TNM N");

    expect(nodes.cells.every((cell) => cell.isUnknown)).toBe(true);
    expect(rowByLabel(matrix, "cancer", "Gene(s)").cells[1].isUnknown).toBe(true);
    expect(rowByLabel(matrix, "cancer", "Gene(s)").cells[0].facts).toHaveLength(1);
  });

  it("nests tumors and says when a tumor just repeats its cancer", () => {
    const matrix = buildCancerComparisonMatrix(CANCERS);
    const tumorSection = matrix.sections.find((section) => section.key === "tumor-1");

    expect(tumorSection.label).toBe("Tumor 1");
    const location = tumorSection.rows.find((row) => row.label === "Location");
    // Cancer 1's tumor repeats the cancer's location; cancer 2's differs.
    expect(location.cells[0].matchesCancer).toBe(true);
    expect(location.cells[1].matchesCancer).toBe(false);
    expect(location.differs).toBe(true);
  });

  it("has nothing to show without cancers", () => {
    expect(buildCancerComparisonMatrix([]).hasData).toBe(false);
    expect(buildCancerComparisonMatrix(null).hasData).toBe(false);
  });
});
