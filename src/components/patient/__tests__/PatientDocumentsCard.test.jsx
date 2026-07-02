/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PatientDocumentsCard, { resolveResponsiveTickCount } from "../PatientDocumentsCard";
import { transformDocumentTimeline } from "../../../utils/patientView/transformDocumentTimeline";

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

    // Height is content-sized: plotTop(10) + rows(2) * rowHeight(40) + footer(38).
    const viewBox = svg.getAttribute("viewBox").split(" ").map(Number);
    expect(viewBox[3]).toBe(128);

    unmount();
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

    expect(container.textContent).toContain("Hidden by episode filter: 2 document(s).");

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
