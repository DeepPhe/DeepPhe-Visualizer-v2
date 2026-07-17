import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const mockHorizontalBarFilter = jest.fn();

jest.mock("../../components/HorizontalBarFilter", () => (props) => {
  mockHorizontalBarFilter(props);
  const selectedValues = Array.isArray(props.selectedValues) ? props.selectedValues : [];

  return (
    <div className={props.className} data-testid={`chart-${props.title}`}>
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

jest.mock("../../controllers/concepts", () => ({
  getSummary: jest.fn(),
}));

jest.mock("../../clients/deepphe-data-api", () => ({
  fetchDeepPheFilterCount: jest.fn(),
  fetchDeepPheFilterCountBatch: jest.fn(),
  fetchDeepPheFilterSummary: jest.fn(),
  fetchPatientDocuments: jest.fn(),
}));

import FiltersView from "../filters";
import { FILTER_SETS } from "../filterSets";
import { getSummary as getOmopSummary } from "../../controllers/omap";
import { getSummary as getAttributeSummary } from "../../controllers/attributes";
import { getSummary as getConceptsSummary } from "../../controllers/concepts";
import {
  fetchDeepPheFilterCount,
  fetchDeepPheFilterCountBatch,
  fetchDeepPheFilterSummary,
  fetchPatientDocuments,
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

function findFilterCardByTitle(filterName) {
  const openButton = findOpenFilterButton(filterName);
  return openButton?.closest?.(".filter-card") || null;
}

function findSectionContainerByHeading(container, headingText) {
  const targetHeadingText = String(headingText || "").trim().toLowerCase();
  const sectionHeading = Array.from(container.querySelectorAll("h2")).find((node) => {
    return String(node.textContent || "").trim().toLowerCase() === targetHeadingText;
  });

  return sectionHeading?.parentElement || null;
}

function findFilterSetRowBySectionHeading(container, headingText) {
  const sectionContainer = findSectionContainerByHeading(container, headingText);
  return sectionContainer?.closest(".filter-set-row") || null;
}

function getRenderedFilterTitlesInSection(container, sectionHeadingText) {
  const sectionContainer = findSectionContainerByHeading(container, sectionHeadingText);
  if (!sectionContainer) {
    return [];
  }

  return Array.from(sectionContainer.querySelectorAll(".filter-card"))
    .map((cardNode) => getFilterTitleFromCardNode(cardNode))
    .filter(Boolean);
}

function findIdentifiedPatientsPanel(container) {
  const panelByTestId = container.querySelector('[data-testid="identified-patients-panel"]');
  if (panelByTestId) {
    return panelByTestId;
  }

  const identifiedHeading = Array.from(container.querySelectorAll("h2")).find((node) => {
    return String(node.textContent || "").trim().toLowerCase() === "identified patients";
  });

  return identifiedHeading?.closest(".MuiPaper-root") || null;
}

function findPatientGridDrawer(container) {
  return container.querySelector('[data-testid="patient-grid-drawer"]');
}

function findPatientGridDrawerToggle(container) {
  return container.querySelector('[data-testid="patient-grid-drawer-toggle"]');
}

function findFilterLayoutModeToggle(container) {
  return container.querySelector('[data-testid="filter-layout-mode-toggle"]');
}

function findResetAllFiltersButton(container) {
  return container.querySelector('[data-testid="reset-all-filters-button"]');
}

function getFilterTitleFromCardNode(cardNode) {
  const openButton = cardNode?.querySelector?.('button[aria-label^="Open "]');
  const ariaLabel = String(openButton?.getAttribute?.("aria-label") || "").trim();
  const match = ariaLabel.match(/^Open\s+(.+)\s+filter$/i);
  return match ? match[1].trim() : "";
}

function getConfiguredFilterTitlesForSection(sectionId) {
  const section = FILTER_SETS.find((filterSet) => filterSet.id === sectionId);
  if (!section) {
    return [];
  }

  return section.filters.map((filter) => filter.displayName || filter.key);
}

function getConfiguredCardHeightCapByTitle(defaultHeightCap) {
  return new Map(
    FILTER_SETS.flatMap((filterSet) =>
      filterSet.filters.map((filter) => [
        filter.displayName || filter.key,
        Number(filter.maxHeightPx) > 0 ? Number(filter.maxHeightPx) : defaultHeightCap,
      ])
    )
  );
}

async function selectFilterValue(filterButtonText, valueButtonText) {
  await waitFor(() => {
    const filterButton = findOpenFilterButton(filterButtonText);
    expect(filterButton).not.toBeUndefined();
  });

  await clickAsync(findOpenFilterButton(filterButtonText));

  // Scope the value lookup to the open details dialog so page-level buttons
  // (pagination, other cards) can't shadow short display labels like "2".
  const findValueButton = () => {
    const dialog = document.querySelector('[role="dialog"]');
    const scope = dialog || document;
    const targetText = String(valueButtonText || "").trim().toLowerCase();
    const buttons = Array.from(scope.querySelectorAll("button"));
    const normalized = (button) =>
      String(button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    return (
      buttons.find((button) => normalized(button) === targetText) ||
      buttons.find((button) => normalized(button).includes(targetText))
    );
  };

  await waitFor(() => {
    expect(findValueButton()).not.toBeUndefined();
  });

  await clickAsync(findValueButton());

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

function createMinWidthMatchMedia(activeWidthPx = 1024) {
  return jest.fn().mockImplementation((query) => {
    const minWidthMatch = String(query || "").match(/\(min-width:\s*(\d+)px\)/i);
    const minWidth = minWidthMatch ? Number.parseInt(minWidthMatch[1], 10) : 0;
    const matches = activeWidthPx >= minWidth;

    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  });
}

describe("FiltersView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHorizontalBarFilter.mockClear();
    // The view persists layout/theme/drawer preferences to localStorage;
    // clear it so tests don't leak state into each other.
    window.localStorage.clear();
    // The density picker is hidden and the default is now "standard"; these
    // layout tests still exercise the (kept) compact-plus packing/cap behavior,
    // so opt into it explicitly via the persisted preference.
    window.localStorage.setItem("filterPageCompactMode", "compact-plus");

    getOmopSummary.mockResolvedValue({
      classes: ["AGE_AT_DX", "GENDER", "RACE", "ETHNICITY", "CANCER"],
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
        ETHNICITY: [
          { ethnicity: "Not Hispanic or Latino", count: 14 },
          { ethnicity: "Hispanic or Latino", count: 8 },
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
    getConceptsSummary.mockResolvedValue({
      classes: [],
      instancesByClass: {},
    });
    // Reject so the view falls back to individual fetchDeepPheFilterCount
    // calls, which the hasFilterRequest assertions inspect.
    fetchDeepPheFilterCountBatch.mockRejectedValue(new Error("batch endpoint unavailable in tests"));
    fetchPatientDocuments.mockResolvedValue([]);
  });

  it("renders shared filter card classes while applying a responsive column cap", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1024),
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(container.querySelectorAll(".filter-section-grid").length).toBeGreaterThan(1);
        expect(findFilterLayoutModeToggle(container)).not.toBeNull();
      });

      await clickAsync(findFilterLayoutModeToggle(container));

      await waitFor(() => {
        const sectionGrids = Array.from(container.querySelectorAll(".filter-section-grid"));
        const filterSets = Array.from(container.querySelectorAll(".filter-set"));
        // Column caps are configured per filter-set (layoutConfig md caps,
        // bounded by each section's card count): Patient (4 cards, cap 3),
        // Cancer Type & Primary Site (1 card), Staging (4 cards, cap 2),
        // Pathology & Grade (1 card).
        expect(sectionGrids.map((node) => node.getAttribute("data-column-cap"))).toEqual([
          "3",
          "1",
          "2",
          "1",
        ]);
        expect(
          sectionGrids.every((node) => node.getAttribute("data-section-height-cap") === "700")
        ).toBe(true);
        expect(filterSets.length).toBeGreaterThan(1);
        expect(filterSets.length).toBe(sectionGrids.length);
        expect(
          filterSets.every((node) => node.getAttribute("data-section-height-cap") === "700")
        ).toBe(true);
        expect(
          filterSets.every((filterSetNode) =>
            Boolean(filterSetNode.querySelector(".filter-section-grid"))
          )
        ).toBe(true);
        expect(
          sectionGrids.every((sectionGridNode) => Boolean(sectionGridNode.closest(".filter-set")))
        ).toBe(true);
      });
      const filterSets = Array.from(container.querySelectorAll(".filter-set"));
      filterSets.forEach((filterSetNode) => {
        const sectionGrid = filterSetNode.querySelector(".filter-section-grid");
        expect(sectionGrid).not.toBeNull();
        expect(sectionGrid.getAttribute("data-section-height-cap")).toBe("700");
        expect(sectionGrid.querySelectorAll(".filter-section-column").length).toBeGreaterThan(0);
        expect(filterSetNode.querySelectorAll(".filter-card-content").length).toBeGreaterThan(0);
        expect(filterSetNode.querySelectorAll(".filter-card-chart").length).toBeGreaterThan(0);
      });
      expect(container.querySelectorAll(".filter-card").length).toBeGreaterThan(1);
      expect(container.querySelectorAll(".filter-card-content").length).toBeGreaterThan(1);
      expect(container.querySelectorAll(".filter-card-body").length).toBeGreaterThan(1);
      expect(container.querySelectorAll(".filter-card-open-button").length).toBeGreaterThan(1);
      expect(container.querySelectorAll(".filter-card-chart").length).toBeGreaterThan(1);
    } finally {
      unmount();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("renders Ethnicity, N Stage, and M Stage when those API classes are returned", async () => {
    const { unmount } = renderComponent(<FiltersView />);

    await waitFor(() => {
      expect(findOpenFilterButton("Ethnicity")).not.toBeUndefined();
      expect(findOpenFilterButton("N Stage")).not.toBeUndefined();
      expect(findOpenFilterButton("M Stage")).not.toBeUndefined();
    });

    unmount();
  });

  it("renders configured filter cards inside their configured sections", async () => {
    getOmopSummary.mockResolvedValue({
      classes: ["AGE_AT_DX", "GENDER", "RACE", "ETHNICITY", "CANCER"],
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
        ETHNICITY: [
          { ethnicity: "Not Hispanic or Latino", count: 14 },
          { ethnicity: "Hispanic or Latino", count: 8 },
        ],
        CANCER: [
          { cancer: "Breast", count: 6 },
          { cancer: "Lung", count: 5 },
        ],
      },
    });

    getAttributeSummary.mockResolvedValue({
      classes: ["Stage", "T Stage", "N Stage", "M Stage", "Lymph Involvement"],
      instancesByClass: {
        Stage: [
          { value: "Stage I", count: 10 },
          { value: "Stage II", count: 7 },
        ],
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
        "Lymph Involvement": [
          { value: "Present", count: 5 },
          { value: "Absent", count: 9 },
        ],
      },
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("Age at Dx")).not.toBeUndefined();
        expect(findOpenFilterButton("Cancer")).not.toBeUndefined();
        expect(findOpenFilterButton("Lymph Involvement")).not.toBeUndefined();
      });

      // Column packing reorders cards within a section for height balance, so
      // assert section membership rather than exact DOM order.
      const expectedStagingTitles = ["Stage", "T Stage", "N Stage", "M Stage", "Lymph Involvement"];
      expect([...getRenderedFilterTitlesInSection(container, "Patient")].sort()).toEqual(
        ["Age at Dx", "Race", "Gender", "Ethnicity"].sort()
      );
      expect(
        getRenderedFilterTitlesInSection(container, "Cancer Type & Primary Site")
      ).toEqual(["Cancer"]);
      expect(
        [...getRenderedFilterTitlesInSection(container, "Staging & Disease Extent")].sort()
      ).toEqual([...expectedStagingTitles].sort());

      const globalRenderedOrder = Array.from(container.querySelectorAll(".filter-card"))
        .map((cardNode) => getFilterTitleFromCardNode(cardNode))
        .filter(Boolean);
      expect([...globalRenderedOrder].sort()).toEqual(
        ["Age at Dx", "Race", "Gender", "Ethnicity", "Cancer", ...expectedStagingTitles].sort()
      );
    } finally {
      unmount();
    }
  });

  it("keeps Age at Dx in the first Patient-section column in one-card-per-column layout", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1280),
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        const patientSection = findSectionContainerByHeading(container, "Patient");
        expect(patientSection).not.toBeNull();
        expect(patientSection.querySelector(".filter-section-grid")).not.toBeNull();
      });

      const patientSection = findSectionContainerByHeading(container, "Patient");
      const patientGrid = patientSection.querySelector(".filter-section-grid");
      const columns = patientGrid.querySelectorAll(".filter-section-column");
      const firstColumn = columns[0];

      expect(patientGrid.getAttribute("data-column-cap")).toBe("3");
      expect(columns.length).toBe(3);
      expect(firstColumn.querySelector('[aria-label="Open Age at Dx filter"]')).not.toBeNull();
    } finally {
      unmount();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("keeps patient/cancer/primary-site cohort overview separate from clinical status", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1920),
    });
    getAttributeSummary.mockResolvedValueOnce({
      classes: [
        "Behavior",
        "Grade_Numeric",
        "M Stage",
        "N Stage",
        "T Stage",
        "Course",
        "Treatments",
        "Location",
        "Topography, major",
        "Performance Status",
      ],
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
        Course: [{ value: "Primary", count: 9 }],
        Treatments: [{ value: "Chemotherapy", count: 8 }],
        Location: [{ value: "Breast", count: 12 }],
        "Topography, major": [{ value: "Breast", count: 12 }],
        "Performance Status": [{ value: "ECOG 1", count: 7 }],
      },
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findSectionContainerByHeading(container, "Patient")).not.toBeNull();
        expect(findSectionContainerByHeading(container, "Cancer Type & Primary Site")).not.toBeNull();
        expect(findSectionContainerByHeading(container, "Clinical Status")).not.toBeNull();
      });

      // Sections now flow in a single masonry; each filter-set is its own
      // layout item. Assert the cohort-overview sections render as distinct
      // items that precede Clinical Status in DOM order.
      const findLayoutItem = (headingText) =>
        findSectionContainerByHeading(container, headingText)?.closest(".filter-set-layout-item") ||
        null;
      const patientItem = findLayoutItem("Patient");
      const cancerTypeItem = findLayoutItem("Cancer Type & Primary Site");
      const clinicalStatusItem = findLayoutItem("Clinical Status");

      expect(patientItem).not.toBeNull();
      expect(cancerTypeItem).not.toBeNull();
      expect(clinicalStatusItem).not.toBeNull();
      expect(patientItem?.getAttribute("data-filter-set-id")).toBe("demographics");
      expect(cancerTypeItem?.getAttribute("data-filter-set-id")).toBe("cancer-type");
      expect(clinicalStatusItem?.getAttribute("data-filter-set-id")).toBe("clinical-status");
      expect(clinicalStatusItem).not.toBe(patientItem);
      expect(clinicalStatusItem).not.toBe(cancerTypeItem);

      const layoutItems = Array.from(container.querySelectorAll(".filter-set-layout-item"));
      expect(layoutItems.indexOf(patientItem)).toBeLessThan(layoutItems.indexOf(clinicalStatusItem));
      expect(layoutItems.indexOf(cancerTypeItem)).toBeLessThan(
        layoutItems.indexOf(clinicalStatusItem)
      );
    } finally {
      unmount();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("toggles between stacked layout and one-card-per-column layout", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1280),
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        const patientSection = findSectionContainerByHeading(container, "Patient");
        expect(patientSection).not.toBeNull();
        expect(patientSection.querySelector(".filter-section-grid")).not.toBeNull();
        expect(findFilterLayoutModeToggle(container)).not.toBeNull();
      });

      const patientSection = findSectionContainerByHeading(container, "Patient");
      const patientGrid = patientSection.querySelector(".filter-section-grid");
      const toggle = findFilterLayoutModeToggle(container);
      const resetButton = findResetAllFiltersButton(container);
      const pageHeading = container.querySelector('[data-testid="filters-page-heading"]');
      expect(toggle?.closest('[data-testid="identified-patients-panel"]')).not.toBeNull();
      expect(resetButton?.closest('[data-testid="identified-patients-panel"]')).not.toBeNull();
      expect(pageHeading?.closest('[data-testid="identified-patients-panel"]')).not.toBeNull();
      expect(pageHeading?.tagName).toBe("H1");

      expect(patientGrid.getAttribute("data-column-cap")).toBe("3");
      expect(patientGrid.querySelectorAll(".filter-section-column").length).toBe(3);
      expect(toggle?.getAttribute("aria-label")).toBe("Switch to stacked layout");
      expect(resetButton?.disabled).toBe(true);

      await clickAsync(toggle);

      // The column cap is configured per filter-set and no longer changes with
      // the layout mode; the toggle only switches stacking behavior.
      await waitFor(() => {
        expect(toggle?.getAttribute("aria-label")).toBe("Switch to one-card-per-column layout");
      });
      expect(patientGrid.getAttribute("data-column-cap")).toBe("3");
      expect(patientGrid.querySelectorAll(".filter-section-column").length).toBe(3);
    } finally {
      unmount();
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("hides the accessibility button from the filter toolbar", async () => {
    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("Age at Dx")).not.toBeUndefined();
      });

      const accessibilityAction = Array.from(container.querySelectorAll("a, button")).find((node) => {
        const label = String(node.getAttribute("aria-label") || "").toLowerCase();
        const text = String(node.textContent || "").toLowerCase();
        return label.includes("accessibility") || text.includes("accessibility");
      });
      expect(accessibilityAction).toBeUndefined();
    } finally {
      unmount();
    }
  });

  it("resets all filter state from the header options bar", async () => {
    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await selectFilterValue("Gender", "Female");

      await waitFor(() => {
        const genderFilterButton = findOpenFilterButton("Gender");
        const resetButton = findResetAllFiltersButton(container);
        expect(genderFilterButton).not.toBeUndefined();
        expect(String(genderFilterButton?.textContent || "")).toContain("1 selected");
        expect(resetButton).not.toBeNull();
        expect(resetButton?.disabled).toBe(false);
      });

      await clickAsync(findResetAllFiltersButton(container));

      await waitFor(() => {
        const genderFilterButton = findOpenFilterButton("Gender");
        const identifiedPanel = findIdentifiedPatientsPanel(container);
        const patientGridDrawer = findPatientGridDrawer(container);
        const resetButton = findResetAllFiltersButton(container);

        expect(String(genderFilterButton?.textContent || "")).toContain("Details");
        expect(String(identifiedPanel?.textContent || "")).not.toContain("Gender (Female)");
        expect(patientGridDrawer).toBeNull();
        expect(resetButton?.disabled).toBe(true);
      });
    } finally {
      unmount();
    }
  });

  it("renders inline filter charts in fill-container mode and keeps modal charts fixed-height", async () => {
    const { unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("N Stage")).not.toBeUndefined();
      });

      await waitFor(() => {
        const inlineChartCalls = mockHorizontalBarFilter.mock.calls
          .map(([props]) => props)
          .filter((props) =>
            String(props?.className || "").split(/\s+/).includes("filter-card-chart")
          );
        expect(inlineChartCalls.length).toBeGreaterThan(0);
        expect(inlineChartCalls.every((props) => props?.fillContainer === true)).toBe(true);
      });

      await clickAsync(findOpenFilterButton("N Stage"));

      await waitFor(() => {
        const modalCall = [...mockHorizontalBarFilter.mock.calls]
          .reverse()
          .map(([props]) => props)
          .find((props) =>
            String(props?.className || "").split(/\s+/).includes("filter-modal-chart")
          );
        expect(modalCall).toBeDefined();
        expect(modalCall?.fillContainer).toBe(false);
      });
    } finally {
      unmount();
    }
  });

  it("measures full filter cards (not inner bodies) for section alignment planning", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    const measuredTokenCounts = {
      card: 0,
      body: 0,
    };

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1280),
    });

    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
      const className =
        typeof this.className === "string"
          ? this.className
          : String(this.getAttribute?.("class") || "");
      const classTokens = className.split(/\s+/).filter(Boolean);
      if (classTokens.includes("filter-card")) {
        measuredTokenCounts.card += 1;
      }
      if (classTokens.includes("filter-card-body")) {
        measuredTokenCounts.body += 1;
      }

      return {
        width: 300,
        height: 100,
        top: 0,
        right: 300,
        bottom: 100,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    };

    const { unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(measuredTokenCounts.card).toBeGreaterThan(0);
      });

      expect(measuredTokenCounts.body).toBe(0);
    } finally {
      unmount();
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("pins scrollable cards at the card height cap while short cards keep natural height", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    // Race has 15 values, so its estimated height (60 + 15x24 = 420) exceeds
    // the 300px compact-plus card cap, which marks it scrollable: the card is
    // pinned at the cap (min-height == max-height == cap) and its rows scroll
    // internally. Short cards keep their natural height — no min-height is
    // forced on them to equalize column bottoms.
    const fullCardHeightByTitle = {
      "Age at Dx": 280,
      Race: 600,
      Gender: 250,
      Ethnicity: 40,
    };

    getOmopSummary.mockResolvedValue({
      classes: ["AGE_AT_DX", "GENDER", "RACE", "ETHNICITY"],
      instancesByClass: {
        AGE_AT_DX: [
          { age_at_dx: "40-49", count: 11 },
          { age_at_dx: "50-59", count: 7 },
        ],
        GENDER: [
          { gender: "Female", count: 13 },
          { gender: "Male", count: 9 },
        ],
        RACE: Array.from({ length: 15 }, (_, index) => ({
          race: `Race Value ${String(index + 1).padStart(2, "0")}`,
          count: 30 - index,
        })),
        ETHNICITY: [
          { ethnicity: "Not Hispanic or Latino", count: 14 },
          { ethnicity: "Hispanic or Latino", count: 8 },
        ],
      },
    });

    const toRect = (height) => ({
      width: 300,
      height,
      top: 0,
      right: 300,
      bottom: height,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1280),
    });

    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
      const className =
        typeof this.className === "string"
          ? this.className
          : String(this.getAttribute?.("class") || "");
      const classTokens = className.split(/\s+/).filter(Boolean);

      if (classTokens.includes("filter-card")) {
        const title = getFilterTitleFromCardNode(this);
        return toRect(fullCardHeightByTitle[title] || 100);
      }

      return originalGetBoundingClientRect.call(this);
    };

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        const raceCard = findFilterCardByTitle("Race");
        expect(raceCard).not.toBeNull();
        expect(Number.parseFloat(String(raceCard.style.minHeight || "0"))).toBeGreaterThan(0);
      });

      const raceCard = findFilterCardByTitle("Race");
      const raceCap = Number(raceCard.getAttribute("data-card-height-cap"));
      expect(raceCap).toBe(300);
      expect(Number.parseFloat(String(raceCard.style.minHeight || "0"))).toBe(raceCap);
      expect(Number.parseFloat(String(raceCard.style.maxHeight || "0"))).toBe(raceCap);

      const raceContent = raceCard.querySelector(".filter-card-content");
      expect(Number.parseFloat(String(raceContent?.style?.minHeight || "0"))).toBe(0);

      ["Age at Dx", "Gender", "Ethnicity"].forEach((title) => {
        const cardNode = findFilterCardByTitle(title);
        expect(cardNode).not.toBeNull();
        const inlineMinHeight = Number.parseFloat(String(cardNode.style.minHeight || "0"));
        const naturalHeight = fullCardHeightByTitle[title];
        // Short cards are never stretched past their natural content height.
        expect(inlineMinHeight).toBeLessThanOrEqual(naturalHeight);
      });
    } finally {
      unmount();
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("caps shared filter-card heights at the default card height cap", async () => {
    // Default per-card height cap; configured maxHeightPx values below it
    // (e.g. Stage 150) still win.
    const DEFAULT_CARD_HEIGHT_CAP = 300;
    const originalMatchMedia = window.matchMedia;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    const toRect = (height) => ({
      width: 300,
      height,
      top: 0,
      right: 300,
      bottom: height,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    getAttributeSummary.mockResolvedValue({
      classes: ["Stage", "T Stage", "N Stage", "M Stage", "Lymph Involvement"],
      instancesByClass: {
        Stage: [
          { value: "Stage I", count: 10 },
          { value: "Stage II", count: 7 },
        ],
        "T Stage": [
          { value: "T1", count: 9 },
          { value: "T2", count: 5 },
        ],
        "N Stage": [
          { value: "N0", count: 8 },
          { value: "N1", count: 4 },
        ],
        "M Stage": [
          { value: "M0", count: 8 },
          { value: "M1", count: 2 },
        ],
        "Lymph Involvement": [
          { value: "Present", count: 6 },
          { value: "Absent", count: 3 },
        ],
      },
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1280),
    });

    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
      const className =
        typeof this.className === "string"
          ? this.className
          : String(this.getAttribute?.("class") || "");
      const classTokens = className.split(/\s+/).filter(Boolean);

      if (classTokens.includes("filter-card")) {
        return toRect(500);
      }

      return originalGetBoundingClientRect.call(this);
    };

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("Age at Dx")).not.toBeUndefined();
      });

      const expectedCardHeightCapByTitle = getConfiguredCardHeightCapByTitle(DEFAULT_CARD_HEIGHT_CAP);
      const cards = Array.from(container.querySelectorAll(".filter-card"));
      expect(cards.length).toBeGreaterThan(1);
      let sawLymphCard = false;
      cards.forEach((cardNode) => {
        const filterTitle = getFilterTitleFromCardNode(cardNode);
        const expectedCardHeightCap =
          expectedCardHeightCapByTitle.get(filterTitle) || DEFAULT_CARD_HEIGHT_CAP;
        if (filterTitle === "Lymph Involvement") {
          sawLymphCard = true;
        }
        const dataCap = Number(cardNode.getAttribute("data-card-height-cap"));
        const maxHeight = Number.parseFloat(String(cardNode.style.maxHeight || "0"));
        const minHeight = Number.parseFloat(String(cardNode.style.minHeight || "0"));
        const overrideHeight = Number(cardNode.getAttribute("data-card-height-override"));
        expect(dataCap).toBe(expectedCardHeightCap);
        expect(maxHeight).toBe(expectedCardHeightCap);
        if (minHeight > 0) {
          expect(minHeight).toBeLessThanOrEqual(expectedCardHeightCap);
        }
        if (Number.isFinite(overrideHeight) && overrideHeight > 0) {
          expect(overrideHeight).toBeLessThanOrEqual(expectedCardHeightCap);
        }
      });
      expect(sawLymphCard).toBe(true);
    } finally {
      unmount();
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("keeps non-scrollable cards at natural height instead of stretching to equalize columns", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    // All cards fit under the 300px cap, so none are scrollable. The columns
    // pack unevenly, but the layout must NOT stretch any card past its
    // natural content height to equalize bottoms (there would be nothing but
    // whitespace to fill).
    const fullCardHeightByTitle = {
      "Age at Dx": 280,
      Race: 90,
      Gender: 80,
      Ethnicity: 70,
      Cancer: 130,
    };
    const toRect = (height) => ({
      width: 300,
      height,
      top: 0,
      right: 300,
      bottom: height,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    getAttributeSummary.mockResolvedValue({
      classes: [],
      instancesByClass: {},
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1280),
    });

    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
      const className =
        typeof this.className === "string"
          ? this.className
          : String(this.getAttribute?.("class") || "");
      const classTokens = className.split(/\s+/).filter(Boolean);

      if (classTokens.includes("filter-card")) {
        const title = getFilterTitleFromCardNode(this);
        return toRect(fullCardHeightByTitle[title] || 100);
      }

      return originalGetBoundingClientRect.call(this);
    };

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("Age at Dx")).not.toBeUndefined();
      });

      // Give the layout passes time to settle, then confirm no card was
      // stretched: stretch overrides are reserved for scrollable cards.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(container.querySelectorAll(".filter-card[data-card-height-override]").length).toBe(0);
      Array.from(container.querySelectorAll(".filter-card")).forEach((cardNode) => {
        const cardTitle = getFilterTitleFromCardNode(cardNode);
        const naturalHeight = fullCardHeightByTitle[cardTitle] || 100;
        const inlineMinHeight = Number.parseFloat(String(cardNode.style.minHeight || "0"));
        if (inlineMinHeight > 0) {
          expect(inlineMinHeight).toBeLessThanOrEqual(naturalHeight);
        }
      });
    } finally {
      unmount();
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("does not measure pre-stretched card overrides during initial card measurement", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    let measuredWithOverrideAttribute = false;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1280),
    });

    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
      const className =
        typeof this.className === "string"
          ? this.className
          : String(this.getAttribute?.("class") || "");
      const classTokens = className.split(/\s+/).filter(Boolean);
      if (classTokens.includes("filter-card")) {
        if (this.hasAttribute("data-card-height-override")) {
          measuredWithOverrideAttribute = true;
        }
      }

      return originalGetBoundingClientRect.call(this);
    };

    const { unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        const demographicsButton = findOpenFilterButton("Age at Dx");
        expect(demographicsButton).not.toBeUndefined();
      });

      expect(measuredWithOverrideAttribute).toBe(false);
    } finally {
      unmount();
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
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
    // T Stage rows display with the "T" prefix stripped (compactLabelStripPrefix).
    await selectFilterValue("T Stage", "2");

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

    await waitFor(() => {
      expect(findPatientGridDrawerToggle(container)).not.toBeNull();
    });

    await clickAsync(findPatientGridDrawerToggle(container));

    await waitFor(() => {
      const collapsedSummary = container.querySelector('[data-testid="patient-grid-collapsed-summary"]');
      expect(String(collapsedSummary?.textContent || "")).toContain(
        "4 40-49 year old white female with breast cancer, and T stage T2."
      );
    });

    unmount();
  }, 20000);

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

  it("hides slow-query warning while showing zero-result hint with itemCounts guidance", async () => {
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
    // T Stage rows display with the "T" prefix stripped (compactLabelStripPrefix).
    await selectFilterValue("T Stage", "2");

    await waitFor(() => {
      const patientGridDrawer = findPatientGridDrawer(container);
      const identifiedPanel = findIdentifiedPatientsPanel(container);
      const drawerText = String(patientGridDrawer?.textContent || "");
      const panelText = String(identifiedPanel?.textContent || "");
      expect(drawerText).not.toContain("Query took 106.5 ms");
      expect(drawerText).toContain(
        "Cancer matched 0 patients before intersection. Check spelling and selected values."
      );
      expect(drawerText).toContain("No patients matched these criteria.");
      expect(panelText).not.toContain("Query took 106.5 ms");
    });

    unmount();
  }, 20000);

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
      const genderChartCall = [...mockHorizontalBarFilter.mock.calls]
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

  it("computes row numerators client-side from the patient-id index for small cohorts", async () => {
    // Summaries WITH patient ids -> totalPatientCount resolves (5, under the
    // threshold) -> the client-side patient-id index builds, and row numerators
    // are computed in the browser via set intersection rather than the server
    // included-counts batch.
    getOmopSummary.mockResolvedValue({
      classes: ["GENDER", "RACE"],
      instancesByClass: {
        GENDER: [
          { gender: "Female", count: 4, patient_ids: ["p1", "p2", "p3", "p5"] },
          { gender: "Male", count: 1, patient_ids: ["p4"] },
        ],
        RACE: [
          { race: "White", count: 3, patient_ids: ["p1", "p2", "p4"] },
          { race: "Black", count: 1, patient_ids: ["p3"] },
          { race: "Asian", count: 1, patient_ids: ["p5"] },
          { race: "Other", count: 1, patient_ids: ["p4"] },
        ],
      },
      timing: { totalMs: 1 },
    });
    getAttributeSummary.mockResolvedValue({ classes: [], instancesByClass: {}, timing: { totalMs: 1 } });
    getConceptsSummary.mockResolvedValue({ classes: [], instancesByClass: {}, timing: { totalMs: 1 } });

    // Make the server return NOTHING for any count query, and reject the
    // included-counts batch. With the client fast path engaged, the cohort
    // count, the drawer's patient ids, and the row numerators are all computed
    // in the browser — so the asserted values below can only come from the
    // client math, and the empty server response can't pollute them.
    fetchDeepPheFilterCount.mockResolvedValue({
      count: 0,
      patient_ids: [],
      timing: { totalMs: 1, itemCounts: [0] },
    });
    fetchDeepPheFilterCountBatch.mockRejectedValue(new Error("server path should not run on the client fast path"));
    fetchDeepPheFilterSummary.mockResolvedValue([]);

    const { unmount } = renderComponent(<FiltersView />);

    const getLatestChartProps = (title) =>
      [...mockHorizontalBarFilter.mock.calls]
        .reverse()
        .map(([props]) => props)
        .find((props) => props.title === title);

    await waitFor(() => {
      expect(getLatestChartProps("Gender")).toBeDefined();
      expect(getLatestChartProps("Race")).toBeDefined();
    });

    await act(async () => {
      getLatestChartProps("Gender").onSelectionChange(["Female"]);
      await Promise.resolve();
    });

    // Numerators for Race given Gender=Female {p1,p2,p3,p5}:
    //   White {p1,p2,p4} -> {p1,p2} = 2
    //   Black {p3}       -> {p3}    = 1
    //   Asian {p5}       -> {p5}    = 1
    //   Other {p4}       -> {}      = 0  (zero numerator -> row disabled)
    await waitFor(() => {
      const raceData = getLatestChartProps("Race")?.data || [];
      const byLabel = (label) => raceData.find((row) => row.label === label);
      expect(byLabel("White")?.includedValue).toBe(2);
      expect(byLabel("Black")?.includedValue).toBe(1);
      expect(byLabel("Asian")?.includedValue).toBe(1);
      expect(byLabel("Other")?.includedValue).toBe(0);
    });

    // The drawer's patient set is resolved client-side too: the cohort for
    // Gender=Female is {p1,p2,p3,p5}, so the page summary is fetched for those
    // ids. The server returned an empty cohort, so these ids can only have come
    // from the in-browser index.
    await waitFor(() => {
      const requestedSummaryIds = fetchDeepPheFilterSummary.mock.calls.flatMap(([ids]) =>
        Array.isArray(ids) ? ids : []
      );
      expect(requestedSummaryIds).toEqual(expect.arrayContaining(["p1", "p2", "p3", "p5"]));
    });

    // The client path never falls back to the server included-counts batch.
    expect(fetchDeepPheFilterCountBatch).not.toHaveBeenCalled();

    unmount();
  });

  it("renders patient grid in a bottom drawer with 10-row pagination and expand/collapse controls", async () => {
    const patientIds = Array.from({ length: 12 }, (_, index) =>
      `PATIENT-${String(index + 1).padStart(3, "0")}`
    );
    fetchDeepPheFilterCount.mockImplementation(({ includePatientIds }) =>
      Promise.resolve({
        count: patientIds.length,
        patient_ids: includePatientIds ? patientIds : [],
        timing: {
          queryMs: 5.6,
          bitmapMs: 0.9,
          resolveMs: 0.2,
          totalMs: 6.7,
          itemCounts: [patientIds.length],
        },
      })
    );
    fetchDeepPheFilterSummary.mockImplementation(async (requestedPatientIds = []) =>
      requestedPatientIds.map((patientId, index) => ({
        patient_id: patientId,
        demographics: {
          age_at_dx: String(40 + index),
          gender: "Female",
          race: "White",
          ethnicity: "Not Hispanic or Latino",
          cancer_type: "Breast",
        },
        diagnoses: [{ name: "Breast carcinoma", source: "cancer" }],
        staging: [{ name: "Stage I" }],
        grading: [{ name: "Grade 2" }],
        biomarkers: [],
        procedures: [],
        treatments: [],
        findings: [],
      }))
    );

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("Gender")).not.toBeUndefined();
      });

      await selectFilterValue("Gender", "Female");

      await waitFor(() => {
        expect(fetchDeepPheFilterSummary).toHaveBeenCalled();
        const [firstPagePatientIds] = fetchDeepPheFilterSummary.mock.calls[0];
        expect(Array.isArray(firstPagePatientIds)).toBe(true);
        expect(firstPagePatientIds).toHaveLength(10);
      });

      await waitFor(() => {
        const identifiedPanel = findIdentifiedPatientsPanel(container);
        const patientGridDrawer = findPatientGridDrawer(container);
        expect(identifiedPanel).not.toBeNull();
        expect(patientGridDrawer).not.toBeNull();

        const searchInput = patientGridDrawer.querySelector(
          'input[placeholder="Search patient details..."]'
        );
        expect(searchInput).not.toBeNull();
        expect(searchInput?.getAttribute("aria-label")).toBe("Search patient details");

        const patientGridHeading = patientGridDrawer.querySelector("h2");
        expect(String(patientGridHeading?.textContent || "")).toContain("Selected Patients (12)");

        const headerCells = Array.from(patientGridDrawer.querySelectorAll("thead th"));
        expect(headerCells.length).toBeGreaterThan(0);
        expect(
          headerCells.every((headerCell) => String(headerCell.textContent || "").trim().length > 0)
        ).toBe(true);

        const panelText = String(identifiedPanel.textContent || "").replace(/\s+/g, " ");
        expect(panelText).not.toContain("Showing page 1 of 2");
        expect(panelText).not.toContain("Gender (Female)");
      });

      await waitFor(() => {
        const drawerText = String(findPatientGridDrawer(container)?.textContent || "").replace(
          /\s+/g,
          " "
        );
        expect(drawerText).toContain("1–10 of 12 patients");
        expect(drawerText).toContain("Gender (Female)");
      });

      await clickAsync(findPatientGridDrawerToggle(container));

      await waitFor(() => {
        const drawerToggle = findPatientGridDrawerToggle(container);
        const drawerPanel = container.querySelector("#patient-grid-drawer-panel");
        const collapsedSummary = container.querySelector('[data-testid="patient-grid-collapsed-summary"]');
        expect(drawerToggle?.getAttribute("aria-expanded")).toBe("false");
        expect(drawerPanel?.hidden).toBe(true);
        const collapsedSummaryText = String(collapsedSummary?.textContent || "").replace(/\s+/g, " ");
        expect(collapsedSummaryText).toContain("Gender (Female)");
        expect(collapsedSummaryText).toContain("12");
      });

      await clickAsync(findPatientGridDrawerToggle(container));

      await waitFor(() => {
        const drawerToggle = findPatientGridDrawerToggle(container);
        const drawerPanel = container.querySelector("#patient-grid-drawer-panel");
        expect(drawerToggle?.getAttribute("aria-expanded")).toBe("true");
        expect(drawerPanel?.hidden).toBe(false);
      });
    } finally {
      unmount();
    }
  });

  it("hydrates missing document counts in the selected patients drawer", async () => {
    const patientIds = ["PATIENT-001", "PATIENT-002"];
    fetchDeepPheFilterCount.mockImplementation(({ includePatientIds }) =>
      Promise.resolve({
        count: patientIds.length,
        patient_ids: includePatientIds ? patientIds : [],
        timing: {
          queryMs: 4.4,
          bitmapMs: 0.8,
          resolveMs: 0.2,
          totalMs: 5.4,
          itemCounts: [patientIds.length],
        },
      })
    );
    fetchDeepPheFilterSummary.mockImplementation(async (requestedPatientIds = []) =>
      requestedPatientIds.map((patientId, index) => ({
        patient_id: patientId,
        demographics: {
          age_at_dx: String(50 + index),
          gender: "Female",
          race: "White",
          ethnicity: "Not Hispanic or Latino",
          cancer_type: "Breast",
        },
        diagnoses: [{ name: "Breast carcinoma", source: "cancer" }],
        staging: [{ name: "Stage I" }],
        grading: [{ name: "Grade 2" }],
        biomarkers: [],
        procedures: [],
        treatments: [],
        findings: [],
      }))
    );
    fetchPatientDocuments.mockImplementation(async (patientId) => {
      const documentCount = patientId === "PATIENT-001" ? 3 : 2;
      return {
        documents: Array.from({ length: documentCount }, (_, index) => ({
          id: `${patientId}-doc-${index + 1}`,
        })),
      };
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("Gender")).not.toBeUndefined();
      });

      await selectFilterValue("Gender", "Female");

      await waitFor(() => {
        expect(fetchPatientDocuments).toHaveBeenCalledWith(
          "PATIENT-001",
          expect.objectContaining({
            excludeProperties: expect.arrayContaining(["text", "mentions"]),
          })
        );
      });

      await waitFor(() => {
        const drawer = findPatientGridDrawer(container);
        const documentCountCells = Array.from(
          drawer?.querySelectorAll('tbody td[data-column-id="docCount"]') || []
        ).map((cell) => String(cell.textContent || "").trim());

        expect(documentCountCells).toEqual(["3", "2"]);
      });
    } finally {
      unmount();
    }
  });

  it("uses 40-row pagination when the selected patients drawer is maximized", async () => {
    const patientIds = Array.from({ length: 55 }, (_, index) =>
      `PATIENT-${String(index + 1).padStart(3, "0")}`
    );
    fetchDeepPheFilterCount.mockImplementation(({ includePatientIds }) =>
      Promise.resolve({
        count: patientIds.length,
        patient_ids: includePatientIds ? patientIds : [],
        timing: {
          queryMs: 4.1,
          bitmapMs: 0.8,
          resolveMs: 0.3,
          totalMs: 5.2,
          itemCounts: [patientIds.length],
        },
      })
    );
    fetchDeepPheFilterSummary.mockImplementation(async (requestedPatientIds = []) =>
      requestedPatientIds.map((patientId, index) => ({
        patient_id: patientId,
        demographics: {
          age_at_dx: String(40 + index),
          gender: "Female",
          race: "White",
          ethnicity: "Not Hispanic or Latino",
          cancer_type: "Breast",
        },
        diagnoses: [{ name: "Breast carcinoma", source: "cancer" }],
        staging: [{ name: "Stage I" }],
        grading: [{ name: "Grade 2" }],
        biomarkers: [],
        procedures: [],
        treatments: [],
        findings: [],
      }))
    );

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("Gender")).not.toBeUndefined();
      });

      await selectFilterValue("Gender", "Female");

      await waitFor(() => {
        expect(fetchDeepPheFilterSummary).toHaveBeenCalled();
        const [firstPagePatientIds] = fetchDeepPheFilterSummary.mock.calls[0];
        expect(Array.isArray(firstPagePatientIds)).toBe(true);
        expect(firstPagePatientIds).toHaveLength(10);
      });

      const maximizeDrawerButton = container.querySelector(
        '[data-testid="patient-grid-drawer-maximize"]'
      );
      expect(maximizeDrawerButton).not.toBeNull();
      await clickAsync(maximizeDrawerButton);

      await waitFor(() => {
        const requestedPageSizes = fetchDeepPheFilterSummary.mock.calls.map(([requestedPatientIds]) =>
          Array.isArray(requestedPatientIds) ? requestedPatientIds.length : 0
        );
        expect(requestedPageSizes).toContain(40);
      });

      await waitFor(() => {
        const drawerText = String(findPatientGridDrawer(container)?.textContent || "").replace(
          /\s+/g,
          " "
        );
        expect(drawerText).toContain("1–40 of 55 patients");
      });
    } finally {
      unmount();
    }
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
