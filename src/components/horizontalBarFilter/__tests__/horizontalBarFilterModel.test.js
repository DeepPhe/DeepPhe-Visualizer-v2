import {
  computeChartGeometry,
  createCustomSortIndexMap,
  formatCountLabel,
  normalizeChartData,
  shouldShowPatientDots,
  sortChartData,
  toDotPatientIds,
} from "../horizontalBarFilterModel";

const row = (label, value, extra = {}) => ({ label, displayLabel: label, value, ...extra });

describe("normalizeChartData", () => {
  it("coerces values, fills displayLabel, de-duplicates patient ids, and drops empty labels", () => {
    const result = normalizeChartData([
      { label: "A", value: 5, patientIds: ["p1", "p1", "p2"] },
      { label: "  ", value: 3 },
      { label: "B", value: -2, includedValue: 1 },
      { label: "C", value: "not-a-number" },
    ]);

    expect(result.map((item) => item.label)).toEqual(["A", "B", "C"]);
    expect(result[0]).toMatchObject({ displayLabel: "A", value: 5, patientIds: ["p1", "p2"] });
    expect(result[1]).toMatchObject({ value: 0, includedValue: 1 }); // negative clamped to 0
    expect(result[2].value).toBe(0); // NaN -> 0
  });

  it("maps rollup/hierarchy flags from the raw payload", () => {
    const [item] = normalizeChartData([
      { label: "P", value: 1, _isRolledUp: true, _expandable: true, _isChild: false, _isExpandedParent: true },
    ]);
    expect(item).toMatchObject({ isRolledUp: true, isExpandable: true, isChild: false, isExpandedParent: true });
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizeChartData(null)).toEqual([]);
    expect(normalizeChartData(undefined)).toEqual([]);
  });
});

describe("sortChartData (flat)", () => {
  const rows = [row("A", 1), row("B", 3), row("C", 2)];

  it("sorts by count descending then ascending", () => {
    expect(sortChartData(rows, { sortMode: "value-desc" }).map((r) => r.label)).toEqual(["B", "C", "A"]);
    expect(sortChartData(rows, { sortMode: "value-asc" }).map((r) => r.label)).toEqual(["A", "C", "B"]);
  });

  it("sorts alphabetically in both directions", () => {
    expect(sortChartData(rows, { sortMode: "alpha-asc" }).map((r) => r.label)).toEqual(["A", "B", "C"]);
    expect(sortChartData(rows, { sortMode: "alpha-desc" }).map((r) => r.label)).toEqual(["C", "B", "A"]);
  });

  it("honors a custom sort order for alpha modes", () => {
    const customSortIndexMap = createCustomSortIndexMap(["C", "A", "B"]);
    expect(
      sortChartData(rows, { sortMode: "alpha-asc", customSortIndexMap }).map((r) => r.label)
    ).toEqual(["C", "A", "B"]);
  });

  it("does not mutate the input array", () => {
    const input = [row("A", 1), row("B", 3)];
    sortChartData(input, { sortMode: "value-desc" });
    expect(input.map((r) => r.label)).toEqual(["A", "B"]);
  });
});

describe("sortChartData (hierarchical)", () => {
  it("sorts parents by mode and keeps children grouped under their parent", () => {
    const rows = [
      row("P1", 5, { isChild: false }),
      row("C1", 2, { isChild: true }),
      row("P2", 8, { isChild: false }),
    ];
    const sorted = sortChartData(rows, { sortMode: "value-desc", hasHierarchyRows: true });
    expect(sorted.map((r) => r.label)).toEqual(["P2", "P1", "C1"]);
  });
});

describe("formatCountLabel", () => {
  it("shows the total alone when there is no distinct included value", () => {
    expect(formatCountLabel(5)).toBe("5");
    expect(formatCountLabel(5, 5)).toBe("5");
    expect(formatCountLabel(1000)).toBe("1,000");
  });

  it("shows included/total when they differ", () => {
    expect(formatCountLabel(5, 3)).toBe("3/5");
  });
});

describe("createCustomSortIndexMap", () => {
  it("returns null for empty input and de-duplicates tokens", () => {
    expect(createCustomSortIndexMap([])).toBeNull();
    // The duplicate "A" is ignored; each kept token retains its original array index.
    const map = createCustomSortIndexMap(["A", "A", "B"]);
    expect(map.size).toBe(2);
    expect(map.get("A")).toBe(0);
    expect(map.get("B")).toBe(2);
  });
});

describe("computeChartGeometry", () => {
  it("computes standard-density metrics with the count column pinned to the right edge", () => {
    const geometry = computeChartGeometry({
      isCompactDensity: false,
      safeFontScale: 1,
      safeBarRegionScale: 1,
      chartWidth: 780,
      maxLabelLength: 10,
      maxCountLabelLength: 3,
      hasHierarchyRows: false,
      rowCount: 5,
    });

    expect(geometry).toMatchObject({
      textFontSize: 12,
      rowHeight: 30,
      barHeight: 18,
      dotRadius: 3,
      dotHitRadius: 8,
      countColumnWidth: 38,
      hierarchyInsetWidth: 0,
      columnGap: 8,
      countColumnStartX: 736,
      labelColumnWidth: 92,
      barStartX: 106,
      fullBarMaxWidth: 622,
      barMaxWidth: 622,
      maxLabelCharacters: 11,
      verticalPaddingTop: 10,
      calculatedHeight: 170, // 5 rows * 30 + 20 padding
    });
  });

  it("tightens metrics and adds a hierarchy inset in compact density", () => {
    const geometry = computeChartGeometry({
      isCompactDensity: true,
      safeFontScale: 1,
      safeBarRegionScale: 1,
      chartWidth: 400,
      maxLabelLength: 5,
      maxCountLabelLength: 2,
      hasHierarchyRows: true,
      rowCount: 3,
    });

    expect(geometry).toMatchObject({
      textFontSize: 11,
      rowHeight: 20,
      barHeight: 12,
      hierarchyInsetWidth: 28, // icon hit width + child indent
      countColumnStartX: 356,
      labelColumnWidth: 76,
      barStartX: 90,
      barMaxWidth: 258,
      maxLabelCharacters: 8,
      verticalPaddingTop: 3,
      calculatedHeight: 66, // 3 rows * 20 + 6 padding
    });
  });

  it("scales the bar region width by safeBarRegionScale", () => {
    const base = {
      isCompactDensity: false,
      safeFontScale: 1,
      chartWidth: 780,
      maxLabelLength: 10,
      maxCountLabelLength: 3,
      hasHierarchyRows: false,
      rowCount: 5,
    };
    expect(computeChartGeometry({ ...base, safeBarRegionScale: 1 }).barMaxWidth).toBe(622);
    expect(computeChartGeometry({ ...base, safeBarRegionScale: 0.5 }).barMaxWidth).toBe(311);
  });
});

describe("patient dot helpers", () => {
  it("shows dots only within threshold and with patient ids", () => {
    expect(shouldShowPatientDots({ value: 3, patientIds: ["p1"] }, 5)).toBe(true);
    expect(shouldShowPatientDots({ value: 10, patientIds: ["p1"] }, 5)).toBe(false);
    expect(shouldShowPatientDots({ value: 3, patientIds: [] }, 5)).toBe(false);
  });

  it("caps dot ids at the row value", () => {
    expect(toDotPatientIds({ value: 2, patientIds: ["p1", "p2", "p3"] })).toEqual(["p1", "p2"]);
    expect(toDotPatientIds({ value: 5, patientIds: ["p1", "p2"] })).toEqual(["p1", "p2"]);
  });
});
