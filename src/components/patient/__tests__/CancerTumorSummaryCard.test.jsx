/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-container */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import CancerTumorSummaryCard from "../CancerTumorSummaryCard";
import PatientViewPresentationProvider from "../PatientViewPresentationProvider";
import { PATIENT_VIEW_PRESENTATION_STORAGE_KEY } from "../../../constants/patientViewPresentation";

/** The per-cancer cards are the alpha reading; the matrix is the default. */
function renderAlpha(element) {
  localStorage.setItem(PATIENT_VIEW_PRESENTATION_STORAGE_KEY, "alpha");
  return renderComponent(<PatientViewPresentationProvider>{element}</PatientViewPresentationProvider>);
}

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
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses a content-height grid while preserving every fact and click behavior", () => {
    const onFactSelect = jest.fn();
    const { container, unmount } = renderAlpha(
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
    const { container, unmount } = renderAlpha(
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


  describe("improved view", () => {
    const twoCancers = [
      cancers[0],
      {
        cancerId: "cancer-2",
        title: "cancer-2",
        collatedCancerFacts: [
          {
            categoryName: "Location",
            facts: [fact("c2-location", "Upper-Outer Quadrant of the Breast")],
          },
          { categoryName: "Grade", facts: [fact("c2-grade", "1")] },
        ],
        tnm: [{ data: { T: [fact("c2-t", "1")], N: [], M: [] } }],
        tumors: {
          listViewData: [
            {
              id: "tumor-2",
              data: [{ category: "Location", facts: [fact("t2-location", "Nipple")] }],
            },
          ],
        },
      },
    ];


    it("folds away rows with nothing documented, and can show them", () => {
      // Neither cancer stages N or M, so those rows carry nothing to compare.
      const sparseCancers = twoCancers.map((cancer) => ({
        ...cancer,
        tnm: [{ data: { T: [], N: [], M: [] } }],
      }));
      const { container, unmount } = renderComponent(
        <CancerTumorSummaryCard cancers={sparseCancers} />
      );

      try {
        const rowLabels = () =>
          [...container.querySelectorAll("th[scope='row']")].map((n) => n.textContent);
        const toggle = () =>
          container.querySelector("[data-testid='cancer-comparison-undocumented-toggle']");

        // Neither cancer is staged, so the TNM row is folded away by default.
        expect(rowLabels().some((label) => label.startsWith("TNM"))).toBe(false);
        expect(toggle().textContent).toMatch(/^Show \d+ undocumented or repeated fields?$/);
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
        const foldedCount = rowLabels().length;

        act(() => {
          toggle().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(rowLabels().some((label) => label.startsWith("TNM"))).toBe(true);
        expect(rowLabels().length).toBeGreaterThan(foldedCount);
        expect(toggle().textContent).toMatch(/^Hide \d+ undocumented or repeated fields?$/);
        // The completeness count still counts every field, folded or not.
        expect(container.textContent).toMatch(/\d+\/\d+ documented/);
      } finally {
        unmount();
      }
    });

    it("compares the cancers in one matrix instead of separate cards", () => {
      const onFactSelect = jest.fn();
      const { container, unmount } = renderComponent(
        <CancerTumorSummaryCard cancers={twoCancers} onFactSelect={onFactSelect} />
      );

      try {
        const matrix = container.querySelector("[data-testid='cancer-comparison-matrix']");
        expect(matrix).not.toBeNull();
        expect(container.querySelectorAll("[data-testid='cancer-summary-record']")).toHaveLength(0);

        const headers = [...matrix.querySelectorAll("th[scope='col']")].map((n) => n.textContent);
        expect(headers[1]).toContain("Cancer 1");
        expect(headers[2]).toContain("Cancer 2");
        // Sparse records read as sparse.
        expect(headers[1]).toMatch(/\d+\/\d+ documented/);

        // The differences are what the reader came for.
        const gradeRow = [...matrix.querySelectorAll("th[scope='row']")].find((n) =>
          n.textContent.startsWith("Grade")
        );
        expect(gradeRow.getAttribute("data-differs")).toBe("true");
        expect(gradeRow.textContent).toContain("differs");
        const locationRow = [...matrix.querySelectorAll("th[scope='row']")].find((n) =>
          n.textContent.startsWith("Location")
        );
        expect(locationRow.getAttribute("data-differs")).toBe("false");

        // Undocumented values are demoted, not hidden.
        expect(matrix.textContent).toContain("—");
        expect(matrix.querySelector("[aria-label='Not documented']")).not.toBeNull();

        // A tumor repeating its cancer's location says so once.
        expect(matrix.textContent).toContain("Same as cancer");
        expect(matrix.textContent).toContain("Tumor 1");

        // Values stay clickable, and link to their documents.
        const gradeValue = [...matrix.querySelectorAll("button")].find(
          (button) => button.textContent === "3"
        );
        act(() => {
          gradeValue.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(onFactSelect).toHaveBeenCalledWith("c-grade");
      } finally {
        unmount();
      }
    });
  });


  describe("beta view", () => {
    const renderBeta = (element) => {
      localStorage.setItem(PATIENT_VIEW_PRESENTATION_STORAGE_KEY, "beta");
      return renderComponent(<PatientViewPresentationProvider>{element}</PatientViewPresentationProvider>);
    };
    const betaCancers = [
      cancers[0],
      {
        cancerId: "cancer-2",
        title: "cancer-2",
        collatedCancerFacts: [
          {
            categoryName: "Location",
            facts: [fact("c2-location", "Upper-Outer Quadrant of the Breast")],
          },
          { categoryName: "Grade", facts: [fact("c2-grade", "1")] },
        ],
        tnm: [{ data: { T: [], N: [], M: [] } }],
        tumors: {
          listViewData: [
            {
              id: "tumor-2",
              data: [{ category: "Location", facts: [fact("t2-location", "Nipple")] }],
            },
          ],
        },
      },
    ];

    it("turns the comparison on its side: the cancers as rows, the attributes as columns", () => {
      const onFactSelect = jest.fn();
      const { container, unmount } = renderBeta(
        <CancerTumorSummaryCard cancers={betaCancers} onFactSelect={onFactSelect} />
      );

      try {
        const table = container.querySelector("[data-testid='cancer-comparison-table']");
        expect(table).not.toBeNull();
        expect(container.querySelector("[data-testid='cancer-comparison-matrix']")).toBeNull();
        expect(container.querySelectorAll("[data-testid='cancer-summary-record']")).toHaveLength(0);

        // A row per cancer, so a few short rows rather than one per attribute.
        const rows = [...container.querySelectorAll("[data-testid='cancer-comparison-table-row']")];
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector("th[scope='row']").textContent).toContain("Cancer 1");
        expect(rows[1].querySelector("th[scope='row']").textContent).toContain("Cancer 2");

        // Attributes are column headings, grouped under Cancer and Tumor.
        const columnHeads = [...table.querySelectorAll("th[scope='col']")].map((n) => n.textContent);
        expect(columnHeads.some((text) => text.startsWith("Grade"))).toBe(true);
        const groups = [...table.querySelectorAll("th[scope='colgroup']")].map((n) => n.textContent);
        expect(groups).toEqual(expect.arrayContaining(["Cancer", "Tumor 1"]));

        // The columns where the cancers disagree are marked.
        const gradeHead = [...table.querySelectorAll("th[scope='col']")].find((n) =>
          n.textContent.startsWith("Grade")
        );
        expect(gradeHead.getAttribute("data-differs")).toBe("true");
        expect(gradeHead.textContent).toContain("differs");

        // Values are still clickable and link to their documents.
        const gradeValue = [...rows[0].querySelectorAll("button")].find((b) => b.textContent === "3");
        act(() => {
          gradeValue.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(onFactSelect).toHaveBeenCalledWith("c-grade");
      } finally {
        unmount();
      }
    });

    it("keeps a tumor's repeated value short, and folds columns with nothing to compare", () => {
      const sparse = betaCancers.map((cancer) => ({
        ...cancer,
        tnm: [{ data: { T: [], N: [], M: [] } }],
      }));
      const { container, unmount } = renderBeta(<CancerTumorSummaryCard cancers={sparse} />);

      try {
        const toggle = () =>
          container.querySelector("[data-testid='cancer-comparison-undocumented-toggle']");
        const heads = () =>
          [...container.querySelectorAll("th[scope='col']")].map((n) => n.textContent);

        // Neither cancer is staged, so the TNM column is folded away.
        expect(heads().some((text) => text.startsWith("TNM"))).toBe(false);
        expect(toggle().textContent).toMatch(/^Show \d+ undocumented or repeated columns?$/);

        act(() => {
          toggle().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(heads().some((text) => text.startsWith("TNM"))).toBe(true);
        expect(toggle().textContent).toMatch(/^Hide \d+ undocumented or repeated columns?$/);
      } finally {
        unmount();
      }
    });
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

  it("lays cancer records out in a multi-column grid, with fact details spanning it", () => {
    const twoCancers = [cancers[0], { ...cancers[0], cancerId: "cancer-2", title: "cancer-2" }];
    const { container, unmount } = renderAlpha(
      <CancerTumorSummaryCard
        cancers={twoCancers}
        factSelection={{ factId: "c-grade", categoryName: "Grade", prettyName: "Grade 3" }}
      />
    );

    try {
      const grid = container.querySelector("[data-testid='cancer-summary-grid']");
      expect(grid).not.toBeNull();
      // Records flow across the panel instead of stacking full-width.
      expect(getComputedStyle(grid).display).toBe("grid");
      expect(getComputedStyle(grid).gridTemplateColumns).toContain("auto-fit");
      expect(
        container.querySelectorAll("[data-testid='cancer-summary-record']")
      ).toHaveLength(2);

      // The selected-fact panel is a sibling of the records, so it must span
      // every column rather than sit in one.
      const detailsPanel = [...grid.children].find((child) =>
        child.textContent.includes("Details")
      );
      expect(getComputedStyle(detailsPanel).gridColumn).toBe("1/-1");
    } finally {
      unmount();
    }
  });
});
