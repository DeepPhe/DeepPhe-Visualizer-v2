/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/render-result-naming-convention */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { usePatientData } from "../usePatientData";

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

function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeProfile(patientId) {
  return { patientId, patientName: patientId, demographics: {}, documents: [], cancers: [] };
}

describe("usePatientData", () => {
  it("ignores empty patient IDs without loading", async () => {
    const { result, unmount } = renderHook(usePatientData);
    const loader = jest.fn();

    let returned;
    await act(async () => {
      returned = await result.current.loadPatient("   ", loader);
    });

    expect(returned).toBeNull();
    expect(loader).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it("loads a profile and exposes the transformed bundle", async () => {
    const { result, unmount } = renderHook(usePatientData);
    const loader = jest.fn().mockResolvedValue(makeProfile("p1"));

    let returned;
    await act(async () => {
      returned = await result.current.loadPatient("p1", loader);
    });

    expect(loader).toHaveBeenCalledWith("p1");
    expect(result.current.patientData.patientId).toBe("p1");
    expect(Array.isArray(result.current.cancerSummary)).toBe(true);
    expect(result.current.timelineData).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorMessage).toBe("");
    expect(returned.patientData.patientId).toBe("p1");

    unmount();
  });

  it("records an error message and clears data when the load fails", async () => {
    const { result, unmount } = renderHook(usePatientData);
    const loader = jest.fn().mockRejectedValue(new Error("patient not found"));

    let returned;
    await act(async () => {
      returned = await result.current.loadPatient("p9", loader);
    });

    expect(returned).toBeNull();
    expect(result.current.patientData).toBeNull();
    expect(result.current.errorMessage).toBe("patient not found");
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it("ignores a stale (superseded) load so the latest request wins", async () => {
    const { result, unmount } = renderHook(usePatientData);
    const first = createDeferred();
    const second = createDeferred();

    let firstPromise;
    let secondPromise;
    act(() => {
      firstPromise = result.current.loadPatient("p1", () => first.promise);
    });
    act(() => {
      secondPromise = result.current.loadPatient("p2", () => second.promise);
    });

    // Resolve the newer request first, then the stale one.
    await act(async () => {
      second.resolve(makeProfile("p2"));
      await secondPromise;
    });
    await act(async () => {
      first.resolve(makeProfile("p1"));
      await firstPromise;
    });

    // The stale p1 result must not clobber the p2 state.
    expect(result.current.patientData.patientId).toBe("p2");

    unmount();
  });
});
