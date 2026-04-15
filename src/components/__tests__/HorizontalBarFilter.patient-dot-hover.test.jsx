/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import HorizontalBarFilter from "../HorizontalBarFilter";

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

async function hoverAsync(element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await Promise.resolve();
  });
}

async function advanceTimersAsync(durationMs) {
  await act(async () => {
    jest.advanceTimersByTime(durationMs);
    await Promise.resolve();
  });
}

describe("HorizontalBarFilter unselected patient dot hover", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("shows a patient summary popper when hovering an unselected row dot", async () => {
    const getPatientSummary = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              patientId: "PATIENT_BRAVO",
              docCount: 2,
              activeDx: [{ name: "Basal Cell Carcinoma", uncertain: false, docFreq: 2 }],
              negatedDx: [],
              staging: [],
              biomarkers: [],
              procedures: [],
              treatments: [],
              activeFindings: [],
              negatedFindings: [],
            });
          }, 1000);
        })
    );
    const onSelectionChange = jest.fn();
    const { container, unmount } = renderComponent(
      <HorizontalBarFilter
        title="Test"
        data={[
          {
            label: "Group A",
            displayLabel: "Group A",
            value: 1,
            patientIds: ["PATIENT_ALPHA"],
          },
          {
            label: "Group B",
            displayLabel: "Group B",
            value: 1,
            patientIds: ["PATIENT_BRAVO"],
          },
        ]}
        selectedValues={["Group A"]}
        onSelectionChange={onSelectionChange}
        getPatientSummary={getPatientSummary}
        inlinePatientIdsThreshold={20}
      />
    );

    const targetDot = container.querySelector(
      'circle.horizontal-bar-filter-patient-dot-hitbox[aria-label^="Patient PATIENT_BRAVO"]'
    );
    expect(targetDot).not.toBeNull();

    await hoverAsync(targetDot);
    await advanceTimersAsync(220);

    expect(getPatientSummary).toHaveBeenCalledWith("PATIENT_BRAVO");
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Patient PATIENT_BRAVO");
    expect(document.body.textContent).not.toContain(
      "Hover or click a patient dot to view the summary."
    );

    await advanceTimersAsync(1000);
    expect(document.body.textContent).toContain("Patient PATIENT_BRAVO · 2 notes");

    unmount();
  });

  it("renders an enlarged interactive hitbox for patient dots", () => {
    const { container, unmount } = renderComponent(
      <HorizontalBarFilter
        title="Hitbox Test"
        data={[
          {
            label: "Group B",
            displayLabel: "Group B",
            value: 1,
            patientIds: ["PATIENT_BRAVO"],
          },
        ]}
        selectedValues={[]}
        inlinePatientIdsThreshold={20}
      />
    );

    const visibleDot = container.querySelector('circle[data-patient-dot="true"]');
    const dotHitbox = container.querySelector("circle.horizontal-bar-filter-patient-dot-hitbox");
    expect(visibleDot).not.toBeNull();
    expect(dotHitbox).not.toBeNull();

    const visibleRadius = Number(visibleDot.getAttribute("r"));
    const hitboxRadius = Number(dotHitbox.getAttribute("r"));
    expect(hitboxRadius).toBeGreaterThan(visibleRadius);
    expect(container.querySelector("circle.horizontal-bar-filter-patient-dot-hitbox > title")).toBeNull();

    unmount();
  });
});
