import {
  buildFilterSectionLayout,
  buildTallestAlignedLayout,
  estimateCardHeight,
} from "../filterLayout";

describe("filterLayout helpers", () => {
  it("estimates card height from row count", () => {
    expect(estimateCardHeight(3)).toBe(228);
    expect(estimateCardHeight(2, 20, 80)).toBe(120);
    expect(estimateCardHeight(-5, 20, 80)).toBe(80);
  });

  it("stretches shorter solo measured cards to align with the tallest column", () => {
    const layout = buildTallestAlignedLayout(
      ["A", "B", "C"],
      { A: 120, B: 120, C: 120 },
      { A: 160, B: 130, C: 130 },
      24,
      3
    );

    expect(layout.tallestFilterBoxHeight).toBe(120);
    expect(layout.tallestMeasuredFilterBoxHeight).toBe(160);
    expect(layout.cardHeightOverrideByClass).toEqual({ B: 160, C: 160 });
    expect(layout.cardMarginBottomByClass).toEqual({ A: 0, B: 0, C: 0 });
  });

  it("builds full section layout maps and final section height", () => {
    const layout = buildFilterSectionLayout({
      classNames: ["A", "B", "C"],
      measuredCardHeightByClass: { A: 200, B: "180", C: 150 },
      naturalGapPx: 24,
      maxColumns: 2,
      cardBottomMargin: 24,
      categoryMaxHeight: 700,
      rowHeightEstimate: 10,
      cardOverheadEstimate: 50,
    });

    expect(layout.baseCardHeightByClass).toEqual({ A: 200, B: 180, C: 150 });
    expect(layout.measuredCardHeightByClass).toEqual({ A: 200, B: 180, C: 150 });
    expect(layout.resolvedCardHeightByClass).toEqual({ A: 354, B: 180, C: 150 });
    expect(layout.cardHeightOverrideByClass).toEqual({ A: 354 });
    expect(layout.cardMarginBottomByClass).toEqual({ A: 0, B: 24, C: 0 });
    expect(layout.sectionHeight).toBe(378);
  });

  it("falls back to configured base heights and row-count estimates when measurements are missing", () => {
    const layout = buildFilterSectionLayout({
      classNames: ["A", "B"],
      baseCardHeightByClass: { A: 250 },
      rowCountByClass: { B: 4 },
      measuredCardHeightByClass: { A: null, B: undefined },
      naturalGapPx: 24,
      maxColumns: 2,
      cardBottomMargin: 20,
      categoryMaxHeight: 500,
      rowHeightEstimate: 10,
      cardOverheadEstimate: 50,
    });

    expect(layout.baseCardHeightByClass).toEqual({ A: 250, B: 90 });
    expect(layout.measuredCardHeightByClass).toEqual({ A: 0, B: 0 });
    expect(layout.cardHeightOverrideByClass).toEqual({ B: 250 });
    expect(layout.cardMarginBottomByClass).toEqual({ A: 0, B: 0 });
    expect(layout.sectionHeight).toBe(270);
  });

  it("preserves configured order when a responsive column cap bounds the section", () => {
    const layout = buildFilterSectionLayout({
      classNames: ["A", "B", "C", "D"],
      baseCardHeightByClass: { A: 120, B: 120, C: 120, D: 120 },
      measuredCardHeightByClass: { A: 120, B: 120, C: 120, D: 120 },
      naturalGapPx: 24,
      maxColumns: 2,
      cardBottomMargin: 24,
    });

    expect(layout.columnGroups.flat()).toEqual(["A", "B", "C", "D"]);
    expect(layout.cardMarginBottomByClass.A).toBeGreaterThan(0);
    expect(layout.cardMarginBottomByClass.B).toBe(0);
    expect(layout.cardMarginBottomByClass.C).toBeGreaterThan(0);
    expect(layout.cardMarginBottomByClass.D).toBe(0);
  });

  it("keeps staging classes in configured reading order under cap 3", () => {
    const layout = buildFilterSectionLayout({
      classNames: [
        "Stage",
        "T Stage",
        "N Stage",
        "M Stage",
        "Lymph Involvement",
      ],
      baseCardHeightByClass: {
        Stage: 120,
        "T Stage": 120,
        "N Stage": 120,
        "M Stage": 120,
        "Lymph Involvement": 120,
      },
      measuredCardHeightByClass: {
        Stage: 120,
        "T Stage": 120,
        "N Stage": 120,
        "M Stage": 120,
        "Lymph Involvement": 120,
      },
      naturalGapPx: 24,
      maxColumns: 3,
      cardBottomMargin: 24,
    });

    expect(layout.columnGroups.flat()).toEqual([
      "Stage",
      "T Stage",
      "N Stage",
      "M Stage",
      "Lymph Involvement",
    ]);
  });

  it("keeps a naturally tall card in its own column when packing under cap 3", () => {
    const layout = buildFilterSectionLayout({
      classNames: ["Stage", "T Stage", "N Stage", "M Stage", "Lymph Involvement"],
      measuredCardHeightByClass: {
        Stage: 260,
        "T Stage": 250,
        "N Stage": 210,
        "M Stage": 205,
        "Lymph Involvement": 600,
      },
      naturalGapPx: 24,
      maxColumns: 3,
      cardBottomMargin: 24,
    });

    expect(layout.columnGroups.flat()).toEqual([
      "Stage",
      "T Stage",
      "N Stage",
      "M Stage",
      "Lymph Involvement",
    ]);
    const lymphColumn = layout.columnGroups.find((group) => group.includes("Lymph Involvement"));
    expect(lymphColumn).toEqual(["Lymph Involvement"]);
  });

  it("keeps demographics column bottoms aligned so Ethnicity ends level with Race", () => {
    const layout = buildFilterSectionLayout({
      classNames: ["AGE_AT_DX", "RACE", "GENDER", "ETHNICITY"],
      baseCardHeightByClass: {
        AGE_AT_DX: 480,
        RACE: 516,
        GENDER: 228,
        ETHNICITY: 228,
      },
      measuredCardHeightByClass: {
        AGE_AT_DX: 480,
        RACE: 516,
        GENDER: 228,
        ETHNICITY: 228,
      },
      naturalGapPx: 24,
      maxColumns: 3,
      cardBottomMargin: 24,
    });

    expect(layout.columnGroups).toEqual([
      ["AGE_AT_DX"],
      ["RACE"],
      ["GENDER", "ETHNICITY"],
    ]);

    const getResolvedCardHeight = (className) =>
      Math.max(
        Number(layout.baseCardHeightByClass[className]) || 0,
        Number(layout.cardHeightOverrideByClass[className]) || 0
      );
    const columnHeights = layout.columnGroups.map((group) =>
      group.reduce(
        (sum, className) =>
          sum +
          getResolvedCardHeight(className) +
          (Number(layout.cardMarginBottomByClass[className]) || 0),
        0
      )
    );

    expect(columnHeights).toEqual([516, 516, 516]);
    expect(layout.resolvedCardHeightByClass.AGE_AT_DX).toBe(516);
    expect(layout.resolvedCardHeightByClass.RACE).toBe(516);
    expect(layout.cardMarginBottomByClass.GENDER).toBe(60);
    expect(layout.cardMarginBottomByClass.ETHNICITY).toBe(0);
  });

  // --- Validation cases for the three DP improvements ---

  it("lex tiebreak (sumSq) picks balanced partition when maxHeight is tied", () => {
    // [400][200][100,100] and [400][200,100][100] both give maxH=400.
    // sumSq: 400²+200²+224²=250176 vs 400²+324²+100²=274976.
    // New algorithm must pick the lower-sumSq partition.
    const layout = buildTallestAlignedLayout(
      ["A", "B", "C", "D"],
      { A: 400, B: 200, C: 100, D: 100 },
      {},
      24,
      3
    );
    expect(layout.columnGroups).toEqual([["A"], ["B"], ["C", "D"]]);
  });

  it("column-count search selects k giving smallest maxHeight", () => {
    // k=3: maxH=100; k=2: maxH=224; k=1: maxH=348. k=3 must win.
    const layout = buildTallestAlignedLayout(
      ["A", "B", "C"],
      { A: 100, B: 100, C: 100 },
      {},
      24,
      3
    );
    expect(layout.columnGroups).toEqual([["A"], ["B"], ["C"]]);
  });

  it("column-count search prefers fewer columns when maxH and sumSq are tied across k values", () => {
    // gap=0, heights=[100,100,0].
    // k=2: [A][B,C] => maxH=100, sumSq=100²+100²=20000.
    // k=3: [A][B][C] => maxH=100, sumSq=100²+100²+0²=20000.
    // Same lex tuple — smaller k (2) must win.
    const layout = buildTallestAlignedLayout(
      ["A", "B", "C"],
      { A: 100, B: 100, C: 0 },
      {},
      0,
      3
    );
    expect(layout.columnGroups).toEqual([["A"], ["B", "C"]]);
  });

  it("uses measured heights in the DP, not base estimates", () => {
    // base [100,100,300]: optimal k=2 split is [A,B][C] (maxH=max(224,300)=300).
    // measured [300,100,100]: optimal k=2 split is [A][B,C] (maxH=max(300,224)=300).
    // After Change 3 the DP runs on measured heights, so result must be [A][B,C].
    const layout = buildTallestAlignedLayout(
      ["A", "B", "C"],
      { A: 100, B: 100, C: 300 },
      { A: 300, B: 100, C: 100 },
      24,
      2
    );
    expect(layout.columnGroups).toEqual([["A"], ["B", "C"]]);
  });

  it("equalizes column heights for mixed solo and multi-card columns", () => {
    const layout = buildFilterSectionLayout({
      classNames: ["A", "B", "C", "D", "E"],
      measuredCardHeightByClass: {
        A: 520,
        B: 360,
        C: 240,
        D: 240,
        E: 220,
      },
      naturalGapPx: 24,
      maxColumns: 3,
      cardBottomMargin: 24,
    });

    expect(layout.columnGroups).toEqual([["A"], ["B", "C"], ["D", "E"]]);
    expect(layout.columnGroups.flat()).toEqual(["A", "B", "C", "D", "E"]);

    const getColumnHeight = (group) =>
      group.reduce(
        (sum, className) =>
          sum +
          (Number(layout.resolvedCardHeightByClass[className]) || 0) +
          (Number(layout.cardMarginBottomByClass[className]) || 0),
        0
      );
    const columnHeights = layout.columnGroups.map(getColumnHeight);

    expect(columnHeights).toEqual([624, 624, 624]);
    expect(layout.sectionHeight).toBe(648);
  });

  it("stacks short Compact+ cards while keeping capped tall cards as solo columns", () => {
    const layout = buildFilterSectionLayout({
      classNames: [
        "Grade",
        "Disease Grade Qualifier",
        "Histologic Features",
        "Pathologic Process",
      ],
      measuredCardHeightByClass: {
        Grade: 228,
        "Disease Grade Qualifier": 228,
        "Histologic Features": 300,
        "Pathologic Process": 241,
      },
      rowCountByClass: {
        Grade: 7,
        "Disease Grade Qualifier": 7,
        "Histologic Features": 24,
        "Pathologic Process": 9,
      },
      naturalGapPx: 8,
      maxColumns: 3,
      cardBottomMargin: 12,
      stackableCardMaxHeight: 300,
      allowNonContiguousPacking: true,
    });

    expect(layout.columnGroups).toEqual([
      ["Grade", "Disease Grade Qualifier"],
      ["Histologic Features"],
      ["Pathologic Process"],
    ]);
    expect(layout.cardHeightOverrideByClass["Histologic Features"]).toBe(464);
    expect(layout.cardHeightOverrideByClass["Pathologic Process"]).toBe(464);
  });

  it("LPT distributes equal-height Compact+ cards across bins, balancing by height", () => {
    const layout = buildFilterSectionLayout({
      classNames: [
        "Tissue",
        "Topography, minor",
        "Quadrant",
        "Clockface",
        "Laterality",
        "Body Part",
        "Body Fluid or Substance",
      ],
      measuredCardHeightByClass: {
        Tissue: 300,
        "Topography, minor": 300,
        Quadrant: 181,
        Clockface: 300,
        Laterality: 101,
        "Body Part": 300,
        "Body Fluid or Substance": 121,
      },
      rowCountByClass: {
        Tissue: 18,
        "Topography, minor": 16,
        Quadrant: 8,
        Clockface: 16,
        Laterality: 3,
        "Body Part": 22,
        "Body Fluid or Substance": 4,
      },
      naturalGapPx: 8,
      maxColumns: 3,
      cardBottomMargin: 12,
      categoryMaxHeight: 700,
      stackableCardMaxHeight: 300,
      allowNonContiguousPacking: true,
    });

    const bodyPartColumn = layout.columnGroups.find((group) =>
      group.includes("Body Part")
    );

    // LPT pairs Body Part (300px) with Tissue (300px) — equal heights fill the
    // same bin. Natural order within the column is preserved.
    expect(bodyPartColumn).toEqual(["Tissue", "Body Part"]);
  });
});
