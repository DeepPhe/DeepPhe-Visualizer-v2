import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
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

describe("PatientSummaryCard", () => {
  it("shows the highest confidence before a multi-document source count", () => {
    const sections = [
      {
        key: "diagnoses",
        label: "Diagnoses",
        items: [
          {
            name: "Multi-source Finding",
            documentIds: ["d1", "d2"],
            selection: {
              bestConfidence: 0.9,
              documentIds: ["d1", "d2"],
              documentRanking: [
                { documentId: "d1", confidence: 0.9 },
                { documentId: "d2", confidence: 0.7 },
              ],
            },
          },
        ],
      },
    ];

    const { container, unmount } = renderComponent(
      <PatientSummaryCard
        sections={sections}
        confidenceThreshold={50}
        onSelectItem={jest.fn()}
      />
    );

    expect(container.textContent).toContain("Multi-source Finding90% (2)");
    expect(container.querySelector('button[aria-label*="90% confidence"]')).not.toBeNull();

    unmount();
  });

  it("uses the summary body as the scroll container", () => {
    const sections = [
      {
        key: "diagnoses",
        label: "Diagnoses",
        items: [{ name: "Invasive Breast Carcinoma" }],
      },
    ];

    const { container, unmount } = renderComponent(
      <PatientSummaryCard sections={sections} />
    );

    const scrollBody = container.querySelector(
      '[data-testid="patient-summary-card-scroll"]'
    );

    expect(scrollBody).not.toBeNull();
    expect(window.getComputedStyle(scrollBody).overflowY).toBe("auto");

    unmount();
  });

  it("hides findings below the confidence slider threshold and reports the hidden count", () => {
    const sections = [
      {
        key: "diagnoses",
        label: "Diagnoses",
        items: [
          {
            name: "High Confidence Finding",
            selection: {
              bestConfidence: 1,
              documentRanking: [{ documentId: "d1", confidence: 1 }],
            },
          },
          {
            name: "Low Confidence Finding",
            selection: {
              bestConfidence: 0.2,
              documentRanking: [{ documentId: "d2", confidence: 0.2 }],
            },
          },
        ],
      },
    ];

    const { container, unmount } = renderComponent(<PatientSummaryCard sections={sections} />);

    // The patient-view confidence filter defaults to 100%.
    expect(container.textContent).toContain("High Confidence Finding");
    expect(container.textContent).not.toContain("Low Confidence Finding");
    expect(container.textContent).toContain("1 finding hidden below 100% confidence.");

    const slider = container.querySelector('input[type="range"]');
    expect(slider).not.toBeNull();
    expect(slider.getAttribute("aria-label")).toBe("Minimum finding confidence percent");

    expect(slider.value).toBe("100");

    unmount();
  });

  it("collapses to its header, hiding the findings body and confidence slider", () => {
    const sections = [
      {
        key: "diagnoses",
        label: "Diagnoses",
        items: [{ name: "Some Finding" }],
      },
    ];
    const onToggleExpanded = jest.fn();

    const { container, unmount } = renderComponent(
      <PatientSummaryCard
        sections={sections}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        collapsiblePanelId="summary-panel-body"
      />
    );

    const toggle = container.querySelector(
      'button[aria-label="Expand Patient Summary section"]'
    );
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("summary-panel-body");
    // Body + confidence slider are gone while collapsed.
    expect(container.querySelector('[data-testid="patient-summary-card-scroll"]')).toBeNull();
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(container.textContent).not.toContain("Some Finding");

    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);

    unmount();
  });
});
