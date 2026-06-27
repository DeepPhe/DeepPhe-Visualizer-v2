import { useCallback, useState } from "react";
import { THEME_OPTIONS, THEME_STORAGE_KEY } from "../themes";

const FONT_SCALE_STORAGE_KEY = "filterPageFontScale";
const HIGH_CONTRAST_STORAGE_KEY = "filterPageHighContrast";
const REDUCED_MOTION_STORAGE_KEY = "filterPageReducedMotion";
const COMPACT_MODE_STORAGE_KEY = "filterPageCompactMode";
const STACK_GAP_STORAGE_KEY = "filterPageStackGapPx";
const SLACK_MODE_STORAGE_KEY = "filterPageSlackMode";
const SHOW_BAR_BEHIND_DOTS_STORAGE_KEY = "filterPageShowBarBehindDots";

export const FONT_SCALE_OPTIONS = [0.75, 0.9, 1, 1.1, 1.25, 1.5];
export const STACK_GAP_OPTIONS = [2, 4, 6, 8, 12, 16];

export const SLACK_DISTRIBUTION_MODE = {
  PROPORTIONAL: "proportional",
  EQUAL: "equal",
  TALLEST: "tallest",
  NONE: "none",
};

export const FILTER_PANEL_DENSITY_MODE = {
  STANDARD: "standard",
  COMPACT: "compact",
  COMPACT_PLUS: "compact-plus",
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

function getInitialBooleanPref(storageKey, defaultValue = false) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage unavailable
  }
  return defaultValue;
}

function getInitialStackGapPx() {
  try {
    const stored = Number.parseInt(
      localStorage.getItem(STACK_GAP_STORAGE_KEY) || "",
      10
    );
    if (STACK_GAP_OPTIONS.includes(stored)) return stored;
  } catch {
    // localStorage unavailable
  }
  return 12;
}

function getInitialSlackDistributionMode() {
  try {
    const stored = localStorage.getItem(SLACK_MODE_STORAGE_KEY);
    if (Object.values(SLACK_DISTRIBUTION_MODE).includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return SLACK_DISTRIBUTION_MODE.PROPORTIONAL;
}

function getInitialFilterPanelDensityMode() {
  try {
    const stored = localStorage.getItem(COMPACT_MODE_STORAGE_KEY);
    if (stored === FILTER_PANEL_DENSITY_MODE.STANDARD) return FILTER_PANEL_DENSITY_MODE.STANDARD;
    if (stored === FILTER_PANEL_DENSITY_MODE.COMPACT) return FILTER_PANEL_DENSITY_MODE.COMPACT;
    if (stored === FILTER_PANEL_DENSITY_MODE.COMPACT_PLUS) return FILTER_PANEL_DENSITY_MODE.COMPACT_PLUS;
    if (stored === "true") return FILTER_PANEL_DENSITY_MODE.COMPACT_PLUS;
    if (stored === "false") return FILTER_PANEL_DENSITY_MODE.STANDARD;
  } catch {
    // localStorage unavailable
  }
  // Standard is currently the only user-facing density (the density picker is
  // hidden in FiltersToolbar). The compact modes remain implemented and are
  // still honored when explicitly stored; change this default to re-enable.
  return FILTER_PANEL_DENSITY_MODE.STANDARD;
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
  const [stackGapPx, setStackGapPx] = useState(getInitialStackGapPx);
  const [slackDistributionMode, setSlackDistributionMode] = useState(
    getInitialSlackDistributionMode
  );
  const [showBarBehindDots, setShowBarBehindDots] = useState(
    () => getInitialBooleanPref(SHOW_BAR_BEHIND_DOTS_STORAGE_KEY, true)
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

  const toggleShowBarBehindDots = useCallback(() => {
    setShowBarBehindDots((prev) => {
      const next = !prev;
      tryLocalStorage(() => localStorage.setItem(SHOW_BAR_BEHIND_DOTS_STORAGE_KEY, String(next)));
      return next;
    });
  }, []);

  const changeStackGapPx = useCallback((nextPx) => {
    const numericPx = Number(nextPx);
    if (!STACK_GAP_OPTIONS.includes(numericPx)) return;
    setStackGapPx(numericPx);
    tryLocalStorage(() =>
      localStorage.setItem(STACK_GAP_STORAGE_KEY, String(numericPx))
    );
  }, []);

  const changeSlackDistributionMode = useCallback((nextMode) => {
    if (!Object.values(SLACK_DISTRIBUTION_MODE).includes(nextMode)) return;
    setSlackDistributionMode(nextMode);
    tryLocalStorage(() =>
      localStorage.setItem(SLACK_MODE_STORAGE_KEY, nextMode)
    );
  }, []);

  const changeFilterPanelDensityMode = useCallback((nextMode) => {
    const resolved =
      nextMode === FILTER_PANEL_DENSITY_MODE.STANDARD
        ? FILTER_PANEL_DENSITY_MODE.STANDARD
        : nextMode === FILTER_PANEL_DENSITY_MODE.COMPACT
          ? FILTER_PANEL_DENSITY_MODE.COMPACT
          : FILTER_PANEL_DENSITY_MODE.COMPACT_PLUS;
    setFilterPanelDensityMode(resolved);
    tryLocalStorage(() =>
      localStorage.setItem(COMPACT_MODE_STORAGE_KEY, resolved)
    );
  }, []);

  return {
    themeKey,
    fontScale,
    highContrast,
    reducedMotion,
    filterPanelDensityMode,
    isCompactDensity: filterPanelDensityMode !== FILTER_PANEL_DENSITY_MODE.STANDARD,
    isCompactPlusDensity: filterPanelDensityMode === FILTER_PANEL_DENSITY_MODE.COMPACT_PLUS,
    stackGapPx,
    slackDistributionMode,
    showBarBehindDots,
    changeTheme,
    changeFontScale,
    toggleHighContrast,
    toggleReducedMotion,
    toggleShowBarBehindDots,
    changeFilterPanelDensityMode,
    changeStackGapPx,
    changeSlackDistributionMode,
  };
}
