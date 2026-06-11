/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */
/* eslint-disable testing-library/render-result-naming-convention */
import React, { useEffect } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useDataLoader } from "../useDataLoader";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function HookHarness({ getClassesFn, getInstancesFn, errorContext, onState }) {
  const state = useDataLoader(getClassesFn, getInstancesFn, errorContext);

  useEffect(() => {
    onState(state);
  }, [onState, state]);

  return null;
}

function renderHookHarness(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<HookHarness {...props} />);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
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

describe("useDataLoader", () => {
  let getClassesFn;
  let getInstancesFn;

  beforeEach(() => {
    getClassesFn = jest.fn();
    getInstancesFn = jest.fn();
  });

  it("loads classes and summaries successfully", async () => {
    const onState = jest.fn();
    getClassesFn.mockResolvedValue(["Class1", "Class2"]);
    getInstancesFn.mockImplementation((className) => {
      if (className === "Class1") {
        return Promise.resolve([
          { value: "A", count: 2 },
          { value: "A", count: 3 },
        ]);
      }
      return Promise.resolve([{ value: "B", count: 1 }]);
    });

    const { unmount } = renderHookHarness({
      getClassesFn,
      getInstancesFn,
      errorContext: "OMOP",
      onState,
    });

    await waitFor(() => {
      const latest = onState.mock.calls[onState.mock.calls.length - 1][0];
      expect(latest.isLoading).toBe(false);
      expect(latest.classes).toEqual(["Class1", "Class2"]);
      expect(latest.summaryByClass.Class1).toEqual([{ value: "A", count: 5 }]);
      expect(latest.summaryByClass.Class2).toEqual([{ value: "B", count: 1 }]);
      expect(latest.errorsByClass).toEqual({});
      expect(latest.errorMessage).toBe("");
    });

    unmount();
  });

  it("handles class loading errors", async () => {
    const onState = jest.fn();
    getClassesFn.mockRejectedValue(new Error("Classes down"));

    const { unmount } = renderHookHarness({
      getClassesFn,
      getInstancesFn,
      errorContext: "Attributes",
      onState,
    });

    await waitFor(() => {
      const latest = onState.mock.calls[onState.mock.calls.length - 1][0];
      expect(latest.isLoading).toBe(false);
      expect(latest.classes).toEqual([]);
      expect(latest.errorMessage).toBe("Classes down");
      expect(latest.summaryByClass).toEqual({});
      expect(latest.errorsByClass).toEqual({});
    });

    expect(getInstancesFn).not.toHaveBeenCalled();
    unmount();
  });

  it("handles partial instance failures", async () => {
    const onState = jest.fn();
    getClassesFn.mockResolvedValue(["Class1", "Class2"]);
    getInstancesFn.mockImplementation((className) => {
      if (className === "Class1") {
        return Promise.resolve([{ value: "A", count: 5 }]);
      }
      return Promise.reject(new Error("Instance down"));
    });

    const { unmount } = renderHookHarness({
      getClassesFn,
      getInstancesFn,
      errorContext: "Concepts",
      onState,
    });

    await waitFor(() => {
      const latest = onState.mock.calls[onState.mock.calls.length - 1][0];
      expect(latest.isLoading).toBe(false);
      expect(latest.classes).toEqual(["Class1", "Class2"]);
      expect(latest.summaryByClass.Class1).toEqual([{ value: "A", count: 5 }]);
      expect(latest.errorsByClass.Class2).toBe("Instance down");
      expect(latest.errorMessage).toBe("");
    });

    unmount();
  });

  it("handles empty classes list without instance calls", async () => {
    const onState = jest.fn();
    getClassesFn.mockResolvedValue([]);

    const { unmount } = renderHookHarness({
      getClassesFn,
      getInstancesFn,
      errorContext: "Cancers",
      onState,
    });

    await waitFor(() => {
      const latest = onState.mock.calls[onState.mock.calls.length - 1][0];
      expect(latest.isLoading).toBe(false);
      expect(latest.classes).toEqual([]);
      expect(latest.summaryByClass).toEqual({});
      expect(latest.errorsByClass).toEqual({});
    });

    expect(getInstancesFn).not.toHaveBeenCalled();
    unmount();
  });

  it("treats non-array class results as empty array", async () => {
    const onState = jest.fn();
    getClassesFn.mockResolvedValue({ classes: ["X"] });

    const { unmount } = renderHookHarness({
      getClassesFn,
      getInstancesFn,
      errorContext: "OMOP",
      onState,
    });

    await waitFor(() => {
      const latest = onState.mock.calls[onState.mock.calls.length - 1][0];
      expect(latest.isLoading).toBe(false);
      expect(latest.classes).toEqual([]);
    });

    expect(getInstancesFn).not.toHaveBeenCalled();
    unmount();
  });

  it("keeps context-specific fallback error messaging", async () => {
    const onState = jest.fn();
    getClassesFn.mockResolvedValue(["Class1"]);
    getInstancesFn.mockRejectedValue({});

    const { unmount } = renderHookHarness({
      getClassesFn,
      getInstancesFn,
      errorContext: "OMOP",
      onState,
    });

    await waitFor(() => {
      const latest = onState.mock.calls[onState.mock.calls.length - 1][0];
      expect(latest.errorsByClass.Class1).toBe("Failed to load OMOP instances.");
    });

    unmount();
  });

  it("does not update state after unmount", async () => {
    const onState = jest.fn();
    const classesDeferred = createDeferred();
    const instancesDeferred = createDeferred();

    getClassesFn.mockReturnValue(classesDeferred.promise);
    getInstancesFn.mockReturnValue(instancesDeferred.promise);

    const harness = renderHookHarness({
      getClassesFn,
      getInstancesFn,
      errorContext: "OMOP",
      onState,
    });

    const callCountBeforeUnmount = onState.mock.calls.length;

    harness.unmount();

    await act(async () => {
      classesDeferred.resolve(["Class1"]);
      await Promise.resolve();
    });

    await act(async () => {
      instancesDeferred.resolve([{ value: "A", count: 1 }]);
      await Promise.resolve();
    });

    expect(onState.mock.calls.length).toBe(callCountBeforeUnmount);
  });
});
