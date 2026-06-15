/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */
/* eslint-disable testing-library/render-result-naming-convention */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useBatchDataLoader } from "../useBatchDataLoader";

function renderHook(useHook) {
  const result = { current: null };
  function Harness() {
    result.current = useHook();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Harness));
  });
  return {
    result,
    unmount() {
      act(() => root.unmount());
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

describe("useBatchDataLoader", () => {
  it("summarizes batch instances, sorting by count desc and attaching patient IDs", async () => {
    const getSummaryFn = jest.fn().mockResolvedValue({
      classes: ["C1", "C2"],
      instancesByClass: {
        C1: [
          { value: "A", count: 2, patientIds: ["p1", "p2"] },
          { value: "B", count: 5 },
        ],
        C2: [{ value: "X", count: 1 }],
      },
    });

    const { result, unmount } = renderHook(() => useBatchDataLoader(getSummaryFn, "Attributes"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.classes).toEqual(["C1", "C2"]);
      expect(result.current.summaryByClass.C1).toEqual([
        { value: "B", count: 5 },
        { value: "A", count: 2, patientIds: ["p1", "p2"] },
      ]);
      expect(result.current.summaryByClass.C2).toEqual([{ value: "X", count: 1 }]);
      expect(result.current.errorMessage).toBe("");
    });

    unmount();
  });

  it("surfaces the error message when the summary request fails", async () => {
    const getSummaryFn = jest.fn().mockRejectedValue(new Error("batch endpoint down"));

    const { result, unmount } = renderHook(() => useBatchDataLoader(getSummaryFn, "Concepts"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.errorMessage).toBe("batch endpoint down");
      expect(result.current.classes).toEqual([]);
    });

    unmount();
  });

  it("handles a response with no classes without errors", async () => {
    const getSummaryFn = jest.fn().mockResolvedValue({});

    const { result, unmount } = renderHook(() => useBatchDataLoader(getSummaryFn, "OMOP"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.classes).toEqual([]);
      expect(result.current.summaryByClass).toEqual({});
      expect(result.current.errorMessage).toBe("");
    });

    unmount();
  });
});
