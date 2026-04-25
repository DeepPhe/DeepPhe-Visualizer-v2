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

  it("hides an episode when its dropdown is set to hidden", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildTimelineData()} />
    );

    const diagnosticFilter = Array.from(container.querySelectorAll("select")).find((select) =>
      String(select.id || "").includes("episode-filter-diagnostic")
    );

    expect(diagnosticFilter).toBeDefined();

    act(() => {
      diagnosticFilter.value = "__hidden__";
      diagnosticFilter.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    });

    const visiblePoints = container.querySelectorAll("circle[data-document-id]");
    expect(visiblePoints).toHaveLength(1);
    expect(visiblePoints[0].getAttribute("data-document-id")).toBe("doc-3");

    unmount();
  });

  it("renders a warning when all document timestamps collapse to one value", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildCollapsedTimelineData()} />
    );

    expect(container.textContent).toContain("All documents currently resolve to the same timestamp");
    expect(container.textContent).toContain("2025/03/16");

    unmount();
  });

  it("selects a document when chosen from an episode dropdown", () => {
    const onSelectDocument = jest.fn();
    const { container, unmount } = renderComponent(
      <PatientDocumentsCard timelineData={buildTimelineData()} onSelectDocument={onSelectDocument} />
    );

    const diagnosticFilter = Array.from(container.querySelectorAll("select")).find((select) =>
      String(select.id || "").includes("episode-filter-diagnostic")
    );

    expect(diagnosticFilter).toBeDefined();

    act(() => {
      diagnosticFilter.value = "doc-2";
      diagnosticFilter.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    });

    expect(onSelectDocument).toHaveBeenCalledWith("doc-2");
    unmount();
  });
});
