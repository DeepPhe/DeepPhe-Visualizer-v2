import { useCallback, useState } from "react";
import { THEME_OPTIONS, THEME_STORAGE_KEY } from "../themes";

const FONT_SCALE_STORAGE_KEY = "filterPageFontScale";
const HIGH_CONTRAST_STORAGE_KEY = "filterPageHighContrast";
const REDUCED_MOTION_STORAGE_KEY = "filterPageReducedMotion";
const COMPACT_MODE_STORAGE_KEY = "filterPageCompactMode";

export const FONT_SCALE_OPTIONS = [0.75, 0.9, 1, 1.1, 1.25, 1.5];

export const FILTER_PANEL_DENSITY_MODE = {
  STANDARD: "standard",
  COMPACT: "compact",
};

export function findClosestFontScaleIndex(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return FONT_SCALE_OPTIONS.indexOf(1);
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  FONT_SCALE_OPTIONS.forEach((option, index) => {
    const distance = Math.abs(option - numericValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function tryLocalStorage(fn) {
  try {
    fn();
  } catch {
    // localStorage unavailable
  }
}

function getInitialThemeKey() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEME_OPTIONS.some((option) => option.key === stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "obsidian";
  }
  return "govuk";
}

function getInitialFontScale() {
  try {
    const stored = Number.parseFloat(localStorage.getItem(FONT_SCALE_STORAGE_KEY) || "");
    const hasMatch = FONT_SCALE_OPTIONS.some((scale) => Math.abs(scale - stored) < 0.001);
    if (hasMatch) return stored;
  } catch {
    // localStorage unavailable
  }
  return 1;
}

function getInitialBooleanPref(storageKey) {
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    // localStorage unavailable
  }
  return false;
}

function getInitialFilterPanelDensityMode() {
  try {
    const stored = localStorage.getItem(COMPACT_MODE_STORAGE_KEY);
    if (stored === "true") return FILTER_PANEL_DENSITY_MODE.COMPACT;
    if (stored === "false") return FILTER_PANEL_DENSITY_MODE.STANDARD;
  } catch {
    // localStorage unavailable
  }
  return FILTER_PANEL_DENSITY_MODE.COMPACT;
}

/**
 * Manages the filter page display preferences backed by localStorage.
 * Returns stable setter/toggle functions so callers don't need to know
 * about storage key names or value coercion.
 */
export function useFilterPagePreferences() {
  const [themeKey, setThemeKey] = useState(getInitialThemeKey);
  const [fontScale, setFontScale] = useState(getInitialFontScale);
  const [highContrast, setHighContrast] = useState(
    () => getInitialBooleanPref(HIGH_CONTRAST_STORAGE_KEY)
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => getInitialBooleanPref(REDUCED_MOTION_STORAGE_KEY)
  );
  const [filterPanelDensityMode, setFilterPanelDensityMode] = useState(
    getInitialFilterPanelDensityMode
  );

  const changeTheme = useCallback((nextKey) => {
    if (!THEME_OPTIONS.some((option) => option.key === nextKey)) return;
    setThemeKey(nextKey);
    tryLocalStorage(() => localStorage.setItem(THEME_STORAGE_KEY, nextKey));
  }, []);

  const changeFontScale = useCallback((delta) => {
    setFontScale((prev) => {
      if (!Number.isFinite(delta) || delta === 0) return prev;
      const currentIndex = findClosestFontScaleIndex(prev);
      const nextIndex = Math.max(0, Math.min(FONT_SCALE_OPTIONS.length - 1, currentIndex + Math.sign(delta)));
      const next = FONT_SCALE_OPTIONS[nextIndex];
      tryLocalStorage(() => localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(next)));
      return next;
    });
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((prev) => {
      const next = !prev;
      tryLocalStorage(() => localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(next)));
      return next;
    });
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setReducedMotion((prev) => {
      const next = !prev;
      tryLocalStorage(() => localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(next)));
      return next;
    });
  }, []);

  const changeFilterPanelDensityMode = useCallback((nextMode) => {
    const resolved =
      nextMode === FILTER_PANEL_DENSITY_MODE.STANDARD
        ? FILTER_PANEL_DENSITY_MODE.STANDARD
        : FILTER_PANEL_DENSITY_MODE.COMPACT;
    setFilterPanelDensityMode(resolved);
    tryLocalStorage(() =>
      localStorage.setItem(
        COMPACT_MODE_STORAGE_KEY,
        String(resolved === FILTER_PANEL_DENSITY_MODE.COMPACT)
      )
    );
  }, []);

  return {
    themeKey,
    fontScale,
    highContrast,
    reducedMotion,
    filterPanelDensityMode,
    isCompactDensity: filterPanelDensityMode === FILTER_PANEL_DENSITY_MODE.COMPACT,
    changeTheme,
    changeFontScale,
    toggleHighContrast,
    toggleReducedMotion,
    changeFilterPanelDensityMode,
  };
}
