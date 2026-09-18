/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { getContrastRatio } from "@mui/material/styles";
import EventRelationTimelineCard, {
  getEventTimelineColors,
} from "../EventRelationTimelineCard";
import { THEME_OPTIONS, getThemeByKey } from "../../../themes";
import { WCAG_AA_TEXT_CONTRAST, WCAG_UI_CONTRAST } from "../../../utils/colorContrast";
import { resetStaticEventRelationTimelineCacheForTests } from "../../../clients/eventRelationTimeline";
import { TIMELINE_PLOT_INSET } from "../../../constants/timelineFrame";

// Composited panel background the timeline SVG sits on, per theme (the vapor
// paper is a translucent white over its near-black page).
const TIMELINE_THEME_BACKGROUNDS = {
  obsidian: "#1A2332",
  vapor: "#161425",
  govuk: "#FFFFFF",
};

const TEST_TSV = [
  "PatientID\tConceptID\tRelation1\tDate1\tRelation2\tDate2",
  "fake_patient1\tc-finding\tOverlaps\t2010-01-01\tOverlaps\t2010-03-01",
  "fake_patient1\tc-treatment\tOn\t2010-05-31\tOn\t2010-05-31",
  "fake_patient1\tc-negated\tOn\t2011-02-01\tOn\t2011-02-01",
].join("\n");

const CONCEPTS = [
  {
    id: "c-finding",
    name: "Estrogen Receptor Status",
    dpheGroup: "Clinical Test Result",
    mentionIds: ["m-finding"],
  },
  {
    id: "c-treatment",
    name: "Chemotherapy",
    dpheGroup: "Intervention or Procedure",
    mentionIds: ["m-treatment"],
  },
  {
    id: "c-negated",
    name: "Vomiting",
    dpheGroup: "Finding",
    negated: true,
    mentionIds: ["m-negated"],
  },
];

const SELECTED_DOCUMENT = {
  id: "doc-1",
  mentions: [{ id: "m-treatment" }],
};

const originalFetch = global.fetch;

function renderComponent(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    rerender: (nextElement) => act(() => root.render(nextElement)),
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function waitFor(assertion, timeoutMs = 3000) {
  const start = Date.now();

  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs) {
        throw error;
      }

      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
}

function setNativeSelectValue(selectNode, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  ).set;
  setter.call(selectNode, value);
  selectNode.dispatchEvent(new Event("change", { bubbles: true }));
}

function zoomInWithButton(container) {
  act(() => {
    container
      .querySelector('button[aria-label="Zoom in event timeline"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function mockTimelineFetch(tsvText = TEST_TSV) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => tsvText,
  }));
}

describe("EventRelationTimelineCard", () => {
  afterEach(() => {
    resetStaticEventRelationTimelineCacheForTests();
    jest.clearAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  it("fetches and renders the fake patient event relation SVG", async () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard patientId="fake_patient1" concepts={CONCEPTS} />
    );

    try {
      await waitFor(() => {
        expect(
          container.querySelector('svg[aria-label="Event relation timeline chart"]')
        ).not.toBeNull();
      });

      expect(global.fetch).toHaveBeenCalledWith("/data/event-timelines/fake_patient1.tsv");
      // Three rows, none sharing a lane group + date range, so three merged spans.
      expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3);
      expect(container.textContent).toContain("Event Timeline");
      expect(container.querySelector(".event-relation-legend")).not.toBeNull();
      expect(container.querySelector(".event-relation-legend svg[aria-label]")).not.toBeNull();
      expect(container.querySelector("[data-testid='event-relation-scope']")).not.toBeNull();
      // Group labels count merged spans, in the alpha's "Group (n):" form.
      expect(container.textContent).toContain("Finding (2):");
      expect(container.textContent).toContain("Treatment (1):");
      expect(container.textContent).toContain("3 spans from 3 relations");
      // Alpha colouring: green marks, red reserved for negation.
      const negatedMark = container.querySelector(
        '[data-negated="true"] .relation-icon'
      );
      expect(negatedMark.getAttribute("stroke")).toBe("rgb(255, 0, 0)");
      expect(
        container
          .querySelector('[data-negated="false"] .relation-icon')
          .getAttribute("stroke")
      ).toBe("rgb(49, 163, 84)");
    } finally {
      unmount();
    }
  });

  it("filters to relations linked to the current report", async () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard
        patientId="fake_patient1"
        concepts={CONCEPTS}
        selectedDocument={SELECTED_DOCUMENT}
      />
    );

    try {
      await waitFor(() => {
        expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3);
      });

      const scopeSelect = container.querySelector("[data-testid='event-relation-scope']");
      const originalX = container.querySelector("[data-concept-ids='c-treatment'] .relation-icon")
        .getAttribute("x1");

      await act(async () => {
        setNativeSelectValue(scopeSelect, "current-report");
      });

      expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(1);
      expect(container.textContent).toContain("1 of 3 relations");
      expect(container.querySelector("[data-concept-ids='c-treatment']")).not.toBeNull();
      expect(container.querySelector("[data-concept-ids='c-treatment'] .relation-icon")
        .getAttribute("x1")).toBe(originalX);
    } finally {
      unmount();
    }
  });

  it("can recover from a report with no events and still zoom", async () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard
        patientId="fake_patient1"
        concepts={CONCEPTS}
        selectedDocument={{ id: "empty-report", mentions: [] }}
      />
    );
    try {
      await waitFor(() => expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3));
      act(() => setNativeSelectValue(container.querySelector("select"), "current-report"));
      expect(container.textContent).toContain("No event relations match the current report.");
      expect(container.querySelector("select")).not.toBeNull();
      act(() => setNativeSelectValue(container.querySelector("select"), "all"));
      expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3);
      expect(container.querySelector("[data-testid='event-timeline-overview-band']")).not.toBeNull();
      expect(container.querySelector("[data-testid='event-timeline-slider-start']")).not.toBeNull();
      expect(container.querySelector("[data-testid='event-timeline-slider-end']")).not.toBeNull();
      const markX = () => container.querySelector("[data-concept-ids='c-treatment'] .relation-icon").getAttribute("x1");
      const beforeZoom = markX();
      zoomInWithButton(container);
      expect(markX()).not.toBe(beforeZoom);
    } finally {
      unmount();
    }
  });

  it("leaves wheel gestures to scroll the page instead of zooming", async () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard patientId="fake_patient1" concepts={CONCEPTS} />
    );

    try {
      await waitFor(() => expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3));
      const markX = () =>
        container.querySelector("[data-concept-ids='c-treatment'] .relation-icon").getAttribute("x1");
      const before = markX();
      const wheelEvent = new WheelEvent("wheel", {
        deltaY: -200,
        clientX: 300,
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        container.querySelector(".zoom_ER").dispatchEvent(wheelEvent);
      });

      expect(wheelEvent.defaultPrevented).toBe(false);
      expect(markX()).toBe(before);
      expect(container.textContent).toContain("100%");
    } finally {
      unmount();
    }
  });

  it("keeps the overview axis ends fixed and draws a miniature span per mark", async () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard patientId="fake_patient1" concepts={CONCEPTS} />
    );

    try {
      await waitFor(() => expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3));

      const ticks = [...container.querySelectorAll("[data-testid='event-timeline-overview-tick']")];
      expect(ticks).toHaveLength(3);
      expect(ticks.filter((tick) => tick.dataset.row === "Finding")).toHaveLength(2);
      expect(ticks.map((tick) => tick.getAttribute("fill")).sort()).toEqual([
        "rgb(255, 0, 0)",
        "rgb(49, 163, 84)",
        "rgb(49, 163, 84)",
      ]);

      const overviewLabels = () =>
        [
          ...container
            .querySelector("[data-testid='event-timeline-overview-axis']")
            .querySelectorAll("text"),
        ].map((node) => node.textContent);
      const detailLabels = () =>
        [...container.querySelectorAll(".main-ER-x-axis-bottom text")].map((node) => node.textContent);
      const initialOverview = overviewLabels();
      const initialDetail = detailLabels();
      // Domain = the data ±50 days.
      expect(initialOverview[0]).toBe("Nov 2009");
      expect(initialOverview[initialOverview.length - 1]).toBe("Mar 2011");

      // The plot starts TIMELINE_PLOT_INSET.left into the SVG; in jsdom clientX
      // is in viewBox units.
      const selection = container.querySelector("[data-testid='event-timeline-slider-selection']");
      const startX = Number(selection.getAttribute("x")) + TIMELINE_PLOT_INSET.left;
      const width = Number(selection.getAttribute("width"));
      const startHandle = container.querySelector("[data-testid='event-timeline-slider-start']");
      act(() => {
        startHandle.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: startX })
        );
        window.dispatchEvent(
          new MouseEvent("pointermove", { bubbles: true, cancelable: true, clientX: startX + width / 2 })
        );
        window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
      });

      expect(overviewLabels()).toEqual(initialOverview);
      expect(detailLabels()).not.toEqual(initialDetail);
      expect(container.textContent).toContain("200%");
      expect(
        container.querySelector("[data-testid='event-timeline-slider-start-label']").textContent
      ).toMatch(/, 2010$/);
    } finally {
      unmount();
    }
  });

  it("zooms and pans from the keyboard, and keeps the zoom when a lane collapses", async () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard patientId="fake_patient1" concepts={CONCEPTS} />
    );

    try {
      await waitFor(() => expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3));
      const chart = container.querySelector('svg[aria-label="Event relation timeline chart"]');
      const span = () => container.querySelector("[data-concept-ids='c-treatment']");
      const press = (key) =>
        act(() => {
          span().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));
        });
      expect(chart).not.toBeNull();

      press("+");
      press("+");
      expect(container.textContent).toContain("225%");
      const windowX = () =>
        Number(
          container
            .querySelector("[data-testid='event-timeline-slider-selection']")
            .getAttribute("x")
        );
      const centered = windowX();
      press("ArrowRight");
      expect(windowX()).toBeGreaterThan(centered);
      press("ArrowLeft");
      expect(windowX()).toBeCloseTo(centered, 3);

      const zoomedMarkX = span().querySelector(".relation-icon").getAttribute("x1");
      act(() => {
        container
          .querySelector(".group-toggle")
          .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      expect(container.querySelector(".group-toggle").getAttribute("aria-expanded")).toBe("false");
      expect(container.textContent).toContain("225%");
      expect(windowX()).toBeCloseTo(centered, 3);
      expect(span().querySelector(".relation-icon").getAttribute("x1")).toBe(zoomedMarkX);

      press("0");
      expect(container.textContent).toContain("100%");
    } finally {
      unmount();
    }
  });

  it("zooms from the legend controls and can reset the event range", async () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard patientId="fake_patient1" concepts={CONCEPTS} />
    );

    try {
      await waitFor(() => {
        expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3);
      });

      const markX = () =>
        container
          .querySelector("[data-concept-ids='c-treatment'] .relation-icon")
          .getAttribute("x1");
      const baselineX = markX();

      await act(async () => {
        container
          .querySelector('button[aria-label="Zoom in event timeline"]')
          .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(markX()).not.toBe(baselineX);

      await act(async () => {
        container
          .querySelector('button[aria-label="Reset event timeline zoom"]')
          .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(markX()).toBe(baselineX);
    } finally {
      unmount();
    }
  });

  it("preserves zoom and restores interactions after reopening the panel", async () => {
    mockTimelineFetch();
    const props = { patientId: "fake_patient1", concepts: CONCEPTS };
    const { container, rerender, unmount } = renderComponent(<EventRelationTimelineCard {...props} />);
    try {
      await waitFor(() => expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3));
      const markX = () => container.querySelector("[data-concept-ids='c-treatment'] .relation-icon").getAttribute("x1");
      const windowWidth = () =>
        container
          .querySelector("[data-testid='event-timeline-slider-selection']")
          .getAttribute("width");
      zoomInWithButton(container);
      const zoomedX = markX();
      const zoomedWindowWidth = windowWidth();
      rerender(<EventRelationTimelineCard {...props} expanded={false} />);
      rerender(<EventRelationTimelineCard {...props} expanded />);
      expect(markX()).toBe(zoomedX);
      expect(windowWidth()).toBe(zoomedWindowWidth);
      zoomInWithButton(container);
      expect(markX()).not.toBe(zoomedX);
    } finally {
      unmount();
    }
  });

  it("toggles a span's concept ids through onSelectConceptIds", async () => {
    mockTimelineFetch();
    const handleSelect = jest.fn();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard
        patientId="fake_patient1"
        concepts={CONCEPTS}
        onSelectConceptIds={handleSelect}
      />
    );

    try {
      await waitFor(() => {
        expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3);
      });

      const treatmentSpan = container.querySelector("[data-concept-ids='c-treatment']");

      await act(async () => {
        treatmentSpan.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      });

      expect(handleSelect).toHaveBeenCalledWith(
        ["c-treatment"],
        expect.objectContaining({ isDeselecting: false })
      );
      expect(
        container.querySelector("[data-concept-ids='c-treatment']").dataset.selected
      ).toBe("true");
      expect(container.querySelector("[data-concept-ids='c-finding']").dataset.selectionState)
        .toBe("unselected");

      await act(async () => {
        container
          .querySelector("[data-concept-ids='c-finding']")
          .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(
        container.querySelector("[data-concept-ids='c-finding']").dataset.selected
      ).toBe("true");

      // Deselecting one event removes only that event's concepts.
      await act(async () => {
        container
          .querySelector("[data-concept-ids='c-treatment']")
          .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(handleSelect).toHaveBeenLastCalledWith(
        ["c-finding"],
        expect.objectContaining({ isDeselecting: true })
      );
      expect(
        container.querySelector("[data-concept-ids='c-treatment']").dataset.selected
      ).toBe("false");
      expect(
        container.querySelector("[data-concept-ids='c-finding']").dataset.selected
      ).toBe("true");
    } finally {
      unmount();
    }
  });

  it("keeps a visible focus indicator on the keyboard-reachable marks", async () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard patientId="fake_patient1" concepts={CONCEPTS} />
    );

    try {
      await waitFor(() => {
        expect(container.querySelectorAll("[data-event-relation-id]")).toHaveLength(3);
      });

      const span = container.querySelector("[data-event-relation-id]");
      const toggle = container.querySelector(".group-toggle");

      // Both are tabbable, so neither may suppress the focus ring outright
      // (WCAG 2.4.7). A bare outline:none on these is the regression.
      [span, toggle].forEach((node) => {
        expect(node.getAttribute("tabindex")).toBe("0");
        expect(node.getAttribute("role")).toBe("button");
        expect(node.style.outline).toBe("");
      });

      const focusRule = [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules];
          } catch {
            return [];
          }
        })
        .find(
          (rule) =>
            rule.cssText.includes(":focus-visible") && rule.cssText.includes("outline")
        );
      expect(focusRule).toBeDefined();
    } finally {
      unmount();
    }
  });

  it("keeps age labels, toggles, and the selection halo legible in every theme", () => {
    THEME_OPTIONS.forEach(({ key }) => {
      const theme = getThemeByKey(key);
      const background = TIMELINE_THEME_BACKGROUNDS[key];
      const colors = getEventTimelineColors(theme);

      // Age-axis tick labels read as text (alpha hardcoded #444 → 1.65:1 on dark).
      expect(getContrastRatio(colors.ageText, background)).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT_CONTRAST
      );
      // Group collapse chevrons are a UI control (alpha #666 → 2.95:1 on dark).
      expect(getContrastRatio(colors.toggleIcon, background)).toBeGreaterThanOrEqual(
        WCAG_UI_CONTRAST
      );
      // The selected span/marker halo must be visible (alpha "black" vanished on dark).
      expect(getContrastRatio(colors.selectedOutline, background)).toBeGreaterThanOrEqual(
        WCAG_UI_CONTRAST
      );
      // Date axis labels read as text; the axis line is a UI component.
      expect(getContrastRatio(colors.axisText, background)).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT_CONTRAST
      );
      expect(getContrastRatio(colors.axisLine, background)).toBeGreaterThanOrEqual(
        WCAG_UI_CONTRAST
      );
    });
  });

  it("does not fetch or render for non-target patients", () => {
    mockTimelineFetch();
    const { container, unmount } = renderComponent(
      <EventRelationTimelineCard patientId="patient-2" concepts={CONCEPTS} />
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");
    unmount();
  });
});
