/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container, testing-library/no-node-access */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, getContrastRatio } from "@mui/material/styles";
import TimelineOverviewStrip, { getOverviewStripColors } from "../TimelineOverviewStrip";
import TimelineZoomControls from "../TimelineZoomControls";
import { THEME_OPTIONS, getThemeByKey } from "../../../../themes";
import { WCAG_AA_TEXT_CONTRAST, WCAG_UI_CONTRAST } from "../../../../utils/colorContrast";
import { getViewportWindow, viewportToDateWindow } from "../../../../utils/patientView/timelineViewport";

// Composited panel backgrounds the timelines sit on (see the card tests).
const PANEL_BACKGROUNDS = { obsidian: "#1A2332", vapor: "#161425", govuk: "#FFFFFF" };

const DOMAIN_START = new Date(2010, 0, 4);
const DOMAIN_END = new Date(2011, 2, 20);
const LABELS = { group: "Range", window: "Window", start: "Start", end: "End" };
const ROWS = [
  { key: "Clinical note", marks: [{ key: "a", x1: 120, x2: 120, color: "#A5D6A7" }] },
  {
    key: "Pathology",
    marks: [
      { key: "b", x1: 300, x2: 300, color: "#FFAB91" },
      { key: "c", x1: 500, x2: 640, color: "#CE93D8" },
    ],
  },
];

function renderStrip(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onViewportChange = jest.fn();
  const baseProps = {
    plotLeft: 100,
    plotWidth: 800,
    top: 0,
    rows: ROWS,
    viewport: { zoom: 1, panRatio: 0 },
    onViewportChange,
    minWindowRatio: 1 / 16,
    domainStart: DOMAIN_START,
    domainEnd: DOMAIN_END,
    tickCount: 5,
    clientToX: (clientX) => clientX,
    labels: LABELS,
    testIdPrefix: "test-timeline",
  };
  const render = (nextProps) =>
    act(() => {
      root.render(
        <svg>
          <TimelineOverviewStrip {...baseProps} {...nextProps} />
        </svg>
      );
    });

  render(props);
  return {
    container,
    onViewportChange,
    rerender: render,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const byTestId = (container, testId) => container.querySelector(`[data-testid='${testId}']`);

describe("TimelineOverviewStrip", () => {
  it("draws one mark per input at its full-domain position, at least 3px wide", () => {
    const { container, unmount } = renderStrip();

    const marks = [...container.querySelectorAll("[data-testid='test-timeline-overview-tick']")];
    expect(marks).toHaveLength(3);
    expect(marks.map((mark) => [mark.dataset.row, Number(mark.getAttribute("x")), Number(mark.getAttribute("width"))])).toEqual([
      ["Clinical note", 118.5, 3],
      ["Pathology", 298.5, 3],
      ["Pathology", 500, 140],
    ]);
    expect(marks[0].closest("g").getAttribute("aria-hidden")).toBe("true");

    unmount();
  });

  it("keeps the fixed axis ends and the marks in place whatever the viewport", () => {
    const { container, rerender, unmount } = renderStrip();
    const axisLabels = () =>
      [...byTestId(container, "test-timeline-overview-axis").querySelectorAll("text")].map(
        (node) => node.textContent
      );
    const markXs = () =>
      [...container.querySelectorAll("[data-testid='test-timeline-overview-tick']")].map((mark) =>
        mark.getAttribute("x")
      );

    const initialLabels = axisLabels();
    const initialMarks = markXs();
    expect(initialLabels[0]).toBe("Jan 2010");
    expect(initialLabels[initialLabels.length - 1]).toBe("Mar 2011");

    [{ zoom: 4, panRatio: 0.1 }, { zoom: 16, panRatio: 0.9375 }].forEach((viewport) => {
      rerender({ viewport });
      expect(axisLabels()).toEqual(initialLabels);
      expect(markXs()).toEqual(initialMarks);

      // The window's edges sit at the viewport's dates, and so do its labels.
      const selection = byTestId(container, "test-timeline-slider-selection");
      const { startRatio, endRatio } = getViewportWindow(viewport);
      expect(Number(selection.getAttribute("x"))).toBeCloseTo(100 + startRatio * 800, 6);
      expect(Number(selection.getAttribute("width"))).toBeCloseTo((endRatio - startRatio) * 800, 6);
      const { startDate } = viewportToDateWindow(viewport, DOMAIN_START, DOMAIN_END);
      expect(byTestId(container, "test-timeline-slider-start").getAttribute("aria-valuetext")).toBe(
        new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(startDate)
      );
    });

    unmount();
  });

  it("hides handle labels at 100% and merges them when they would overlap", () => {
    const { container, rerender, unmount } = renderStrip();
    expect(byTestId(container, "test-timeline-slider-start-label")).toBeNull();

    rerender({ viewport: { zoom: 2, panRatio: 0.25 } });
    expect(byTestId(container, "test-timeline-slider-start-label")).not.toBeNull();
    expect(byTestId(container, "test-timeline-slider-end-label")).not.toBeNull();

    rerender({ viewport: { zoom: 16, panRatio: 0.5 } });
    expect(byTestId(container, "test-timeline-slider-start-label")).toBeNull();
    expect(byTestId(container, "test-timeline-slider-range-label").textContent).toContain(" – ");

    unmount();
  });

  it("bounds each handle's slider value by the other handle", () => {
    const { container, unmount } = renderStrip({ viewport: { zoom: 4, panRatio: 0.5 } });

    const start = byTestId(container, "test-timeline-slider-start");
    const end = byTestId(container, "test-timeline-slider-end");
    expect(start.getAttribute("role")).toBe("slider");
    expect(start.getAttribute("aria-valuenow")).toBe("500");
    expect(start.getAttribute("aria-valuemax")).toBe(String(Math.round((0.75 - 1 / 16) * 1000)));
    expect(end.getAttribute("aria-valuenow")).toBe("750");
    expect(end.getAttribute("aria-valuemin")).toBe(String(Math.round((0.5 + 1 / 16) * 1000)));
    expect(end.getAttribute("aria-valuemax")).toBe("1000");

    unmount();
  });

  it("snaps a handle dragged within a few pixels of either end to that end", () => {
    const { container, onViewportChange, unmount } = renderStrip({ viewport: { zoom: 2, panRatio: 0.25 } });
    const pointer = (type, clientX) =>
      new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX });
    const drag = (testId, from, to) =>
      act(() => {
        byTestId(container, testId).dispatchEvent(pointer("pointerdown", from));
        window.dispatchEvent(pointer("pointermove", to));
        window.dispatchEvent(pointer("pointerup", to));
      });

    // The band runs from x=100 to x=900; the window from 300 to 700.
    drag("test-timeline-slider-start", 300, 104);
    expect(getViewportWindow(onViewportChange.mock.calls.at(-1)[0]).startRatio).toBe(0);

    drag("test-timeline-slider-end", 700, 896);
    expect(getViewportWindow(onViewportChange.mock.calls.at(-1)[0]).endRatio).toBe(1);

    // Farther than the snap distance, the handle stays where it was dropped.
    drag("test-timeline-slider-start", 300, 120);
    expect(getViewportWindow(onViewportChange.mock.calls.at(-1)[0]).startRatio).toBeCloseTo(20 / 800, 10);

    unmount();
  });

  it("stops a drag on pointercancel", () => {
    const { container, onViewportChange, unmount } = renderStrip({ viewport: { zoom: 2, panRatio: 0.25 } });
    const pointer = (type, clientX) =>
      new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX });

    act(() => {
      byTestId(container, "test-timeline-slider-selection").dispatchEvent(pointer("pointerdown", 400));
      window.dispatchEvent(pointer("pointermove", 450));
    });
    expect(onViewportChange).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true }));
      window.dispatchEvent(pointer("pointermove", 500));
    });
    expect(onViewportChange).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("uses WCAG-readable colors in every theme", () => {
    THEME_OPTIONS.forEach(({ key }) => {
      const colors = getOverviewStripColors(getThemeByKey(key));
      const background = PANEL_BACKGROUNDS[key];

      expect(getContrastRatio(colors.handleLabelText, background)).toBeGreaterThanOrEqual(WCAG_AA_TEXT_CONTRAST);
      expect(getContrastRatio(colors.axisText, background)).toBeGreaterThanOrEqual(WCAG_AA_TEXT_CONTRAST);
      expect(getContrastRatio(colors.windowStroke, background)).toBeGreaterThanOrEqual(WCAG_UI_CONTRAST);
      expect(getContrastRatio(colors.handleStroke, background)).toBeGreaterThanOrEqual(WCAG_UI_CONTRAST);
      expect(getContrastRatio(colors.axisLine, background)).toBeGreaterThanOrEqual(WCAG_UI_CONTRAST);
    });
  });

  it("gives the handles and window a focus-visible ring from the theme", () => {
    const theme = getThemeByKey("obsidian");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <svg>
            <TimelineOverviewStrip
              plotLeft={0}
              plotWidth={800}
              top={0}
              rows={ROWS}
              viewport={{ zoom: 2, panRatio: 0 }}
              onViewportChange={() => {}}
              minWindowRatio={1 / 16}
              domainStart={DOMAIN_START}
              domainEnd={DOMAIN_END}
              clientToX={(clientX) => clientX}
              labels={LABELS}
              testIdPrefix="themed"
            />
          </svg>
        </ThemeProvider>
      );
    });

    const handle = container.querySelector("[data-testid='themed-slider-start']");
    expect(handle.getAttribute("tabindex")).toBe("0");
    const focusRule = [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules];
        } catch {
          return [];
        }
      })
      .find((rule) => {
        const cssText = rule.cssText.toLowerCase();
        return (
          cssText.includes(":focus-visible") &&
          cssText.includes(theme.custom.focusRing.toLowerCase()) &&
          handle
            .getAttribute("class")
            .split(" ")
            .some((name) => cssText.includes(name.toLowerCase()))
        );
      });
    expect(focusRule).toBeDefined();

    act(() => root.unmount());
    container.remove();
  });
});

describe("TimelineZoomControls", () => {
  it("disables every button when told to, and each when it can't act", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const handlers = {
      onZoomIn: jest.fn(),
      onZoomOut: jest.fn(),
      onPanEarlier: jest.fn(),
      onPanLater: jest.fn(),
      onReset: jest.fn(),
    };
    const labels = {
      group: "Zoom",
      zoomIn: "In",
      zoomOut: "Out",
      panEarlier: "Earlier",
      panLater: "Later",
      reset: "Reset",
    };
    const render = (props) =>
      act(() => {
        root.render(
          <TimelineZoomControls
            zoomPercent={150}
            {...handlers}
            canZoomIn
            canZoomOut
            canPanEarlier={false}
            canPanLater
            canReset
            labels={labels}
            {...props}
          />
        );
      });
    const button = (label) => container.querySelector(`button[aria-label="${label}"]`);

    render({});
    expect(container.textContent).toContain("150%");
    expect(button("Earlier").disabled).toBe(true);
    expect(button("Later").disabled).toBe(false);
    act(() => {
      button("Later").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onPanLater).toHaveBeenCalledTimes(1);

    render({ disabled: true });
    ["In", "Out", "Earlier", "Later", "Reset"].forEach((label) => {
      expect(button(label).disabled).toBe(true);
    });

    act(() => root.unmount());
    container.remove();
  });
});
