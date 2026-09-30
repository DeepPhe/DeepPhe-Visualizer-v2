import {
  buildFilterSectionLayout,
  buildTallestAlignedLayout,
  estimateCardHeight,
  packColumnsInOrder,
  snapCardHeightToWholeRows,
} from "../filterLayout";
import {
  OVERSIZED_MIN_ROWS_BY_DENSITY,
  buildBalancedMasonryLayout,
  getOversizedRowThreshold,
} from "../filters/layoutConfig";

describe("filterLayout helpers", () => {
  it("globally balances outer domains while keeping the priority row anchored", () => {
    const layout = buildBalancedMasonryLayout(
      [390, 606, 914, 1296, 482, 914, 698, 698, 914].map((height, index) => ({
        id: String(index),
        height,
      })),
      3,
      16
    );

    expect([layout.columnById["0"], layout.columnById["1"], layout.columnById["2"]]).toEqual([
      1, 2, 3,
    ]);
    expect(layout.columnById).toEqual({
      0: 1,
      1: 2,
      2: 3,
      3: 1,
      4: 3,
      5: 2,
      6: 1,
      7: 2,
      8: 3,
    });
    expect(Math.max(...layout.columnHeights) - Math.min(...layout.columnHeights)).toBe(166);
  });

  it("keeps the naturally balanced two-column clinical sequence", () => {
    const layout = buildBalancedMasonryLayout(
      [390, 606, 914, 1296, 482, 914, 698, 698, 914].map((height, index) => ({
        id: String(index),
        height,
      })),
      2,
      16
    );

    expect(layout.columnById).toEqual({
      0: 1,
      1: 2,
      2: 1,
      3: 2,
      4: 1,
      5: 2,
      6: 1,
      7: 2,
      8: 1,
    });
  });

  it("estimates card height from row count", () => {
    expect(estimateCardHeight(3)).toBe(228);
    expect(estimateCardHeight(2, 20, 80)).toBe(120);
    expect(estimateCardHeight(-5, 20, 80)).toBe(80);
  });

  it("keeps shorter solo measured cards at their natural height", () => {
    const layout = buildTallestAlignedLayout(
      ["A", "B", "C"],
      { A: 120, B: 120, C: 120 },
      { A: 160, B: 130, C: 130 },
      24,
      3
    );

    expect(layout.tallestFilterBoxHeight).toBe(120);
    expect(layout.tallestMeasuredFilterBoxHeight).toBe(160);
    expect(layout.cardHeightOverrideByClass).toEqual({});
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
    expect(layout.resolvedCardHeightByClass).toEqual({ A: 200, B: 180, C: 150 });
    expect(layout.cardHeightOverrideByClass).toEqual({});
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
    expect(layout.cardHeightOverrideByClass).toEqual({});
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

  it("dedicates a column to a 25-row card even when height-balancing would pair it", () => {
    // LongList is the SHORTEST card by measured height, so a pure height packer
    // would pair it with a sibling. Its 25-row count (> threshold 24) overrides
    // that and forces it into its own column.
    const layout = buildFilterSectionLayout({
      classNames: ["LongList", "Short1", "Short2"],
      rowCountByClass: { LongList: 25, Short1: 4, Short2: 4 },
      measuredCardHeightByClass: { LongList: 80, Short1: 300, Short2: 300 },
      naturalGapPx: 24,
      maxColumns: 2,
      cardBottomMargin: 24,
      oversizedRowThreshold: 24,
    });

    const longColumn = layout.columnGroups.find((group) => group.includes("LongList"));
    expect(longColumn).toEqual(["LongList"]);
  });

  it("does not inflate short cards when an oversized sibling activates wrapper packing", () => {
    const layout = buildFilterSectionLayout({
      classNames: ["LongList", "FourRows", "TwoRows"],
      rowCountByClass: { LongList: 25, FourRows: 4, TwoRows: 2 },
      measuredCardHeightByClass: {
        LongList: 212,
        FourRows: 172,
        TwoRows: 112,
      },
      desiredCardHeightByClass: {
        LongList: 804,
        FourRows: 172,
        TwoRows: 112,
      },
      naturalGapPx: 16,
      maxColumns: 3,
      cardBottomMargin: 24,
      stackableCardMaxHeight: 212,
      oversizedRowThreshold: 24,
    });

    expect(layout.columnGroups).toEqual([
      ["LongList"],
      ["FourRows"],
      ["TwoRows"],
    ]);
    expect(layout.cardHeightOverrideByClass).toEqual({});
    expect(layout.resolvedCardHeightByClass).toEqual({
      LongList: 212,
      FourRows: 172,
      TwoRows: 112,
    });
  });

  it("does not dedicate a column to a card with only 24 rows (boundary)", () => {
    // Same shapes as above but one row fewer: not oversized, so the height
    // packer is free to pair the short LongList card with a sibling.
    const layout = buildFilterSectionLayout({
      classNames: ["LongList", "Short1", "Short2"],
      rowCountByClass: { LongList: 24, Short1: 4, Short2: 4 },
      measuredCardHeightByClass: { LongList: 80, Short1: 300, Short2: 300 },
      naturalGapPx: 24,
      maxColumns: 2,
      cardBottomMargin: 24,
      oversizedRowThreshold: 24,
    });

    const longColumn = layout.columnGroups.find((group) => group.includes("LongList"));
    expect(longColumn.length).toBeGreaterThan(1);
  });

  it("derives the per-density oversized threshold as one below the inclusive minimum", () => {
    expect(getOversizedRowThreshold("standard")).toBe(OVERSIZED_MIN_ROWS_BY_DENSITY.standard - 1);
    expect(getOversizedRowThreshold("compact")).toBe(OVERSIZED_MIN_ROWS_BY_DENSITY.compact - 1);
    expect(getOversizedRowThreshold("compact-plus")).toBe(OVERSIZED_MIN_ROWS_BY_DENSITY["compact-plus"] - 1);
  });

  it("falls back to the standard density threshold for unknown modes", () => {
    expect(getOversizedRowThreshold("nope")).toBe(getOversizedRowThreshold("standard"));
    expect(getOversizedRowThreshold(undefined)).toBe(getOversizedRowThreshold("standard"));
  });

  it("qualifies a card with exactly the configured minimum rows", () => {
    const compactMin = OVERSIZED_MIN_ROWS_BY_DENSITY.compact;
    const threshold = getOversizedRowThreshold("compact");
    expect(compactMin > threshold).toBe(true); // the minimum count claims a column
    expect(compactMin - 1 > threshold).toBe(false); // one fewer does not
  });

  it("keeps demographics cards content-sized with only the rendered gap", () => {
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

    expect(columnHeights).toEqual([480, 516, 480]);
    expect(layout.resolvedCardHeightByClass.AGE_AT_DX).toBe(480);
    expect(layout.resolvedCardHeightByClass.RACE).toBe(516);
    expect(layout.cardMarginBottomByClass.GENDER).toBe(24);
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

  it("keeps mixed solo and multi-card columns at natural heights", () => {
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

    expect(columnHeights).toEqual([520, 624, 484]);
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
    expect(layout.cardHeightOverrideByClass).toEqual({});
    expect(layout.scrollableCardStretchByClass["Histologic Features"]).toBe(464);
    expect(layout.scrollableCardStretchByClass["Pathologic Process"]).toBe(444);
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

describe("planning the Masonry's real columns", () => {
  // The Staging section as measured in Standard density: card order, natural
  // heights (long cards capped at 212), and how much of each list is hidden.
  const CLASS_NAMES = [
    "Stage",
    "T Stage",
    "N Stage",
    "M Stage",
    "Generic TNM Finding",
    "Pathologic TNM Finding",
    "Lymph Involvement",
    "Lymph Node",
    "Metastatic Site",
    "Metastatic Behavior",
    "Finding",
  ];
  const NATURAL = {
    Stage: 153,
    "T Stage": 93,
    "N Stage": 123,
    "M Stage": 93,
    "Generic TNM Finding": 212,
    "Pathologic TNM Finding": 212,
    "Lymph Involvement": 153,
    "Lymph Node": 153,
    "Metastatic Site": 93,
    "Metastatic Behavior": 123,
    Finding: 212,
  };
  // What each card would be with no cap: content that scrolls has more to show.
  const DESIRED = { ...NATURAL, "Generic TNM Finding": 331, "Pathologic TNM Finding": 421, Finding: 1261 };
  const GAP = 16;

  it("places cards the way a Masonry does: in order, into the shortest column", () => {
    const columns = packColumnsInOrder(CLASS_NAMES, NATURAL, 2, GAP);

    // The grouping the running app shows.
    expect(columns).toEqual([
      ["Stage", "M Stage", "Pathologic TNM Finding", "Lymph Node", "Metastatic Behavior"],
      [
        "T Stage",
        "N Stage",
        "Generic TNM Finding",
        "Lymph Involvement",
        "Metastatic Site",
        "Finding",
      ],
    ]);
    expect(packColumnsInOrder(["a", "b", "c"], { a: 10, b: 10, c: 10 }, 5, 0)).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
    expect(packColumnsInOrder([], {}, 2, GAP)).toEqual([]);
    // A single column is just a stack.
    expect(packColumnsInOrder(["a", "b"], { a: 5, b: 5 }, 1, GAP)).toEqual([["a", "b"]]);
  });

  it("lets a scrolling card grow into free space in its own column, and no further", () => {
    const layout = buildFilterSectionLayout({
      classNames: CLASS_NAMES,
      measuredCardHeightByClass: NATURAL,
      desiredCardHeightByClass: DESIRED,
      rowCountByClass: Object.fromEntries(CLASS_NAMES.map((name) => [name, 5])),
      naturalGapPx: GAP,
      maxColumns: 11,
      stackableCardMaxHeight: 212,
      masonryColumnCount: 2,
    });

    expect(layout.plansMasonryColumns).toBe(true);
    expect(layout.columnGroups).toHaveLength(2);

    const tallest = Math.max(
      ...layout.columnGroups.map(
        (group) =>
          group.reduce((sum, name) => sum + NATURAL[name], 0) + (group.length - 1) * GAP
      )
    );
    const left = layout.columnGroups[0];
    const leftNatural = left.reduce((sum, name) => sum + NATURAL[name], 0) + (left.length - 1) * GAP;
    const grown = layout.scrollableCardStretchByClass["Pathologic TNM Finding"];

    // It takes the column's free space...
    expect(grown).toBe(212 + (tallest - leftNatural));
    // ...but never past what it has to show.
    expect(grown).toBeLessThanOrEqual(DESIRED["Pathologic TNM Finding"]);
    // The tallest column has no free space, so its cards stay as they are.
    expect(layout.scrollableCardStretchByClass["Generic TNM Finding"]).toBeUndefined();
    expect(layout.scrollableCardStretchByClass.Finding).toBeUndefined();
    // Short cards never stretch, which is what left empty panels before.
    expect(layout.scrollableCardStretchByClass.Stage).toBeUndefined();
  });

  it("never grows a card past its own content, even with plenty of room", () => {
    const layout = buildFilterSectionLayout({
      classNames: ["Short list", "Long list", "Filler"],
      measuredCardHeightByClass: { "Short list": 212, "Long list": 100, Filler: 600 },
      // Long list is short enough to fit already, so it has nothing to grow into.
      desiredCardHeightByClass: { "Short list": 230, "Long list": 100, Filler: 600 },
      rowCountByClass: { "Short list": 8, "Long list": 2, Filler: 20 },
      naturalGapPx: GAP,
      maxColumns: 3,
      stackableCardMaxHeight: 212,
      masonryColumnCount: 2,
    });

    // Short list wants 18px more; it gets exactly that, however much room there is.
    expect(layout.scrollableCardStretchByClass["Short list"]).toBe(230);
    expect(layout.scrollableCardStretchByClass["Long list"]).toBeUndefined();
  });

  it("leaves a section alone when nothing in it scrolls, or there is one column", () => {
    const flat = buildFilterSectionLayout({
      classNames: ["a", "b", "c"],
      measuredCardHeightByClass: { a: 100, b: 120, c: 90 },
      desiredCardHeightByClass: { a: 100, b: 120, c: 90 },
      rowCountByClass: { a: 2, b: 3, c: 2 },
      naturalGapPx: GAP,
      maxColumns: 3,
      stackableCardMaxHeight: 212,
      masonryColumnCount: 2,
    });
    expect(flat.plansMasonryColumns).toBe(false);
    expect(flat.scrollableCardStretchByClass).toEqual({});

    const single = buildFilterSectionLayout({
      classNames: CLASS_NAMES,
      measuredCardHeightByClass: NATURAL,
      desiredCardHeightByClass: DESIRED,
      rowCountByClass: Object.fromEntries(CLASS_NAMES.map((name) => [name, 5])),
      naturalGapPx: GAP,
      maxColumns: 11,
      stackableCardMaxHeight: 212,
      masonryColumnCount: 1,
    });
    expect(single.plansMasonryColumns).toBe(false);
  });

  it("plans from natural heights, so the plan doesn't move as cards grow", () => {
    const first = packColumnsInOrder(CLASS_NAMES, NATURAL, 2, GAP);
    // Same plan whether or not a card has been stretched: planning reads the
    // natural heights, which the measurement hook preserves.
    const second = packColumnsInOrder(CLASS_NAMES, { ...NATURAL }, 2, GAP);
    expect(second).toEqual(first);
  });
});

describe("sharing free column space between scrolling cards", () => {
  const GAP = 16;
  // One column holding two scrolling cards next to a taller column.
  const build = (desired) =>
    buildTallestAlignedLayout(
      ["big", "hides-a-lot", "spacer", "tall"],
      { big: 300, "hides-a-lot": 212, spacer: 100, tall: 900 },
      { big: 300, "hides-a-lot": 212, spacer: 100, tall: 900 },
      GAP,
      2,
      212,
      {
        forcedColumnGroups: [["big", "hides-a-lot", "spacer"], ["tall"]],
        scrollableCardByClass: { big: true, "hides-a-lot": true },
        desiredCardHeightByClass: desired,
        slackDistributionMode: "proportional",
      }
    );

  it("finishes a card that needs little, and hands the rest to the one that needs more", () => {
    // Column is 300+212+100+2*16 = 644 against 900: 256px free.
    const layout = build({ big: 320, "hides-a-lot": 700, spacer: 100, tall: 900 });
    const stretch = layout.scrollableCardStretchByClass;

    // "big" only needs 20px more: filled completely, so it stops scrolling...
    expect(stretch.big).toBe(320);
    // ...and everything it didn't need goes to the card hiding the most.
    expect(stretch["hides-a-lot"]).toBe(212 + (256 - 20));
  });

  it("splits free space equally between cards that both need more than their share", () => {
    const layout = build({ big: 700, "hides-a-lot": 512, spacer: 100, tall: 900 });
    const stretch = layout.scrollableCardStretchByClass;

    // big hides 400px and the other 300px; each takes half of the 256px free.
    expect(stretch.big - 300).toBeCloseTo(128, 5);
    expect(stretch["hides-a-lot"] - 212).toBeCloseTo(128, 5);
    // No free space is wasted while either card still scrolls.
    expect(stretch.big - 300 + (stretch["hides-a-lot"] - 212)).toBeCloseTo(256, 5);
  });

  it("leaves space unused rather than growing past what there is to show", () => {
    const layout = build({ big: 310, "hides-a-lot": 220, spacer: 100, tall: 900 });
    const stretch = layout.scrollableCardStretchByClass;

    expect(stretch.big).toBe(310);
    expect(stretch["hides-a-lot"]).toBe(220);
  });
});

describe("ending a scrolling card on a whole row", () => {
  // Measured from the running app: 30px rows starting 10px into the chart, and
  // 36px of card chrome (header plus a 1px border either side).
  const METRICS = { rowHeight: 30, firstRowOffset: 10, chromeHeight: 36 };

  it("rounds down to the last whole row that fits", () => {
    // 36 + 10 + 30*n
    expect(snapCardHeightToWholeRows(212, METRICS)).toBe(196);
    expect(snapCardHeightToWholeRows(196, METRICS)).toBe(196);
    expect(snapCardHeightToWholeRows(380, METRICS)).toBe(376);
    // Never taller than it was asked to be.
    [150, 212, 333, 380, 519].forEach((height) => {
      expect(snapCardHeightToWholeRows(height, METRICS)).toBeLessThanOrEqual(height);
    });
  });

  it("leaves the height alone without usable measurements, or when no row fits", () => {
    expect(snapCardHeightToWholeRows(212, undefined)).toBe(212);
    expect(snapCardHeightToWholeRows(212, { rowHeight: 0, chromeHeight: 36 })).toBe(212);
    expect(snapCardHeightToWholeRows(212, { rowHeight: 30 })).toBe(212);
    // Less than one row of room: leave it, rather than showing none.
    expect(snapCardHeightToWholeRows(60, METRICS)).toBe(60);
    expect(snapCardHeightToWholeRows(Number.NaN, METRICS)).toBeNaN();
  });

  it("scales with the row height, so it holds at other font sizes", () => {
    const large = { rowHeight: 37.5, firstRowOffset: 12, chromeHeight: 40 };
    const snapped = snapCardHeightToWholeRows(300, large);
    expect((snapped - 40 - 12) / 37.5).toBe(Math.round((snapped - 40 - 12) / 37.5));
    expect(snapped).toBeLessThanOrEqual(300);
    expect(300 - snapped).toBeLessThan(37.5);
  });
});

describe("handing out free column space in whole rows", () => {
  const GAP = 16;
  const ROW = 30;
  const tallFor = (slack) => 620 + slack;
  const layoutFor = (slack, desired, quanta) =>
    buildTallestAlignedLayout(
      ["a", "b", "c", "tall"],
      { a: 196, b: 196, c: 196, tall: tallFor(slack) },
      { a: 196, b: 196, c: 196, tall: tallFor(slack) },
      GAP,
      2,
      212,
      {
        forcedColumnGroups: [["a", "b", "c"], ["tall"]],
        scrollableCardByClass: { a: true, b: true, c: true },
        desiredCardHeightByClass: desired,
        rowQuantumByClass: quanta,
        slackDistributionMode: "proportional",
      }
    );
  const HUNGRY = { a: 500, b: 700, c: 600, tall: 1000 };
  const ROWS = { a: ROW, b: ROW, c: ROW, tall: ROW };

  it("gives one whole row to one card rather than three unusable slivers", () => {
    // 37px free: enough for exactly one 30px row.
    const stretch = layoutFor(37, HUNGRY, ROWS).scrollableCardStretchByClass;
    const grown = ["a", "b", "c"].filter((name) => stretch[name] !== undefined);

    expect(grown).toHaveLength(1);
    // The neediest card (b hides the most) takes it.
    expect(grown[0]).toBe("b");
    expect(stretch.b).toBe(196 + ROW);
  });

  it("spreads rows evenly across needy cards as room allows", () => {
    // 100px: three whole rows, one each.
    const stretch = layoutFor(100, HUNGRY, ROWS).scrollableCardStretchByClass;
    expect(stretch.a - 196).toBe(ROW);
    expect(stretch.b - 196).toBe(ROW);
    expect(stretch.c - 196).toBe(ROW);

    // 130px: four rows, so the neediest gets the extra.
    const more = layoutFor(130, HUNGRY, ROWS).scrollableCardStretchByClass;
    expect(more.b - 196).toBe(2 * ROW);
    expect((more.a - 196) + (more.b - 196) + (more.c - 196)).toBe(4 * ROW);
  });

  it("uses only what fits, and lets a card that needs less than a row finish", () => {
    // Less than one row free: nothing is given away.
    expect(layoutFor(20, HUNGRY, ROWS).scrollableCardStretchByClass).toEqual({});

    // "a" has only 12px more to show. With 45px free the neediest card takes a
    // whole row (30), and the 15 left is enough for "a" to finish completely.
    const finishing = layoutFor(45, { ...HUNGRY, a: 208 }, ROWS).scrollableCardStretchByClass;
    expect(finishing.b).toBe(196 + ROW);
    expect(finishing.a).toBe(208);
    // With only 40, the row goes to the neediest and 10 is too little to finish "a".
    const tight = layoutFor(40, { ...HUNGRY, a: 208 }, ROWS).scrollableCardStretchByClass;
    expect(tight.b).toBe(196 + ROW);
    expect(tight.a).toBeUndefined();
  });

  it("falls back to an even split when row heights are unknown", () => {
    const stretch = layoutFor(90, HUNGRY, {}).scrollableCardStretchByClass;
    expect(stretch.a - 196).toBeCloseTo(30, 5);
    expect(stretch.b - 196).toBeCloseTo(30, 5);
    expect(stretch.c - 196).toBeCloseTo(30, 5);
  });
});
