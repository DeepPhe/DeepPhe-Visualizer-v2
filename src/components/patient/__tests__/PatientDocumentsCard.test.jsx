/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PatientDocumentsCard from "../PatientDocumentsCard";
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
  it("renders a graphical timeline with document points", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildTimelineData()} />
    );

    const svg = container.querySelector('svg[aria-label="Patient document timeline chart"]');
    expect(svg).not.toBeNull();
    expect(container.querySelectorAll("circle[data-document-id]")).toHaveLength(3);
    expect(container.querySelectorAll("select")).toHaveLength(0);

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
});
