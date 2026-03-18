import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

jest.mock("../../components/debug/SummaryChart", () => (props) => (
  <div data-testid="summary-chart">chart:{props.distribution?.length || 0}</div>
));

jest.mock("../../controllers/omap", () => ({
  getClasses: jest.fn(),
  getInstances: jest.fn(),
}));

jest.mock("../../controllers/attributes", () => ({
  getClasses: jest.fn(),
  getInstances: jest.fn(),
}));

jest.mock("../../controllers/concepts", () => ({
  getClasses: jest.fn(),
  getInstances: jest.fn(),
}));

jest.mock("../../controllers/cancers", () => ({
  getClasses: jest.fn(),
  getInstances: jest.fn(),
}));

import DebugView from "../debug";
import { getClasses as getOmopClasses, getInstances as getOmopInstances } from "../../controllers/omap";
import {
  getClasses as getAttributeClasses,
  getInstances as getAttributeInstances,
} from "../../controllers/attributes";
import { getClasses as getConceptClasses, getInstances as getConceptInstances } from "../../controllers/concepts";
import { getClasses as getCancerClasses, getInstances as getCancerInstances } from "../../controllers/cancers";

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

function click(element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

describe("DebugView", () => {
  let rafQueue;

  beforeEach(() => {
    jest.clearAllMocks();

    rafQueue = [];
    global.requestAnimationFrame = jest.fn((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });

    Element.prototype.scrollIntoView = jest.fn();

    getOmopClasses.mockResolvedValue(["AGE_AT_DX", "GENDER"]);
    getOmopInstances.mockImplementation((className) => {
      if (className === "AGE_AT_DX") {
        return Promise.resolve([
          { age_at_dx: "45", count: 2 },
          { age_at_dx: "47", count: 3 },
        ]);
      }
      return Promise.resolve([{ gender: "Female", count: 5 }]);
    });

    getAttributeClasses.mockResolvedValue(["Behavior", "BRCA1"]);
    getAttributeInstances.mockImplementation((className) => {
      if (className === "Behavior") {
        return Promise.resolve([
          { value: "Aggressive", count: 2 },
          { value: "Indolent", count: 1 },
        ]);
      }
      return Promise.resolve([{ value: "Mutated", count: 3 }]);
    });

    getConceptClasses.mockResolvedValue(["ConceptA"]);
    getConceptInstances.mockResolvedValue([{ value: "ConceptValue", count: 4 }]);

    getCancerClasses.mockResolvedValue(["AbdominalMass", "LungCancer"]);
    getCancerInstances.mockImplementation((className) => {
      if (className === "AbdominalMass") {
        return Promise.resolve([
          { value: "AbdominalMass", count: 2 },
          { value: "AbdominalMass", count: 1 },
        ]);
      }
      return Promise.resolve([{ value: "LungCancer", count: 4 }]);
    });
  });

  function flushRafQueue() {
    act(() => {
      while (rafQueue.length > 0) {
        const callbacks = [...rafQueue];
        rafQueue = [];
        callbacks.forEach((cb) => cb());
      }
    });
  }

  it("renders title and collapsed sections initially", () => {
    const { container, unmount } = renderComponent(<DebugView />);

    expect(container.textContent).toContain("Debug View");
    expect(container.textContent).toContain("OMOP");
    expect(container.textContent).toContain("Attributes");
    expect(container.textContent).toContain("Concepts");
    expect(container.textContent).toContain("Cancers");

    expect(container.querySelector('[aria-label="Expand OMOP section"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Expand Attributes section"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Expand Concepts section"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Expand Cancers section"]')).not.toBeNull();

    unmount();
  });

  it("expands and collapses a section", async () => {
    const { container, unmount } = renderComponent(<DebugView />);

    const omopToggle = container.querySelector('[aria-label="Expand OMOP section"]');
    click(omopToggle);

    // Spinner/disabled while pending
    expect(omopToggle.disabled).toBe(true);
    flushRafQueue();

    await waitFor(() => {
      expect(container.querySelector('[aria-label="Collapse OMOP section"]')).not.toBeNull();
      expect(container.textContent).toContain("AGE_AT_DX");
      expect(container.textContent).toContain("GENDER");
    });

    const collapseButton = container.querySelector('[aria-label="Collapse OMOP section"]');
    click(collapseButton);
    flushRafQueue();

    await waitFor(() => {
      expect(container.querySelector('[aria-label="Expand OMOP section"]')).not.toBeNull();
    });

    unmount();
  });

  it("expands collapsed section and scrolls when jump link is clicked", async () => {
    const { container, unmount } = renderComponent(<DebugView />);

    await waitFor(() => {
      const links = Array.from(container.querySelectorAll("a"));
      expect(links.some((link) => link.textContent === "AGE_AT_DX")).toBe(true);
    });

    const ageJumpLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "AGE_AT_DX"
    );

    click(ageJumpLink);
    flushRafQueue();

    await waitFor(() => {
      expect(container.querySelector('[aria-label="Collapse OMOP section"]')).not.toBeNull();
    });

    const expandedJumpLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "AGE_AT_DX"
    );
    click(expandedJumpLink);

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    unmount();
  });

  it("shows error state for a failing section without breaking others", async () => {
    getConceptClasses.mockRejectedValue(new Error("Concept service unavailable"));

    const { container, unmount } = renderComponent(<DebugView />);

    const conceptToggle = container.querySelector('[aria-label="Expand Concepts section"]');
    click(conceptToggle);
    flushRafQueue();

    await waitFor(() => {
      expect(container.textContent).toContain("Concept service unavailable");
    });

    const omopToggle = container.querySelector('[aria-label="Expand OMOP section"]');
    click(omopToggle);
    flushRafQueue();

    await waitFor(() => {
      expect(container.textContent).toContain("AGE_AT_DX");
    });

    unmount();
  });

  it("renders aggregated cancer table values", async () => {
    const { container, unmount } = renderComponent(<DebugView />);

    const cancerToggle = container.querySelector('[aria-label="Expand Cancers section"]');
    click(cancerToggle);
    flushRafQueue();

    await waitFor(() => {
      expect(container.textContent).toContain("Cancer Counts");
      expect(container.textContent).toContain("AbdominalMass");
      expect(container.textContent).toContain("LungCancer");
      // Aggregated counts: AbdominalMass=3, LungCancer=4
      expect(container.textContent).toContain("3");
      expect(container.textContent).toContain("4");
    });

    unmount();
  });

  it("renders back home router link", () => {
    const { container, unmount } = renderComponent(<DebugView />);

    const link = Array.from(container.querySelectorAll("a")).find(
      (anchor) => anchor.textContent === "Back Home"
    );

    expect(link).not.toBeUndefined();
    expect(link.getAttribute("href")).toBe("/");

    unmount();
  });
});
