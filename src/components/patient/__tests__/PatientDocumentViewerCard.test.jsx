/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PatientDocumentViewerCard from "../PatientDocumentViewerCard";
import PatientSummaryCard from "../PatientSummaryCard";

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

function buildDocumentPayload() {
  return {
    id: "doc-1",
    name: "Clinical Note",
    text: "Tumor in left breast.",
    mentions: [
      { id: "m-neoplasm", begin: 0, end: 5, confidence: 0.95, negated: false },
      { id: "m-side", begin: 9, end: 13, confidence: 0.87, negated: true },
    ],
  };
}

function buildConceptPayload() {
  return [
    {
      id: "c-neoplasm",
      name: "Neoplasm",
      preferredText: "Tumor",
      classUri: "Neoplasm",
      dpheGroup: "Neoplasm",
      codingScheme: "SNOMED CT",
      mentionIds: ["m-neoplasm"],
    },
    {
      id: "c-side",
      name: "Side",
      classUri: "Side",
      dpheGroup: "Side",
      mentionIds: ["m-side"],
    },
  ];
}

function SyncedConfidenceHarness() {
  const [confidenceThreshold, setConfidenceThreshold] = React.useState(100);
  const sections = [
    {
      key: "diagnoses",
      label: "Diagnoses",
      items: [
        {
          name: "High Confidence Finding",
          selection: { bestConfidence: 0.9 },
        },
      ],
    },
  ];

  return (
    <>
      <PatientSummaryCard
        sections={sections}
        confidenceThreshold={confidenceThreshold}
        onConfidenceThresholdChange={setConfidenceThreshold}
      />
      <PatientDocumentViewerCard
        document={buildDocumentPayload()}
        concepts={buildConceptPayload()}
        confidenceThreshold={confidenceThreshold}
        onConfidenceThresholdChange={setConfidenceThreshold}
      />
    </>
  );
}

describe("PatientDocumentViewerCard", () => {
  test("synchronizes its confidence filter with the patient summary slider", () => {
    const { container, unmount } = renderComponent(<SyncedConfidenceHarness />);

    const documentViewerSlider = container.querySelector(
      'input[aria-label="Document viewer confidence percent"]'
    );
    expect(documentViewerSlider.value).toBe("100");

    const confidenceTab = container.querySelector("#document-viewer-tab-2");
    act(() => {
      confidenceTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const histogram = container.querySelector('svg[aria-label="Mention confidence histogram"]');
    histogram.parentElement.getBoundingClientRect = () => ({
      left: 0,
      width: 360,
      top: 0,
      right: 360,
      bottom: 220,
      height: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    act(() => {
      histogram.parentElement.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: 228 })
      );
    });

    const summarySlider = container.querySelector(
      'input[aria-label="Minimum finding confidence percent"]'
    );
    expect(summarySlider.value).toBe("80");
    expect(documentViewerSlider.value).toBe("80");
    expect(container.textContent).toContain("Confidence: 80%");
    const histogramLabels = [...histogram.querySelectorAll("text")].map(
      (label) => label.textContent
    );
    expect(histogramLabels).toContain("50%");
    expect(histogramLabels).toContain("100%");
    expect(histogramLabels).not.toContain("10%");

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    act(() => {
      nativeInputValueSetter.call(summarySlider, "65");
      summarySlider.dispatchEvent(new Event("input", { bubbles: true }));
      summarySlider.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(summarySlider.value).toBe("65");
    expect(documentViewerSlider.value).toBe("65");
    expect(container.textContent).toContain("Confidence: 65%");

    act(() => {
      nativeInputValueSetter.call(documentViewerSlider, "90");
      documentViewerSlider.dispatchEvent(new Event("input", { bubbles: true }));
      documentViewerSlider.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(summarySlider.value).toBe("90");
    expect(documentViewerSlider.value).toBe("90");
    expect(container.textContent).toContain("Confidence: 90%");

    unmount();
  });

  test("renders tabbed controls and does not render legacy slider controls", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentViewerCard
        document={buildDocumentPayload()}
        concepts={buildConceptPayload()}
        confidenceThreshold={50}
      />
    );

    expect(container.textContent).toContain("Concept List");
    expect(container.textContent).toContain("Group Filter");
    expect(container.textContent).toContain("Confidence Filter");
    expect(container.querySelector('[aria-label="Mention confidence filter"]')).toBeNull();
    expect(container.textContent).not.toContain("Showing mentions with confidence >=");

    unmount();
  });

  test("renders highlighted mention overlay buttons in text pane", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentViewerCard
        document={buildDocumentPayload()}
        concepts={buildConceptPayload()}
        confidenceThreshold={50}
      />
    );

    const mentionButtons = container.querySelectorAll('button[aria-label^="Mention "]');
    expect(mentionButtons.length).toBeGreaterThan(0);
    expect(container.textContent).toContain("Neoplasm (1)");
    expect(container.textContent).toContain("Side (1)");

    unmount();
  });

  test("lets an embedded viewer grow to its full content without nested scrolling", () => {
    const { container, unmount } = renderComponent(
      <PatientDocumentViewerCard
        embedded
        document={buildDocumentPayload()}
        concepts={buildConceptPayload()}
        confidenceThreshold={50}
        collapsiblePanelId="natural-height-viewer"
      />
    );

    const card = container.querySelector('[data-testid="patient-document-viewer-card"]');
    const content = container.querySelector("#natural-height-viewer");
    const textPane = container.querySelector('[data-testid="patient-document-text-pane"]');
    const conceptPanelBody = container.querySelector('[role="tabpanel"]').parentElement;

    expect(window.getComputedStyle(card).height).toBe("auto");
    expect(window.getComputedStyle(content).overflow).toBe("visible");
    expect(window.getComputedStyle(textPane).height).toBe("auto");
    expect(window.getComputedStyle(textPane).overflowY).toBe("visible");
    expect(window.getComputedStyle(conceptPanelBody).overflow).toBe("visible");

    unmount();
  });

  test("shows complete concept and mention details when a concept is hovered", () => {
    jest.useFakeTimers();
    const { container, unmount } = renderComponent(
      <PatientDocumentViewerCard
        document={buildDocumentPayload()}
        concepts={buildConceptPayload()}
        confidenceThreshold={50}
      />
    );

    const conceptChip = container.querySelector('[role="button"][aria-label^="Neoplasm."]');
    expect(conceptChip).not.toBeNull();
    expect(conceptChip.getAttribute("aria-label")).toContain("Confidence 95%");

    act(() => {
      conceptChip.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      jest.advanceTimersByTime(300);
    });

    const tooltip = document.body.querySelector('[data-testid="concept-details-tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain("Preferred textTumor");
    expect(tooltip.textContent).toContain("Concept typeNeoplasm");
    expect(tooltip.textContent).toContain("Confidence95%");
    expect(tooltip.textContent).toContain("Coding SchemeSNOMED CT");
    expect(tooltip.textContent).toContain("Tumor — 95%");
    expect(tooltip.textContent).toContain("Affirmed · Certain · Current");
    expect(tooltip.textContent).toContain("Offsets 0–5 · ID m-neoplasm");

    unmount();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("collapses the whole viewer to its header while keeping close reachable", () => {
    const onToggleExpanded = jest.fn();
    const onClose = jest.fn();
    const { container, unmount } = renderComponent(
      <PatientDocumentViewerCard
        embedded
        document={buildDocumentPayload()}
        concepts={buildConceptPayload()}
        confidenceThreshold={50}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        onClose={onClose}
        collapsiblePanelId="viewer-panel-body"
      />
    );

    const toggle = container.querySelector(
      'button[aria-label="Expand Document Viewer section"]'
    );
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("viewer-panel-body");
    // Report text + concept controls are hidden while collapsed…
    expect(container.querySelector('[data-testid="patient-document-text-pane"]')).toBeNull();
    expect(container.querySelector("#viewer-panel-body")).toBeNull();
    // …but the close button stays in the header.
    expect(container.querySelector('button[aria-label="Close document"]')).not.toBeNull();

    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);

    unmount();
  });
});
