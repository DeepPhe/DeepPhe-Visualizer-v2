import {
  buildEventRelationHeatmap,
  computeEventRelationAgeAxis,
  buildEventRelationTooltip,
  checkOverlapWithPadding,
  computeEventRelationDomain,
  computeEventRelationTimelineLayout,
  formatEventRelationDuration,
  getEventRelationGlyph,
  packSpansIntoLanes,
} from "../eventRelationTimelineLayout";
import { zoomIdentity } from "d3-zoom";
import {
  LANE,
  MARGINS,
  PLOT_RIGHT_GUTTER,
  TIMELINE_PADDING_DAYS,
} from "../../../constants/eventRelationTimeline";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function span(id, laneGroup, startIso, endIso, overrides = {}) {
  return {
    id,
    laneGroup,
    start: startIso,
    end: endIso,
    startTime: Date.parse(`${startIso}T00:00:00Z`),
    endTime: Date.parse(`${endIso}T00:00:00Z`),
    relation1: "Overlaps",
    relation2: "Overlaps",
    relationKey: "Overlaps/Overlaps",
    negated: false,
    conceptIds: [id],
    conceptLabels: [id],
    ...overrides,
  };
}

describe("event relation timeline layout", () => {
  it("pads the data extent by the alpha's 50 days instead of hardcoding a domain", () => {
    const spans = [
      span("a", "Finding", "2010-01-01", "2010-06-01"),
      span("b", "Finding", "2009-03-15", "2011-02-20"),
    ];
    const domain = computeEventRelationDomain(spans);

    expect(domain.startDate.getTime()).toBe(
      Date.parse("2009-03-15T00:00:00Z") - TIMELINE_PADDING_DAYS * MS_PER_DAY
    );
    expect(domain.endDate.getTime()).toBe(
      Date.parse("2011-02-20T00:00:00Z") + TIMELINE_PADDING_DAYS * MS_PER_DAY
    );
  });

  it("packs non-overlapping spans onto one lane and pushes overlaps down", () => {
    const disjoint = packSpansIntoLanes([
      { id: "a", start: "2010-01-01", x1: 0, x2: 10 },
      { id: "b", start: "2010-02-01", x1: 20, x2: 30 },
    ]);
    expect(disjoint.laneCount).toBe(1);
    expect(disjoint.laneIndexById.get("b")).toBe(0);

    const overlapping = packSpansIntoLanes([
      { id: "a", start: "2010-01-01", x1: 0, x2: 40 },
      { id: "b", start: "2010-01-15", x1: 20, x2: 60 },
      { id: "c", start: "2010-02-01", x1: 50, x2: 80 },
    ]);
    expect(overlapping.laneCount).toBe(2);
    expect(overlapping.laneIndexById.get("a")).toBe(0);
    expect(overlapping.laneIndexById.get("b")).toBe(1);
    // "c" clears lane 0 (ends at 40) so it packs back up rather than opening a third lane.
    expect(overlapping.laneIndexById.get("c")).toBe(0);
  });

  it("collapses a group to a single lane", () => {
    const packed = packSpansIntoLanes(
      [
        { id: "a", start: "2010-01-01", x1: 0, x2: 40 },
        { id: "b", start: "2010-01-15", x1: 20, x2: 60 },
      ],
      { expanded: false }
    );

    expect(packed.laneCount).toBe(1);
    expect(packed.laneIndexById.get("b")).toBe(0);
  });

  it("grows an overlap range by the padding on both sides", () => {
    expect(checkOverlapWithPadding([0, 10], [12, 20], 0)).toBe(false);
    expect(checkOverlapWithPadding([0, 10], [12, 20], 8)).toBe(true);
  });

  it("lays groups out in the alpha's draw order with lane-height rows", () => {
    const layout = computeEventRelationTimelineLayout({
      containerWidth: 1040,
      spans: [
        span("t1", "Treatment", "2010-01-01", "2010-03-01"),
        span("f1", "Finding", "2010-01-01", "2010-02-01"),
        span("f2", "Finding", "2010-01-10", "2010-04-01"),
      ],
    });

    expect(layout.groups.map((group) => group.key)).toEqual(["Finding", "Treatment"]);
    expect(layout.groups[0].laneCount).toBe(2);
    expect(layout.groups[0].height).toBe(2 * LANE.height);
    expect(layout.groups[0].yOffset).toBe(0);
    expect(layout.groups[1].yOffset).toBe(2 * LANE.height + LANE.GROUP_TOP_PADDING);
    expect(layout.dimensions.svgWidth).toBe(1040 - 200 - 25);
  });

  it("keeps the viewBox wide enough for the plot's minimum width", () => {
    const spans = [span("a", "Finding", "2010-01-01", "2010-06-01")];
    const narrow = computeEventRelationTimelineLayout({ containerWidth: 375, spans });

    // The plot floor kicks in, so the drawn area is wider than the container.
    expect(narrow.dimensions.svgWidth).toBe(240);
    // The viewBox must cover the drawn content, or the right-hand end of the
    // chart is clipped away on narrow screens.
    expect(narrow.dimensions.viewBoxWidth).toBe(
      MARGINS.left + narrow.dimensions.svgWidth + PLOT_RIGHT_GUTTER
    );
    expect(narrow.dimensions.viewBoxWidth).toBeGreaterThan(375);

    // On a wide container the viewBox still matches the container exactly.
    const wide = computeEventRelationTimelineLayout({ containerWidth: 1900, spans });
    expect(wide.dimensions.viewBoxWidth).toBe(1900);
  });

  it("gives each relation pair the alpha's end caps", () => {
    const at = (relation1, relation2, x1 = 10, x2 = 90) =>
      getEventRelationGlyph({ relation1, relation2, x1, x2 });

    // Overlaps is deliberately capless: an open end reads as "extends beyond".
    expect(at("Overlaps", "Overlaps")).toMatchObject({
      kind: "span",
      markerStart: null,
      markerEnd: null,
    });
    expect(at("After", "Overlaps")).toMatchObject({ markerStart: "rightArrow", markerEnd: null });
    expect(at("Overlaps", "Before")).toMatchObject({ markerStart: null, markerEnd: "leftArrow" });
    expect(at("After", "Before")).toMatchObject({
      markerStart: "rightArrow",
      markerEnd: "leftArrow",
    });
    expect(at("On", "Before")).toMatchObject({
      markerStart: "verticalLineCap",
      markerEnd: "leftArrow",
    });
    expect(at("Overlaps", "On")).toMatchObject({ markerEnd: "verticalLineCap" });

    // After/After and Before/Before draw as a bare span in the alpha.
    expect(at("After", "After")).toMatchObject({ markerStart: null, markerEnd: null });
    expect(at("Before", "Before")).toMatchObject({ markerStart: null, markerEnd: null });

    // Same-day On/On is a bare vertical tick, not a span.
    expect(at("On", "On", 40, 40)).toMatchObject({ kind: "tick" });
    expect(at("On", "On", 40, 90)).toMatchObject({
      kind: "span",
      markerStart: "verticalLineCap",
      markerEnd: "verticalLineCap",
    });
  });

  it("uses the grey collapsed cap when a group is collapsed", () => {
    expect(
      getEventRelationGlyph(
        { relation1: "Overlaps", relation2: "On", x1: 10, x2: 90 },
        { expanded: false }
      )
    ).toMatchObject({ markerEnd: "collapsedVerticalLineCap" });
  });

  it("bins collapsed-group spans into a density heatmap", () => {
    const layout = computeEventRelationTimelineLayout({
      containerWidth: 1040,
      spans: [
        span("a", "Finding", "2010-01-01", "2010-12-01"),
        span("b", "Finding", "2010-02-01", "2010-11-01"),
      ],
      collapsedGroups: new Set(["Finding"]),
    });
    const bins = buildEventRelationHeatmap(layout.groups[0].spans, layout.mainX);

    expect(bins).toHaveLength(100);
    expect(Math.max(...bins.map((bin) => bin.count))).toBe(2);
    expect(bins.some((bin) => bin.count === 0)).toBe(true);
  });

  it("derives the age axis from the patient's date of birth", () => {
    const layout = computeEventRelationTimelineLayout({
      containerWidth: 1040,
      spans: [span("a", "Finding", "2009-01-28", "2011-03-01")],
    });
    // 2009-01-28 -50d .. 2011-03-01 +50d => 2008-12-09 .. 2011-04-20
    const axis = computeEventRelationAgeAxis(
      layout.domain,
      layout.mainX,
      new Date(Date.UTC(1960, 3, 1))
    );

    expect(axis.available).toBe(true);
    expect(axis.encounters.map((e) => e.age)).toEqual([48, 51]);
    // Birthdays falling inside the domain, labelled with the age reached.
    expect(axis.interiors.map((i) => i.age)).toEqual([49, 50, 51]);
    expect(axis.interiors[0].date.toISOString()).toBe("2009-04-01T00:00:00.000Z");
    expect(axis.interiors.every((i) => i.x > 0 && i.x <= layout.dimensions.svgWidth)).toBe(
      true
    );
  });

  it("hides age ticks that pan outside the visible plot range", () => {
    const layout = computeEventRelationTimelineLayout({
      containerWidth: 1040,
      spans: [span("a", "Finding", "2009-01-28", "2011-03-01")],
    });
    const zoomedX = zoomIdentity
      .translate(-layout.dimensions.svgWidth * 0.35, 0)
      .scale(1.8)
      .rescaleX(layout.mainX);
    const axis = computeEventRelationAgeAxis(
      layout.domain,
      zoomedX,
      new Date(Date.UTC(1960, 3, 1))
    );
    const allTicks = [...axis.encounters, ...axis.interiors];

    expect(axis.available).toBe(true);
    expect(allTicks.every((tick) => tick.x >= 0 && tick.x <= layout.dimensions.svgWidth)).toBe(
      true
    );
    expect(allTicks.map((tick) => tick.age)).not.toEqual(
      expect.arrayContaining([48, 49])
    );
  });

  it("omits the age axis and its band when no birth date is known", () => {
    const layout = computeEventRelationTimelineLayout({
      containerWidth: 1040,
      spans: [span("a", "Finding", "2010-01-01", "2010-06-01")],
    });

    expect(computeEventRelationAgeAxis(layout.domain, layout.mainX, null)).toMatchObject({
      available: false,
      encounters: [],
      interiors: [],
    });

    const withAge = computeEventRelationTimelineLayout({
      containerWidth: 1040,
      spans: [span("a", "Finding", "2010-01-01", "2010-06-01")],
      showAgeAxis: true,
    });
    const withoutAge = computeEventRelationTimelineLayout({
      containerWidth: 1040,
      spans: [span("a", "Finding", "2010-01-01", "2010-06-01")],
      showAgeAxis: false,
    });

    expect(withoutAge.dimensions.svgTotalHeight).toBeLessThan(
      withAge.dimensions.svgTotalHeight
    );
    expect(withoutAge.dimensions.overviewTop).toBeLessThan(withAge.dimensions.overviewTop);
  });

  it("formats the alpha's duration and tooltip text", () => {
    expect(formatEventRelationDuration("2010-01-01", "2011-03-15")).toBe(
      "1 year, 2 months, 13 days"
    );

    expect(
      buildEventRelationTooltip({
        start: "2010-01-01",
        end: "2010-01-31",
        relation1: "On",
        relation2: "Before",
        conceptLabels: ["Carboplatin", "Carboplatin", "Doxorubicin"],
      })
    ).toBe(
      "Duration: 1 month\nOn: 2010-01-01\nBefore: 2010-01-31\nConcept Name: Carboplatin (x2), Doxorubicin"
    );
  });
});
