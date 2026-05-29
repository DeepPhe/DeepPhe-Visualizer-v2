/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PatientGrid from "../PatientGrid";

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

async function waitFor(assertion, timeoutMs = 2000) {
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

const baseRow = {
  patientId: "TEST-ID-001",
  ageAtDx: "52",
  gender: "female",
  race: "white",
  ethnicity: "Unknown",
  cancerType: "Breast",
  stage: "Stage IIA",
  stageSortRank: 6,
  grade: "2",
  activeDx: "Breast Lobular Carcinoma",
  diagnosesSummary: { display: "Breast carcinoma", full: "Breast carcinoma", overflow: 0 },
  biomarkersSummary: { display: "ERBB2 Gene", full: "ERBB2 Gene", overflow: 0 },
  treatmentsSummary: { display: "Docetaxel", full: "Docetaxel", overflow: 0 },
  proceduresSummary: { display: "Core biopsy", full: "Core biopsy", overflow: 0 },
  findingsSummary: { display: "Atypia", full: "Atypia", overflow: 0 },
  _raw: {},
};

describe("PatientGrid column sizing", () => {
  it("renders drag handles for resizable columns", () => {
    const { container, unmount } = renderComponent(
      <PatientGrid embedded data={[baseRow]} totalCohortCount={1} cohortSize={1} />
    );

    const resizeHandles = container.querySelectorAll('[data-testid^="patient-grid-column-resizer-"]');
    expect(resizeHandles.length).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="patient-grid-column-resizer-patientId"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="patient-grid-column-resizer-expand"]')).toBeNull();

    unmount();
  });

  it("updates Patient ID column width when drag-resized", async () => {
    const { container, unmount } = renderComponent(
      <PatientGrid embedded data={[baseRow]} totalCohortCount={1} cohortSize={1} />
    );

    const patientIdHeader = container.querySelector('thead th[data-column-id="patientId"]');
    const patientIdResizeHandle = container.querySelector(
      '[data-testid="patient-grid-column-resizer-patientId"]'
    );

    expect(patientIdHeader).not.toBeNull();
    expect(patientIdResizeHandle).not.toBeNull();
    expect(Number(patientIdHeader?.getAttribute("data-column-size"))).toBe(200);

    await act(async () => {
      patientIdResizeHandle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 200 }));
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 280 }));
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      await Promise.resolve();
    });

    let nextSize = Number(patientIdHeader?.getAttribute("data-column-size"));
    await waitFor(() => {
      nextSize = Number(patientIdHeader?.getAttribute("data-column-size"));
      expect(nextSize).not.toBe(200);
    });
    expect(nextSize).toBeGreaterThanOrEqual(130);

    unmount();
  });
});

describe("PatientGrid detail panel actions", () => {
  it("opens document viewer from expanded patient summary button", async () => {
    const onPatientOpen = jest.fn();
    const rowWithDetails = {
      ...baseRow,
      patientId: "TEST-ID-OPEN",
      _raw: {
        diagnoses: [{ name: "Invasive Breast Carcinoma" }],
      },
    };

    const { container, unmount } = renderComponent(
      <PatientGrid
        embedded
        data={[rowWithDetails]}
        totalCohortCount={1}
        cohortSize={1}
        onPatientOpen={onPatientOpen}
      />
    );

    const expandButton = container.querySelector('button[aria-label="Expand row details"]');
    expect(expandButton).not.toBeNull();

    await act(async () => {
      expandButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    let showInViewerButton = null;
    await waitFor(() => {
      showInViewerButton = Array.from(container.querySelectorAll("button")).find((buttonNode) =>
        String(buttonNode.textContent || "").includes("Show in Document Viewer")
      );
      expect(showInViewerButton).not.toBeNull();
    });

    await act(async () => {
      showInViewerButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(onPatientOpen).toHaveBeenCalledTimes(1);
    expect(onPatientOpen).toHaveBeenCalledWith("TEST-ID-OPEN");

    unmount();
  });
});
