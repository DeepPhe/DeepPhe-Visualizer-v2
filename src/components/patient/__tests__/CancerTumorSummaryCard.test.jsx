/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import CancerTumorSummaryCard from "../CancerTumorSummaryCard";

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
      act(() => root.unmount());
      container.remove();
    },
  };
}

const fact = (id, value) => ({ id, value });

const cancers = [
  {
    cancerId: "cancer-1",
    title: "cancer-1",
    collatedCancerFacts: [
      { categoryName: "Location", facts: [fact("c-location", "Upper-Outer Quadrant of the Breast")] },
      { categoryName: "Grade", facts: [fact("c-grade", "3")] },
      { categoryName: "Genes", facts: [fact("c-gene", "ERBB2 Gene")] },
    ],
    tnm: [
      {
        data: {
          T: [fact("c-t", "1")],
          N: [fact("c-n", "1")],
          M: [fact("c-m", "0")],
        },
      },
    ],
    tumors: {
      listViewData: [
        {
          id: "tumor-1",
          type: "tumor_machine_id_1",
          data: [
            { category: "Location", facts: [fact("t-location", "Upper-Outer Quadrant of the Breast")] },
            { category: "Laterality", facts: [fact("t-laterality", "Left")] },
            { category: "Grade", facts: [fact("t-grade", "3")] },
          ],
        },
      ],
    },
  },
];

describe("CancerTumorSummaryCard", () => {
  it("uses a content-height grid while preserving every fact and click behavior", () => {
    const onFactSelect = jest.fn();
    const { container, unmount } = renderComponent(
      <CancerTumorSummaryCard
        cancers={cancers}
        contentAutoHeight
        onFactSelect={onFactSelect}
      />
    );

    const card = container.querySelector('[data-testid="cancer-tumor-summary-card"]');
    const record = container.querySelector('[data-testid="cancer-summary-record"]');
    const cancerFactGrid = container.querySelector('[data-testid="cancer-fact-grid"]');
    const tumorFactGrid = container.querySelector('[data-testid="tumor-fact-grid"]');

    expect(window.getComputedStyle(card).height).toBe("auto");
    expect(window.getComputedStyle(record).display).toBe("grid");
    // Fact groups flow and wrap for density rather than sitting in a rigid grid.
    expect(window.getComputedStyle(cancerFactGrid).display).toBe("flex");
    expect(window.getComputedStyle(cancerFactGrid).flexWrap).toBe("wrap");
    expect(window.getComputedStyle(tumorFactGrid).display).toBe("flex");
    expect(window.getComputedStyle(tumorFactGrid).flexWrap).toBe("wrap");
    expect(container.textContent).toContain("Cancer 1");
    expect(container.textContent).toContain("Gene(s)");
    expect(container.textContent).toContain("TNM");
    expect(container.textContent).toContain("Tumor 1");
    expect(container.textContent).toContain("Laterality");

    const locationButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Upper-Outer Quadrant of the Breast"
    );
    act(() => {
      locationButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onFactSelect).toHaveBeenCalledWith("c-location");

    unmount();
  });

  it("exposes an accessible collapse toggle and hides the body when collapsed", () => {
    const onToggleExpanded = jest.fn();
    const { container, unmount } = renderComponent(
      <CancerTumorSummaryCard
        cancers={cancers}
        contentAutoHeight
        expanded
        onToggleExpanded={onToggleExpanded}
        collapsiblePanelId="cancer-panel-body"
      />
    );

    const toggle = container.querySelector(
      'button[aria-label="Collapse Cancer and Tumor Detail section"]'
    );
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe("cancer-panel-body");
    expect(container.querySelector('[data-testid="cancer-summary-record"]')).not.toBeNull();
    expect(container.querySelector("#cancer-panel-body")).not.toBeNull();

    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("renders only the header when collapsed", () => {
    const { container, unmount } = renderComponent(
      <CancerTumorSummaryCard
        cancers={cancers}
        contentAutoHeight
        expanded={false}
        onToggleExpanded={() => {}}
        collapsiblePanelId="cancer-panel-body"
      />
    );

    const toggle = container.querySelector(
      'button[aria-label="Expand Cancer and Tumor Detail section"]'
    );
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="cancer-summary-record"]')).toBeNull();
    expect(container.querySelector("#cancer-panel-body")).toBeNull();

    unmount();
  });
});
