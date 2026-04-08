import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const mockHorizontalBarChart = jest.fn();

jest.mock("../../components/HorizontalBarChart", () => (props) => {
  mockHorizontalBarChart(props);
  const selectedValues = Array.isArray(props.selectedValues) ? props.selectedValues : [];

  return (
    <div data-testid={`chart-${props.title}`}>
      {props.data.map((row) => {
        const isSelected = selectedValues.includes(row.label);
        const textLabel = row.displayLabel || row.label;
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
            {textLabel}
          </button>
        );
      })}
    </div>
  );
});

jest.mock("../../controllers/omap", () => ({
  getSummary: jest.fn(),
}));

jest.mock("../../controllers/attributes", () => ({
  getSummary: jest.fn(),
}));

jest.mock("../../clients/deepphe-data-api", () => ({
  fetchDeepPheFilterCount: jest.fn(),
  fetchDeepPheFilterSummary: jest.fn(),
}));

import FiltersView from "../filters";
import { getSummary as getOmopSummary } from "../../controllers/omap";
import { getSummary as getAttributeSummary } from "../../controllers/attributes";
import {
  fetchDeepPheFilterCount,
  fetchDeepPheFilterSummary,
} from "../../clients/deepphe-data-api";

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

function findButtonByText(text) {
  const targetText = String(text || "")
    .trim()
    .toLowerCase();
  return Array.from(document.querySelectorAll("button")).find(
    (button) => {
      const buttonText = String(button.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      return buttonText === targetText || buttonText.includes(targetText);
    }
  );
}

function findOpenFilterButton(filterName) {
  const expectedLabel = `open ${String(filterName || "").trim().toLowerCase()} filter`;
  return Array.from(document.querySelectorAll("button")).find((button) => {
    const ariaLabel = String(button.getAttribute("aria-label") || "")
      .trim()
      .toLowerCase();
    return ariaLabel === expectedLabel;
  });
}

async function selectFilterValue(filterButtonText, valueButtonText) {
  await waitFor(() => {
    const filterButton = findOpenFilterButton(filterButtonText);
    expect(filterButton).not.toBeUndefined();
  });

  await clickAsync(findOpenFilterButton(filterButtonText));

  await waitFor(() => {
    const valueButton = findButtonByText(valueButtonText);
    expect(valueButton).not.toBeUndefined();
  });

  await clickAsync(findButtonByText(valueButtonText));

  await waitFor(() => {
    const closeButton = findButtonByText("Close");
    expect(closeButton).not.toBeUndefined();
  });

  await clickAsync(findButtonByText("Close"));
}

function hasFilterRequest(expectedFilters) {
  const expected = JSON.stringify(expectedFilters);
  return fetchDeepPheFilterCount.mock.calls.some(([payload]) => {
    return JSON.stringify(payload?.filters || []) === expected;
  });
}

describe("FiltersView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHorizontalBarChart.mockClear();

    getOmopSummary.mockResolvedValue({
      classes: ["AGE_AT_DX", "GENDER", "RACE", "CANCER"],
      instancesByClass: {
        AGE_AT_DX: [
          { age_at_dx: "40-49", count: 11 },
          { age_at_dx: "50-59", count: 7 },
        ],
        GENDER: [
          { gender: "Female", count: 13 },
          { gender: "Male", count: 9 },
        ],
        RACE: [
          { race: "White", count: 12 },
          { race: "Black", count: 7 },
        ],
        CANCER: [
          { cancer: "Breast", count: 6 },
          { cancer: "Lung", count: 5 },
        ],
      },
    });

    getAttributeSummary.mockResolvedValue({
      classes: ["Behavior", "Grade_Numeric", "M Stage", "N Stage", "T Stage"],
      instancesByClass: {
        "T Stage": [
          { value: "T1", count: 9 },
          { value: "T2", count: 4 },
        ],
        "N Stage": [
          { value: "N0", count: 8 },
          { value: "N1", count: 3 },
        ],
        "M Stage": [
          { value: "M0", count: 10 },
          { value: "M1", count: 2 },
        ],
        Grade_Numeric: [
          { value: "Grade 2", count: 6 },
          { value: "Grade 3", count: 5 },
        ],
        Behavior: [
          { value: "Invasive", count: 7 },
          { value: "Malignant", count: 6 },
        ],
      },
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
    fetchDeepPheFilterSummary.mockResolvedValue([]);
  });

  it("builds OMOP + Attribute endpoint filters from selected class charts", async () => {
    const { container, unmount } = renderComponent(<FiltersView />);

    await waitFor(() => {
      expect(findOpenFilterButton("Age at Dx")).not.toBeUndefined();
      expect(findOpenFilterButton("Gender")).not.toBeUndefined();
      expect(findOpenFilterButton("Race")).not.toBeUndefined();
      expect(findOpenFilterButton("Cancer")).not.toBeUndefined();
      expect(findOpenFilterButton("T Stage")).not.toBeUndefined();
    });

    await selectFilterValue("Age at Dx", "40-49");
    await selectFilterValue("Gender", "Female");
    await selectFilterValue("Race", "White");
    await selectFilterValue("Cancer", "Breast");
    await selectFilterValue("T Stage", "T2");

    await waitFor(() => {
      expect(
        hasFilterRequest([
          { type: "omop", class: "AGE_AT_DX", instances: ["40-49"] },
          { type: "omop", class: "RACE", instances: ["White"] },
          { type: "omop", class: "GENDER", instances: ["Female"] },
          { type: "omop", class: "CANCER", instances: ["Breast"] },
          { type: "attributes", class: "T Stage", instances: ["T2"] },
        ])
      ).toBe(true);
    });

    expect(container.textContent).toContain(
      "There are 4 40-49 year old white female patients in the cohort with breast cancer, and T stage T2."
    );

    unmount();
  });

  it("expands age decile selections into underlying AGE_AT_DX instances", async () => {
    getOmopSummary.mockResolvedValue({
      classes: ["AGE_AT_DX"],
      instancesByClass: {
        AGE_AT_DX: [
          { age_at_dx: "41", count: 4 },
          { age_at_dx: "44", count: 3 },
          { age_at_dx: "52", count: 2 },
        ],
      },
    });
    getAttributeSummary.mockResolvedValue({
      classes: [],
      instancesByClass: {},
    });
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

    const { unmount } = renderComponent(<FiltersView />);

    await waitFor(() => {
      const ageFilterButton = findOpenFilterButton("Age at Dx");
      expect(ageFilterButton).not.toBeUndefined();
    });

    await selectFilterValue("Age at Dx", "40-49");

    await waitFor(() => {
      expect(
        hasFilterRequest([{ type: "omop", class: "AGE_AT_DX", instances: ["41", "44"] }])
      ).toBe(true);
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
      expect(findOpenFilterButton("Gender")).not.toBeUndefined();
      expect(findOpenFilterButton("Race")).not.toBeUndefined();
      expect(findOpenFilterButton("Cancer")).not.toBeUndefined();
      expect(findOpenFilterButton("T Stage")).not.toBeUndefined();
    });

    await selectFilterValue("Gender", "Female");
    await selectFilterValue("Race", "White");
    await selectFilterValue("Cancer", "Breast");
    await selectFilterValue("T Stage", "T2");

    await waitFor(() => {
      expect(container.textContent).toContain("Query took 106.5 ms");
      expect(container.textContent).toContain(
        "Cancer matched 0 patients before intersection. Check spelling and selected values."
      );
    });

    expect(container.textContent).toContain("No patients matched these criteria.");

    unmount();
  });

  it("loads patient_ids for low-count gender rows and passes them to chart data", async () => {
    getOmopSummary.mockResolvedValue({
      classes: ["GENDER"],
      instancesByClass: {
        GENDER: [
          { gender: "U", count: 15 },
          { gender: "F", count: 40 },
        ],
      },
      timing: { totalMs: 1 },
    });
    getAttributeSummary.mockResolvedValue({
      classes: [],
      instancesByClass: {},
      timing: { totalMs: 1 },
    });

    const expectedPatientIds = [
      "TEST-PATIENT-001",
      "TEST-PATIENT-002",
      "TEST-PATIENT-003",
      "TEST-PATIENT-004",
      "TEST-PATIENT-005",
      "TEST-PATIENT-006",
      "TEST-PATIENT-007",
      "TEST-PATIENT-008",
      "TEST-PATIENT-009",
      "TEST-PATIENT-010",
      "TEST-PATIENT-011",
      "TEST-PATIENT-012",
      "TEST-PATIENT-013",
      "TEST-PATIENT-014",
      "TEST-PATIENT-015",
    ];

    fetchDeepPheFilterCount.mockImplementation(({ filters, includePatientIds }) => {
      const firstFilter = Array.isArray(filters) ? filters[0] : null;
      const isGenderURequest =
        firstFilter?.type === "omop" &&
        firstFilter?.class === "GENDER" &&
        Array.isArray(firstFilter?.instances) &&
        firstFilter.instances.length === 1 &&
        firstFilter.instances[0] === "U";

      if (isGenderURequest && includePatientIds) {
        return Promise.resolve({
          count: 15,
          patient_ids: expectedPatientIds,
          timing: {
            queryMs: 0.3,
            bitmapMs: 0.05,
            resolveMs: 0.23,
            totalMs: 0.58,
            itemCounts: [15],
          },
        });
      }

      return Promise.resolve({
        count: 0,
        patient_ids: [],
        timing: {
          queryMs: 0,
          bitmapMs: 0,
          resolveMs: 0,
          totalMs: 0,
          itemCounts: [],
        },
      });
    });

    const { unmount } = renderComponent(<FiltersView />);

    await waitFor(() => {
      const genderFilterButton = findOpenFilterButton("Gender");
      expect(genderFilterButton).not.toBeUndefined();
    });

    await clickAsync(findOpenFilterButton("Gender"));

    await waitFor(() => {
      expect(findButtonByText("Unknown")).not.toBeUndefined();
    });

    await clickAsync(findButtonByText("Unknown"));

    await waitFor(() => {
      expect(fetchDeepPheFilterCount).toHaveBeenCalledWith({
        filters: [{ type: "omop", class: "GENDER", instances: ["U"] }],
        includePatientIds: true,
      });
    });

    await waitFor(() => {
      const genderChartCall = [...mockHorizontalBarChart.mock.calls]
        .reverse()
        .map(([props]) => props)
        .find((props) => props.title === "Gender");
      expect(genderChartCall).toBeDefined();
      const unknownRow = Array.isArray(genderChartCall?.data)
        ? genderChartCall.data.find(
            (row) => row?.label === "U" || row?.displayLabel === "Unknown"
          )
        : null;
      expect(unknownRow?.displayLabel).toBe("Unknown");
      expect(Array.isArray(unknownRow?.patientIds)).toBe(true);
      expect(unknownRow?.patientIds?.length).toBe(expectedPatientIds.length);
    });

    unmount();
  });

  it("expands compact cancer short codes to display labels", async () => {
    getOmopSummary.mockResolvedValue({
      classes: ["CANCER"],
      instancesByClass: {
        CANCER: [
          { cancer: "B", count: 48_586 },
          { cancer: "M", count: 13_713 },
          { cancer: "O", count: 7_560 },
        ],
      },
      timing: { totalMs: 1 },
    });
    getAttributeSummary.mockResolvedValue({
      classes: [],
      instancesByClass: {},
      timing: { totalMs: 1 },
    });

    const { unmount } = renderComponent(<FiltersView />);

    await waitFor(() => {
      const cancerFilterButton = findOpenFilterButton("Cancer");
      expect(cancerFilterButton).not.toBeUndefined();
    });

    await clickAsync(findOpenFilterButton("Cancer"));

    await waitFor(() => {
      const breastButton = findButtonByText("Breast");
      const melanomaButton = findButtonByText("Melanoma");
      const ovarianButton = findButtonByText("Ovarian");

      expect(breastButton).not.toBeUndefined();
      expect(melanomaButton).not.toBeUndefined();
      expect(ovarianButton).not.toBeUndefined();
    });

    unmount();
  });
});
