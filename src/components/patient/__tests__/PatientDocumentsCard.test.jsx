/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, getContrastRatio } from "@mui/material/styles";
import PatientDocumentsCard, {
  getTimelineSvgColors,
  resolveResponsiveTickCount,
} from "../PatientDocumentsCard";
import { THEME_OPTIONS, getThemeByKey } from "../../../themes";
import { transformDocumentTimeline } from "../../../utils/patientView/transformDocumentTimeline";
import { WCAG_AA_TEXT_CONTRAST, WCAG_UI_CONTRAST } from "../../../utils/colorContrast";

function renderComponent(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function buildTimelineData() {
  return transformDocumentTimeline({
    patientId: "patient-1",
    patientName: "Patient One",
    documents: [
      {
        id: "doc-1",
        name: "Document One",
        date: "202503161030",
        type: "Clinical note",
        episode: "Diagnostic",
      },
      {
        id: "doc-2",
        name: "Document Two",
        date: "202503161230",
        type: "Clinical note",
        episode: "Diagnostic",
      },
      {
        id: "doc-3",
        name: "Document Three",
        date: "202503171000",
        type: "Radiology report",
        episode: "Pre-diagnostic",
      },
    ],
  });
}

function buildCollapsedTimelineData() {
  return transformDocumentTimeline({
    patientId: "patient-collapsed",
    patientName: "Collapsed Patient",
    documents: [
      {
        id: "patient-collapsed_16032025025912_D_1",
        name: "Document One",
        date: "202503160259",
        type: "Clinical note",
        episode: "unknown",
      },
      {
        id: "patient-collapsed_16032025025912_D_2",
        name: "Document Two",
        date: "202503160259",
        type: "Clinical note",
        episode: "unknown",
      },
    ],
  });
}

const TIMELINE_THEME_BACKGROUNDS = {
  obsidian: "#1A2332",
  vapor: "#161425",
  govuk: "#FFFFFF",
};

describe("PatientDocumentsCard", () => {
  it("reduces date tick density as the available plot width narrows", () => {
    expect(resolveResponsiveTickCount(1064, 7)).toBe(7);
    expect(resolveResponsiveTickCount(704, 7)).toBe(5);
    expect(resolveResponsiveTickCount(364, 7)).toBe(3);
    expect(resolveResponsiveTickCount(588, 4)).toBe(4);
  });

  it("renders a graphical timeline with document points", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildTimelineData()} />
    );

    const svg = container.querySelector('svg[aria-label="Patient document timeline chart"]');
    expect(svg).not.toBeNull();
    expect(container.querySelectorAll("circle[data-document-id]")).toHaveLength(3);
    expect(container.querySelectorAll("select")).toHaveLength(0);

    // Height is content-sized: plotTop(8) + rows(2) * rowHeight(30) + axis
    // footer(28) + gap(6) + overview strip for 2 rows(52).
    const viewBox = svg.getAttribute("viewBox").split(" ").map(Number);
    expect(viewBox[3]).toBe(154);

    const sliderHandle = container.querySelector("[data-testid='document-timeline-slider-end']");
    const handleCoordinates = sliderHandle
      .getAttribute("d")
      .match(/-?\d+(?:\.\d+)?/g)
      .map(Number);
    const handleMaxY = Math.max(...handleCoordinates.filter((_, index) => index % 2 === 1));
    expect(handleMaxY).toBeLessThanOrEqual(viewBox[3] - 1);

    unmount();
  });

  it("defines timeline contrast backgrounds for every configured theme", () => {
    expect(Object.keys(TIMELINE_THEME_BACKGROUNDS).sort()).toEqual(
      THEME_OPTIONS.map(({ key }) => key).sort()
    );
  });

  it("uses WCAG-readable SVG colors in all configured themes", () => {
    THEME_OPTIONS.forEach(({ key }) => {
      const theme = getThemeByKey(key);
      const background = TIMELINE_THEME_BACKGROUNDS[key];
      const colors = getTimelineSvgColors(theme);

      expect(getContrastRatio(colors.textColor, background)).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT_CONTRAST
      );
      expect(getContrastRatio(colors.axisColor, background)).toBeGreaterThanOrEqual(
        WCAG_UI_CONTRAST
      );
      expect(getContrastRatio(colors.relatedStrokeColor, background)).toBeGreaterThanOrEqual(
        WCAG_UI_CONTRAST
      );
      expect(getContrastRatio(colors.eventRelatedStrokeColor, background)).toBeGreaterThanOrEqual(
        WCAG_UI_CONTRAST
      );
      expect(getContrastRatio(colors.docCountBadgeText, colors.docCountBadgeBackground)).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT_CONTRAST
      );
    });
  });

  it("renders timeline labels with each theme's contrast colors", () => {
    THEME_OPTIONS.forEach(({ key }) => {
      const theme = getThemeByKey(key);
      const { container, unmount } = renderComponent(
        <ThemeProvider theme={theme}>
          <PatientDocumentsCard timelineData={buildTimelineData()} />
        </ThemeProvider>
      );

      const rowLabel = container.querySelector(".patient-timeline-row-label");
      const tickLabel = container.querySelector(".patient-timeline-tick-label");
      const axisTitle = container.querySelector(".patient-timeline-axis-title");

      expect(rowLabel.getAttribute("fill")).toBe(theme.palette.text.secondary);
      expect(tickLabel.getAttribute("fill")).toBe(theme.palette.text.secondary);
      expect(axisTitle.getAttribute("fill")).toBe(theme.palette.text.secondary);

      unmount();
    });
  });

  it("selects a document when its timeline point is clicked", () => {
    const onSelectDocument = jest.fn();
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildTimelineData()} onSelectDocument={onSelectDocument} />
    );

    const point = container.querySelector('circle[data-document-id="doc-2"]');
    expect(point).not.toBeNull();

    act(() => {
      point.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onSelectDocument).toHaveBeenCalledWith("doc-2");
    unmount();
  });

  it("marks event-linked documents with a distinct accessible gold ring", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard
        timelineData={buildTimelineData()}
        relatedDocumentIds={["doc-1"]}
        eventRelatedDocumentIds={["doc-2"]}
      />
    );

    const eventRing = container.querySelector(
      '.patient-timeline-event-related-ring[data-document-id="doc-2"]'
    );
    const eventPoint = container.querySelector('circle[data-document-id="doc-2"].patient-timeline-point');
    const factPoint = container.querySelector('circle[data-document-id="doc-1"].patient-timeline-point');

    expect(eventRing).not.toBeNull();
    expect(eventPoint.dataset.eventRelated).toBe("true");
    expect(eventPoint.getAttribute("aria-label")).toContain(
      "Linked to selected event timeline concept"
    );
    expect(factPoint.dataset.related).toBe("true");
    expect(container.textContent).toContain("Gold outline: event-linked documents");

    unmount();
  });

  it("zooms from the compact date range slider and syncs reset", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard
        timelineData={buildTimelineData()}
        eventRelatedDocumentIds={["doc-2"]}
      />
    );

    const readSpread = () => {
      const xs = [...container.querySelectorAll("circle[data-document-id]")].map((circle) =>
        Number(circle.getAttribute("cx"))
      );
      return Math.max(...xs) - Math.min(...xs);
    };
    const selection = () => container.querySelector("[data-testid='document-timeline-slider-selection']");

    const baselineSpread = readSpread();
    const baselineSelectionWidth = Number(selection().getAttribute("width"));
    const endHandle = container.querySelector("[data-testid='document-timeline-slider-end']");
    const selectionEndX =
      Number(selection().getAttribute("x")) + Number(selection().getAttribute("width"));

    act(() => {
      endHandle.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: selectionEndX,
        })
      );
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          clientX: selectionEndX - baselineSelectionWidth / 2,
        })
      );
      window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
    });

    expect(readSpread()).toBeGreaterThan(baselineSpread + 1);
    expect(Number(selection().getAttribute("width"))).toBeLessThan(baselineSelectionWidth);
    expect(container.querySelector(".patient-timeline-event-related-ring")).not.toBeNull();

    act(() => {
      container
        .querySelector('[aria-label="Reset timeline zoom"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(readSpread()).toBeCloseTo(baselineSpread, 3);
    expect(Number(selection().getAttribute("width"))).toBeCloseTo(baselineSelectionWidth, 3);

    unmount();
  });

  it("supports keyboard control for the compact date range slider", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildTimelineData()} />
    );

    const selection = () => container.querySelector("[data-testid='document-timeline-slider-selection']");
    const endHandle = () => container.querySelector("[data-testid='document-timeline-slider-end']");
    const baselineSelectionWidth = Number(selection().getAttribute("width"));

    expect(selection().getAttribute("role")).toBe("slider");
    expect(selection().getAttribute("aria-label")).toBe("Pan document timeline date range");
    expect(selection().getAttribute("aria-valuetext")).toContain(" to ");
    expect(endHandle().getAttribute("role")).toBe("slider");
    expect(endHandle().getAttribute("aria-label")).toBe("End of document timeline date range");

    act(() => {
      endHandle().dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "ArrowLeft",
        })
      );
    });

    expect(Number(selection().getAttribute("width"))).toBeLessThan(baselineSelectionWidth);
    expect(Number(endHandle().getAttribute("aria-valuenow"))).toBeLessThan(1000);

    unmount();
  });

  it("spreads timeline points along the date axis when zoomed in, and restores on reset", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildTimelineData()} />
    );

    const readSpread = () => {
      const xs = [...container.querySelectorAll("circle[data-document-id]")].map((circle) =>
        Number(circle.getAttribute("cx"))
      );
      return Math.max(...xs) - Math.min(...xs);
    };

    const baselineSpread = readSpread();
    expect(baselineSpread).toBeGreaterThan(0);

    const zoomInButton = container.querySelector('[aria-label="Zoom in timeline"]');
    expect(zoomInButton).not.toBeNull();

    act(() => {
      zoomInButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(readSpread()).toBeGreaterThan(baselineSpread + 1);

    const resetButton = container.querySelector('[aria-label="Reset timeline zoom"]');
    act(() => {
      resetButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(readSpread()).toBeCloseTo(baselineSpread, 3);

    unmount();
  });

  it("leaves wheel gestures available for native scrolling instead of zooming", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildTimelineData()} />
    );

    const svg = container.querySelector('svg[aria-label="Patient document timeline chart"]');
    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -120,
    });

    act(() => {
      svg.dispatchEvent(wheelEvent);
    });

    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(container.textContent).toContain("100%");
    expect(container.textContent).toContain("Scrolling moves through the patient view.");

    unmount();
  });

  describe("overview strip", () => {
    // Spread across 14 months and two calendar years, like a real patient.
    function buildLongTimelineData() {
      return transformDocumentTimeline({
        patientId: "patient-long",
        patientName: "Patient Long",
        documents: [
          ["doc-a", "201001250900", "Clinical note"],
          ["doc-b", "201006151000", "Surgical pathology"],
          ["doc-c", "201011221100", "Clinical note"],
          ["doc-d", "201012091200", "Radiology report"],
          ["doc-e", "201101311300", "Surgical pathology"],
          ["doc-f", "201102270900", "Clinical note"],
        ].map(([id, date, type]) => ({ id, name: id, date, type, episode: "Diagnostic" })),
      });
    }

    const byTestId = (container, testId) => container.querySelector(`[data-testid='${testId}']`);
    const texts = (nodes) => [...nodes].map((node) => node.textContent);
    const pointer = (type, clientX) =>
      new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX });

    function dragHandle(container, handleTestId, fromX, toX) {
      act(() => {
        byTestId(container, handleTestId).dispatchEvent(pointer("pointerdown", fromX));
        window.dispatchEvent(pointer("pointermove", toX));
        window.dispatchEvent(pointer("pointerup", toX));
      });
    }

    function readWindow(container) {
      const selection = byTestId(container, "document-timeline-slider-selection");
      const x = Number(selection.getAttribute("x"));
      return { x, end: x + Number(selection.getAttribute("width")) };
    }

    it("keeps the overview axis's end labels fixed while the detail axis follows the handles", () => {
      const { container, unmount } = renderComponent(
        <PatientDocumentsCard timelineData={buildLongTimelineData()} />
      );

      const overviewLabels = () =>
        texts(
          byTestId(container, "document-timeline-overview-axis").querySelectorAll("text")
        );
      const detailLabels = () =>
        texts(byTestId(container, "document-timeline-detail-axis").querySelectorAll("text"));

      const initialOverview = overviewLabels();
      const initialDetail = detailLabels();
      expect(initialOverview[0]).toBe("Jan 2010");
      expect(initialOverview[initialOverview.length - 1]).toBe("Mar 2011");
      // At 100% the handle labels would repeat those end labels.
      expect(byTestId(container, "document-timeline-slider-start-label")).toBeNull();

      const { x, end } = readWindow(container);
      const width = end - x;
      dragHandle(container, "document-timeline-slider-start", x, x + width * 0.7);
      dragHandle(container, "document-timeline-slider-end", end, end - width * 0.1);

      expect(overviewLabels()).toEqual(initialOverview);
      expect(detailLabels()).not.toEqual(initialDetail);

      // The detail axis's end labels and the handle labels name the same dates.
      const startLabel = byTestId(container, "document-timeline-slider-start-label");
      const endLabel = byTestId(container, "document-timeline-slider-end-label");
      expect(startLabel.textContent).toMatch(/^[A-Z][a-z]{2} \d{1,2}, 2010$/);
      expect(endLabel.textContent).toMatch(/^[A-Z][a-z]{2} \d{1,2}, 2011$/);
      const detail = detailLabels();
      expect(startLabel.textContent.startsWith(detail[0])).toBe(true);
      expect(endLabel.textContent.startsWith(detail[detail.length - 1])).toBe(true);
      expect(
        byTestId(container, "document-timeline-slider-start").getAttribute("aria-valuetext")
      ).toBe(startLabel.textContent);

      unmount();
    });

    it("never lets the handles cross, by pointer or keyboard", () => {
      const { container, unmount } = renderComponent(
        <PatientDocumentsCard timelineData={buildLongTimelineData()} />
      );

      const { x, end } = readWindow(container);
      dragHandle(container, "document-timeline-slider-start", x, end + 200);
      const afterDrag = readWindow(container);
      expect(afterDrag.x).toBeLessThan(afterDrag.end);
      expect(afterDrag.end).toBeCloseTo(end, 3);

      const startHandle = byTestId(container, "document-timeline-slider-start");
      for (let press = 0; press < 5; press += 1) {
        act(() => {
          startHandle.dispatchEvent(
            new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" })
          );
        });
      }
      const afterKeys = readWindow(container);
      expect(afterKeys.x).toBeLessThan(afterKeys.end);
      expect(afterKeys.end).toBeCloseTo(end, 3);
      expect(Number(startHandle.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(
        Number(startHandle.getAttribute("aria-valuemax"))
      );

      unmount();
    });

    it("recenters the window when the band is pressed", () => {
      const { container, unmount } = renderComponent(
        <PatientDocumentsCard timelineData={buildLongTimelineData()} />
      );

      act(() => {
        container
          .querySelector('[aria-label="Zoom in timeline"]')
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      const before = readWindow(container);
      const band = byTestId(container, "document-timeline-overview-band");
      const bandRight = Number(band.getAttribute("x")) + Number(band.getAttribute("width"));

      act(() => {
        band.dispatchEvent(pointer("pointerdown", bandRight - 1));
      });

      const after = readWindow(container);
      expect(after.end - after.x).toBeCloseTo(before.end - before.x, 3);
      expect(after.end).toBeCloseTo(bandRight, 3);

      unmount();
    });

    it("draws one miniature tick per document in its report type's row", () => {
      const { container, unmount } = renderComponent(
        <PatientDocumentsCard timelineData={buildLongTimelineData()} />
      );

      const ticks = [...container.querySelectorAll("[data-testid='document-timeline-overview-tick']")];
      expect(ticks).toHaveLength(6);
      expect(ticks.filter((tick) => tick.dataset.row === "Clinical note")).toHaveLength(3);

      // Miniature positions never move with the viewport.
      const before = ticks.map((tick) => tick.getAttribute("x"));
      act(() => {
        container
          .querySelector('[aria-label="Zoom in timeline"]')
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(
        [...container.querySelectorAll("[data-testid='document-timeline-overview-tick']")].map(
          (tick) => tick.getAttribute("x")
        )
      ).toEqual(before);

      unmount();
    });

    it("pans with the header buttons and disables each at its end of the range", () => {
      const { container, unmount } = renderComponent(
        <PatientDocumentsCard timelineData={buildLongTimelineData()} />
      );
      const button = (label) => container.querySelector(`[aria-label="${label}"]`);
      const click = (label) =>
        act(() => {
          button(label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

      expect(button("Pan timeline earlier").disabled).toBe(true);
      expect(button("Pan timeline later").disabled).toBe(true);

      click("Zoom in timeline");
      click("Zoom in timeline");
      expect(container.textContent).toContain("225%");
      const centered = readWindow(container);

      click("Pan timeline later");
      const panned = readWindow(container);
      const windowWidth = centered.end - centered.x;
      // One step is 20% of the visible window, not of the whole range.
      expect(panned.x - centered.x).toBeCloseTo(windowWidth * 0.2, 3);

      for (let press = 0; press < 10; press += 1) {
        if (!button("Pan timeline later").disabled) {
          click("Pan timeline later");
        }
      }
      expect(button("Pan timeline later").disabled).toBe(true);
      expect(button("Pan timeline earlier").disabled).toBe(false);

      unmount();
    });

    it("announces the selected range once the reader stops changing it", () => {
      jest.useFakeTimers();
      const { container, unmount } = renderComponent(
        <PatientDocumentsCard timelineData={buildLongTimelineData()} />
      );
      try {
        const status = byTestId(container, "document-timeline-range-status");
        expect(status.getAttribute("aria-live")).toBe("polite");
        expect(status.textContent).toBe("");

        act(() => {
          container
            .querySelector('[aria-label="Zoom in timeline"]')
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(status.textContent).toBe("");

        act(() => {
          jest.advanceTimersByTime(300);
        });
        expect(status.textContent).toMatch(
          /^Showing [A-Z][a-z]{2} \d{1,2}, 2010 to [A-Z][a-z]{2} \d{1,2}, 201[01]$/
        );
      } finally {
        unmount();
        jest.useRealTimers();
      }
    });
  });

  it("hides an episode when its dropdown is set to hidden in collapsed-date mode", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildCollapsedTimelineData()} />
    );

    const collapsedModeFilter = container.querySelector("select");
    expect(collapsedModeFilter).not.toBeNull();

    act(() => {
      collapsedModeFilter.value = "__hidden__";
      collapsedModeFilter.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Hidden: 2 doc(s)");

    unmount();
  });

  it("hides the timeline chart when all document timestamps collapse to one value", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildCollapsedTimelineData()} />
    );

    expect(container.querySelector('svg[aria-label="Patient document timeline chart"]')).toBeNull();
    expect(container.querySelectorAll("select")).toHaveLength(1);
    expect(container.textContent).toContain("Timeline chart is hidden because all documents share one timestamp");

    unmount();
  });

  it("selects a document when chosen from an episode dropdown in collapsed-date mode", () => {
    const onSelectDocument = jest.fn();
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard
        timelineData={buildCollapsedTimelineData()}
        onSelectDocument={onSelectDocument}
      />
    );

    const collapsedModeFilter = container.querySelector("select");
    expect(collapsedModeFilter).not.toBeNull();

    act(() => {
      collapsedModeFilter.value = "patient-collapsed_16032025025912_D_2";
      collapsedModeFilter.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    });

    expect(onSelectDocument).toHaveBeenCalledWith("patient-collapsed_16032025025912_D_2");
    unmount();
  });

  it("collapses to its header, hiding the timeline chart", () => {
    const onToggleExpanded = jest.fn();
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard
        timelineData={buildTimelineData()}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        collapsiblePanelId="timeline-panel-body"
      />
    );

    const toggle = container.querySelector(
      'button[aria-label="Expand Patient Document Timeline section"]'
    );
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("timeline-panel-body");
    expect(
      container.querySelector('svg[aria-label="Patient document timeline chart"]')
    ).toBeNull();
    expect(container.querySelector("#timeline-panel-body")).toBeNull();

    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);

    unmount();
  });
});
