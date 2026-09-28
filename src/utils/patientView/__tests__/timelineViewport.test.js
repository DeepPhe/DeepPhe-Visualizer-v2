import {
  DEFAULT_VIEWPORT,
  MAX_ZOOM,
  PAN_STEP_RATIO,
  applySliderKey,
  canPanEarlier,
  canPanLater,
  clampPanRatio,
  clampZoom,
  computeOverviewStripLayout,
  dateWindowToViewport,
  describeViewportRange,
  estimateLabelWidth,
  formatHandleDate,
  getMinimumWindowRatio,
  getViewportWindow,
  layoutHandleLabels,
  moveViewportEdge,
  moveViewportWindow,
  centerViewportOn,
  getSnapRatio,
  panViewport,
  rebaseViewport,
  resolveOverviewTicks,
  sameDateDomain,
  snapRatioToEnds,
  spansMultipleYears,
  unionDateDomains,
  viewportFromWindow,
  viewportToDateWindow,
  zoomViewport,
} from "../timelineViewport";
import { resolveTicks } from "../timelineChartLayout";

const DOMAIN_START = new Date(2010, 0, 4);
const DOMAIN_END = new Date(2011, 2, 20);

describe("timeline viewport math", () => {
  it("clamps zoom to 1×–16× and the pan to both domain ends", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(40)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampPanRatio(-0.3, 4)).toBe(0);
    expect(clampPanRatio(0.9, 4)).toBe(0.75);
    expect(clampPanRatio(0.5, 1)).toBe(0);
  });

  it("keeps the anchor's date fixed while zooming", () => {
    const start = { zoom: 2, panRatio: 0.3 };
    const anchorFraction = 0.25;
    const anchorRatio = start.panRatio + anchorFraction / start.zoom;

    const zoomed = zoomViewport(start, 1.5, anchorFraction);
    expect(zoomed.zoom).toBe(3);
    expect(zoomed.panRatio + anchorFraction / zoomed.zoom).toBeCloseTo(anchorRatio, 10);

    // At the cap nothing moves.
    expect(zoomViewport({ zoom: MAX_ZOOM, panRatio: 0.5 }, 1.5)).toEqual({
      zoom: MAX_ZOOM,
      panRatio: 0.5,
    });
  });

  it("pans by 20% of the visible window and stops at each end", () => {
    const viewport = { zoom: 4, panRatio: 0.4 };
    const { startRatio, endRatio } = getViewportWindow(viewport);
    const later = panViewport(viewport, 1);
    expect(later.panRatio - viewport.panRatio).toBeCloseTo(PAN_STEP_RATIO * (endRatio - startRatio), 10);
    expect(panViewport(viewport, -1).panRatio).toBeCloseTo(0.35, 10);

    expect(panViewport({ zoom: 4, panRatio: 0.74 }, 1).panRatio).toBe(0.75);
    expect(panViewport({ zoom: 4, panRatio: 0.01 }, -1).panRatio).toBe(0);
    expect(canPanEarlier({ zoom: 4, panRatio: 0 })).toBe(false);
    expect(canPanLater({ zoom: 4, panRatio: 0.75 })).toBe(false);
    expect(canPanEarlier(DEFAULT_VIEWPORT)).toBe(false);
    expect(canPanLater(DEFAULT_VIEWPORT)).toBe(false);
  });

  it("moves one edge at a time, enforcing the minimum window and no crossing", () => {
    const minimum = 0.1;
    const viewport = viewportFromWindow(0.2, 0.6, minimum);

    const startMoved = moveViewportEdge(viewport, "start", 0.3, minimum);
    expect(getViewportWindow(startMoved).startRatio).toBeCloseTo(0.3, 10);
    expect(getViewportWindow(startMoved).endRatio).toBeCloseTo(0.6, 10);

    // Dragged past the other handle, the start stops the minimum short of it.
    const pastEnd = getViewportWindow(moveViewportEdge(viewport, "start", 0.95, minimum));
    expect(pastEnd.startRatio).toBeCloseTo(0.5, 10);
    expect(pastEnd.endRatio).toBeCloseTo(0.6, 10);

    const pastStart = getViewportWindow(moveViewportEdge(viewport, "end", -1, minimum));
    expect(pastStart.startRatio).toBeCloseTo(0.2, 10);
    expect(pastStart.endRatio).toBeCloseTo(0.3, 10);

    const pastDomain = getViewportWindow(moveViewportEdge(viewport, "end", 1.4, minimum));
    expect(pastDomain.endRatio).toBe(1);

    // The minimum is never narrower than MAX_ZOOM allows.
    expect(getMinimumWindowRatio(1064)).toBeCloseTo(1 / MAX_ZOOM, 10);
    expect(getMinimumWindowRatio(64)).toBeCloseTo(8 / 64, 10);
  });

  it("drags and recenters the window without changing its width", () => {
    const viewport = { zoom: 5, panRatio: 0.1 };
    expect(moveViewportWindow(viewport, 0.9)).toEqual({ zoom: 5, panRatio: 0.8 });
    expect(centerViewportOn(viewport, 0.5).panRatio).toBeCloseTo(0.4, 10);
    expect(centerViewportOn(viewport, 0).panRatio).toBe(0);
  });

  it("handles the slider keys like a multi-thumb slider", () => {
    const minimum = 0.1;
    const viewport = viewportFromWindow(0.4, 0.6, minimum);
    const windowOf = (next) => getViewportWindow(next);

    expect(windowOf(applySliderKey(viewport, "start", "ArrowLeft", { minWindowRatio: minimum })).startRatio).toBeCloseTo(0.35, 10);
    expect(windowOf(applySliderKey(viewport, "end", "ArrowRight", { shiftKey: true, minWindowRatio: minimum })).endRatio).toBeCloseTo(0.8, 10);

    const panned = windowOf(applySliderKey(viewport, "window", "ArrowRight", { minWindowRatio: minimum }));
    expect(panned.startRatio).toBeCloseTo(0.45, 10);
    expect(panned.endRatio).toBeCloseTo(0.65, 10);

    expect(windowOf(applySliderKey(viewport, "window", "Home", { minWindowRatio: minimum })).startRatio).toBe(0);
    expect(windowOf(applySliderKey(viewport, "window", "End", { minWindowRatio: minimum })).endRatio).toBeCloseTo(1, 10);

    const endHome = windowOf(applySliderKey(viewport, "end", "Home", { minWindowRatio: minimum }));
    expect(endHome.endRatio - endHome.startRatio).toBeCloseTo(minimum, 10);

    // Holding ArrowRight on the start handle never passes the end handle.
    let held = viewport;
    for (let press = 0; press < 20; press += 1) {
      held = applySliderKey(held, "start", "ArrowRight", { minWindowRatio: minimum });
    }
    expect(windowOf(held).endRatio - windowOf(held).startRatio).toBeCloseTo(minimum, 10);
    expect(windowOf(held).endRatio).toBeCloseTo(0.6, 10);

    expect(applySliderKey(viewport, "start", "Enter", { minWindowRatio: minimum })).toBeNull();
  });

  it("round-trips between a viewport and its date window", () => {
    const viewport = { zoom: 3.2, panRatio: 0.41 };
    const { startDate, endDate } = viewportToDateWindow(viewport, DOMAIN_START, DOMAIN_END);
    const roundTripped = dateWindowToViewport(startDate, endDate, DOMAIN_START, DOMAIN_END);

    expect(roundTripped.zoom).toBeCloseTo(viewport.zoom, 6);
    expect(roundTripped.panRatio).toBeCloseTo(viewport.panRatio, 6);
    expect(viewportToDateWindow(DEFAULT_VIEWPORT, DOMAIN_START, DOMAIN_END)).toEqual({
      startDate: DOMAIN_START,
      endDate: DOMAIN_END,
    });
  });

  it("maps the overview window's edges to the detail axis's end dates for any viewport", () => {
    const plotLeft = 236;
    const plotWidth = 1064;
    [DEFAULT_VIEWPORT, { zoom: 2, panRatio: 0.5 }, { zoom: 16, panRatio: 0.9375 }, { zoom: 7.3, panRatio: 0.21 }].forEach(
      (viewport) => {
        const { startRatio, endRatio } = getViewportWindow(viewport);
        const { startDate, endDate } = viewportToDateWindow(viewport, DOMAIN_START, DOMAIN_END);
        const detailTicks = resolveTicks(startDate, endDate, plotWidth, plotLeft, 7);
        const spanMs = DOMAIN_END.getTime() - DOMAIN_START.getTime();
        const windowLeftDate = DOMAIN_START.getTime() + startRatio * spanMs;
        const windowRightDate = DOMAIN_START.getTime() + endRatio * spanMs;

        // A Date holds whole milliseconds, so allow the truncation.
        expect(Math.abs(detailTicks[0].date.getTime() - windowLeftDate)).toBeLessThan(1);
        expect(
          Math.abs(detailTicks[detailTicks.length - 1].date.getTime() - windowRightDate)
        ).toBeLessThan(1);
      }
    );
  });
});

describe("linked timeline domains", () => {
  it("snaps a ratio within the snap distance to either end", () => {
    const snap = getSnapRatio(600);
    expect(snap).toBeCloseTo(6 / 600, 10);
    expect(snapRatioToEnds(0.009, snap)).toBe(0);
    expect(snapRatioToEnds(0.991, snap)).toBe(1);
    expect(snapRatioToEnds(0.02, snap)).toBe(0.02);
    expect(snapRatioToEnds(-0.4, snap)).toBe(0);

    // Snapping both edges gives exactly 100%, not "100%" at 1.004×.
    const almostFull = moveViewportEdge(
      viewportFromWindow(0.3, 1),
      "start",
      snapRatioToEnds(0.004, snap)
    );
    expect(almostFull).toEqual({ zoom: 1, panRatio: 0 });
  });

  it("covers every valid domain, ignoring missing ones", () => {
    const documents = { startDate: new Date(2010, 0, 4), endDate: new Date(2011, 2, 22) };
    const events = { startDate: new Date(2008, 10, 20), endDate: new Date(2011, 3, 20) };

    expect(unionDateDomains([documents, null, events])).toEqual({
      startDate: events.startDate,
      endDate: events.endDate,
    });
    expect(unionDateDomains([documents])).toEqual(documents);
    expect(unionDateDomains([null, { startDate: "nope" }])).toBeNull();
    expect(sameDateDomain(documents, { ...documents })).toBe(true);
    expect(sameDateDomain(documents, events)).toBe(false);
  });

  it("keeps a zoomed reader's dates when the domain widens, and 100% at 100%", () => {
    const narrow = { startDate: new Date(2010, 0, 1), endDate: new Date(2011, 0, 1) };
    const wide = { startDate: new Date(2009, 0, 1), endDate: new Date(2011, 0, 1) };

    const zoomed = { zoom: 4, panRatio: 0.5 };
    const before = viewportToDateWindow(zoomed, narrow.startDate, narrow.endDate);
    const rebased = rebaseViewport(zoomed, narrow, wide);
    const after = viewportToDateWindow(rebased, wide.startDate, wide.endDate);
    expect(after.startDate.getTime()).toBeCloseTo(before.startDate.getTime(), -1);
    expect(after.endDate.getTime()).toBeCloseTo(before.endDate.getTime(), -1);
    expect(rebased.zoom).toBeGreaterThan(zoomed.zoom);

    expect(rebaseViewport(DEFAULT_VIEWPORT, narrow, wide)).toEqual(DEFAULT_VIEWPORT);
  });
});

describe("timeline date labels", () => {
  it("prints a UTC-midnight date as its own calendar day when formatted in UTC", () => {
    // In any timezone west of UTC, local formatting would print Dec 31, 2009.
    const utcMidnight = new Date(Date.UTC(2010, 0, 1));
    expect(formatHandleDate(utcMidnight, { timeZone: "UTC" })).toBe("Jan 1");
    expect(formatHandleDate(utcMidnight, { includeYear: true, timeZone: "UTC" })).toBe("Jan 1, 2010");
    expect(resolveTicks(utcMidnight, new Date(Date.UTC(2010, 1, 1)), 100, 0, 2, { timeZone: "UTC" })[0].label).toBe("Jan 1");
  });

  it("adds the year only when the domain crosses a calendar year", () => {
    expect(spansMultipleYears(new Date(2010, 0, 4), new Date(2011, 2, 20))).toBe(true);
    expect(spansMultipleYears(new Date(2010, 0, 4), new Date(2010, 11, 20))).toBe(false);
    expect(formatHandleDate(new Date(2010, 10, 12))).toBe("Nov 12");
    expect(formatHandleDate(new Date(Number.NaN))).toBe("Unknown date");
    expect(
      describeViewportRange({ zoom: 2, panRatio: 0 }, new Date(2010, 0, 1), new Date(2011, 0, 1))
    ).toMatch(/^Showing Jan 1, 2010 to Jul 2, 2010$/);
  });

  it("always labels both overview ends and drops interior ticks that collide with them", () => {
    const ticks = resolveOverviewTicks({
      startDate: DOMAIN_START,
      endDate: DOMAIN_END,
      plotLeft: 0,
      plotWidth: 1000,
      tickCount: 7,
    });
    expect(ticks[0]).toMatchObject({ label: "Jan 2010", anchor: "start", x: 0 });
    expect(ticks[ticks.length - 1]).toMatchObject({ label: "Mar 2011", anchor: "end", x: 1000 });
    expect(ticks).toHaveLength(7);

    // So narrow that every interior label would touch an end label.
    const crowded = resolveOverviewTicks({
      startDate: DOMAIN_START,
      endDate: DOMAIN_END,
      plotLeft: 0,
      plotWidth: 150,
      tickCount: 7,
    });
    expect(crowded.map((tick) => tick.label)).toEqual(["Jan 2010", "Mar 2011"]);

    const endsOnly = resolveOverviewTicks({
      startDate: DOMAIN_START,
      endDate: DOMAIN_END,
      plotLeft: 0,
      plotWidth: 1000,
      tickCount: 7,
      endLabelsOnly: true,
    });
    expect(endsOnly).toHaveLength(2);
  });

  it("lays out the handle labels: separate, merged, clamped, or hidden", () => {
    const base = {
      startLabel: "Nov 12, 2010",
      endLabel: "Mar 4, 2011",
      plotLeft: 100,
      plotWidth: 800,
      fontSize: 12,
    };
    const labelWidth = estimateLabelWidth("Nov 12, 2010", 12);

    expect(layoutHandleLabels({ ...base, startX: 300, endX: 700, zoomed: false })).toEqual({
      visible: false,
      merged: false,
      labels: [],
    });

    const separate = layoutHandleLabels({ ...base, startX: 300, endX: 700 });
    expect(separate.merged).toBe(false);
    expect(separate.labels.map((label) => label.x)).toEqual([300, 700]);

    const merged = layoutHandleLabels({ ...base, startX: 480, endX: 520 });
    expect(merged.merged).toBe(true);
    expect(merged.labels).toHaveLength(1);
    expect(merged.labels[0].label).toBe("Nov 12, 2010 – Mar 4, 2011");
    expect(merged.labels[0].x).toBe(500);

    const clamped = layoutHandleLabels({ ...base, startX: 100, endX: 900 });
    expect(clamped.labels[0].left).toBeCloseTo(100, 10);
    expect(clamped.labels[1].right).toBeLessThanOrEqual(900);
    expect(clamped.labels[0].x).toBeCloseTo(100 + labelWidth / 2, 10);
  });

  it("sizes the strip from its row count", () => {
    const oneRow = computeOverviewStripLayout({ rowCount: 1 });
    const fourRows = computeOverviewStripLayout({ rowCount: 4 });
    expect(fourRows.bandHeight - oneRow.bandHeight).toBe(3 * (4 + 2));
    expect(fourRows.height - oneRow.height).toBe(18);
    expect(oneRow.bandTop).toBe(oneRow.handleOverhang);
    expect(oneRow.handleLabelBaseline).toBeGreaterThan(oneRow.bandBottom + oneRow.handleOverhang);
    expect(oneRow.axisLabelBaseline).toBeGreaterThan(oneRow.handleLabelBaseline);
    expect(computeOverviewStripLayout({ rowCount: 2, compact: true }).miniRowHeight).toBe(5);
  });
});
