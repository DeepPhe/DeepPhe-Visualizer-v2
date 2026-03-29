/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import HorizontalBarChart from "../HorizontalBarChart";

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

async function clickAsync(element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
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

function getRowLabelOrder(container, labels) {
  const labelSet = new Set(labels);
  return Array.from(container.querySelectorAll("svg text"))
    .map((node) => ({
      label: String(node.textContent || "").trim(),
      y: Number(node.getAttribute("y")),
    }))
    .filter((row) => labelSet.has(row.label) && Number.isFinite(row.y))
    .sort((leftRow, rightRow) => leftRow.y - rightRow.y)
    .map((row) => row.label);
}

describe("HorizontalBarChart patient dots", () => {
  it("renders row hover highlight when a chart row is hovered", async () => {
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="Hover Test"
        data={[
          {
            label: "Group A",
            displayLabel: "Group A",
            value: 12,
          },
        ]}
        onSelectionChange={jest.fn()}
      />
    );

    const interactiveRow = container.querySelector('rect[role="button"]');
    expect(interactiveRow).not.toBeNull();

    const hoverRectBefore = container.querySelector('rect[data-hover-highlight="true"]');
    expect(hoverRectBefore).not.toBeNull();
    expect(hoverRectBefore.getAttribute("opacity")).toBe("0");

    await act(async () => {
      interactiveRow.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      await Promise.resolve();
    });

    const hoverRectDuring = container.querySelector('rect[data-hover-highlight="true"]');
    expect(hoverRectDuring).not.toBeNull();
    expect(hoverRectDuring.getAttribute("opacity")).toBe("1");

    await act(async () => {
      interactiveRow.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      await Promise.resolve();
    });

    const hoverRectAfter = container.querySelector('rect[data-hover-highlight="true"]');
    expect(hoverRectAfter).not.toBeNull();
    expect(hoverRectAfter.getAttribute("opacity")).toBe("0");

    unmount();
  });

  it("renders an SVG focus ring when a chart row receives keyboard focus", async () => {
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="Focus Test"
        data={[
          {
            label: "Group A",
            displayLabel: "Group A",
            value: 8,
          },
        ]}
        onSelectionChange={jest.fn()}
      />
    );

    const interactiveRow = container.querySelector('rect[role="button"]');
    expect(interactiveRow).not.toBeNull();

    expect(container.querySelector('rect[data-focus-ring="true"]')).toBeNull();

    await act(async () => {
      interactiveRow.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('rect[data-focus-ring="true"]')).not.toBeNull();

    await act(async () => {
      interactiveRow.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('rect[data-focus-ring="true"]')).toBeNull();

    unmount();
  });

  it("renders one dot per patient when count is at or below threshold", () => {
    const patientIds = Array.from(
      { length: 20 },
      (_, index) => `PATIENT_${String.fromCharCode(65 + index)}`
    );
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="Test"
        data={[
          {
            label: "Group A",
            displayLabel: "Group A",
            value: 20,
            patientIds,
          },
        ]}
        inlinePatientIdsThreshold={20}
      />
    );

    const dots = container.querySelectorAll('circle[data-patient-dot="true"]');
    expect(dots).toHaveLength(20);

    unmount();
  });

  it("does not render dots when patientIds are missing", () => {
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="Test"
        data={[
          {
            label: "U",
            displayLabel: "U",
            value: 15,
          },
        ]}
        inlinePatientIdsThreshold={20}
      />
    );

    const dots = container.querySelectorAll('circle[data-patient-dot="true"]');
    expect(dots).toHaveLength(0);

    unmount();
  });

  it("shows numeric count instead of dots when count is above threshold", () => {
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="Test"
        data={[
          {
            label: "Group B",
            displayLabel: "Group B",
            value: 21,
            patientIds: Array.from(
              { length: 21 },
              (_, index) => `PATIENT_${String.fromCharCode(65 + index)}`
            ),
          },
        ]}
        inlinePatientIdsThreshold={20}
      />
    );

    const dots = container.querySelectorAll('circle[data-patient-dot="true"]');
    expect(dots).toHaveLength(0);
    expect(container.textContent).toContain("21");

    unmount();
  });

  it("opens patient summary on dot click without toggling row selection", async () => {
    const onSelectionChange = jest.fn();
    const getPatientSummary = jest.fn().mockResolvedValue({
      patientId: "PATIENT_BRAVO",
      docCount: 1,
      activeDx: [{ name: "Basal Cell Carcinoma", uncertain: false, docFreq: 1 }],
      negatedDx: [],
      staging: [],
      biomarkers: [],
      procedures: [],
      treatments: [],
      activeFindings: [],
      negatedFindings: [],
    });
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="Test"
        data={[
          {
            label: "Group C",
            displayLabel: "Group C",
            value: 2,
            patientIds: ["PATIENT_ALPHA", "PATIENT_BRAVO"],
          },
        ]}
        selectedValues={[]}
        onSelectionChange={onSelectionChange}
        getPatientSummary={getPatientSummary}
        inlinePatientIdsThreshold={20}
      />
    );

    const targetDot = container.querySelector('circle[data-patient-id="PATIENT_BRAVO"]');
    expect(targetDot).not.toBeNull();

    await clickAsync(targetDot);

    await waitFor(() => {
      expect(getPatientSummary).toHaveBeenCalledWith("PATIENT_BRAVO");
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain("Patient PATIENT_BRAVO · 1 notes");
    });
    expect(onSelectionChange).not.toHaveBeenCalled();

    unmount();
  });

  it("does not render a misleading zero-note label when note count is unavailable", async () => {
    const getPatientSummary = jest.fn().mockResolvedValue({
      patientId: "PATIENT_OMEGA",
      docCount: 0,
      activeDx: [{ name: "Melanoma", uncertain: false }],
      negatedDx: [],
      staging: [],
      biomarkers: [],
      procedures: [],
      treatments: [],
      activeFindings: [],
      negatedFindings: [],
    });
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="No Count Test"
        data={[
          {
            label: "Group Z",
            displayLabel: "Group Z",
            value: 1,
            patientIds: ["PATIENT_OMEGA"],
          },
        ]}
        getPatientSummary={getPatientSummary}
        inlinePatientIdsThreshold={20}
      />
    );

    const targetDot = container.querySelector('circle[data-patient-id="PATIENT_OMEGA"]');
    expect(targetDot).not.toBeNull();

    await clickAsync(targetDot);

    await waitFor(() => {
      expect(getPatientSummary).toHaveBeenCalledWith("PATIENT_OMEGA");
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain("Patient PATIENT_OMEGA");
    });
    expect(document.body.textContent).not.toContain("Patient PATIENT_OMEGA · 0 notes");

    unmount();
  });

  it("keeps dots visible when display labels are expanded from short codes", () => {
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="Gender"
        data={[
          {
            label: "U",
            displayLabel: "Unknown",
            value: 3,
            patientIds: ["PATIENT_ALPHA", "PATIENT_BRAVO", "PATIENT_CHARLIE"],
          },
        ]}
        inlinePatientIdsThreshold={20}
      />
    );

    expect(container.textContent).toContain("Unknown");
    const dots = container.querySelectorAll('circle[data-patient-dot="true"]');
    expect(dots).toHaveLength(3);

    unmount();
  });

  it("notifies sort mode changes so external distribution strips can sync", async () => {
    const onSortModeChange = jest.fn();
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="Test"
        data={[
          {
            label: "B",
            displayLabel: "B",
            value: 4,
          },
          {
            label: "A",
            displayLabel: "A",
            value: 2,
          },
        ]}
        showSortDimensionToggle
        showSortCycleButton={false}
        onSortModeChange={onSortModeChange}
      />
    );

    await waitFor(() => {
      expect(onSortModeChange).toHaveBeenCalledWith("value-desc");
    });

    const labelSortButton = container.querySelector('button[aria-label^="Sort by label"]');
    expect(labelSortButton).not.toBeNull();

    await clickAsync(labelSortButton);

    await waitFor(() => {
      expect(onSortModeChange).toHaveBeenLastCalledWith("alpha-asc");
    });

    unmount();
  });

  it("applies custom label sort order while preserving count sort toggle", async () => {
    const { container, unmount } = renderComponent(
      <HorizontalBarChart
        title="TNM"
        data={[
          { label: "T3", displayLabel: "T3", value: 5 },
          { label: "TX", displayLabel: "TX", value: 7 },
          { label: "T0", displayLabel: "T0", value: 1 },
          { label: "T1", displayLabel: "T1", value: 9 },
        ]}
        customSortOrder={["T0", "Tis", "Ta", "T1", "T2", "T3", "T4"]}
        defaultSort="alpha-asc"
        showSortDimensionToggle
        showSortCycleButton={false}
      />
    );

    await waitFor(() => {
      expect(getRowLabelOrder(container, ["T0", "T1", "T3", "TX"])).toEqual([
        "T0",
        "T1",
        "T3",
        "TX",
      ]);
    });

    const countSortButton = container.querySelector('button[aria-label^="Sort by count"]');
    expect(countSortButton).not.toBeNull();
    await clickAsync(countSortButton);

    await waitFor(() => {
      expect(getRowLabelOrder(container, ["T0", "T1", "T3", "TX"])).toEqual([
        "T1",
        "TX",
        "T3",
        "T0",
      ]);
    });

    unmount();
  });
});
