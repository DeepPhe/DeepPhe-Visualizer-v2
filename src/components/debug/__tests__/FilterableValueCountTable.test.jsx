import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import FilterableValueCountTable from "../FilterableValueCountTable";

const mockRows = [
  { id: "row-alpha", label: "Alpha", count: 100 },
  { id: "row-beta", label: "Beta", count: 50 },
  { id: "row-gamma", label: "Gamma", count: 200 },
  { id: "row-delta", label: "Delta", count: 50 },
];

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

function changeInputValue(input, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;

  act(() => {
    if (valueSetter) {
      valueSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function clickElement(element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function getRowLabels(container) {
  return Array.from(container.querySelectorAll("tbody tr td:first-child")).map((cell) =>
    cell.textContent.trim()
  );
}

function getInputByLabel(container, labelText) {
  const label = Array.from(container.querySelectorAll("label")).find(
    (element) => element.textContent === labelText
  );
  if (!label) {
    return null;
  }

  const inputId = label.getAttribute("for");
  return inputId ? document.getElementById(inputId) : null;
}

function getHeaderControl(container, text) {
  const headerCell = Array.from(container.querySelectorAll("th")).find((cell) =>
    cell.textContent.includes(text)
  );

  if (!headerCell) {
    return null;
  }

  return headerCell.querySelector('[role="button"], button, span');
}

describe("FilterableValueCountTable", () => {
  it("renders table headers and rows", () => {
    const { container, unmount } = renderComponent(<FilterableValueCountTable rows={mockRows} />);

    expect(container.textContent).toContain("Value");
    expect(container.textContent).toContain("Count");
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Gamma");

    unmount();
  });

  it("filters rows using search input", () => {
    const { container, unmount } = renderComponent(<FilterableValueCountTable rows={mockRows} />);

    const searchInput = getInputByLabel(container, "Search");
    expect(searchInput).not.toBeNull();
    changeInputValue(searchInput, "ga");

    const labels = getRowLabels(container);
    expect(labels).toEqual(["Gamma"]);

    changeInputValue(searchInput, "zzz");
    expect(container.textContent).toContain("No matching values.");

    changeInputValue(searchInput, "");
    expect(getRowLabels(container)).toContain("Alpha");

    unmount();
  });

  it("sorts rows by value when Value header is clicked", () => {
    const { container, unmount } = renderComponent(<FilterableValueCountTable rows={mockRows} />);

    const valueControl = getHeaderControl(container, "Value");
    clickElement(valueControl);

    expect(getRowLabels(container)).toEqual(["Gamma", "Delta", "Beta", "Alpha"]);

    clickElement(valueControl);
    expect(getRowLabels(container)).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);

    unmount();
  });

  it("sorts rows by count and uses value as tie-breaker", () => {
    const { container, unmount } = renderComponent(<FilterableValueCountTable rows={mockRows} />);

    const countControl = getHeaderControl(container, "Count");
    clickElement(countControl);

    expect(getRowLabels(container)).toEqual(["Gamma", "Alpha", "Beta", "Delta"]);

    clickElement(countControl);
    expect(getRowLabels(container)).toEqual(["Beta", "Delta", "Alpha", "Gamma"]);

    unmount();
  });

  it("toggles expand/collapse button state", () => {
    const { container, unmount } = renderComponent(<FilterableValueCountTable rows={mockRows} />);

    const expandButton = container.querySelector('[aria-label="Expand list"]');
    expect(expandButton).not.toBeNull();

    clickElement(expandButton);
    const collapseButton = container.querySelector('[aria-label="Collapse list"]');
    expect(collapseButton).not.toBeNull();

    clickElement(collapseButton);
    expect(container.querySelector('[aria-label="Expand list"]')).not.toBeNull();

    unmount();
  });

  it("renders empty state for empty rows", () => {
    const { container, unmount } = renderComponent(<FilterableValueCountTable rows={[]} />);

    expect(container.textContent).toContain("No matching values.");

    unmount();
  });

  it("supports custom value header", () => {
    const { container, unmount } = renderComponent(
      <FilterableValueCountTable rows={mockRows} valueHeader="Cancer" />
    );

    expect(container.textContent).toContain("Cancer");

    unmount();
  });

  it("applies row id attributes and formats large numbers", () => {
    const { container, unmount } = renderComponent(
      <FilterableValueCountTable rows={[{ id: "row-1", label: "Large", count: 1234 }]} />
    );

    expect(container.querySelector("#row-1")).not.toBeNull();
    expect(container.textContent).toContain("1,234");

    unmount();
  });
});
