import { buildCancerComparisonMatrix, buildCancerComparisonTable } from "../cancerComparison";

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

  it("orders attributes clinically and reads TNM as one row", () => {
    const matrix = buildCancerComparisonMatrix(CANCERS);
    const cancerSection = matrix.sections.find((section) => section.key === "cancer");
    const labels = cancerSection.rows.map((row) => row.label);

    expect(labels.slice(0, 3)).toEqual(["Location", "Grade", "Gene(s)"]);
    // "T1 N0 M0" is how the stage is read, so it is one row, not three.
    expect(labels).toContain("TNM");
    expect(labels).not.toContain("TNM T");
    const tnm = cancerSection.rows.find((row) => row.label === "TNM");
    expect(tnm.cells[0].facts.map((f) => f.comparisonPrefix)).toEqual(["T", "M"]);
    expect(tnm.cells[1].isUnknown).toBe(true);
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
    const genes = rowByLabel(matrix, "cancer", "Gene(s)");

    expect(genes.cells[1].isUnknown).toBe(true);
    expect(genes.cells[0].facts).toHaveLength(1);
    expect(genes.allUnknown).toBe(false);
    expect(genes.isFoldable).toBe(false);
  });

  it("folds rows that hold nothing to compare", () => {
    const matrix = buildCancerComparisonMatrix([
      {
        cancerId: "only",
        collatedCancerFacts: [{ categoryName: "Grade", facts: [fact("g", "3")] }],
        tnm: [{ data: { T: [], N: [], M: [] } }],
        tumors: {
          listViewData: [{ id: "t", data: [{ category: "Grade", facts: [fact("tg", "3")] }] }],
        },
      },
    ]);

    // Nothing staged at all: the TNM row has nothing to say.
    expect(rowByLabel(matrix, "cancer", "TNM").allUnknown).toBe(true);
    expect(rowByLabel(matrix, "cancer", "TNM").isFoldable).toBe(true);
    // The tumor only repeats its cancer's grade.
    const tumorGrade = rowByLabel(matrix, "tumor-1", "Grade");
    expect(tumorGrade.repeatsCancer).toBe(true);
    expect(tumorGrade.isFoldable).toBe(true);
    // A row that says something stays.
    expect(rowByLabel(matrix, "cancer", "Grade").isFoldable).toBe(false);
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

describe("cancer comparison table (cancers as rows)", () => {
  it("turns the matrix on its side: a row per cancer, a column per attribute", () => {
    const matrix = buildCancerComparisonMatrix(CANCERS);
    const table = buildCancerComparisonTable(CANCERS);

    expect(table.hasData).toBe(true);
    expect(table.rows.map((row) => row.label)).toEqual(["Cancer 1", "Cancer 2"]);
    expect(table.rows[0].title).toBe("patient_cancer_1");
    // One column per matrix row, in the same order, tagged with its section.
    const matrixRows = matrix.sections.flatMap((section) => section.rows);
    expect(table.columns.map((column) => column.key)).toEqual(matrixRows.map((row) => row.key));
    expect(table.columns[0]).toMatchObject({ groupKey: "cancer", groupLabel: "Cancer", label: "Location" });
    expect(table.columns.some((column) => column.groupKey === "tumor-1")).toBe(true);
    // Every row has a cell per column.
    table.rows.forEach((row) => expect(row.cells).toHaveLength(table.columns.length));
  });

  it("puts each cancer's own value in its own row", () => {
    const table = buildCancerComparisonTable(CANCERS);
    const column = (label) => table.columns.findIndex((c) => c.groupKey === "cancer" && c.label === label);

    expect(table.rows[0].cells[column("Grade")].facts[0].value).toBe("3");
    expect(table.rows[1].cells[column("Grade")].facts[0].value).toBe("1");
    expect(table.rows[1].cells[column("Gene(s)")].isUnknown).toBe(true);
    // Which columns differ is carried over, and so is completeness.
    expect(table.columns[column("Grade")].differs).toBe(true);
    expect(table.columns[column("Location")].differs).toBe(false);
    expect(table.rows[0].documentedCount).toBeGreaterThan(table.rows[1].documentedCount);
    expect(table.rows[0].fieldCount).toBe(table.rows[1].fieldCount);
  });

  it("marks the same columns foldable as the matrix marks rows", () => {
    const matrix = buildCancerComparisonMatrix(CANCERS);
    const table = buildCancerComparisonTable(CANCERS);
    const matrixFoldable = matrix.sections.flatMap((s) => s.rows).map((row) => row.isFoldable);

    expect(table.columns.map((column) => column.isFoldable)).toEqual(matrixFoldable);
  });

  it("has nothing to show without cancers", () => {
    expect(buildCancerComparisonTable([]).hasData).toBe(false);
    expect(buildCancerComparisonTable(null).hasData).toBe(false);
  });
});
