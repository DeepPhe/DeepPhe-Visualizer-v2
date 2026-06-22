import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME_OPTIONS, getThemeByKey } from "../themes";
import {
  EMPTY_THEME_COLOR_OVERRIDES,
  collectThemeColorEntries,
  getInitialThemeColorOverridesByTheme,
  persistThemeColorOverridesByTheme,
} from "../views/filters/themeColorOverrides";

/**
 * Owns the Theme Builder dialog state: which theme is being edited, the search
 * filter, and the per-theme color overrides (persisted to storage). Takes the
 * active themeKey + changeTheme from useFilterPagePreferences so it can expose
 * the active theme's overrides (consumed by FiltersView's activeTheme) and
 * apply the edited theme.
 */
export function useThemeBuilderState({ themeKey, changeTheme }) {
  const [isThemeBuilderOpen, setIsThemeBuilderOpen] = useState(false);
  const [themeBuilderThemeKey, setThemeBuilderThemeKey] = useState(() => themeKey);
  const [themeBuilderSearchQuery, setThemeBuilderSearchQuery] = useState("");
  const [themeColorOverridesByTheme, setThemeColorOverridesByTheme] = useState(getInitialThemeColorOverridesByTheme);

  const activeThemeColorOverrides = themeColorOverridesByTheme[themeKey] || EMPTY_THEME_COLOR_OVERRIDES;

  const themeBuilderTheme = useMemo(() => getThemeByKey(themeBuilderThemeKey), [themeBuilderThemeKey]);
  const themeBuilderColorEntries = useMemo(() => collectThemeColorEntries(themeBuilderTheme), [themeBuilderTheme]);
  const themeBuilderThemeOverrides = themeColorOverridesByTheme[themeBuilderThemeKey] || EMPTY_THEME_COLOR_OVERRIDES;
  const filteredThemeBuilderColorEntries = useMemo(() => {
    const normalizedQuery = String(themeBuilderSearchQuery || "")
      .trim()
      .toLowerCase();
    if (!normalizedQuery) {
      return themeBuilderColorEntries;
    }
    return themeBuilderColorEntries.filter((entry) => {
      const pathText = String(entry?.pathLabel || "").toLowerCase();
      const valueText = String(entry?.defaultValue || "").toLowerCase();
      return pathText.includes(normalizedQuery) || valueText.includes(normalizedQuery);
    });
  }, [themeBuilderColorEntries, themeBuilderSearchQuery]);
  const hasThemeBuilderOverrides = Object.keys(themeBuilderThemeOverrides).length > 0;
  const hasAnyThemeColorOverrides = Object.keys(themeColorOverridesByTheme).length > 0;

  useEffect(() => {
    persistThemeColorOverridesByTheme(themeColorOverridesByTheme);
  }, [themeColorOverridesByTheme]);

  const openThemeBuilder = useCallback((themeKeyToEdit) => {
    setThemeBuilderThemeKey(themeKeyToEdit);
    setThemeBuilderSearchQuery("");
    setIsThemeBuilderOpen(true);
  }, []);

  const handleThemeBuilderClose = useCallback(() => {
    setIsThemeBuilderOpen(false);
  }, []);

  const handleThemeBuilderThemeChange = useCallback((event) => {
    const nextThemeKey = String(event?.target?.value || "");
    if (!THEME_OPTIONS.some((option) => option.key === nextThemeKey)) {
      return;
    }
    setThemeBuilderThemeKey(nextThemeKey);
    setThemeBuilderSearchQuery("");
  }, []);

  const handleThemeBuilderEntryChange = useCallback(
    (entry, rawNextValue) => {
      if (!entry?.id || !entry?.defaultValue) {
        return;
      }

      const normalizedNextValue = String(rawNextValue ?? "").trim();
      setThemeColorOverridesByTheme((previousOverridesByTheme) => {
        const previousThemeOverrides = previousOverridesByTheme[themeBuilderThemeKey] || EMPTY_THEME_COLOR_OVERRIDES;
        const nextThemeOverrides = { ...previousThemeOverrides };

        if (!normalizedNextValue || normalizedNextValue === entry.defaultValue) {
          delete nextThemeOverrides[entry.id];
        } else {
          nextThemeOverrides[entry.id] = normalizedNextValue;
        }

        const nextOverridesByTheme = { ...previousOverridesByTheme };
        if (Object.keys(nextThemeOverrides).length === 0) {
          delete nextOverridesByTheme[themeBuilderThemeKey];
        } else {
          nextOverridesByTheme[themeBuilderThemeKey] = nextThemeOverrides;
        }
        return nextOverridesByTheme;
      });
    },
    [themeBuilderThemeKey]
  );

  const handleThemeBuilderThemeReset = useCallback(() => {
    setThemeColorOverridesByTheme((previousOverridesByTheme) => {
      if (!previousOverridesByTheme[themeBuilderThemeKey]) {
        return previousOverridesByTheme;
      }
      const nextOverridesByTheme = { ...previousOverridesByTheme };
      delete nextOverridesByTheme[themeBuilderThemeKey];
      return nextOverridesByTheme;
    });
  }, [themeBuilderThemeKey]);

  const handleThemeBuilderResetAll = useCallback(() => {
    setThemeColorOverridesByTheme({});
  }, []);

  const handleThemeBuilderApplyTheme = useCallback(() => {
    changeTheme(themeBuilderThemeKey);
  }, [themeBuilderThemeKey, changeTheme]);

  return {
    isThemeBuilderOpen,
    openThemeBuilder,
    themeBuilderThemeKey,
    themeBuilderSearchQuery,
    setThemeBuilderSearchQuery,
    activeThemeColorOverrides,
    themeBuilderColorEntries,
    filteredThemeBuilderColorEntries,
    themeBuilderThemeOverrides,
    hasThemeBuilderOverrides,
    hasAnyThemeColorOverrides,
    handleThemeBuilderClose,
    handleThemeBuilderThemeChange,
    handleThemeBuilderEntryChange,
    handleThemeBuilderThemeReset,
    handleThemeBuilderResetAll,
    handleThemeBuilderApplyTheme,
  };
}
