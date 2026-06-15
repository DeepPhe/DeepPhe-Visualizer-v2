/* eslint-disable testing-library/no-unnecessary-act */
/* eslint-disable testing-library/render-result-naming-convention */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  FONT_SCALE_OPTIONS,
  findClosestFontScaleIndex,
  useFilterPagePreferences,
} from "../useFilterPagePreferences";

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

beforeEach(() => {
  localStorage.clear();
});

describe("findClosestFontScaleIndex", () => {
  it("snaps a value to the nearest configured scale", () => {
    expect(findClosestFontScaleIndex(1)).toBe(FONT_SCALE_OPTIONS.indexOf(1));
    expect(findClosestFontScaleIndex(1.2)).toBe(FONT_SCALE_OPTIONS.indexOf(1.25));
    expect(findClosestFontScaleIndex(0.1)).toBe(0);
    expect(findClosestFontScaleIndex(10)).toBe(FONT_SCALE_OPTIONS.length - 1);
  });

  it("defaults non-numeric input to the 1.0 scale", () => {
    expect(findClosestFontScaleIndex("nope")).toBe(FONT_SCALE_OPTIONS.indexOf(1));
  });
});

describe("useFilterPagePreferences — defaults", () => {
  it("returns sensible defaults when localStorage is empty", () => {
    const { result, unmount } = renderHook(useFilterPagePreferences);

    expect(result.current.themeKey).toBe("govuk");
    expect(result.current.fontScale).toBe(1);
    expect(result.current.highContrast).toBe(false);
    expect(result.current.reducedMotion).toBe(false);
    expect(result.current.filterPanelDensityMode).toBe("compact-plus");
    expect(result.current.isCompactDensity).toBe(true);
    expect(result.current.isCompactPlusDensity).toBe(true);
    expect(result.current.stackGapPx).toBe(12);
    expect(result.current.slackDistributionMode).toBe("proportional");

    unmount();
  });

  it("hydrates from previously persisted preferences", () => {
    localStorage.setItem("filterPageTheme", "obsidian");
    localStorage.setItem("filterPageCompactMode", "standard");
    localStorage.setItem("filterPageHighContrast", "true");

    const { result, unmount } = renderHook(useFilterPagePreferences);

    expect(result.current.themeKey).toBe("obsidian");
    expect(result.current.filterPanelDensityMode).toBe("standard");
    expect(result.current.isCompactDensity).toBe(false);
    expect(result.current.highContrast).toBe(true);

    unmount();
  });
});

describe("useFilterPagePreferences — mutations", () => {
  it("changes the theme and persists it, ignoring unknown keys", () => {
    const { result, unmount } = renderHook(useFilterPagePreferences);

    act(() => result.current.changeTheme("vapor"));
    expect(result.current.themeKey).toBe("vapor");
    expect(localStorage.getItem("filterPageTheme")).toBe("vapor");

    act(() => result.current.changeTheme("not-a-theme"));
    expect(result.current.themeKey).toBe("vapor");

    unmount();
  });

  it("steps the font scale through configured options", () => {
    const { result, unmount } = renderHook(useFilterPagePreferences);

    act(() => result.current.changeFontScale(1));
    expect(result.current.fontScale).toBe(1.1);
    expect(localStorage.getItem("filterPageFontScale")).toBe("1.1");

    act(() => result.current.changeFontScale(-1));
    expect(result.current.fontScale).toBe(1);

    unmount();
  });

  it("toggles boolean accessibility preferences", () => {
    const { result, unmount } = renderHook(useFilterPagePreferences);

    act(() => result.current.toggleHighContrast());
    expect(result.current.highContrast).toBe(true);
    expect(localStorage.getItem("filterPageHighContrast")).toBe("true");

    act(() => result.current.toggleReducedMotion());
    expect(result.current.reducedMotion).toBe(true);

    unmount();
  });

  it("only accepts whitelisted stack gap and slack values", () => {
    const { result, unmount } = renderHook(useFilterPagePreferences);

    act(() => result.current.changeStackGapPx(8));
    expect(result.current.stackGapPx).toBe(8);

    act(() => result.current.changeStackGapPx(7)); // not in STACK_GAP_OPTIONS
    expect(result.current.stackGapPx).toBe(8);

    act(() => result.current.changeSlackDistributionMode("equal"));
    expect(result.current.slackDistributionMode).toBe("equal");

    act(() => result.current.changeSlackDistributionMode("bogus"));
    expect(result.current.slackDistributionMode).toBe("equal");

    unmount();
  });

  it("derives density booleans from the selected density mode", () => {
    const { result, unmount } = renderHook(useFilterPagePreferences);

    act(() => result.current.changeFilterPanelDensityMode("standard"));
    expect(result.current.filterPanelDensityMode).toBe("standard");
    expect(result.current.isCompactDensity).toBe(false);
    expect(result.current.isCompactPlusDensity).toBe(false);

    act(() => result.current.changeFilterPanelDensityMode("compact"));
    expect(result.current.isCompactDensity).toBe(true);
    expect(result.current.isCompactPlusDensity).toBe(false);

    unmount();
  });
});
