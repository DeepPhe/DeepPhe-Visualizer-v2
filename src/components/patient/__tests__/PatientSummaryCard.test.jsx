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
});
