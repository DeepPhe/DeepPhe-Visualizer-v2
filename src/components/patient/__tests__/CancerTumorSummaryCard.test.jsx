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
    expect(window.getComputedStyle(cancerFactGrid).display).toBe("grid");
    expect(window.getComputedStyle(tumorFactGrid).display).toBe("grid");
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
});
