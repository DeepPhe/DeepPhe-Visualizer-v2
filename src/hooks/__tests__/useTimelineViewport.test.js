/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/render-result-naming-convention */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import useTimelineViewport, { RANGE_ANNOUNCEMENT_DELAY_MS } from "../useTimelineViewport";

function renderHook(initialProps) {
  const result = { current: null };
  function Harness(props) {
    result.current = useTimelineViewport(props);
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Harness, initialProps));
  });
  return {
    result,
    rerender(nextProps) {
      act(() => {
        root.render(React.createElement(Harness, nextProps));
      });
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function keyEvent(key, extra = {}) {
  return { key, preventDefault: jest.fn(), ...extra };
}

describe("useTimelineViewport", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("zooms, pans and resets, reporting which controls can act", () => {
    const { result, unmount } = renderHook({ resetKey: "a" });

    expect(result.current).toMatchObject({
      zoomPercent: 100,
      canZoomOut: false,
      canPanEarlier: false,
      canPanLater: false,
      canReset: false,
      canZoomIn: true,
    });

    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    expect(result.current.zoomPercent).toBe(225);
    expect(result.current.canPanEarlier).toBe(true);
    expect(result.current.canPanLater).toBe(true);

    const centered = result.current.viewport.panRatio;
    act(() => result.current.panLater());
    expect(result.current.viewport.panRatio - centered).toBeCloseTo(0.2 / 2.25, 10);

    act(() => result.current.reset());
    expect(result.current.viewport).toEqual({ zoom: 1, panRatio: 0 });

    unmount();
  });

  it("maps +, -, 0 and the arrow keys, and ignores modified keys", () => {
    const { result, unmount } = renderHook({ resetKey: "a" });

    const plus = keyEvent("+");
    act(() => result.current.handlePlotKeyDown(plus));
    expect(plus.preventDefault).toHaveBeenCalled();
    expect(result.current.zoomPercent).toBe(150);

    act(() => result.current.handlePlotKeyDown(keyEvent("ArrowRight")));
    expect(result.current.viewport.panRatio).toBeGreaterThan(1 / 6);

    const browserBack = keyEvent("ArrowLeft", { metaKey: true });
    const before = result.current.viewport;
    act(() => result.current.handlePlotKeyDown(browserBack));
    expect(browserBack.preventDefault).not.toHaveBeenCalled();
    expect(result.current.viewport).toBe(before);

    act(() => result.current.handlePlotKeyDown(keyEvent("-")));
    expect(result.current.zoomPercent).toBe(100);

    const letter = keyEvent("a");
    act(() => result.current.handlePlotKeyDown(letter));
    expect(letter.preventDefault).not.toHaveBeenCalled();

    unmount();
  });

  it("resets when the reset key changes, without announcing it", () => {
    jest.useFakeTimers();
    const describeRange = jest.fn(() => "Showing everything");
    const { result, rerender, unmount } = renderHook({ resetKey: "patient-1", describeRange });

    act(() => result.current.zoomIn());
    act(() => {
      jest.advanceTimersByTime(RANGE_ANNOUNCEMENT_DELAY_MS);
    });
    expect(result.current.announcement).toBe("Showing everything");
    expect(describeRange).toHaveBeenCalledTimes(1);

    rerender({ resetKey: "patient-2", describeRange });
    act(() => {
      jest.advanceTimersByTime(RANGE_ANNOUNCEMENT_DELAY_MS * 2);
    });
    expect(result.current.viewport).toEqual({ zoom: 1, panRatio: 0 });
    expect(describeRange).toHaveBeenCalledTimes(1);

    // Same key: the reader's zoom survives a re-render.
    act(() => result.current.zoomIn());
    rerender({ resetKey: "patient-2", describeRange });
    expect(result.current.zoomPercent).toBe(150);

    unmount();
  });

  it("debounces announcements until changes stop", () => {
    jest.useFakeTimers();
    const describeRange = jest.fn((viewport) => `zoom ${viewport.zoom}`);
    const { result, unmount } = renderHook({ resetKey: "a", describeRange });

    act(() => result.current.zoomIn());
    act(() => {
      jest.advanceTimersByTime(RANGE_ANNOUNCEMENT_DELAY_MS - 50);
    });
    act(() => result.current.zoomIn());
    act(() => {
      jest.advanceTimersByTime(RANGE_ANNOUNCEMENT_DELAY_MS - 50);
    });
    expect(result.current.announcement).toBe("");

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current.announcement).toBe("zoom 2.25");
    expect(describeRange).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("pans on a drag past the threshold and swallows the click that ends it", () => {
    const { result, unmount } = renderHook({ resetKey: "a" });
    const clientToX = (clientX) => clientX;
    const pointerDown = (clientX) => ({ button: 0, clientX, preventDefault: jest.fn() });
    const move = (clientX) =>
      window.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX }));
    const up = () => window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));

    // At 100% there is nothing to pan.
    act(() => result.current.handlePlotPointerDown(pointerDown(500), { clientToX, plotWidth: 1000 }));
    expect(result.current.isDragging).toBe(false);

    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    const start = result.current.viewport.panRatio;

    act(() => result.current.handlePlotPointerDown(pointerDown(500), { clientToX, plotWidth: 1000 }));
    expect(result.current.isDragging).toBe(true);
    act(() => move(503));
    expect(result.current.viewport.panRatio).toBe(start);
    act(() => move(400));
    // Dragging right-to-left by 100 of 1000 units at 225% moves later.
    expect(result.current.viewport.panRatio).toBeCloseTo(start + 100 / (1000 * 2.25), 10);
    act(() => up());
    expect(result.current.isDragging).toBe(false);
    expect(result.current.consumeDragClick()).toBe(true);
    expect(result.current.consumeDragClick()).toBe(false);

    // A press that never moves is a plain click.
    act(() => result.current.handlePlotPointerDown(pointerDown(500), { clientToX, plotWidth: 1000 }));
    act(() => up());
    expect(result.current.consumeDragClick()).toBe(false);

    unmount();
  });
});
