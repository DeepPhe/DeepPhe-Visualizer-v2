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

jest.mock("../../clients/deepphe-data-api", () => ({
  fetchDeepPheFilterCount: jest.fn(),
  fetchDeepPheFilterSummary: jest.fn(),
}));

import FiltersView from "../filters";
import { FILTER_SETS } from "../filterSets";
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
      });

      const sectionGrids = Array.from(container.querySelectorAll(".filter-section-grid"));
      const filterSets = Array.from(container.querySelectorAll(".filter-set"));
      expect(sectionGrids.every((node) => node.getAttribute("data-column-cap") === "3")).toBe(
        true
      );
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

  it("preserves configured filter-card order in rendered DOM across visible sections", async () => {
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

      expect(getRenderedFilterTitlesInSection(container, "Demographics")).toEqual([
        "Age at Dx",
        "Race",
        "Gender",
        "Ethnicity",
      ]);
      expect(getRenderedFilterTitlesInSection(container, "Cancer Type")).toEqual(["Cancer"]);
      expect(getRenderedFilterTitlesInSection(container, "Staging")).toEqual(
        getConfiguredFilterTitlesForSection("staging")
      );

      const globalRenderedOrder = Array.from(container.querySelectorAll(".filter-card"))
        .map((cardNode) => getFilterTitleFromCardNode(cardNode))
        .filter(Boolean);
      expect(globalRenderedOrder).toEqual([
        "Age at Dx",
        "Race",
        "Gender",
        "Ethnicity",
        "Cancer",
        ...getConfiguredFilterTitlesForSection("staging"),
      ]);
    } finally {
      unmount();
    }
  });

  it("keeps Age at Dx in the first Demographics column at cap 3", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMinWidthMatchMedia(1280),
    });

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        const demographicsSection = findSectionContainerByHeading(container, "Demographics");
        expect(demographicsSection).not.toBeNull();
        expect(demographicsSection.querySelector(".filter-section-grid")).not.toBeNull();
      });

      const demographicsSection = findSectionContainerByHeading(container, "Demographics");
      const demographicsGrid = demographicsSection.querySelector(".filter-section-grid");
      const columns = demographicsGrid.querySelectorAll(".filter-section-column");
      const firstColumn = columns[0];

      expect(demographicsGrid.getAttribute("data-column-cap")).toBe("3");
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

  it("applies layout height overrides on outer filter-card nodes", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    const fullCardHeightByTitle = {
      "Age at Dx": 480,
      Race: 516,
      Gender: 228,
      Ethnicity: 228,
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
        const demographicsSection = findSectionContainerByHeading(container, "Demographics");
        expect(demographicsSection).not.toBeNull();
        expect(demographicsSection.querySelector(".filter-section-grid")).not.toBeNull();
      });

      const demographicsSection = findSectionContainerByHeading(container, "Demographics");
      const demographicsGrid = demographicsSection.querySelector(".filter-section-grid");
      const cardsWithOverrides = Array.from(
        demographicsGrid.querySelectorAll(".filter-card[data-card-height-override]")
      );
      expect(cardsWithOverrides.length).toBeGreaterThan(0);

      cardsWithOverrides.forEach((cardNode) => {
        const expectedMinHeight = Number(cardNode.getAttribute("data-card-height-override"));
        const inlineMinHeight = Number.parseFloat(String(cardNode.style.minHeight || "0"));
        expect(Number.isFinite(expectedMinHeight)).toBe(true);
        expect(inlineMinHeight).toBeCloseTo(expectedMinHeight, 0);

        const contentNode = cardNode.querySelector(".filter-card-content");
        const contentInlineMinHeight = Number.parseFloat(
          String(contentNode?.style?.minHeight || "0")
        );
        expect(contentInlineMinHeight).toBe(0);
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

  it("caps shared filter-card heights at CATEGORY_MAX_HEIGHT", async () => {
    const CATEGORY_MAX_HEIGHT = 700;
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
      await waitFor(() => {
        expect(container.querySelectorAll(".filter-card[data-card-height-override]").length).toBeGreaterThan(
          0
        );
      });

      const expectedCardHeightCapByTitle = getConfiguredCardHeightCapByTitle(CATEGORY_MAX_HEIGHT);
      const cards = Array.from(container.querySelectorAll(".filter-card"));
      expect(cards.length).toBeGreaterThan(1);
      let sawLymphCard = false;
      cards.forEach((cardNode) => {
        const filterTitle = getFilterTitleFromCardNode(cardNode);
        const expectedCardHeightCap =
          expectedCardHeightCapByTitle.get(filterTitle) || CATEGORY_MAX_HEIGHT;
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

  it("equalizes column bottoms across every rendered filter-section-grid", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    const fullCardHeightByTitle = {
      "Age at Dx": 480,
      Race: 516,
      Gender: 228,
      Ethnicity: 228,
      Cancer: 260,
      Stage: 430,
      "T Stage": 420,
      "N Stage": 220,
      "M Stage": 210,
      "Lymph Involvement": 430,
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
      classes: ["Stage", "T Stage", "N Stage", "M Stage"],
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
        const title = getFilterTitleFromCardNode(this);
        const naturalHeight = fullCardHeightByTitle[title] || 100;
        const inlineMinHeight = Number.parseFloat(String(this.style.minHeight || "0"));
        const appliedHeight = Number.isFinite(inlineMinHeight) && inlineMinHeight > 0
          ? Math.max(naturalHeight, inlineMinHeight)
          : naturalHeight;
        return toRect(appliedHeight);
      }

      return originalGetBoundingClientRect.call(this);
    };

    const { container, unmount } = renderComponent(<FiltersView />);

    try {
      await waitFor(() => {
        expect(findOpenFilterButton("Age at Dx")).not.toBeUndefined();
        expect(findOpenFilterButton("Stage")).not.toBeUndefined();
      });
      await waitFor(() => {
        const ageCard = findFilterCardByTitle("Age at Dx");
        expect(ageCard).not.toBeNull();
        expect(Number(ageCard.getAttribute("data-card-height-override"))).toBeGreaterThan(0);
      });

        const checkedSectionLabels = [];
        const skippedSectionLabels = [];
      const soloColumnSectionLabels = [];
      const sectionGrids = Array.from(container.querySelectorAll(".filter-section-grid"));
        const defaultHeightCap = 700;

      sectionGrids.forEach((sectionGrid) => {
        const sectionContainer = sectionGrid.parentElement;
        const sectionLabel = String(
          sectionContainer?.querySelector?.("h2")?.textContent || ""
        ).trim();
          const hasCustomCardCap = Array.from(sectionGrid.querySelectorAll(".filter-card")).some(
            (cardNode) => Number(cardNode.getAttribute("data-card-height-cap")) !== defaultHeightCap
          );
          if (hasCustomCardCap) {
            skippedSectionLabels.push(sectionLabel);
            return;
          }
        const columns = Array.from(sectionGrid.querySelectorAll(".filter-section-column"));
        if (columns.length <= 1) {
          soloColumnSectionLabels.push(sectionLabel);
          return;
        }

        const columnHeights = columns.map((columnNode) => {
          const cards = Array.from(columnNode.querySelectorAll(".filter-card"));
          return cards.reduce((sum, cardNode) => {
            const cardHeight = Number(cardNode.getBoundingClientRect()?.height) || 0;
            const marginBottom = Number(cardNode.getAttribute("data-card-margin-bottom")) || 0;
            return sum + cardHeight + marginBottom;
          }, 0);
        });

        checkedSectionLabels.push(sectionLabel);
        const roundedHeights = columnHeights.map((height) => Math.round(height));
        if (new Set(roundedHeights).size !== 1) {
          throw new Error(
            `Mismatched column heights in ${sectionLabel || "(unnamed section)"}: ${roundedHeights.join(
              ", "
            )}`
          );
        }
      });

      expect(checkedSectionLabels).toEqual(expect.arrayContaining(["Demographics"]));
      expect(skippedSectionLabels).toEqual(expect.arrayContaining(["Staging"]));
      expect(soloColumnSectionLabels).toContain("Cancer Type");
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

    await waitFor(() => {
      expect(findPatientGridDrawerToggle(container)).not.toBeNull();
    });

    await clickAsync(findPatientGridDrawerToggle(container));

    await waitFor(() => {
      const collapsedSummary = container.querySelector('[data-testid="patient-grid-collapsed-summary"]');
      expect(String(collapsedSummary?.textContent || "")).toContain(
        "There are 4 40-49 year old white female patients in the cohort with breast cancer, and T stage T2."
      );
    });

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
      const patientGridDrawer = findPatientGridDrawer(container);
      const identifiedPanel = findIdentifiedPatientsPanel(container);
      const drawerText = String(patientGridDrawer?.textContent || "");
      const panelText = String(identifiedPanel?.textContent || "");
      expect(drawerText).toContain("Query took 106.5 ms");
      expect(drawerText).toContain(
        "Cancer matched 0 patients before intersection. Check spelling and selected values."
      );
      expect(drawerText).toContain("No patients matched these criteria.");
      expect(panelText).not.toContain("Query took 106.5 ms");
    });

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
