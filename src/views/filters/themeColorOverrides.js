/**
 * Theme-builder color override engine for the filters view.
 *
 * The theme builder lets a user recolor any color-bearing value in the active
 * MUI theme (palette, custom tokens, component overrides). This module owns
 * the color discovery, override normalization/persistence, and patch
 * construction; the dialog UI and its state live in the view.
 */

import { THEME_OPTIONS } from "../../themes";

export const THEME_EDITOR_MENU_VALUE = "__theme-builder__";
export const EMPTY_THEME_COLOR_OVERRIDES = Object.freeze({});

const THEME_COLOR_OVERRIDES_STORAGE_KEY = "filterPageThemeColorOverrides";
const THEME_COLOR_VALUE_PATTERN =
  /#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:transparent|currentColor)\b/gi;
const THEME_COLOR_VALUE_EXACT_PATTERN =
  /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|currentColor)$/i;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const THEME_COLOR_ROOT_KEYS = ["palette", "custom", "components"];

export function normalizeThemeColorOverridesByTheme(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }

  const validThemeKeys = new Set(THEME_OPTIONS.map((option) => option.key));
  const normalized = {};

  Object.entries(rawValue).forEach(([themeKey, rawOverrides]) => {
    if (!validThemeKeys.has(themeKey) || !rawOverrides || typeof rawOverrides !== "object") {
      return;
    }

    const normalizedThemeOverrides = {};
    Object.entries(rawOverrides).forEach(([entryId, entryValue]) => {
      if (typeof entryId !== "string" || typeof entryValue !== "string") {
        return;
      }
      const normalizedValue = entryValue.trim();
      if (normalizedValue) {
        normalizedThemeOverrides[entryId] = normalizedValue;
      }
    });

    if (Object.keys(normalizedThemeOverrides).length > 0) {
      normalized[themeKey] = normalizedThemeOverrides;
    }
  });

  return normalized;
}

export function getInitialThemeColorOverridesByTheme() {
  try {
    const stored = localStorage.getItem(THEME_COLOR_OVERRIDES_STORAGE_KEY);
    if (!stored) {
      return {};
    }
    return normalizeThemeColorOverridesByTheme(JSON.parse(stored));
  } catch {
    // localStorage unavailable
  }
  return {};
}

export function persistThemeColorOverridesByTheme(overridesByTheme) {
  try {
    localStorage.setItem(
      THEME_COLOR_OVERRIDES_STORAGE_KEY,
      JSON.stringify(normalizeThemeColorOverridesByTheme(overridesByTheme))
    );
  } catch {
    // localStorage unavailable
  }
}

function toThemeColorPathKey(pathSegments) {
  return pathSegments.join("\u0001");
}

function isArrayIndexPathSegment(segment) {
  return /^\d+$/.test(String(segment || ""));
}

function setObjectValueAtPath(target, pathSegments, nextValue) {
  if (!target || typeof target !== "object" || !Array.isArray(pathSegments) || pathSegments.length === 0) {
    return;
  }

  let cursor = target;
  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    const nextSegment = pathSegments[index + 1];
    const shouldCreateArray = isArrayIndexPathSegment(nextSegment);
    const existingValue = cursor[segment];

    if (!existingValue || typeof existingValue !== "object") {
      cursor[segment] = shouldCreateArray ? [] : {};
    }
    cursor = cursor[segment];
  }

  const lastSegment = pathSegments[pathSegments.length - 1];
  cursor[lastSegment] = nextValue;
}

export function collectThemeColorEntries(theme) {
  const entries = [];
  const visited = new WeakSet();

  const visitValue = (value, pathSegments) => {
    if (typeof value === "string") {
      const tokenPattern = new RegExp(THEME_COLOR_VALUE_PATTERN.source, "gi");
      const tokenMatches = [...value.matchAll(tokenPattern)];
      if (tokenMatches.length === 0) {
        return;
      }

      const pathKey = toThemeColorPathKey(pathSegments);
      const pathLabel = pathSegments.join(".");
      const trimmedValue = value.trim();
      const isDirectColor = tokenMatches.length === 1 && THEME_COLOR_VALUE_EXACT_PATTERN.test(trimmedValue);

      if (isDirectColor) {
        entries.push({
          id: pathKey,
          kind: "direct",
          pathKey,
          pathLabel,
          pathSegments,
          defaultValue: trimmedValue,
          sourceValue: trimmedValue,
          tokenIndex: 0,
          tokenStart: 0,
          tokenEnd: trimmedValue.length,
        });
        return;
      }

      tokenMatches.forEach((match, tokenIndex) => {
        const tokenValue = String(match[0] || "").trim();
        if (!tokenValue) {
          return;
        }
        const tokenStart = Number(match.index) || 0;
        entries.push({
          id: `${pathKey}::token:${tokenIndex}`,
          kind: "token",
          pathKey,
          pathLabel,
          pathSegments,
          defaultValue: tokenValue,
          sourceValue: value,
          tokenIndex,
          tokenStart,
          tokenEnd: tokenStart + tokenValue.length,
        });
      });
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((nestedValue, index) => {
        visitValue(nestedValue, [...pathSegments, String(index)]);
      });
      return;
    }

    Object.entries(value).forEach(([key, nestedValue]) => {
      if (typeof nestedValue === "function") {
        return;
      }
      visitValue(nestedValue, [...pathSegments, key]);
    });
  };

  THEME_COLOR_ROOT_KEYS.forEach((rootKey) => {
    visitValue(theme?.[rootKey], [rootKey]);
  });

  return entries.sort((leftEntry, rightEntry) => {
    const pathCompare = leftEntry.pathLabel.localeCompare(rightEntry.pathLabel, undefined, {
      sensitivity: "base",
      numeric: true,
    });
    if (pathCompare !== 0) {
      return pathCompare;
    }
    return leftEntry.tokenIndex - rightEntry.tokenIndex;
  });
}

export function buildThemeColorOverridePatch(entries, overridesByEntryId) {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const normalizedOverrides =
    overridesByEntryId && typeof overridesByEntryId === "object" ? overridesByEntryId : EMPTY_THEME_COLOR_OVERRIDES;
  const entriesByPath = new Map();

  normalizedEntries.forEach((entry) => {
    if (!entry?.pathKey) {
      return;
    }
    if (!entriesByPath.has(entry.pathKey)) {
      entriesByPath.set(entry.pathKey, []);
    }
    entriesByPath.get(entry.pathKey).push(entry);
  });

  const overridePatch = {};
  entriesByPath.forEach((entriesForPath) => {
    const directEntry = entriesForPath.find((entry) => entry.kind === "direct");
    if (directEntry) {
      const overriddenValue = normalizedOverrides[directEntry.id];
      if (
        typeof overriddenValue === "string" &&
        overriddenValue.length > 0 &&
        overriddenValue !== directEntry.defaultValue
      ) {
        setObjectValueAtPath(overridePatch, directEntry.pathSegments, overriddenValue);
      }
      return;
    }

    const tokenEntries = entriesForPath
      .filter((entry) => entry.kind === "token")
      .sort((leftEntry, rightEntry) => leftEntry.tokenIndex - rightEntry.tokenIndex);
    if (tokenEntries.length === 0) {
      return;
    }

    const templateValue = String(tokenEntries[0].sourceValue || "");
    let hasOverride = false;
    let cursor = 0;
    const rebuiltParts = [];

    tokenEntries.forEach((entry) => {
      const overriddenToken = normalizedOverrides[entry.id];
      const nextToken =
        typeof overriddenToken === "string" && overriddenToken.length > 0 ? overriddenToken : entry.defaultValue;
      if (nextToken !== entry.defaultValue) {
        hasOverride = true;
      }
      rebuiltParts.push(templateValue.slice(cursor, entry.tokenStart));
      rebuiltParts.push(nextToken);
      cursor = entry.tokenEnd;
    });

    rebuiltParts.push(templateValue.slice(cursor));
    if (hasOverride) {
      setObjectValueAtPath(overridePatch, tokenEntries[0].pathSegments, rebuiltParts.join(""));
    }
  });

  return overridePatch;
}

export function toColorInputHexValue(colorValue) {
  const normalizedValue = String(colorValue || "").trim();
  if (!HEX_COLOR_PATTERN.test(normalizedValue)) {
    return null;
  }
  if (normalizedValue.length === 4) {
    const [r, g, b] = normalizedValue.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return normalizedValue.toLowerCase();
}
