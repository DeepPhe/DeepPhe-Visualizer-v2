/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import EventRelationTimelineCard from "../EventRelationTimelineCard";
import { resetStaticEventRelationTimelineCacheForTests } from "../../../clients/eventRelationTimeline";

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
      expect(container.querySelector(".brush .overlay")).not.toBeNull();
      const markX = () => container.querySelector("[data-concept-ids='c-treatment'] .relation-icon").getAttribute("x1");
      const beforeZoom = markX();
      act(() => container.querySelector(".zoom_ER").dispatchEvent(
        new WheelEvent("wheel", { deltaY: -200, clientX: 300, bubbles: true, cancelable: true })
      ));
      expect(markX()).not.toBe(beforeZoom);
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
      const zoom = () => act(() => container.querySelector(".zoom_ER").dispatchEvent(
        new WheelEvent("wheel", { deltaY: -200, clientX: 300, bubbles: true, cancelable: true })
      ));
      const markX = () => container.querySelector("[data-concept-ids='c-treatment'] .relation-icon").getAttribute("x1");
      zoom();
      const zoomedX = markX();
      const brushWidth = container.querySelector(".brush .selection").getAttribute("width");
      rerender(<EventRelationTimelineCard {...props} expanded={false} />);
      rerender(<EventRelationTimelineCard {...props} expanded />);
      expect(markX()).toBe(zoomedX);
      expect(container.querySelector(".brush .overlay")).not.toBeNull();
      expect(container.querySelector(".brush .selection").getAttribute("width")).toBe(brushWidth);
      zoom();
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

      // Clicking again clears the same ids.
      await act(async () => {
        container
          .querySelector("[data-concept-ids='c-treatment']")
          .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(handleSelect).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ isDeselecting: true })
      );
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
