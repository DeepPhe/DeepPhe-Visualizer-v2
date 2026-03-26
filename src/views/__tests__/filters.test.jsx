import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

jest.mock("../../components/HorizontalBarChart", () => (props) => {
  const selectedValues = Array.isArray(props.selectedValues) ? props.selectedValues : [];

  return (
    <div data-testid={`chart-${props.title}`}>
      {props.data.map((row) => {
        const isSelected = selectedValues.includes(row.label);
        return (
          <button
            key={row.label}
            type="button"
            onClick={() => {
              const nextValues = isSelected
                ? selectedValues.filter((value) => value !== row.label)
                : [...selectedValues, row.label];
              props.onSelectionChange?.(nextValues);
            }}
          >
            {row.label}
          </button>
        );
      })}
    </div>
  );
});

jest.mock("../../controllers/omap", () => ({
  getClasses: jest.fn(),
  getInstances: jest.fn(),
}));

jest.mock("../../controllers/attributes", () => ({
  getClasses: jest.fn(),
  getInstances: jest.fn(),
}));

jest.mock("../../clients/deepphe-data-api", () => ({
  fetchDeepPheFilterCount: jest.fn(),
}));

import FiltersView from "../filters";
import { getClasses as getOmopClasses, getInstances as getOmopInstances } from "../../controllers/omap";
import {
  getClasses as getAttributeClasses,
  getInstances as getAttributeInstances,
} from "../../controllers/attributes";
import { fetchDeepPheFilterCount } from "../../clients/deepphe-data-api";

function renderComponent(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {element}
      </MemoryRouter>
    );
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

async function waitFor(assertion, timeoutMs = 2500) {
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

describe("FiltersView", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getOmopClasses.mockResolvedValue(["AGE_AT_DX", "GENDER", "RACE", "CANCER"]);
    getOmopInstances.mockImplementation((attribute) => {
      if (String(attribute).toUpperCase() === "AGE_AT_DX") {
        return Promise.resolve([
          { age_at_dx: "40-49", count: 11 },
          { age_at_dx: "50-59", count: 7 },
        ]);
      }

      if (String(attribute).toUpperCase() === "GENDER") {
        return Promise.resolve([
          { gender: "Female", count: 13 },
          { gender: "Male", count: 9 },
        ]);
      }

      if (String(attribute).toUpperCase() === "RACE") {
        return Promise.resolve([
          { race: "White", count: 12 },
          { race: "Black", count: 7 },
        ]);
      }

      if (String(attribute).toUpperCase() === "CANCER") {
        return Promise.resolve([
          { cancer: "Breast", count: 6 },
          { cancer: "Lung", count: 5 },
        ]);
      }

      return Promise.resolve([]);
    });

    getAttributeClasses.mockResolvedValue([
      "Behavior",
      "Grade_Numeric",
      "M Stage",
      "N Stage",
      "T Stage",
    ]);
    getAttributeInstances.mockImplementation((className) => {
      if (className === "T Stage") {
        return Promise.resolve([
          { value: "T1", count: 9 },
          { value: "T2", count: 4 },
        ]);
      }
      if (className === "N Stage") {
        return Promise.resolve([
          { value: "N0", count: 8 },
          { value: "N1", count: 3 },
        ]);
      }
      if (className === "M Stage") {
        return Promise.resolve([
          { value: "M0", count: 10 },
          { value: "M1", count: 2 },
        ]);
      }
      if (className === "Grade_Numeric") {
        return Promise.resolve([
          { value: "Grade 2", count: 6 },
          { value: "Grade 3", count: 5 },
        ]);
      }
      if (className === "Behavior") {
        return Promise.resolve([
          { value: "Invasive", count: 7 },
          { value: "Malignant", count: 6 },
        ]);
      }
      return Promise.resolve([]);
    });

    fetchDeepPheFilterCount.mockResolvedValue({
      count: 4,
      patient_ids: [],
      timing: {
        queryMs: 8.5,
        bitmapMs: 1.2,
        resolveMs: 0,
        totalMs: 9.7,
        itemCounts: [11, 13, 12, 6, 5, 7],
      },
    });
  });

  it("builds OMOP + Attribute endpoint filters from selected class charts", async () => {
    const { container, unmount } = renderComponent(<FiltersView />);

    await waitFor(() => {
      const ageButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "40-49"
      );
      const genderButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Female"
      );
      const raceButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "White"
      );
      const cancerButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Breast"
      );
      const gradeButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "G3"
      );
      const behaviorButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Malignant"
      );

      expect(ageButton).not.toBeUndefined();
      expect(genderButton).not.toBeUndefined();
      expect(raceButton).not.toBeUndefined();
      expect(cancerButton).not.toBeUndefined();
      expect(gradeButton).not.toBeUndefined();
      expect(behaviorButton).not.toBeUndefined();
    });

    const ageButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "40-49"
    );
    const genderButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Female"
    );
    const raceButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "White"
    );
    const cancerButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Breast"
    );
    const gradeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "G3"
    );
    const behaviorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Malignant"
    );

    await clickAsync(ageButton);
    await clickAsync(genderButton);
    await clickAsync(raceButton);
    await clickAsync(cancerButton);
    await clickAsync(gradeButton);
    await clickAsync(behaviorButton);

    await waitFor(() => {
      expect(fetchDeepPheFilterCount).toHaveBeenCalledWith({
        filters: [
          { type: "omop", class: "AGE_AT_DX", instances: ["40-49"] },
          { type: "omop", class: "RACE", instances: ["White"] },
          { type: "omop", class: "GENDER", instances: ["Female"] },
          { type: "omop", class: "CANCER", instances: ["Breast"] },
          { type: "attributes", class: "Grade_Numeric", instances: ["Grade 3"] },
          { type: "attributes", class: "Behavior", instances: ["Invasive", "Malignant"] },
        ],
        includePatientIds: false,
      });
    });

    expect(container.textContent).toContain(
      "There are 4 40-49 year old white female patients in the cohort with breast cancer, malignant neoplasm behavior, and grade G3."
    );

    unmount();
  });

  it("expands age decile selections into underlying AGE_AT_DX instances", async () => {
    getOmopClasses.mockResolvedValue(["AGE_AT_DX"]);
    getOmopInstances.mockImplementation((attribute) => {
      if (String(attribute).toUpperCase() === "AGE_AT_DX") {
        return Promise.resolve([
          { age_at_dx: "41", count: 4 },
          { age_at_dx: "44", count: 3 },
          { age_at_dx: "52", count: 2 },
        ]);
      }
      return Promise.resolve([]);
    });
    getAttributeClasses.mockResolvedValue([]);
    fetchDeepPheFilterCount.mockResolvedValue({
      count: 7,
      patient_ids: [],
      timing: {
        queryMs: 2.1,
        bitmapMs: 0.6,
        resolveMs: 0,
        totalMs: 2.7,
        itemCounts: [7],
      },
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    await waitFor(() => {
      const decileBucket = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "40-49"
      );
      expect(decileBucket).not.toBeUndefined();
    });

    const decileBucket = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "40-49"
    );
    await clickAsync(decileBucket);

    await waitFor(() => {
      expect(fetchDeepPheFilterCount).toHaveBeenCalledWith({
        filters: [{ type: "omop", class: "AGE_AT_DX", instances: ["41", "44"] }],
        includePatientIds: false,
      });
    });

    unmount();
  });

  it("shows slow-query warning and zero-result hint with itemCounts guidance", async () => {
    fetchDeepPheFilterCount.mockResolvedValue({
      count: 0,
      patient_ids: [],
      timing: {
        queryMs: 91.5,
        bitmapMs: 15,
        resolveMs: 0,
        totalMs: 106.5,
        itemCounts: [13, 12, 0, 7],
      },
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    await waitFor(() => {
      const genderButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Female"
      );
      const raceButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "White"
      );
      const cancerButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Breast"
      );
      const behaviorButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Malignant"
      );
      expect(genderButton).not.toBeUndefined();
      expect(raceButton).not.toBeUndefined();
      expect(cancerButton).not.toBeUndefined();
      expect(behaviorButton).not.toBeUndefined();
    });

    const genderButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Female"
    );
    const raceButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "White"
    );
    const cancerButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Breast"
    );
    const behaviorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Malignant"
    );
    await clickAsync(genderButton);
    await clickAsync(raceButton);
    await clickAsync(cancerButton);
    await clickAsync(behaviorButton);

    await waitFor(() => {
      expect(container.textContent).toContain("Query took 106.5 ms");
      expect(container.textContent).toContain(
        "Cancer matched 0 patients before intersection. Check spelling and selected values."
      );
    });

    expect(container.textContent).toContain("No patients matched these criteria.");

    unmount();
  });
});
