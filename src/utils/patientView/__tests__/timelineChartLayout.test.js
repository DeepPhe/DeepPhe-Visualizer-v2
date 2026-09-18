import { buildTimelineChartModel, resolveTimelineDateDomain } from "../timelineChartLayout";

function timelineData(dates) {
  return {
    reportData: dates.map((date, index) => ({
      id: `doc-${index + 1}`,
      name: `Doc ${index + 1}`,
      date,
      type: "Clinical note",
      episode: "Diagnostic",
    })),
  };
}

const LAYOUT = { svgWidth: 1000, plotLeft: 200, plotRight: 25 };

describe("document timeline date domain", () => {
  it("pads its dated documents by 21 days", () => {
    const domain = resolveTimelineDateDomain(timelineData(["201003161030", "201102011200"]));
    expect(domain.startDate.getTime()).toBe(new Date(2010, 1, 23, 10, 30).getTime());
    expect(domain.endDate.getTime()).toBe(new Date(2011, 1, 22, 12, 0).getTime());
  });

  it("has no domain when the chart isn't drawn", () => {
    expect(resolveTimelineDateDomain({})).toBeNull();
    expect(resolveTimelineDateDomain(timelineData(["not a date"]))).toBeNull();
    // Every document on one timestamp: the chart gives way to episode dropdowns.
    expect(resolveTimelineDateDomain(timelineData(["201003161030", "201003161030"]))).toBeNull();
    // A single document still draws, padded either side.
    expect(resolveTimelineDateDomain(timelineData(["201003161030"]))).not.toBeNull();
  });

  it("matches the domain the chart model builds by itself", () => {
    const data = timelineData(["201003161030", "201006011000", "201102011200"]);
    expect(buildTimelineChartModel(data, LAYOUT).dateDomain).toEqual(
      resolveTimelineDateDomain(data)
    );
  });

  it("places documents against a shared domain when one is given", () => {
    const data = timelineData(["201003161030", "201102011200"]);
    const shared = { startDate: new Date(2009, 0, 1), endDate: new Date(2011, 5, 1) };
    const model = buildTimelineChartModel(data, { ...LAYOUT, dateDomain: shared });

    expect(model.dateDomain).toEqual(shared);
    const spanMs = shared.endDate.getTime() - shared.startDate.getTime();
    const expectedX =
      LAYOUT.plotLeft +
      model.dimensions.plotWidth *
        ((new Date(2010, 2, 16, 10, 30).getTime() - shared.startDate.getTime()) / spanMs);
    expect(model.points[0].x).toBeCloseTo(expectedX, 6);
    // The domain override is not a layout dimension.
    expect(model.dimensions.dateDomain).toBeUndefined();
  });
});
