import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

const mockBarChart = jest.fn(() => <div data-testid="bar-chart" />);

jest.mock("@mui/x-charts/BarChart", () => ({
  BarChart: (props) => {
    mockBarChart(props);
    return <div data-testid="bar-chart" />;
  },
}));

const mockTableComponent = jest.fn(() => <div data-testid="value-count-table" />);

jest.mock("../FilterableValueCountTable", () => (props) => {
  mockTableComponent(props);
  return <div data-testid="value-count-table" />;
});

import SummaryChart from "../SummaryChart";

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

describe("SummaryChart", () => {
  beforeEach(() => {
    mockBarChart.mockClear();
    mockTableComponent.mockClear();
  });

  it("renders BarChart for small datasets", () => {
    const distribution = [
      { label: "B", count: 1 },
      { label: "A", count: 2 },
    ];

    const { container, unmount } = renderComponent(<SummaryChart distribution={distribution} />);

    expect(container.querySelector('[data-testid="bar-chart"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="value-count-table"]')).toBeNull();
    expect(mockBarChart).toHaveBeenCalledTimes(1);

    const props = mockBarChart.mock.calls[0][0];
    expect(props.height).toBe(260);
    expect(props.margin).toEqual({ top: 16, right: 12, bottom: 86, left: 88 });
    expect(props.xAxis[0].data).toEqual(["A", "B"]);
    expect(props.series[0].data).toEqual([2, 1]);

    unmount();
  });

  it("renders FilterableValueCountTable for large datasets", () => {
    const distribution = Array.from({ length: 13 }, (_, index) => ({
      label: `Value${13 - index}`,
      count: index,
    }));

    const { container, unmount } = renderComponent(<SummaryChart distribution={distribution} />);

    expect(container.querySelector('[data-testid="value-count-table"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bar-chart"]')).toBeNull();
    expect(mockTableComponent).toHaveBeenCalledTimes(1);

    const tableProps = mockTableComponent.mock.calls[0][0];
    expect(tableProps.rows.map((row) => row.label)).toEqual(
      [...distribution].map((item) => item.label).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    );

    unmount();
  });

  it("handles empty distribution", () => {
    const { container, unmount } = renderComponent(<SummaryChart distribution={[]} />);

    expect(container.querySelector('[data-testid="bar-chart"]')).not.toBeNull();
    const props = mockBarChart.mock.calls[0][0];
    expect(props.xAxis[0].data).toEqual([]);
    expect(props.series[0].data).toEqual([]);

    unmount();
  });

  it("does not mutate source distribution", () => {
    const distribution = [
      { label: "C", count: 1 },
      { label: "A", count: 2 },
      { label: "B", count: 3 },
    ];
    const original = [...distribution];

    const { unmount } = renderComponent(<SummaryChart distribution={distribution} />);

    expect(distribution).toEqual(original);
    unmount();
  });
});
