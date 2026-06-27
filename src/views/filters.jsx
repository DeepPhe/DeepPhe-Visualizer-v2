import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  CssBaseline,
  GlobalStyles,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { ThemeProvider, alpha, createTheme } from "@mui/material/styles";
import Masonry from "@mui/lab/Masonry";
import { getSummary as getOmopSummary } from "../controllers/omap";
import { getSummary as getAttributesSummary } from "../controllers/attributes";
import { getSummary as getConceptsSummary } from "../controllers/concepts";
import {
  fetchDeepPheFilterCount,
  fetchDeepPheFilterCountBatch,
  fetchDeepPheFilterSummary,
  fetchPatientDocuments,
} from "../clients/deepphe-data-api";
import { useBatchDataLoader } from "../hooks/useBatchDataLoader";
import { useThemeBuilderState } from "../hooks/useThemeBuilderState";
import {
  FONT_SCALE_OPTIONS,
  findClosestFontScaleIndex,
  useFilterPagePreferences,
} from "../hooks/useFilterPagePreferences";
import { getThemeByKey } from "../themes";
import {
  THEME_EDITOR_MENU_VALUE,
  buildThemeColorOverridePatch,
  collectThemeColorEntries,
} from "./filters/themeColorOverrides";
import { normalizeClassName } from "../utils/dataProcessing";
import { endSpan, logMilestone, startSpan } from "../utils/perfTracker";
import { resolveFilterSetsWithExtras, resolveFilterSetsForAttributesAndConcepts } from "./filterSets";
import { buildFilterSectionLayout, estimateCardHeight } from "./filterLayout";
import FilterSectionCard from "./filters/FilterSectionCard";
import FilterDetailModal from "./filters/FilterDetailModal";
import ThemeBuilderDialog from "./filters/ThemeBuilderDialog";
import FiltersToolbar from "./filters/FiltersToolbar";
import {
  FILTER_CARD_MIN_WIDTH_PX,
  FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT,
  FILTER_SECTION_LABEL_SX,
  FILTER_SECTION_LANE_MIN_WIDTH_PX,
  FILTER_SECTION_LAYOUT_COLUMNS,
  capColumnsByWidth,
  getFilterSetCardColumnsByBreakpoint,
  getFilterSetPriorityIndex,
  getOversizedRowThreshold,
  resolvePackedGridSpan,
  resolveResponsiveColumnCap,
} from "./filters/layoutConfig";
import PatientDrawer from "./filters/PatientDrawer";
import {
  buildChildChartData,
  buildRollupInstanceMap,
  buildRolledUpChartData,
  isExpandable,
} from "./rollup";
import {
  AGE_AT_DX_CLASS,
  AGE_SELECTION_MODE,
  FILTER_SORT_DIMENSION,
  FILTER_SORT_DIRECTION,
  buildAgeDecileChartData,
  buildAgeDecileInstanceMap,
  filterRowsByQuery,
  getFilterCustomSortOrder,
  getFilterDefaultSortMode,
  getFilterDisplayName,
  getFilterMaxHeightPx,
  getSortDimensionFromMode,
  getSortDirectionFromMode,
  isAttributeRollupClass,
  normalizeChartSortMode,
  normalizeInstanceValues,
  prettifyClassName,
  toChartData,
  toDisplayInstanceValue,
  toSortMode,
  withCompactCustomSortOrder,
  withCompactFilterLabels,
} from "./filters/filterDefinitions";
import { buildIdentifiedSummary, formatSelectionText } from "./filters/cohortNarrative";
import {
  buildActiveFilters,
  getFilterRowKey,
  getRowInstancesForClass,
  isSameFilterClass,
  resolveRequestFilters,
  syncExpandedParentsByClass,
  syncSelectionByClass,
  toFilterItem,
} from "./filters/filterRequest";
import {
  buildPatientSummaryFromFilterSummary,
  formatItemCount,
  formatMs,
  getZeroResultHint,
  normalizeCountResponse,
  normalizePatientIds,
  resolveDocumentCountFromPayload,
  transformSummaryToGridRow,
} from "./filters/patientSummaryNormalization";
import {
  FONT_FAMILY_OPTIONS,
  applyHighContrast,
  getInitialFontFamilyKey,
  getScaledCustomThemeValues,
} from "./filters/filterAppearance";

// Shared frozen empty array used as a stable fallback for per-card selection
// values. A fresh `[]` fallback would give each memoized card a new prop
// identity every render, defeating React.memo on HorizontalBarFilter.
const EMPTY_SELECTION = Object.freeze([]);

const SLOW_QUERY_THRESHOLD_MS = 100;
const PATIENT_GRID_DEFAULT_PAGE_SIZE = 10;
const PATIENT_GRID_MAXIMIZED_PAGE_SIZE = 40;
const INLINE_PATIENT_IDS_THRESHOLD = 20;
const FILTER_LAYOUT_MODE = {
  STACKED: "stacked",
  PER_CARD_COLUMN: "per-card-column",
};
const OPEN_DYSLEXIC_FONT_LINK_ID = "open-dyslexic-font-link";
const OPEN_DYSLEXIC_FONT_LINK_HREF = "https://fonts.cdnfonts.com/css/opendyslexic";
const SHOULD_LOG_FILTERS_PERF = process.env.NODE_ENV !== "production";
const DOCUMENT_COUNT_EXCLUDE_PROPERTIES = [
  "name",
  "type",
  "date",
  "episode",
  "text",
  "mentions",
  "mentionRelations",
  "sections",
];

function toRowCountCacheKey(rowRequestFilters = [], includePatientIds = false) {
  return `${includePatientIds ? "withPatientIds" : "withoutPatientIds"}|${JSON.stringify(rowRequestFilters)}`;
}

const REDUCED_MOTION_STYLES = (
  <GlobalStyles
    styles={{
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          transitionDuration: "0.01ms !important",
          animationDuration: "0.01ms !important",
          animationIterationCount: "1 !important",
        },
      },
    }}
  />
);

const TOGGLED_REDUCED_MOTION_STYLES = (
  <GlobalStyles
    styles={{
      "*, *::before, *::after": {
        transitionDuration: "0.01ms !important",
        animationDuration: "0.01ms !important",
        animationIterationCount: "1 !important",
      },
    }}
  />
);

function FiltersView() {
  const {
    themeKey,
    fontScale,
    highContrast,
    reducedMotion,
    filterPanelDensityMode,
    isCompactDensity,
    isCompactPlusDensity,
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
  } = useFilterPagePreferences();
  const [fontFamilyKey] = useState(getInitialFontFamilyKey);
  const {
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
  } = useThemeBuilderState({ themeKey, changeTheme });
  const selectedBaseTheme = useMemo(() => getThemeByKey(themeKey), [themeKey]);
  const activeThemeColorEntries = useMemo(() => collectThemeColorEntries(selectedBaseTheme), [selectedBaseTheme]);
  const activeThemeColorPatch = useMemo(
    () => buildThemeColorOverridePatch(activeThemeColorEntries, activeThemeColorOverrides),
    [activeThemeColorEntries, activeThemeColorOverrides]
  );
  const activeTheme = useMemo(() => {
    let theme = selectedBaseTheme;

    if (Object.keys(activeThemeColorPatch).length > 0) {
      theme = createTheme(theme, activeThemeColorPatch);
    }

    const selectedFontFamily = FONT_FAMILY_OPTIONS.find((option) => option.key === fontFamilyKey);

    if (selectedFontFamily?.stack) {
      theme = createTheme(theme, {
        typography: {
          fontFamily: selectedFontFamily.stack,
        },
      });
    }

    if (highContrast) {
      theme = applyHighContrast(theme);
    }

    if (fontScale !== 1) {
      theme = createTheme(theme, {
        custom: getScaledCustomThemeValues(theme.custom || {}, fontScale),
      });
    }

    return theme;
  }, [activeThemeColorPatch, fontFamilyKey, fontScale, highContrast, selectedBaseTheme]);
  const isSmUp = useMediaQuery(activeTheme.breakpoints.up("sm"), { noSsr: true });
  const isMdUp = useMediaQuery(activeTheme.breakpoints.up("md"), { noSsr: true });
  const isLgUp = useMediaQuery(activeTheme.breakpoints.up("lg"), { noSsr: true });
  const isXlUp = useMediaQuery(activeTheme.breakpoints.up("xl"), { noSsr: true });
  const resolvedSectionColumnCap = useMemo(
    () =>
      resolveResponsiveColumnCap(FILTER_SECTION_COLUMN_CAP_BY_BREAKPOINT, {
        isSmUp,
        isMdUp,
        isLgUp,
        isXlUp,
      }),
    [isLgUp, isMdUp, isSmUp, isXlUp]
  );
  // Measured width of the filter area, used to keep section lanes and filter
  // cards from subdividing into columns too narrow to read.
  const [filterAreaWidth, setFilterAreaWidth] = useState(0);
  const filterAreaResizeObserverRef = useRef(null);
  const registerFilterArea = useCallback((node) => {
    if (filterAreaResizeObserverRef.current) {
      filterAreaResizeObserverRef.current.disconnect();
      filterAreaResizeObserverRef.current = null;
    }
    if (node && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const nextWidth = Math.round(entries[0]?.contentRect?.width || 0);
        if (nextWidth > 0) {
          setFilterAreaWidth(nextWidth);
        }
      });
      observer.observe(node);
      filterAreaResizeObserverRef.current = observer;
    }
  }, []);

  const resolvedFilterSectionLayoutColumns = useMemo(
    () =>
      capColumnsByWidth(
        resolveResponsiveColumnCap(
          isCompactDensity ? FILTER_SECTION_LAYOUT_COLUMNS.compact : FILTER_SECTION_LAYOUT_COLUMNS.standard,
          {
            isSmUp,
            isMdUp,
            isLgUp,
            isXlUp,
          }
        ),
        filterAreaWidth,
        FILTER_SECTION_LANE_MIN_WIDTH_PX
      ),
    [filterAreaWidth, isCompactDensity, isLgUp, isMdUp, isSmUp, isXlUp]
  );
  const custom = useMemo(() => activeTheme.custom || {}, [activeTheme.custom]);
  const initialLoadStartRef = useRef(
    typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()
  );
  const pageLoadSpanRef = useRef(null);
  if (!pageLoadSpanRef.current) {
    pageLoadSpanRef.current = startSpan("page_load:FiltersView", "page_load", {
      route: "/filters",
    });
  }
  const hasLoggedInitialLoadRef = useRef(false);

  const handleThemeChange = useCallback(
    (event) => {
      const nextKey = String(event?.target?.value || "");
      if (nextKey === THEME_EDITOR_MENU_VALUE) {
        openThemeBuilder(themeKey);
        return;
      }
      changeTheme(nextKey);
    },
    [themeKey, changeTheme, openThemeBuilder]
  );

  const handleFontScaleChange = changeFontScale;
  const handleHighContrastToggle = toggleHighContrast;
  const handleReducedMotionToggle = toggleReducedMotion;
  const handleShowBarBehindDotsToggle = toggleShowBarBehindDots;
  const handleFilterPanelDensityModeChange = useCallback(
    (event) => {
      changeFilterPanelDensityMode(
        String(event?.target?.value || "")
          .trim()
          .toLowerCase()
      );
    },
    [changeFilterPanelDensityMode]
  );
  const handleStackGapChange = useCallback(
    (event) => {
      changeStackGapPx(Number(event?.target?.value));
    },
    [changeStackGapPx]
  );
  const handleSlackModeChange = useCallback(
    (event) => {
      changeSlackDistributionMode(String(event?.target?.value || ""));
    },
    [changeSlackDistributionMode]
  );
  const getOmopSummaryForFilters = useCallback(() => getOmopSummary({ includePatientIds: false }), []);
  const getAttributesSummaryForFilters = useCallback(() => getAttributesSummary({ includePatientIds: false }), []);
  const getConceptsSummaryForFilters = useCallback(() => getConceptsSummary({ includePatientIds: false }), []);
  const omopData = useBatchDataLoader(getOmopSummaryForFilters, "OMOP");
  const attributeData = useBatchDataLoader(getAttributesSummaryForFilters, "Attributes");
  const conceptData = useBatchDataLoader(getConceptsSummaryForFilters, "Concepts");
  // Dataset-wide total patient count, resolved once as the distinct union of
  // patient IDs across every OMOP class. The bar summaries are intentionally
  // loaded without patient IDs (for speed), so this is a dedicated one-shot
  // fetch. Every patient carries OMOP demographics (gender, age at diagnosis),
  // so the OMOP union covers the full corpus. `null` until resolved.
  const [totalPatientCount, setTotalPatientCount] = useState(null);
  const [selectedOmopValuesByClass, setSelectedOmopValuesByClass] = useState({});
  const [selectedAttributeValuesByClass, setSelectedAttributeValuesByClass] = useState({});
  const [selectedConceptValuesByClass, setSelectedConceptValuesByClass] = useState({});
  const [expandedParentsByClass, setExpandedParentsByClass] = useState({});
  const [omopSortModeByClass, setOmopSortModeByClass] = useState({});
  const [attributeSortModeByClass, setAttributeSortModeByClass] = useState({});
  const [conceptSortModeByClass, setConceptSortModeByClass] = useState({});
  const [activeFilterModal, setActiveFilterModal] = useState(null);
  const [activeFilterSearchQuery, setActiveFilterSearchQuery] = useState("");
  const ageAtDxSelectionMode = AGE_SELECTION_MODE.DECILE;
  const [countResult, setCountResult] = useState(null);
  const [includedCountByRowKey, setIncludedCountByRowKey] = useState({});
  const [includedPatientIdsByRowKey, setIncludedPatientIdsByRowKey] = useState({});
  const [, setIsInitialIncludedCountsReady] = useState(false);
  const includedPatientIdsByRowKeyRef = useRef({});
  const hasCompletedInitialIncludedCountsLoadRef = useRef(false);
  const [countError, setCountError] = useState("");
  const [isCountLoading, setIsCountLoading] = useState(false);
  const [currentPatientGridPage, setCurrentPatientGridPage] = useState(0);
  const [openPatientIds, setOpenPatientIds] = useState([]);
  const [activeDrawerTab, setActiveDrawerTab] = useState(0);
  const [patientGridPageCache, setPatientGridPageCache] = useState(() => new Map());
  const patientGridPageCacheRef = useRef(new Map());
  const [isPatientGridPageLoading, setIsPatientGridPageLoading] = useState(false);
  const [patientGridPageError, setPatientGridPageError] = useState("");
  const [patientGridPageRetryToken, setPatientGridPageRetryToken] = useState(0);
  const [isPatientGridDockExpanded, setIsPatientGridDockExpanded] = useState(true);
  const [isPatientGridDockMaximized, setIsPatientGridDockMaximized] = useState(false);
  const [filterLayoutMode, setFilterLayoutMode] = useState(FILTER_LAYOUT_MODE.PER_CARD_COLUMN);
  const isPerCardColumnLayout = filterLayoutMode === FILTER_LAYOUT_MODE.PER_CARD_COLUMN;
  const [cardNaturalHeightByKey, setCardNaturalHeightByKey] = useState({});
  // Unbounded natural content height per card — the chart's actual desired
  // height before the per-card height cap is applied. Used by the compact-plus
  // slack stretch to cap how far a card grows, so it never expands past its
  // own content (the cause of the "stretched card with whitespace below the
  // last row" bug). Stays in sync with cardNaturalHeightByKey: written in the
  // same useLayoutEffect, frozen by the same data-card-height-override guard.
  const [cardDesiredHeightByKey, setCardDesiredHeightByKey] = useState({});
  const cardMeasureRefs = useRef({});
  const patientSummaryCacheRef = useRef(new Map());
  const rowCountResultCacheRef = useRef(new Map());
  const markInitialIncludedCountsReady = useCallback(() => {
    if (hasCompletedInitialIncludedCountsLoadRef.current) {
      return;
    }

    hasCompletedInitialIncludedCountsLoadRef.current = true;
    setIsInitialIncludedCountsReady(true);
  }, []);

  useEffect(() => {
    if (fontFamilyKey !== "open-dyslexic" || typeof document === "undefined") {
      return;
    }

    if (!document.getElementById(OPEN_DYSLEXIC_FONT_LINK_ID)) {
      const linkElement = document.createElement("link");
      linkElement.id = OPEN_DYSLEXIC_FONT_LINK_ID;
      linkElement.rel = "stylesheet";
      linkElement.href = OPEN_DYSLEXIC_FONT_LINK_HREF;
      document.head.appendChild(linkElement);
    }
  }, [fontFamilyKey]);

  useEffect(() => {
    includedPatientIdsByRowKeyRef.current = includedPatientIdsByRowKey;
  }, [includedPatientIdsByRowKey]);

  useEffect(() => {
    if (!isPatientGridDockMaximized || typeof document === "undefined") {
      return undefined;
    }

    const panelId = `drawer-tabpanel-${activeDrawerTab}`;
    let frameId = null;

    const scrollPanelToTop = () => {
      const panelElement = document.getElementById(panelId);
      if (!panelElement) {
        return;
      }
      panelElement.scrollTop = 0;
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      frameId = window.requestAnimationFrame(scrollPanelToTop);
    } else {
      scrollPanelToTop();
    }

    return () => {
      if (frameId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [activeDrawerTab, isPatientGridDockMaximized]);

  useEffect(() => {
    if (hasLoggedInitialLoadRef.current) {
      return;
    }

    if (omopData.isLoading || attributeData.isLoading) {
      return;
    }

    hasLoggedInitialLoadRef.current = true;
    const loadEndTime =
      typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    if (pageLoadSpanRef.current) {
      endSpan(pageLoadSpanRef.current, "ok", {
        totalMs: Math.round(loadEndTime - initialLoadStartRef.current),
        omopClasses: omopData.classes.length,
        attributeClasses: attributeData.classes.length,
      });
      pageLoadSpanRef.current = null;
    }

    if (SHOULD_LOG_FILTERS_PERF) {
      logMilestone("Filters ready", Math.round(loadEndTime - initialLoadStartRef.current), {
        omopClasses: omopData.classes.length,
        attributeClasses: attributeData.classes.length,
        omopError: omopData.errorMessage || undefined,
        attributeError: attributeData.errorMessage || undefined,
      });
    }
  }, [
    attributeData.classes.length,
    attributeData.errorMessage,
    attributeData.isLoading,
    omopData.classes.length,
    omopData.errorMessage,
    omopData.isLoading,
  ]);

  const omopFilterSets = useMemo(
    () => resolveFilterSetsWithExtras(omopData.classes, "omop").filter((filterSet) => filterSet.display !== false),
    [omopData.classes]
  );
  const attributeConceptFilterSets = useMemo(
    () =>
      resolveFilterSetsForAttributesAndConcepts({
        attributes: attributeData.classes,
        concepts: conceptData.classes,
      }),
    [attributeData.classes, conceptData.classes]
  );
  const omopFilterSetById = useMemo(
    () => new Map(omopFilterSets.map((filterSet) => [filterSet.id, filterSet])),
    [omopFilterSets]
  );
  const cohortOverviewInlineAttributeFilterSets = useMemo(() => {
    return attributeConceptFilterSets.filter((filterSet) => String(filterSet?.row || "").trim() === "cohort-overview");
  }, [attributeConceptFilterSets]);
  const attributeConceptFilterSetsOutsideCohortOverview = useMemo(
    () => attributeConceptFilterSets.filter((filterSet) => String(filterSet?.row || "").trim() !== "cohort-overview"),
    [attributeConceptFilterSets]
  );
  const shouldInjectCohortOverviewAttributes = useMemo(
    () => Boolean(omopFilterSetById.get("cancer-type")) && cohortOverviewInlineAttributeFilterSets.length > 0,
    [cohortOverviewInlineAttributeFilterSets.length, omopFilterSetById]
  );
  const filterSectionsForDisplay = useMemo(() => {
    const nextSections = omopFilterSets.map((filterSet) => ({
      id: filterSet.id,
      kind: "omop",
      filterSet,
    }));

    const sectionIdsInCohortOverview = new Set(
      cohortOverviewInlineAttributeFilterSets.map((filterSet) => filterSet.id)
    );
    const attributeSections = shouldInjectCohortOverviewAttributes
      ? attributeConceptFilterSetsOutsideCohortOverview
      : attributeConceptFilterSets;

    attributeSections.forEach((filterSet) => {
      if (shouldInjectCohortOverviewAttributes && sectionIdsInCohortOverview.has(filterSet.id)) {
        return;
      }
      nextSections.push({
        id: filterSet.id,
        kind: "attributes",
        filterSet,
      });
    });

    return nextSections.sort((leftSection, rightSection) => {
      const priorityDelta = getFilterSetPriorityIndex(leftSection.id) - getFilterSetPriorityIndex(rightSection.id);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return String(leftSection.id || "").localeCompare(String(rightSection.id || ""));
    });
  }, [
    attributeConceptFilterSets,
    attributeConceptFilterSetsOutsideCohortOverview,
    cohortOverviewInlineAttributeFilterSets,
    omopFilterSets,
    shouldInjectCohortOverviewAttributes,
  ]);
  const orderedOmopClasses = useMemo(
    () => omopFilterSets.flatMap((filterSet) => filterSet.filters.map((filter) => filter.key)),
    [omopFilterSets]
  );
  const orderedAttributeFilterClasses = useMemo(
    () =>
      attributeConceptFilterSets.flatMap((filterSet) =>
        filterSet.filters.filter((f) => f.type === "attributes").map((f) => f.key)
      ),
    [attributeConceptFilterSets]
  );
  const orderedConceptClasses = useMemo(
    () =>
      attributeConceptFilterSets.flatMap((filterSet) =>
        filterSet.filters.filter((f) => f.type === "concepts").map((f) => f.key)
      ),
    [attributeConceptFilterSets]
  );
  const chartDataByClass = useMemo(() => {
    const next = {};
    orderedOmopClasses.forEach((className) => {
      next[className] = toChartData(omopData.summaryByClass[className], "omop", className);
    });
    return next;
  }, [orderedOmopClasses, omopData.summaryByClass]);
  const attributeChartDataByClass = useMemo(() => {
    const next = {};
    orderedAttributeFilterClasses.forEach((className) => {
      next[className] = toChartData(attributeData.summaryByClass[className], "attributes", className);
    });
    return next;
  }, [orderedAttributeFilterClasses, attributeData.summaryByClass]);
  const rolledUpChartDataByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];
      next[className] = isAttributeRollupClass(className) ? buildRolledUpChartData(classData, className) : classData;
    });

    return next;
  }, [attributeChartDataByClass, orderedAttributeFilterClasses]);
  const rollupInstanceMapByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];
      next[className] = isAttributeRollupClass(className) ? buildRollupInstanceMap(classData, className) : {};
    });

    return next;
  }, [attributeChartDataByClass, orderedAttributeFilterClasses]);
  const attributeDisplayChartDataByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeChartDataByClass[className] || [];

      if (!isAttributeRollupClass(className)) {
        next[className] = classData;
        return;
      }

      const rolledRows = rolledUpChartDataByClass[className] || [];
      const expandedParentSet = new Set(expandedParentsByClass[className] || []);
      const displayRows = [];

      rolledRows.forEach((row) => {
        const rowLabel = String(row?.label || "").trim();
        const rowIsExpandable = Boolean(row?._expandable);
        const rowIsExpanded = rowIsExpandable && expandedParentSet.has(rowLabel);

        displayRows.push({
          ...row,
          _isExpandedParent: rowIsExpanded,
        });

        if (!rowIsExpanded || !isExpandable(classData, className, rowLabel)) {
          return;
        }

        const childRows = buildChildChartData(classData, className, rowLabel);
        displayRows.push(...childRows);
      });

      next[className] = displayRows;
    });

    return next;
  }, [attributeChartDataByClass, expandedParentsByClass, orderedAttributeFilterClasses, rolledUpChartDataByClass]);
  const conceptChartDataByClass = useMemo(() => {
    const next = {};
    orderedConceptClasses.forEach((className) => {
      next[className] = toChartData(conceptData.summaryByClass[className], "concepts", className);
    });
    return next;
  }, [orderedConceptClasses, conceptData.summaryByClass]);
  const conceptDisplayChartDataByClass = useMemo(() => {
    const next = {};
    orderedConceptClasses.forEach((className) => {
      next[className] = conceptChartDataByClass[className] || [];
    });
    return next;
  }, [conceptChartDataByClass, orderedConceptClasses]);
  const ageAtDxClassName = useMemo(
    () => orderedOmopClasses.find((className) => normalizeClassName(className) === AGE_AT_DX_CLASS) || "",
    [orderedOmopClasses]
  );
  const ageAtDxRawChartData = useMemo(() => {
    if (!ageAtDxClassName) {
      return [];
    }
    return chartDataByClass[ageAtDxClassName] || [];
  }, [ageAtDxClassName, chartDataByClass]);
  const ageAtDxDecileChartData = useMemo(() => buildAgeDecileChartData(ageAtDxRawChartData), [ageAtDxRawChartData]);
  const ageDecileInstanceMap = useMemo(() => buildAgeDecileInstanceMap(ageAtDxRawChartData), [ageAtDxRawChartData]);
  const chartClassRows = useMemo(() => {
    const rows = [];

    orderedOmopClasses.forEach((className) => {
      const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
      const data =
        isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
          ? ageAtDxDecileChartData
          : chartDataByClass[className] || [];

      rows.push({
        type: "omop",
        className,
        data,
      });
    });

    orderedAttributeFilterClasses.forEach((className) => {
      rows.push({
        type: "attributes",
        className,
        data: attributeDisplayChartDataByClass[className] || [],
      });
    });

    orderedConceptClasses.forEach((className) => {
      rows.push({
        type: "concepts",
        className,
        data: conceptDisplayChartDataByClass[className] || [],
      });
    });

    return rows;
  }, [
    ageAtDxDecileChartData,
    ageAtDxSelectionMode,
    attributeDisplayChartDataByClass,
    chartDataByClass,
    conceptDisplayChartDataByClass,
    orderedAttributeFilterClasses,
    orderedConceptClasses,
    orderedOmopClasses,
  ]);
  const isLoading = omopData.isLoading;
  const isAttributeLoading = attributeData.isLoading;
  const isConceptLoading = conceptData.isLoading;
  const rootError = omopData.errorMessage;
  const attributeRootError = attributeData.errorMessage;
  const conceptRootError = conceptData.errorMessage;
  const hasDataErrors = !!(rootError || attributeRootError || conceptRootError);
  // Gate on whether all three batch loaders have completed — not on the async
  // per-row count pass (isInitialIncludedCountsReady). Waiting for the count
  // pass creates a window where the loading indicator disappears but the filter
  // sections haven't mounted yet, causing a visible blank flash. Showing
  // sections as soon as base data is loaded is strictly better: bars render
  // with total counts immediately, and included-count indicators appear once
  // `loadIncludedCounts` finishes its async work.
  const allBaseDataLoaded = !isLoading && !isAttributeLoading && !isConceptLoading;
  const shouldShowFilterLoadingState = !hasDataErrors && !allBaseDataLoaded;
  const canRenderFilterSections = !hasDataErrors && allBaseDataLoaded;
  const activeFilters = useMemo(
    () =>
      buildActiveFilters({
        selectedOmopValuesByClass,
        omopClasses: orderedOmopClasses,
        selectedAttributeValuesByClass,
        attributeClasses: orderedAttributeFilterClasses,
        selectedConceptValuesByClass,
        conceptClasses: orderedConceptClasses,
      }),
    [
      orderedAttributeFilterClasses,
      orderedConceptClasses,
      orderedOmopClasses,
      selectedAttributeValuesByClass,
      selectedConceptValuesByClass,
      selectedOmopValuesByClass,
    ]
  );
  const requestFilters = useMemo(
    () =>
      resolveRequestFilters({
        filters: activeFilters,
        ageAtDxSelectionMode,
        ageDecileInstanceMap,
        rollupInstanceMapByClass,
      }),
    [activeFilters, ageAtDxSelectionMode, ageDecileInstanceMap, rollupInstanceMapByClass]
  );
  const hasSelections = activeFilters.length > 0;
  const getPatientSummary = useCallback(async (patientId) => {
    const normalizedPatientId = String(patientId || "").trim();
    if (!normalizedPatientId) {
      return null;
    }

    const cache = patientSummaryCacheRef.current;
    if (cache.has(normalizedPatientId)) {
      return cache.get(normalizedPatientId);
    }

    const summaryPromise = (async () => {
      const summaryPayload = await fetchDeepPheFilterSummary([normalizedPatientId]).catch(() => []);
      const summary = buildPatientSummaryFromFilterSummary(summaryPayload, normalizedPatientId);
      if (summary.docCount > 0) {
        return summary;
      }

      const documentsPayload = await fetchPatientDocuments(normalizedPatientId, {
        excludeProperties: DOCUMENT_COUNT_EXCLUDE_PROPERTIES,
      }).catch(() => null);
      const resolvedDocCount = resolveDocumentCountFromPayload(documentsPayload);
      if (resolvedDocCount > 0) {
        return { ...summary, docCount: resolvedDocCount };
      }

      return summary;
    })();

    cache.set(normalizedPatientId, summaryPromise);
    return summaryPromise;
  }, []);

  useEffect(() => {
    let isActive = true;

    if (isLoading || isAttributeLoading || isConceptLoading) {
      return () => {
        isActive = false;
      };
    }

    const staticCountsByRowKey = {};
    const staticPatientIdsByRowKey = {};
    const countRequests = [];

    chartClassRows.forEach(({ type, className, data }) => {
      const classData = Array.isArray(data) ? data : [];
      const filtersExcludingClass = activeFilters.filter((filter) => !isSameFilterClass(filter, type, className));
      const shouldQueryIncludedCounts = hasSelections && filtersExcludingClass.length > 0;

      classData.forEach((row) => {
        const rowLabel = String(row?.label || "").trim();
        const rowTotalCount = Number(row?.value);
        if (!rowLabel || !Number.isFinite(rowTotalCount)) {
          return;
        }

        const rowKey = getFilterRowKey(type, className, rowLabel);
        const fallbackCount = Math.max(0, Math.round(rowTotalCount));
        const rowPatientIds = normalizeInstanceValues(row?.patientIds);
        const cachedRowPatientIds = normalizeInstanceValues(includedPatientIdsByRowKeyRef.current?.[rowKey]);
        const effectiveRowPatientIds = rowPatientIds.length > 0 ? rowPatientIds : cachedRowPatientIds;
        const shouldRequestPatientIdsForDots =
          fallbackCount > 0 &&
          fallbackCount <= INLINE_PATIENT_IDS_THRESHOLD &&
          effectiveRowPatientIds.length < fallbackCount;

        if (effectiveRowPatientIds.length > 0) {
          staticPatientIdsByRowKey[rowKey] = effectiveRowPatientIds;
        }

        const shouldQueueCountRequest = shouldQueryIncludedCounts || shouldRequestPatientIdsForDots;

        if (!shouldQueueCountRequest) {
          staticCountsByRowKey[rowKey] = fallbackCount;
          return;
        }

        const rowInstances = getRowInstancesForClass({
          type,
          className,
          rowLabel,
          ageAtDxSelectionMode,
          ageDecileInstanceMap,
          rollupInstanceMapByClass,
        });
        const rowFilter = toFilterItem(type, className, rowInstances);
        if (!rowFilter) {
          staticCountsByRowKey[rowKey] = 0;
          return;
        }

        const rowRequestFilters = resolveRequestFilters({
          filters: [...filtersExcludingClass, rowFilter],
          ageAtDxSelectionMode,
          ageDecileInstanceMap,
          rollupInstanceMapByClass,
        });

        if (rowRequestFilters.length === 0) {
          return;
        }

        countRequests.push({
          rowKey,
          rowRequestFilters,
          fallbackCount,
          includePatientIds: shouldRequestPatientIdsForDots,
        });
      });
    });

    setIncludedCountByRowKey((previousCountsByRowKey) => {
      const nextCountsByRowKey = { ...staticCountsByRowKey };

      countRequests.forEach(({ rowKey }) => {
        const previousCount = Number(previousCountsByRowKey?.[rowKey]);
        if (Number.isFinite(previousCount)) {
          nextCountsByRowKey[rowKey] = Math.max(0, Math.round(previousCount));
        }
      });

      return nextCountsByRowKey;
    });
    setIncludedPatientIdsByRowKey((previousPatientIdsByRowKey) => {
      const nextPatientIdsByRowKey = { ...staticPatientIdsByRowKey };

      countRequests.forEach(({ rowKey, includePatientIds }) => {
        if (!includePatientIds) {
          return;
        }

        const previousPatientIds = normalizeInstanceValues(previousPatientIdsByRowKey?.[rowKey]);
        if (previousPatientIds.length > 0) {
          nextPatientIdsByRowKey[rowKey] = previousPatientIds;
        }
      });

      return nextPatientIdsByRowKey;
    });

    if (countRequests.length > 0 && SHOULD_LOG_FILTERS_PERF) {
      logMilestone("Row counts queued", null, { requests: countRequests.length });
    }

    if (countRequests.length === 0) {
      markInitialIncludedCountsReady();
      return () => {
        isActive = false;
      };
    }

    const loadIncludedCounts = async () => {
      const includedCountsStartTime =
        typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      const nextCountsByRowKey = { ...staticCountsByRowKey };
      const nextPatientIdsByRowKey = { ...staticPatientIdsByRowKey };

      // Separate cached rows from those that need a network request.
      const cachedResults = [];
      const uncachedRequests = [];
      for (const request of countRequests) {
        const { rowRequestFilters, includePatientIds } = request;
        const cacheKey = toRowCountCacheKey(rowRequestFilters, includePatientIds);
        const cached = rowCountResultCacheRef.current.get(cacheKey);
        if (cached) {
          cachedResults.push({ request, payload: cached });
        } else {
          uncachedRequests.push({ request, cacheKey });
        }
      }

      // Apply cached results immediately.
      for (const { request, payload } of cachedResults) {
        const { rowKey, fallbackCount, includePatientIds } = request;
        const resolvedCount = payload.count;
        nextCountsByRowKey[rowKey] = Number.isFinite(resolvedCount)
          ? Math.max(0, Math.round(resolvedCount))
          : fallbackCount;
        if (includePatientIds) {
          const resolvedPatientIds = normalizeInstanceValues(payload.patientIds);
          if (resolvedPatientIds.length > 0) {
            nextPatientIdsByRowKey[rowKey] = resolvedPatientIds;
          }
        }
      }

      // Fetch uncached rows: attempt batch endpoint first, fall back to
      // a concurrency-limited pool of individual requests if batch fails.
      if (uncachedRequests.length > 0) {
        let batchFailed = false;
        let batchResults = null;

        try {
          const batchQueries = uncachedRequests.map(({ request }) => ({
            filters: request.rowRequestFilters,
            includePatientIds: request.includePatientIds,
          }));
          batchResults = await fetchDeepPheFilterCountBatch(batchQueries);
        } catch {
          batchFailed = true;
        }

        if (!batchFailed && Array.isArray(batchResults)) {
          // Process batch results positionally.
          batchResults.forEach((result, index) => {
            const { request, cacheKey } = uncachedRequests[index];
            const { rowKey, fallbackCount, includePatientIds } = request;
            try {
              const normalizedCountPayload = normalizeCountResponse(result);
              if (rowCountResultCacheRef.current.size >= 2000) {
                rowCountResultCacheRef.current.clear();
              }
              rowCountResultCacheRef.current.set(cacheKey, normalizedCountPayload);
              const resolvedCount = normalizedCountPayload.count;
              nextCountsByRowKey[rowKey] = Number.isFinite(resolvedCount)
                ? Math.max(0, Math.round(resolvedCount))
                : fallbackCount;
              if (includePatientIds) {
                const resolvedPatientIds = normalizeInstanceValues(normalizedCountPayload.patientIds);
                if (resolvedPatientIds.length > 0) {
                  nextPatientIdsByRowKey[rowKey] = resolvedPatientIds;
                }
              }
            } catch {
              nextCountsByRowKey[rowKey] = fallbackCount;
            }
          });
        } else {
          // Batch unavailable — fall back to concurrency-limited individual requests.
          const CONCURRENCY = 8;
          let index = 0;
          const runNext = async () => {
            while (index < uncachedRequests.length) {
              const current = uncachedRequests[index++];
              const { request, cacheKey } = current;
              const { rowKey, rowRequestFilters, fallbackCount, includePatientIds } = request;
              try {
                const normalizedCountPayload = normalizeCountResponse(
                  await fetchDeepPheFilterCount({ filters: rowRequestFilters, includePatientIds })
                );
                if (rowCountResultCacheRef.current.size >= 2000) {
                  rowCountResultCacheRef.current.clear();
                }
                rowCountResultCacheRef.current.set(cacheKey, normalizedCountPayload);
                const resolvedCount = normalizedCountPayload.count;
                nextCountsByRowKey[rowKey] = Number.isFinite(resolvedCount)
                  ? Math.max(0, Math.round(resolvedCount))
                  : fallbackCount;
                if (includePatientIds) {
                  const resolvedPatientIds = normalizeInstanceValues(normalizedCountPayload.patientIds);
                  if (resolvedPatientIds.length > 0) {
                    nextPatientIdsByRowKey[rowKey] = resolvedPatientIds;
                  }
                }
              } catch {
                nextCountsByRowKey[rowKey] = fallbackCount;
              }
            }
          };
          await Promise.all(Array.from({ length: Math.min(CONCURRENCY, uncachedRequests.length) }, runNext));
        }
      }

      if (isActive) {
        setIncludedCountByRowKey(nextCountsByRowKey);
        setIncludedPatientIdsByRowKey((previousPatientIdsByRowKey) => {
          const mergedPatientIdsByRowKey = { ...nextPatientIdsByRowKey };

          countRequests.forEach(({ rowKey, includePatientIds }) => {
            if (!includePatientIds) {
              return;
            }

            const resolvedPatientIds = normalizeInstanceValues(mergedPatientIdsByRowKey[rowKey]);
            if (resolvedPatientIds.length > 0) {
              return;
            }

            const previousPatientIds = normalizeInstanceValues(previousPatientIdsByRowKey?.[rowKey]);
            if (previousPatientIds.length > 0) {
              mergedPatientIdsByRowKey[rowKey] = previousPatientIds;
            }
          });

          return mergedPatientIdsByRowKey;
        });
        markInitialIncludedCountsReady();
        if (SHOULD_LOG_FILTERS_PERF) {
          logMilestone(
            "Row counts ready",
            Math.round(
              ((typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : Date.now()) -
                includedCountsStartTime) *
                100
            ) / 100,
            { requests: countRequests.length }
          );
        }
      }
    };

    loadIncludedCounts();

    return () => {
      isActive = false;
    };
  }, [
    activeFilters,
    ageAtDxSelectionMode,
    ageDecileInstanceMap,
    chartClassRows,
    hasSelections,
    isAttributeLoading,
    isConceptLoading,
    isLoading,
    markInitialIncludedCountsReady,
    rollupInstanceMapByClass,
  ]);

  useEffect(() => {
    setSelectedOmopValuesByClass((previousSelections) => syncSelectionByClass(previousSelections, orderedOmopClasses));
  }, [orderedOmopClasses]);
  useEffect(() => {
    setSelectedAttributeValuesByClass((previousSelections) =>
      syncSelectionByClass(previousSelections, orderedAttributeFilterClasses)
    );
  }, [orderedAttributeFilterClasses]);
  useEffect(() => {
    setExpandedParentsByClass((previousState) =>
      syncExpandedParentsByClass(previousState, orderedAttributeFilterClasses, rolledUpChartDataByClass)
    );
  }, [orderedAttributeFilterClasses, rolledUpChartDataByClass]);
  useEffect(() => {
    setOmopSortModeByClass((previousModes) => {
      const nextModes = {};
      orderedOmopClasses.forEach((className) => {
        nextModes[className] = normalizeChartSortMode(
          previousModes?.[className] || getFilterDefaultSortMode("omop", className)
        );
      });
      return nextModes;
    });
  }, [orderedOmopClasses]);
  useEffect(() => {
    setAttributeSortModeByClass((previousModes) => {
      const nextModes = {};
      orderedAttributeFilterClasses.forEach((className) => {
        nextModes[className] = normalizeChartSortMode(
          previousModes?.[className] || getFilterDefaultSortMode("attributes", className)
        );
      });
      return nextModes;
    });
  }, [orderedAttributeFilterClasses]);
  useEffect(() => {
    setSelectedConceptValuesByClass((previousSelections) =>
      syncSelectionByClass(previousSelections, orderedConceptClasses)
    );
  }, [orderedConceptClasses]);
  useEffect(() => {
    setConceptSortModeByClass((previousModes) => {
      const nextModes = {};
      orderedConceptClasses.forEach((className) => {
        nextModes[className] = normalizeChartSortMode(
          previousModes?.[className] || getFilterDefaultSortMode("concepts", className)
        );
      });
      return nextModes;
    });
  }, [orderedConceptClasses]);

  const getCardMeasureKey = (type, className) => `${type}:${className}`;
  // Stable per-key ref callbacks. Returning a fresh closure on every render
  // makes React detach (ref(null)) and re-attach the ref each render for every
  // card, churning cardMeasureRefs and re-running the measurement effect. The
  // ref deps (cardMeasureRefs) are stable, so caching by key is safe.
  const cardMeasureRefHandlers = useRef(new Map());
  const setCardMeasureRef = useCallback((type, className) => {
    const key = getCardMeasureKey(type, className);
    const cache = cardMeasureRefHandlers.current;
    if (!cache.has(key)) {
      cache.set(key, (node) => {
        if (node) {
          cardMeasureRefs.current[key] = node;
          return;
        }
        delete cardMeasureRefs.current[key];
      });
    }
    return cache.get(key);
  }, []);

  // Returns a referentially stable style/sx object: when a card re-renders with
  // an identical style payload (same geometry, theme, density) the previously
  // returned object reference is reused. This keeps the cardOuterStyle / cardSx
  // / contentAreaSx props of the memoized FilterSectionCard stable so the card
  // wrapper itself can bail out of re-rendering, not just the chart inside it.
  const stableStyleCache = useRef(new Map());
  const stabilizeStyle = useCallback((key, style) => {
    const cache = stableStyleCache.current;
    const signature = JSON.stringify(style);
    const existing = cache.get(key);
    if (existing && existing.signature === signature) {
      return existing.style;
    }
    cache.set(key, { signature, style });
    return style;
  }, []);

  useLayoutEffect(() => {
    const entries = Object.entries(cardMeasureRefs.current);
    if (entries.length === 0) {
      return undefined;
    }

    const nextHeights = {};
    const nextDesiredHeights = {};
    entries.forEach(([key, node]) => {
      // Capture the chart's true natural content height before any cap is
      // applied. The SVG's height attribute is intrinsic — it's computed by
      // HorizontalBarFilter from row count × row height + padding, independent
      // of container size. So we ALWAYS recompute desired here, even when the
      // card has data-card-height-override set. (Freezing desired risks
      // propagating a stale-and-inflated initial measurement forever.)
      // The per-card-column natural height freeze below stays — that one IS
      // container-sensitive and needs the freeze to avoid oscillation.
      const contentNode = node?.querySelector?.(".filter-card-content");
      const contentScrollHeight = Number(contentNode?.scrollHeight);
      const chartViewportNode = node?.querySelector?.(".horizontal-bar-filter-chart-viewport");
      const chartViewportClientHeight = Number(chartViewportNode?.clientHeight);
      const chartSvgNode = node?.querySelector?.(".horizontal-bar-filter-svg");
      const chartSvgHeight = Number(chartSvgNode?.getAttribute?.("height"));
      const computedStyles = typeof window !== "undefined" ? window.getComputedStyle(node) : null;
      const chartHeightCapValue = String(
        computedStyles?.getPropertyValue?.("--filter-card-chart-height-cap") || ""
      ).trim();
      const chartHeightCapPx = Number.parseFloat(chartHeightCapValue);
      const targetViewportHeight =
        Number.isFinite(chartSvgHeight) && chartSvgHeight > 0
          ? Number.isFinite(chartHeightCapPx) && chartHeightCapPx > 0
            ? Math.min(chartSvgHeight, chartHeightCapPx)
            : chartSvgHeight
          : 0;
      const chartHiddenOverflowHeight =
        Number.isFinite(targetViewportHeight) &&
        targetViewportHeight > 0 &&
        Number.isFinite(chartViewportClientHeight) &&
        chartViewportClientHeight > 0
          ? Math.max(0, targetViewportHeight - chartViewportClientHeight)
          : 0;
      const adjustedContentHeight =
        Number.isFinite(contentScrollHeight) && contentScrollHeight > 0
          ? contentScrollHeight + chartHiddenOverflowHeight
          : 0;
      // Desired height for the slack-stretch ceiling: use the chart SVG's true
      // intrinsic height (numRows * rowHeight + padding, as the chart itself
      // computes it) plus the card chrome (button + body padding above the
      // chart). This is the authoritative source — the SVG height attribute is
      // set by HorizontalBarFilter from its own data, unaffected by the card's
      // outer cap. We deliberately do NOT use chartHeightCapPx here, because
      // when desired > cap, that's exactly the case where we want to stretch.
      // Falls back to adjustedContentHeight when SVG metrics aren't available.
      const cardClientHeight = Number(node?.clientHeight) || 0;
      const cardChromeHeight =
        cardClientHeight > 0 && chartViewportClientHeight > 0
          ? Math.max(0, cardClientHeight - chartViewportClientHeight)
          : 0;
      const desiredHeight =
        Number.isFinite(chartSvgHeight) && chartSvgHeight > 0
          ? chartSvgHeight + cardChromeHeight
          : adjustedContentHeight;
      if (desiredHeight > 0) {
        nextDesiredHeights[key] = desiredHeight;
      }

      // Natural-height freeze: when the card has an explicit override, its
      // DOM-measured outer height reflects the forced size, not the natural
      // content size. Reusing it as the layout's "current effective height"
      // would oscillate (stretch sets size → measure reports stretched →
      // layout treats stretched as natural → recomputes differently → loop).
      // So preserve the previously stored natural height. Desired stays fresh.
      if (node?.hasAttribute?.("data-card-height-override")) {
        const previousHeight = Number(cardNaturalHeightByKey[key]);
        if (Number.isFinite(previousHeight) && previousHeight > 0) {
          nextHeights[key] = previousHeight;
        }
        return;
      }

      if (isPerCardColumnLayout) {
        const cardHeightCap = Number(node?.getAttribute?.("data-card-height-cap"));
        const boundedContentHeight =
          Number.isFinite(adjustedContentHeight) && adjustedContentHeight > 0
            ? Number.isFinite(cardHeightCap) && cardHeightCap > 0
              ? Math.min(adjustedContentHeight, cardHeightCap)
              : adjustedContentHeight
            : 0;
        if (boundedContentHeight > 0) {
          nextHeights[key] = boundedContentHeight;
          return;
        }
      }

      const rect = node?.getBoundingClientRect?.();
      const height = Number(rect?.height);
      if (Number.isFinite(height) && height > 0) {
        nextHeights[key] = height;
      }
    });

    setCardNaturalHeightByKey((previousHeights) => {
      const previousEntries = Object.entries(previousHeights);
      const nextEntries = Object.entries(nextHeights);
      if (previousEntries.length === nextEntries.length) {
        let hasDiff = false;
        for (const [key, value] of nextEntries) {
          const previousValue = Number(previousHeights[key]);
          if (!Number.isFinite(previousValue) || Math.abs(previousValue - value) > 1) {
            hasDiff = true;
            break;
          }
        }
        if (!hasDiff) {
          return previousHeights;
        }
      }
      return nextHeights;
    });

    setCardDesiredHeightByKey((previousDesired) => {
      const previousEntries = Object.entries(previousDesired);
      const nextEntries = Object.entries(nextDesiredHeights);
      if (previousEntries.length === nextEntries.length) {
        let hasDiff = false;
        for (const [key, value] of nextEntries) {
          const previousValue = Number(previousDesired[key]);
          if (!Number.isFinite(previousValue) || Math.abs(previousValue - value) > 1) {
            hasDiff = true;
            break;
          }
        }
        if (!hasDiff) {
          return previousDesired;
        }
      }
      return nextDesiredHeights;
    });

    return undefined;
  }, [
    ageAtDxDecileChartData,
    attributeConceptFilterSets,
    attributeDisplayChartDataByClass,
    cardNaturalHeightByKey,
    chartDataByClass,
    conceptDisplayChartDataByClass,
    isPerCardColumnLayout,
    omopFilterSets,
  ]);

  useEffect(() => {
    let isActive = true;

    if (!hasSelections) {
      setCountResult(null);
      setCountError("");
      setIsCountLoading(false);
      setCurrentPatientGridPage(0);
      patientGridPageCacheRef.current = new Map();
      setPatientGridPageCache(new Map());
      setPatientGridPageError("");
      setIsPatientGridPageLoading(false);
      return () => {
        isActive = false;
      };
    }

    // Keep the current cohort and patient grid visible while the new count
    // loads — do NOT clear countResult / the page cache up front. The
    // result-driven effects below reset the page + cache only when the resolved
    // patient set actually changes (patientIdsForResultKey), so re-selecting a
    // filter value that returns the same patients no longer blanks/reloads the
    // table. On count failure the catch block clears the cohort.
    setIsCountLoading(true);
    setCountError("");

    const loadCount = async () => {
      const filterSpan = startSpan("filter_query", "filter_query", {
        filterCount: requestFilters?.length ?? 0,
        includePatientIds: false,
      });

      try {
        let nextResult = normalizeCountResponse(
          await fetchDeepPheFilterCount({
            filters: requestFilters,
            includePatientIds: false,
          })
        );

        const shouldAutoResolvePatientIds = nextResult.count > 0 && nextResult.patientIds.length === 0;

        if (shouldAutoResolvePatientIds) {
          nextResult = normalizeCountResponse(
            await fetchDeepPheFilterCount({
              filters: requestFilters,
              includePatientIds: true,
            })
          );
        }

        const successMeta = {
          resultCount: nextResult.count,
          queryMs: nextResult.timing?.queryMs,
          bitmapMs: nextResult.timing?.bitmapMs,
          resolveMs: nextResult.timing?.resolveMs,
          totalMs: nextResult.timing?.totalMs,
        };

        if (!isActive) {
          endSpan(filterSpan, "cancelled", successMeta);
          return;
        }
        endSpan(filterSpan, "ok", successMeta);
        if (SHOULD_LOG_FILTERS_PERF) {
          logMilestone("Filter query", successMeta.totalMs, { count: successMeta.resultCount });
        }
        setCountResult(nextResult);
      } catch (error) {
        if (!isActive) {
          endSpan(filterSpan, "cancelled", { errorMessage: error?.message || "" });
          return;
        }
        endSpan(filterSpan, "error", { errorMessage: error?.message || "" });
        setCountResult(null);
        setCountError(error?.message || "Failed to fetch filter count.");
      } finally {
        if (isActive) {
          setIsCountLoading(false);
        }
      }
    };

    loadCount();

    return () => {
      isActive = false;
    };
  }, [hasSelections, requestFilters]);

  useEffect(() => {
    let isActive = true;

    const collectPatientIds = (rawValue, into) => {
      if (Array.isArray(rawValue)) {
        rawValue.forEach((id) => {
          const trimmed = String(id ?? "").trim();
          if (trimmed) {
            into.add(trimmed);
          }
        });
        return;
      }
      if (typeof rawValue === "string") {
        rawValue
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .forEach((id) => into.add(id));
        return;
      }
      if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
        const trimmed = String(rawValue).trim();
        if (trimmed) {
          into.add(trimmed);
        }
      }
    };

    const loadTotalPatientCount = async () => {
      try {
        const summary = await getOmopSummary({ includePatientIds: true });
        if (!isActive) {
          return;
        }
        const instancesByClass = summary?.instancesByClass || {};
        const distinctPatientIds = new Set();
        Object.values(instancesByClass).forEach((rows) => {
          (Array.isArray(rows) ? rows : []).forEach((row) => {
            collectPatientIds(
              row?.patientIds ?? row?.patient_ids ?? row?.patientId ?? row?.patient_id,
              distinctPatientIds
            );
          });
        });
        setTotalPatientCount(distinctPatientIds.size);
      } catch (error) {
        if (isActive) {
          // Leave the total unresolved rather than showing a wrong number.
          setTotalPatientCount(null);
        }
      }
    };

    loadTotalPatientCount();

    return () => {
      isActive = false;
    };
  }, []);

  const timing = useMemo(() => countResult?.timing || {}, [countResult?.timing]);
  const isSlowQuery = Number(timing.totalMs || 0) > SLOW_QUERY_THRESHOLD_MS;
  const zeroResultHint = countResult?.count === 0 ? getZeroResultHint(activeFilters, timing.itemCounts) : "";
  const identifiedSummary = useMemo(
    () => buildIdentifiedSummary(activeFilters, countResult?.count),
    [activeFilters, countResult?.count]
  );
  const cohortSize = Number(countResult?.count || 0);
  const patientGridPageSize = isPatientGridDockMaximized
    ? PATIENT_GRID_MAXIMIZED_PAGE_SIZE
    : PATIENT_GRID_DEFAULT_PAGE_SIZE;
  const stablePatientIdsRef = useRef([]);
  const patientIdsForResult = useMemo(() => {
    const next = normalizePatientIds(countResult?.patientIds);
    const prev = stablePatientIdsRef.current;
    // normalizePatientIds returns a sorted, de-duped list, so an identical
    // selected-patient set yields an equal array. Keep the previous reference in
    // that case so downstream memos/effects (and the patient grid) don't churn
    // when a new filter value doesn't actually change the cohort.
    if (prev.length === next.length && prev.every((id, index) => id === next[index])) {
      return prev;
    }
    stablePatientIdsRef.current = next;
    return next;
  }, [countResult?.patientIds]);
  const patientIdsForResultKey = useMemo(() => patientIdsForResult.join(","), [patientIdsForResult]);
  const totalPatientGridPages = useMemo(
    () => Math.ceil(patientIdsForResult.length / patientGridPageSize),
    [patientGridPageSize, patientIdsForResult.length]
  );
  const currentPatientGridPageIds = useMemo(() => {
    if (cohortSize <= 0) {
      return [];
    }

    const startIndex = currentPatientGridPage * patientGridPageSize;
    const endIndex = Math.min(startIndex + patientGridPageSize, patientIdsForResult.length);

    return patientIdsForResult.slice(startIndex, endIndex);
  }, [cohortSize, currentPatientGridPage, patientGridPageSize, patientIdsForResult]);
  const patientGridRows = useMemo(
    () => patientGridPageCache.get(currentPatientGridPage) || [],
    [currentPatientGridPage, patientGridPageCache]
  );
  const shouldShowPatientDetailGrid = Boolean(countResult);
  const isPatientGridDockVisible = Boolean(
    // Open patient document views (e.g. opened by clicking a patient dot) keep the
    // drawer visible even when no filters are selected.
    openPatientIds.length > 0 ||
      (hasSelections &&
        (isCountLoading || Boolean(countResult) || Boolean(countError) || patientGridPageCache.size > 0))
  );
  const patientGridDrawerPanelId = "patient-grid-drawer-panel";
  const patientGridDrawerStatusText = isPatientGridPageLoading
    ? "Updating matched patients…"
    : cohortSize > 0
    ? `Showing page ${(currentPatientGridPage + 1).toLocaleString()} of ${Math.max(
        1,
        totalPatientGridPages
      ).toLocaleString()} · ${cohortSize.toLocaleString()} matched patient${cohortSize === 1 ? "" : "s"}.`
    : "No matched patients.";
  const patientGridDrawerFilterSummaryText = useMemo(() => {
    if (activeFilters.length === 0) {
      return "";
    }

    return activeFilters
      .map((filter) => {
        const classLabel = getFilterDisplayName(filter.type, filter.class);
        const selectedValues = formatSelectionText(
          filter.instances.map((value) => toDisplayInstanceValue(filter.type, filter.class, value))
        );
        return `${classLabel} (${selectedValues})`;
      })
      .join(", ");
  }, [activeFilters]);
  const patientGridCollapsedHeaderSummary = useMemo(() => {
    const hasFilterSummaries = activeFilters.length > 0;
    const hasPerfSummary = SHOULD_LOG_FILTERS_PERF && Boolean(countResult);
    const showSlowWarning = false;
    const hasSlowWarning = Boolean(countResult) && isSlowQuery;
    const shouldShowSlowWarning = hasSlowWarning && showSlowWarning;
    const hasZeroHint = Boolean(countResult) && Boolean(zeroResultHint);
    const hasIdentifiedSummary = Boolean(countResult && identifiedSummary);
    const hasStatusCopy =
      isCountLoading ||
      Boolean(countError) ||
      hasIdentifiedSummary ||
      hasFilterSummaries ||
      shouldShowSlowWarning ||
      hasZeroHint ||
      hasPerfSummary;

    if (!hasStatusCopy) {
      return null;
    }

    return (
      <Stack spacing={0.75}>
        {isCountLoading ? (
          <Typography variant="body2" color="text.secondary">
            Querying patient count...
          </Typography>
        ) : null}
        {countError ? <Alert severity="error">{countError}</Alert> : null}
        {hasIdentifiedSummary ? (
          <Typography variant="body2" color="text.secondary">
            {identifiedSummary}
          </Typography>
        ) : null}
        {hasFilterSummaries ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {activeFilters.map((filter, index) => (
              <Box
                key={`${filter.class}-${index}`}
                sx={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 0.75,
                  px: 0.75,
                  py: 0.3,
                  border: custom.chipInactiveBorder || "1px solid",
                  borderColor: custom.chipInactiveBorder ? undefined : "divider",
                  borderRadius: custom.chipRadius || "4px",
                  bgcolor: custom.chipActiveBg || "grey.50",
                  color: custom.chipActiveText || "text.primary",
                  boxShadow: custom.chipActiveGlow || "none",
                  maxWidth: "100%",
                  transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                }}
              >
                <Typography variant="body2" sx={{ color: "inherit", opacity: 0.9 }}>
                  {prettifyClassName(filter.class, filter.type)} (
                  {formatSelectionText(
                    filter.instances.map((value) => toDisplayInstanceValue(filter.type, filter.class, value))
                  )}
                  )
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    color: "inherit",
                    fontFamily: custom.countFontFamily || "inherit",
                  }}
                >
                  {formatItemCount(timing.itemCounts?.[index])}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}
        {shouldShowSlowWarning ? (
          <Alert severity="warning">
            Query took {formatMs(timing.totalMs)} ms. Consider narrowing selections for faster response.
          </Alert>
        ) : null}
        {hasZeroHint ? <Alert severity="info">{zeroResultHint}</Alert> : null}
        {hasPerfSummary ? (
          <Typography
            variant="caption"
            sx={{
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              color: custom.statsColor || "text.secondary",
              fontFamily: custom.countFontFamily || "inherit",
              pt: 0.25,
            }}
          >
            Query {formatMs(timing.queryMs)} ms | Bitmap {formatMs(timing.bitmapMs)} ms | Resolve{" "}
            {formatMs(timing.resolveMs)} ms | Total {formatMs(timing.totalMs)} ms
          </Typography>
        ) : null}
      </Stack>
    );
  }, [
    activeFilters,
    countError,
    countResult,
    custom,
    identifiedSummary,
    isCountLoading,
    isSlowQuery,
    timing,
    zeroResultHint,
  ]);
  const patientGridDrawerBottomPadding = isPatientGridDockVisible
    ? {
        xs: isPatientGridDockMaximized ? "calc(100vh - 96px)" : isPatientGridDockExpanded ? "68vh" : "104px",
        md: isPatientGridDockMaximized
          ? "calc(100vh - 124px)"
          : isPatientGridDockExpanded
          ? "min(78vh, 820px)"
          : "116px",
      }
    : 0;
  // Drive the table's loading from the patient-set page fetch only, not the
  // count request: isPatientGridPageLoading is keyed on the sorted cohort
  // (patientIdsForResultKey), so the grid reloads only when the selected-patient
  // set actually changes — not on every filter count that returns the same set.
  const patientGridDrawerTableLoading = isPatientGridPageLoading;

  useEffect(() => {
    setCurrentPatientGridPage(0);
    patientGridPageCacheRef.current = new Map();
    setPatientGridPageCache(new Map());
    setPatientGridPageError("");
    setIsPatientGridPageLoading(false);
  }, [patientGridPageSize, patientIdsForResultKey, shouldShowPatientDetailGrid]);

  useEffect(() => {
    if (totalPatientGridPages <= 0) {
      return;
    }

    if (currentPatientGridPage >= totalPatientGridPages) {
      setCurrentPatientGridPage(Math.max(0, totalPatientGridPages - 1));
    }
  }, [currentPatientGridPage, totalPatientGridPages]);

  useEffect(() => {
    let isActive = true;

    if (!shouldShowPatientDetailGrid || cohortSize <= 0) {
      setIsPatientGridPageLoading(false);
      setPatientGridPageError("");
      return () => {
        isActive = false;
      };
    }

    if (currentPatientGridPageIds.length === 0) {
      setIsPatientGridPageLoading(false);
      setPatientGridPageError("Failed to load patient details.");
      return () => {
        isActive = false;
      };
    }

    if (patientGridPageCacheRef.current.has(currentPatientGridPage)) {
      setIsPatientGridPageLoading(false);
      setPatientGridPageError("");
      return () => {
        isActive = false;
      };
    }

    setIsPatientGridPageLoading(true);
    setPatientGridPageError("");

    const loadPatientPage = async () => {
      const pageLoadStartTime =
        typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      try {
        const fetchStartTime =
          typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
        const summaryPayload = await fetchDeepPheFilterSummary(currentPatientGridPageIds);
        const fetchMs =
          Math.round(
            ((typeof performance !== "undefined" && typeof performance.now === "function"
              ? performance.now()
              : Date.now()) -
              fetchStartTime) *
              100
          ) / 100;
        const summaryRowsRaw = Array.isArray(summaryPayload)
          ? summaryPayload
          : Array.isArray(summaryPayload?.data)
          ? summaryPayload.data
          : Array.isArray(summaryPayload?.summaries)
          ? summaryPayload.summaries
          : [];
        const pageRows = summaryRowsRaw
          .map(transformSummaryToGridRow)
          .filter((row) => row.patientId)
          .sort((leftRow, rightRow) =>
            String(leftRow.patientId).localeCompare(String(rightRow.patientId), undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );

        if (!isActive) {
          return;
        }

        patientGridPageCacheRef.current.set(currentPatientGridPage, pageRows);
        setPatientGridPageCache((previousCache) => {
          const nextCache = new Map(previousCache);
          nextCache.set(currentPatientGridPage, pageRows);
          return nextCache;
        });
        if (SHOULD_LOG_FILTERS_PERF) {
          logMilestone(
            "Patient grid page loaded",
            Math.round(
              ((typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : Date.now()) -
                pageLoadStartTime) *
                100
            ) / 100,
            {
              page: currentPatientGridPage + 1,
              patients: pageRows.length,
              fetchMs,
            }
          );
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setPatientGridPageError(error?.message || "Failed to load patient details.");
      } finally {
        if (isActive) {
          setIsPatientGridPageLoading(false);
        }
      }
    };

    loadPatientPage();

    return () => {
      isActive = false;
    };
  }, [
    cohortSize,
    currentPatientGridPage,
    currentPatientGridPageIds,
    patientGridPageRetryToken,
    shouldShowPatientDetailGrid,
  ]);

  const handleRetryPatientSummary = useCallback(() => {
    patientGridPageCacheRef.current.delete(currentPatientGridPage);
    setPatientGridPageCache((previousCache) => {
      const nextCache = new Map(previousCache);
      nextCache.delete(currentPatientGridPage);
      return nextCache;
    });
    setPatientGridPageRetryToken((previous) => previous + 1);
  }, [currentPatientGridPage]);

  const MAX_OPEN_PATIENT_TABS = 5;

  const handleOpenPatientTab = useCallback(
    (patientId) => {
      const normalizedId = String(patientId || "").trim();
      if (!normalizedId) return;

      setOpenPatientIds((previous) => {
        const existingIndex = previous.indexOf(normalizedId);
        if (existingIndex !== -1) {
          setActiveDrawerTab(existingIndex + 1);
          return previous;
        }

        const next = [...previous, normalizedId].slice(-MAX_OPEN_PATIENT_TABS);
        setActiveDrawerTab(next.length);
        return next;
      });

      setIsPatientGridDockExpanded(true);
    },
    [MAX_OPEN_PATIENT_TABS]
  );

  const handleClosePatientTab = useCallback((patientId, event) => {
    event.stopPropagation();
    setOpenPatientIds((previous) => {
      const index = previous.indexOf(patientId);
      if (index === -1) {
        return previous;
      }
      const next = previous.filter((id) => id !== patientId);

      setActiveDrawerTab((previousTab) => {
        const closingTabIndex = index + 1;
        if (previousTab === closingTabIndex) {
          return Math.max(0, closingTabIndex - 1);
        }
        if (previousTab > closingTabIndex) {
          return previousTab - 1;
        }
        return previousTab;
      });

      return next;
    });
  }, []);

  const omopChartDataWithIncludedByClass = useMemo(() => {
    const next = {};

    orderedOmopClasses.forEach((className) => {
      const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
      const classData =
        isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
          ? ageAtDxDecileChartData
          : chartDataByClass[className] || [];

      next[className] = classData.map((row) => {
        const rowKey = getFilterRowKey("omop", className, String(row?.label || "").trim());
        const includedPatientIds = normalizeInstanceValues(includedPatientIdsByRowKey[rowKey]);

        return {
          ...row,
          // The included/total fraction in the count label is only meaningful
          // once a filter narrows the cohort. Before any selection, leave it
          // undefined so the row shows its plain count. (Included-count requests
          // still run at startup to resolve patient dots — we just don't surface
          // them as a numerator/denominator yet.)
          includedValue: hasSelections ? includedCountByRowKey[rowKey] : undefined,
          patientIds: includedPatientIds.length > 0 ? includedPatientIds : normalizeInstanceValues(row?.patientIds),
        };
      });
    });

    return next;
  }, [
    ageAtDxDecileChartData,
    ageAtDxSelectionMode,
    chartDataByClass,
    hasSelections,
    includedCountByRowKey,
    includedPatientIdsByRowKey,
    orderedOmopClasses,
  ]);
  const attributeChartDataWithIncludedByClass = useMemo(() => {
    const next = {};

    orderedAttributeFilterClasses.forEach((className) => {
      const classData = attributeDisplayChartDataByClass[className] || [];
      next[className] = classData.map((row) => {
        const rowKey = getFilterRowKey("attributes", className, String(row?.label || "").trim());
        const includedPatientIds = normalizeInstanceValues(includedPatientIdsByRowKey[rowKey]);

        return {
          ...row,
          includedValue: hasSelections ? includedCountByRowKey[rowKey] : undefined,
          patientIds: includedPatientIds.length > 0 ? includedPatientIds : normalizeInstanceValues(row?.patientIds),
        };
      });
    });

    return next;
  }, [
    attributeDisplayChartDataByClass,
    hasSelections,
    includedCountByRowKey,
    includedPatientIdsByRowKey,
    orderedAttributeFilterClasses,
  ]);
  const conceptChartDataWithIncludedByClass = useMemo(() => {
    const next = {};

    orderedConceptClasses.forEach((className) => {
      const classData = conceptDisplayChartDataByClass[className] || [];
      next[className] = classData.map((row) => {
        const rowKey = getFilterRowKey("concepts", className, String(row?.label || "").trim());
        const includedPatientIds = normalizeInstanceValues(includedPatientIdsByRowKey[rowKey]);

        return {
          ...row,
          includedValue: hasSelections ? includedCountByRowKey[rowKey] : undefined,
          patientIds: includedPatientIds.length > 0 ? includedPatientIds : normalizeInstanceValues(row?.patientIds),
        };
      });
    });

    return next;
  }, [
    conceptDisplayChartDataByClass,
    hasSelections,
    includedCountByRowKey,
    includedPatientIdsByRowKey,
    orderedConceptClasses,
  ]);
  const getChartDataForDensity = useCallback(
    (rows, filterType, className) => withCompactFilterLabels(rows, filterType, className, isCompactDensity),
    [isCompactDensity]
  );
  const getCustomSortOrderForDensity = useCallback(
    (filterType, className) =>
      withCompactCustomSortOrder(
        getFilterCustomSortOrder(filterType, className),
        filterType,
        className,
        isCompactDensity
      ),
    [isCompactDensity]
  );
  // Selection-change handlers are cached per (setter, className) so each filter
  // card receives a stable callback identity across renders. State setters from
  // useState are themselves stable, so the cached closures never go stale. This
  // is what lets the memoized FilterSectionCard / HorizontalBarFilter skip
  // re-rendering when only an unrelated part of FiltersView state changes.
  const selectionChangeHandlers = useRef(new Map());
  const handleSelectionChange = useCallback((setter, className) => {
    let byClass = selectionChangeHandlers.current.get(setter);
    if (!byClass) {
      byClass = new Map();
      selectionChangeHandlers.current.set(setter, byClass);
    }
    if (!byClass.has(className)) {
      byClass.set(className, (nextValues) => {
        const normalizedValues = Array.isArray(nextValues)
          ? [...new Set(nextValues.map((value) => String(value || "").trim()).filter(Boolean))]
          : [];
        setter((previousSelections) => ({
          ...previousSelections,
          [className]: normalizedValues,
        }));
      });
    }
    return byClass.get(className);
  }, []);
  const attributeExpansionHandlers = useRef(new Map());
  const handleAttributeParentExpansionChange = useCallback((className) => {
    const cache = attributeExpansionHandlers.current;
    if (!cache.has(className)) {
      cache.set(className, (rowLabel, nextExpanded, row) => {
        if (!isAttributeRollupClass(className)) {
          return;
        }

        const parentKey = String(row?.label || rowLabel || "").trim();
        const isRowExpandable = Boolean(row?._expandable || row?.isExpandable);
        if (!parentKey || !isRowExpandable) {
          return;
        }

        setExpandedParentsByClass((previousState) => {
          const existingParents = new Set(previousState?.[className] || []);
          if (nextExpanded) {
            existingParents.add(parentKey);
          } else {
            existingParents.delete(parentKey);
          }

          return {
            ...previousState,
            [className]: [...existingParents],
          };
        });
      });
    }
    return cache.get(className);
  }, []);
  const setFilterSortMode = useCallback((filterType, className, nextSortMode) => {
    const normalizedType = String(filterType || "").toLowerCase();
    const normalizedSortMode = normalizeChartSortMode(nextSortMode);

    const setter =
      normalizedType === "attributes"
        ? setAttributeSortModeByClass
        : normalizedType === "concepts"
        ? setConceptSortModeByClass
        : setOmopSortModeByClass;

    setter((previousModes) => {
      if (previousModes?.[className] === normalizedSortMode) {
        return previousModes;
      }
      return {
        ...previousModes,
        [className]: normalizedSortMode,
      };
    });
  }, []);
  const handleOpenFilterModal = useCallback((filterType, className, classDisplayName) => {
    const normalizedType = String(filterType || "omop").toLowerCase();
    setActiveFilterModal({
      type: normalizedType === "attributes" ? "attributes" : normalizedType === "concepts" ? "concepts" : "omop",
      className,
      classDisplayName: String(classDisplayName || className || "").trim() || String(className || ""),
    });
    setActiveFilterSearchQuery("");
  }, []);
  const handleCloseFilterModal = useCallback(() => {
    setActiveFilterModal(null);
    setActiveFilterSearchQuery("");
  }, []);
  const activeFilterDetail = useMemo(() => {
    if (!activeFilterModal?.className) {
      return null;
    }

    const { type, className, classDisplayName } = activeFilterModal;
    const rawType = String(type || "").toLowerCase();
    const normalizedType = rawType === "attributes" ? "attributes" : rawType === "concepts" ? "concepts" : "omop";
    const chartData =
      normalizedType === "attributes"
        ? attributeChartDataWithIncludedByClass[className] || attributeDisplayChartDataByClass[className] || []
        : normalizedType === "concepts"
        ? conceptChartDataWithIncludedByClass[className] || conceptDisplayChartDataByClass[className] || []
        : omopChartDataWithIncludedByClass[className] || chartDataByClass[className] || [];
    const selectedValues =
      normalizedType === "attributes"
        ? selectedAttributeValuesByClass[className] || []
        : normalizedType === "concepts"
        ? selectedConceptValuesByClass[className] || []
        : selectedOmopValuesByClass[className] || [];
    const sortModeByClass =
      normalizedType === "attributes"
        ? attributeSortModeByClass
        : normalizedType === "concepts"
        ? conceptSortModeByClass
        : omopSortModeByClass;
    const classError =
      normalizedType === "attributes"
        ? attributeData.errorsByClass[className] || ""
        : normalizedType === "concepts"
        ? conceptData.errorsByClass[className] || ""
        : omopData.errorsByClass[className] || "";
    const sortMode = sortModeByClass[className] || getFilterDefaultSortMode(normalizedType, className);

    return {
      type: normalizedType,
      className,
      classDisplayName,
      chartData: getChartDataForDensity(Array.isArray(chartData) ? chartData : [], normalizedType, className),
      selectedValues,
      classError,
      sortMode,
    };
  }, [
    activeFilterModal,
    attributeChartDataWithIncludedByClass,
    attributeData.errorsByClass,
    attributeDisplayChartDataByClass,
    attributeSortModeByClass,
    chartDataByClass,
    conceptChartDataWithIncludedByClass,
    conceptData.errorsByClass,
    conceptDisplayChartDataByClass,
    conceptSortModeByClass,
    getChartDataForDensity,
    omopChartDataWithIncludedByClass,
    omopData.errorsByClass,
    omopSortModeByClass,
    selectedAttributeValuesByClass,
    selectedConceptValuesByClass,
    selectedOmopValuesByClass,
  ]);
  const activeFilterSortDimension = useMemo(
    () => getSortDimensionFromMode(activeFilterDetail?.sortMode),
    [activeFilterDetail?.sortMode]
  );
  const activeFilterSortDirection = useMemo(
    () => getSortDirectionFromMode(activeFilterDetail?.sortMode),
    [activeFilterDetail?.sortMode]
  );
  const filteredModalChartData = useMemo(
    () => filterRowsByQuery(activeFilterDetail?.chartData, activeFilterSearchQuery),
    [activeFilterDetail?.chartData, activeFilterSearchQuery]
  );
  const handleModalSortDimensionChange = useCallback(
    (event) => {
      if (!activeFilterDetail) {
        return;
      }

      const requestedDimension = String(event?.target?.value || "")
        .trim()
        .toLowerCase();
      const nextDimension =
        requestedDimension === FILTER_SORT_DIMENSION.LABEL ? FILTER_SORT_DIMENSION.LABEL : FILTER_SORT_DIMENSION.COUNT;
      const nextSortMode = toSortMode(nextDimension, activeFilterSortDirection);
      setFilterSortMode(activeFilterDetail.type, activeFilterDetail.className, nextSortMode);
    },
    [activeFilterDetail, activeFilterSortDirection, setFilterSortMode]
  );
  const handleModalSortDirectionToggle = useCallback(() => {
    if (!activeFilterDetail) {
      return;
    }

    const nextDirection =
      activeFilterSortDirection === FILTER_SORT_DIRECTION.ASC ? FILTER_SORT_DIRECTION.DESC : FILTER_SORT_DIRECTION.ASC;
    const nextSortMode = toSortMode(activeFilterSortDimension, nextDirection);
    setFilterSortMode(activeFilterDetail.type, activeFilterDetail.className, nextSortMode);
  }, [activeFilterDetail, activeFilterSortDimension, activeFilterSortDirection, setFilterSortMode]);
  const handleResetAllFilters = useCallback(() => {
    setSelectedOmopValuesByClass(syncSelectionByClass({}, orderedOmopClasses));
    setSelectedAttributeValuesByClass(syncSelectionByClass({}, orderedAttributeFilterClasses));
    setSelectedConceptValuesByClass(syncSelectionByClass({}, orderedConceptClasses));
    setExpandedParentsByClass(syncExpandedParentsByClass({}, orderedAttributeFilterClasses, rolledUpChartDataByClass));

    const nextOmopSortModes = {};
    orderedOmopClasses.forEach((className) => {
      nextOmopSortModes[className] = getFilterDefaultSortMode("omop", className);
    });
    setOmopSortModeByClass(nextOmopSortModes);

    const nextAttributeSortModes = {};
    orderedAttributeFilterClasses.forEach((className) => {
      nextAttributeSortModes[className] = getFilterDefaultSortMode("attributes", className);
    });
    setAttributeSortModeByClass(nextAttributeSortModes);

    const nextConceptSortModes = {};
    orderedConceptClasses.forEach((className) => {
      nextConceptSortModes[className] = getFilterDefaultSortMode("concepts", className);
    });
    setConceptSortModeByClass(nextConceptSortModes);

    setActiveFilterModal(null);
    setActiveFilterSearchQuery("");
  }, [orderedAttributeFilterClasses, orderedConceptClasses, orderedOmopClasses, rolledUpChartDataByClass]);
  const toggleFilterLayoutMode = () => {
    setFilterLayoutMode((previousMode) =>
      previousMode === FILTER_LAYOUT_MODE.PER_CARD_COLUMN
        ? FILTER_LAYOUT_MODE.STACKED
        : FILTER_LAYOUT_MODE.PER_CARD_COLUMN
    );
  };
  const filterLayoutToggleTooltip = isPerCardColumnLayout
    ? "Switch to stacked layout"
    : "Switch to one-card-per-column layout";
  const hasExpandedParentFilters = useMemo(
    () =>
      Object.values(expandedParentsByClass).some(
        (parentValues) => Array.isArray(parentValues) && parentValues.length > 0
      ),
    [expandedParentsByClass]
  );
  const hasNonDefaultOmopSortMode = useMemo(
    () =>
      orderedOmopClasses.some(
        (className) =>
          normalizeChartSortMode(omopSortModeByClass[className]) !== getFilterDefaultSortMode("omop", className)
      ),
    [omopSortModeByClass, orderedOmopClasses]
  );
  const hasNonDefaultAttributeSortMode = useMemo(
    () =>
      orderedAttributeFilterClasses.some(
        (className) =>
          normalizeChartSortMode(attributeSortModeByClass[className]) !==
          getFilterDefaultSortMode("attributes", className)
      ),
    [attributeSortModeByClass, orderedAttributeFilterClasses]
  );
  const hasNonDefaultConceptSortMode = useMemo(
    () =>
      orderedConceptClasses.some(
        (className) =>
          normalizeChartSortMode(conceptSortModeByClass[className]) !== getFilterDefaultSortMode("concepts", className)
      ),
    [conceptSortModeByClass, orderedConceptClasses]
  );
  const canResetAllFilters =
    hasSelections ||
    hasExpandedParentFilters ||
    hasNonDefaultOmopSortMode ||
    hasNonDefaultAttributeSortMode ||
    hasNonDefaultConceptSortMode ||
    Boolean(activeFilterModal) ||
    Boolean(String(activeFilterSearchQuery || "").trim());
  const FILTER_PANEL_SPACING_PX = isCompactPlusDensity ? stackGapPx : isCompactDensity ? 8 : 16;
  const FILTER_PANEL_SPACING_UNITS = FILTER_PANEL_SPACING_PX / 8;
  // Hard cap every filter card. Anything taller scrolls inside the
  // chart viewport (overflowY: auto on .horizontal-bar-filter-chart-viewport)
  // so the page stays scannable even for cards with hundreds of values.
  const FILTER_CARD_MAX_HEIGHT_PX = isCompactPlusDensity ? 300 : 200;
  const FILTER_SECTION_HEIGHT_CAP_PX = 700;
  const FILTER_CARD_CHART_HEIGHT_OFFSET_PX = 150;
  const PER_CARD_COLUMN_CHART_HEIGHT_CAP_PX = 340;
  const ROW_HEIGHT_ESTIMATE = isCompactDensity ? 24 : 36;
  const CARD_OVERHEAD_ESTIMATE = isCompactDensity ? 60 : 120;
  const NATURAL_STACK_GAP_PX = isCompactDensity ? 8 : 24;
  const CARD_BOTTOM_MARGIN = isCompactDensity ? 12 : 24;
  // A filter card with enough charted values claims its own dedicated column
  // before LPT packs the rest — the point where a value list reads as its own
  // browseable lane rather than a card to stack under a sibling. The minimum is
  // tunable per density (OVERSIZED_MIN_ROWS_BY_DENSITY in layoutConfig) since
  // taller standard rows reach that length sooner. The count uses the chart's
  // data-array length (currently charted values), not the vocabulary size.
  const OVERSIZED_ROW_THRESHOLD = getOversizedRowThreshold(filterPanelDensityMode);
  const resolveSectionHeightCapPx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const numericHeightCap = Number(sectionHeightCap);
    if (!Number.isFinite(numericHeightCap) || numericHeightCap <= 0) {
      return FILTER_SECTION_HEIGHT_CAP_PX;
    }
    return Math.max(1, Math.round(numericHeightCap));
  };
  const resolveCardChartHeightCapPx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    const naturalChartCapPx = Math.max(220, resolvedSectionHeightCapPx - FILTER_CARD_CHART_HEIGHT_OFFSET_PX);
    return isPerCardColumnLayout ? Math.min(naturalChartCapPx, PER_CARD_COLUMN_CHART_HEIGHT_CAP_PX) : naturalChartCapPx;
  };
  const toSectionHeightPx = (sectionHeight, sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const numericSectionHeight = Number(sectionHeight);
    if (!Number.isFinite(numericSectionHeight) || numericSectionHeight <= 0) {
      return "auto";
    }
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    return `${Math.min(Math.round(numericSectionHeight), resolvedSectionHeightCapPx)}px`;
  };
  const getFilterSetSx = (sectionHeight, sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => {
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    const resolvedCardChartHeightCapPx = resolveCardChartHeightCapPx(resolvedSectionHeightCapPx);
    return {
      "--filter-section-height": toSectionHeightPx(sectionHeight, resolvedSectionHeightCapPx),
      "--filter-section-height-cap": `${resolvedSectionHeightCapPx}px`,
      "--filter-card-chart-height-cap": `${resolvedCardChartHeightCapPx}px`,
      "& > .filter-section-grid": { maxHeight: "none" },
    };
  };
  const getCardContentAreaSx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX, { fillHeight = false } = {}) => {
    const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
    return stabilizeStyle(`content:${resolvedSectionHeightCapPx}:${fillHeight}`, {
      display: "flex",
      flexDirection: "column",
      gap: 0,
      minHeight: 0,
      // fillHeight: when the outer Paper has an explicit height set (compact-plus
      // slack stretch), "100%" resolves to that height so the flex column can
      // grow and the chart viewport fills the card. Otherwise "auto" so the card
      // collapses to its natural content height.
      height: fillHeight ? "100%" : "auto",
      maxHeight: "var(--filter-section-height-cap)",
      overflowY: "hidden",
      overflowX: "hidden",
      pr: 0,
      "& .filter-card-body": {
        display: "flex",
        flexDirection: "column",
        gap: 0,
        flex: 1,
        minHeight: 0,
      },
      "& .filter-card-chart": {
        flex: 1,
        minHeight: 0,
        // When fillHeight is set (compact-plus slack stretch active), the
        // Paper's own height already bounds the card to stretchedCardHeightCapPx,
        // and .filter-card-content fills it via height:100%. The 44vh/chart-cap
        // ceiling is redundant in that case and would leave dead white space
        // below the chart. Drop it so the chart can grow to fill the column.
        ...(fillHeight
          ? {}
          : {
              maxHeight: `min(44vh, ${resolveCardChartHeightCapPx(resolvedSectionHeightCapPx)}px)`,
            }),
        overflowY: "hidden",
        overflowX: "hidden",
      },
      "& .filter-card-chart .horizontal-bar-filter-chart-region": {
        minHeight: 0,
      },
      "& .filter-card-chart .horizontal-bar-filter-chart-viewport": {
        maxHeight: "100%",
        overflowY: "auto",
        overflowX: "hidden",
      },
    });
  };
  const buildSectionLayout = (type, filters, classChartDataByClass, options = {}) => {
    const { maxColumns: maxColumnsOverride } = options;
    const sectionHeightCap = resolveSectionHeightCapPx();
    const classNames = filters.map((filter) => filter.key);
    const filterByClassName = Object.fromEntries(filters.map((filter) => [filter.key, filter]));
    const getLayoutMeasureType = (className) =>
      String(filterByClassName[className]?.type || type || "attributes").toLowerCase();
    const numericMaxColumnsOverride = Number(maxColumnsOverride);
    const resolvedLayoutColumnCap =
      Number.isFinite(numericMaxColumnsOverride) && numericMaxColumnsOverride > 0
        ? Math.max(1, Math.floor(numericMaxColumnsOverride))
        : resolvedSectionColumnCap;
    // Detect oversized cards early so we can bump maxColumns: each oversized
    // card wants its own column, so allow up to filter-count columns when at
    // least one qualifies (otherwise the LPT's reservedColumnCount stays
    // bounded by the breakpoint cap and oversized cards have to share).
    const earlyRowCountByClass = Object.fromEntries(
      classNames.map((className) => {
        const classChartData = classChartDataByClass[className];
        return [className, Array.isArray(classChartData) ? classChartData.length : 0];
      })
    );
    const sectionHasOversizedCards = classNames.some(
      (className) => (Number(earlyRowCountByClass[className]) || 0) > OVERSIZED_ROW_THRESHOLD
    );
    const resolvedSectionMaxColumns = sectionHasOversizedCards
      ? Math.max(resolvedLayoutColumnCap, classNames.length)
      : isPerCardColumnLayout && !isCompactPlusDensity
        ? Math.max(1, classNames.length)
        : resolvedLayoutColumnCap;
    const measuredCardHeightByClass = Object.fromEntries(
      classNames.map((className) => [
        className,
        cardNaturalHeightByKey[getCardMeasureKey(getLayoutMeasureType(className), className)],
      ])
    );
    const rowCountByClass = Object.fromEntries(
      classNames.map((className) => {
        const classChartData = classChartDataByClass[className];
        return [className, Array.isArray(classChartData) ? classChartData.length : 0];
      })
    );
    // Per-card uncapped natural content height observed in the DOM. When the
    // measurement isn't available yet (first render), this is omitted and the
    // layout falls back to the row-count estimate. Once measured, it's the
    // authoritative ceiling on slack stretch — a card never grows past it.
    const desiredCardHeightByClass = Object.fromEntries(
      classNames.map((className) => [
        className,
        cardDesiredHeightByKey[getCardMeasureKey(getLayoutMeasureType(className), className)] || 0,
      ])
    );

    const sectionLayout = buildFilterSectionLayout({
      classNames,
      rowCountByClass,
      measuredCardHeightByClass,
      desiredCardHeightByClass,
      naturalGapPx: isCompactPlusDensity ? stackGapPx : NATURAL_STACK_GAP_PX,
      maxColumns: resolvedSectionMaxColumns,
      categoryMaxHeight: sectionHeightCap,
      cardBottomMargin: CARD_BOTTOM_MARGIN,
      rowHeightEstimate: ROW_HEIGHT_ESTIMATE,
      cardOverheadEstimate: CARD_OVERHEAD_ESTIMATE,
      stackableCardMaxHeight: FILTER_CARD_MAX_HEIGHT_PX,
      allowNonContiguousPacking: isCompactPlusDensity,
      slackDistributionMode,
      // Cards with 25+ rows claim their own column in any density.
      // A 25+ row list is "a browseable lane" regardless of density mode — the
      // ergonomic argument doesn't depend on whether layout uses LPT or DP.
      // (filterLayout.js forces the LPT path when oversized cards exist so the
      // dedicated-column reservation can fire even in non-compact-plus modes.)
      oversizedRowThreshold: OVERSIZED_ROW_THRESHOLD,
    });
    const { scrollableCardStretchByClass } = sectionLayout;
    // If any card in this section is "oversized" (more rows than threshold),
    // honour the LPT-produced columnGroups (which dedicate columns to those
    // cards) instead of the per-card-column fallback that throws columnGroups
    // away. Renderers consume `useColumnWrappers` to switch from individual
    // cards in Masonry to column-wrapper Boxes (the compact-plus rendering
    // shape) — that's the only way Masonry will respect our column reservation.
    const hasOversizedCards = classNames.some(
      (className) => (Number(rowCountByClass[className]) || 0) > OVERSIZED_ROW_THRESHOLD
    );
    const useColumnWrappers = isCompactPlusDensity || hasOversizedCards;

    if (!isPerCardColumnLayout || useColumnWrappers) {
      return {
        ...sectionLayout,
        sectionHeightCap,
        useColumnWrappers,
        // In compact-plus, supply stretch targets for scrollable cards so they
        // fill column slack up to the section cap. cardMarginBottomByClass is
        // cleared because Masonry handles column spacing via flex gap.
        // The measurement hook skips re-measuring cards that carry
        // data-card-height-override, so natural heights are preserved and the
        // layout converges within 2 passes.
        ...(isCompactPlusDensity
          ? {
              cardHeightOverrideByClass: scrollableCardStretchByClass,
              cardMarginBottomByClass: {},
            }
          : {}),
      };
    }

    const perCardColumnGroups = classNames.map((className) => [className]);
    const perCardMarginBottomByClass = Object.fromEntries(classNames.map((className) => [className, 0]));
    const maxPerCardHeight = classNames.reduce((maxHeight, className) => {
      const resolvedCardHeight = Number(sectionLayout.resolvedCardHeightByClass?.[className]) || 0;
      return Math.max(maxHeight, resolvedCardHeight);
    }, 0);
    const perCardSectionHeight = classNames.length
      ? Math.min(sectionHeightCap, maxPerCardHeight + CARD_BOTTOM_MARGIN)
      : 0;

    return {
      ...sectionLayout,
      columnGroups: perCardColumnGroups,
      cardHeightOverrideByClass: {},
      cardMarginBottomByClass: perCardMarginBottomByClass,
      sectionHeight: perCardSectionHeight,
      sectionHeightCap,
      useColumnWrappers: false,
    };
  };
  const getFilterGridSx = (sectionHeightCap = FILTER_SECTION_HEIGHT_CAP_PX) => ({
    "--filter-section-height": toSectionHeightPx(0, sectionHeightCap),
    "--filter-section-height-cap": `${resolveSectionHeightCapPx(sectionHeightCap)}px`,
    "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(sectionHeightCap)}px`,
    m: 0,
    width: "auto",
    maxWidth: "none",
    alignContent: "flex-start",
    "& > .filter-section-column": {
      display: "block",
      minWidth: 0,
      breakInside: "avoid",
      pageBreakInside: "avoid",
      WebkitColumnBreakInside: "avoid",
      boxSizing: "border-box",
    },
  });
  const getFilterGridColumnCount = (filterCount, filterSetId = "") => {
    const normalizedFilterCount = Math.max(1, Number(filterCount) || 1);
    const sectionColumnCaps = getFilterSetCardColumnsByBreakpoint(filterSetId, normalizedFilterCount, {
      isSmUp,
      isMdUp,
      isLgUp,
      isXlUp,
    });
    const breakpointCap =
      isPerCardColumnLayout && !isCompactPlusDensity
        ? sectionColumnCaps
        : Math.min(sectionColumnCaps, Math.max(1, Number(resolvedSectionColumnCap) || 1));
    // Each section lane gets roughly an equal slice of the filter area, so cap
    // card columns to keep each card at least FILTER_CARD_MIN_WIDTH_PX wide.
    const approxLaneWidth =
      filterAreaWidth > 0
        ? filterAreaWidth / Math.max(1, resolvedFilterSectionLayoutColumns)
        : 0;
    return capColumnsByWidth(breakpointCap, approxLaneWidth, FILTER_CARD_MIN_WIDTH_PX);
  };
  const getFilterSectionColumnSx = (span = null) => {
    void span;
    return {
      minWidth: 0,
    };
  };
  const getCardSx = (cardIndex = 0) => {
    void cardIndex;
    const base = {
      width: "100%",
      display: "inline-block",
      verticalAlign: "top",
      breakInside: "avoid",
      mb: 0,
      position: "relative",
      overflow: "hidden",
      boxSizing: "border-box",
      transition: "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.2s ease",
    };
    if (custom.cardBeforePseudo === "vapor-glass") {
      base["&::before"] = {
        content: '""',
        position: "absolute",
        top: 0,
        left: 16,
        right: 16,
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
        borderRadius: "16px 16px 0 0",
        pointerEvents: "none",
      };
    }
    // cardIndex is intentionally ignored; the style depends only on the theme,
    // so a single cache key yields one shared stable reference across all cards.
    return stabilizeStyle("cardsx", base);
  };
  const getFilterSetLaneSx = (kind = "attributes") => {
    const laneColor =
      kind === "omop"
        ? activeTheme.palette.primary.main
        : activeTheme.palette.secondary?.main || activeTheme.palette.primary.main;
    const laneTintOpacity = activeTheme.palette.mode === "dark" ? 0.05 : 0.025;
    const laneRuleOpacity = activeTheme.palette.mode === "dark" ? 0.62 : 0.44;

    return {
      minWidth: 0,
      position: "relative",
      pl: isCompactDensity ? 0.75 : 1,
      pr: isCompactDensity ? 0.25 : 0.5,
      py: isCompactDensity ? 0.25 : 0.5,
      borderLeft: "2px solid",
      borderLeftColor: alpha(laneColor, laneRuleOpacity),
      background: `linear-gradient(90deg, ${alpha(laneColor, laneTintOpacity)} 0, ${alpha(laneColor, 0)} 40px)`,
      breakInside: "avoid",
      pageBreakInside: "avoid",
      WebkitColumnBreakInside: "avoid",
      boxSizing: "border-box",
      "& .filter-set > h2": {
        minHeight: isCompactDensity ? 18 : 22,
        lineHeight: 1.15,
        mb: isCompactDensity ? 0.25 : 0.5,
        color: "text.secondary",
      },
      "& .filter-card-open-button": {
        borderColor: alpha(laneColor, activeTheme.palette.mode === "dark" ? 0.38 : 0.28),
      },
    };
  };
  const fontScaleIndex = findClosestFontScaleIndex(fontScale);
  const canDecreaseFontScale = fontScaleIndex > 0;
  const canIncreaseFontScale = fontScaleIndex < FONT_SCALE_OPTIONS.length - 1;
  const fontScalePercentLabel = `${Math.round(fontScale * 100)}%`;
  const getToggleButtonSx = (isActive) => (theme) => ({
    height: 32,
    width: 32,
    border: "1px solid",
    borderColor: isActive ? theme.palette.primary.main : theme.palette.divider,
    borderRadius: 1,
    color: isActive ? theme.palette.primary.main : custom.iconDefault || theme.palette.text.secondary,
    backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.15) : theme.palette.background.paper,
    "&:hover": {
      backgroundColor: isActive
        ? alpha(theme.palette.primary.main, 0.24)
        : custom.iconHoverBg || theme.palette.action.hover,
    },
  });
  // Helper: render the inner attribute cards (the children of the
  // .filter-section-grid Box) for a given attribute filter-set. Used both by
  // renderAttributeFilterSet (which wraps these in a Stack with its own
  // header) and by the omop renderer when injecting cohort-overview attribute
  // filters inline into a sibling omop section's grid.
  const renderAttributeFilterCards = (filterSet, keyPrefix, options = {}) => {
    const { sectionHeightCap: overrideSectionHeightCap } = options;
    const renderedFilters = filterSet.filters;
    const classChartDataByClass = {};
    renderedFilters.forEach((filter) => {
      const className = filter.key;
      const filterType = String(filter.type || "attributes").toLowerCase();
      if (filterType === "concepts") {
        const classData = conceptDisplayChartDataByClass[className] || [];
        classChartDataByClass[className] = conceptChartDataWithIncludedByClass[className] || classData;
      } else {
        const classData = attributeDisplayChartDataByClass[className] || [];
        classChartDataByClass[className] = attributeChartDataWithIncludedByClass[className] || classData;
      }
    });
    const layoutColumnCap = getFilterGridColumnCount(renderedFilters.length, filterSet.id);
    const {
      columnGroups,
      measuredCardHeightByClass,
      cardHeightOverrideByClass,
      cardMarginBottomByClass,
      sectionHeightCap: computedSectionHeightCap,
      useColumnWrappers,
    } = buildSectionLayout("attributes", renderedFilters, classChartDataByClass, {
      maxColumns: layoutColumnCap,
    });
    const sectionHeightCap = overrideSectionHeightCap ?? computedSectionHeightCap;
    const filterByClassName = Object.fromEntries(renderedFilters.map((filter) => [filter.key, filter]));
    const orderedClassNames = renderedFilters.map((filter) => filter.key);

    const renderAttributeCard = (className, classIndex) => {
      const filter = filterByClassName[className];
      if (!filter) {
        return null;
      }
      const filterType = String(filter.type || "attributes").toLowerCase();
      const isConcept = filterType === "concepts";
      const classError = isConcept
        ? conceptData.errorsByClass[className] || ""
        : attributeData.errorsByClass[className] || "";
      const classChartData = classChartDataByClass[className] || [];
      const classDisplayName = filter.displayName || getFilterDisplayName(filterType, className);
      const selectedValuesForClass = isConcept
        ? selectedConceptValuesByClass[className] || EMPTY_SELECTION
        : selectedAttributeValuesByClass[className] || EMPTY_SELECTION;
      const onSelectionChangeForClass = handleSelectionChange(
        isConcept ? setSelectedConceptValuesByClass : setSelectedAttributeValuesByClass,
        className
      );
      const sortMode = isConcept
        ? conceptSortModeByClass[className] || getFilterDefaultSortMode("concepts", className)
        : attributeSortModeByClass[className] || getFilterDefaultSortMode("attributes", className);
      const customSortOrder = getCustomSortOrderForDensity(filterType, className);
      const classChartDataForRender = getChartDataForDensity(classChartData, filterType, className);
      const selectedCount = selectedValuesForClass.length;
      const cardHeightOverride = cardHeightOverrideByClass[className];
      const measuredCardHeight = Number(measuredCardHeightByClass[className]) || 0;
      const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
      const configuredCardHeightCapPx = getFilterMaxHeightPx("attributes", className);
      const resolvedCardHeightCapPx = Math.min(
        FILTER_CARD_MAX_HEIGHT_PX,
        configuredCardHeightCapPx == null
          ? resolvedSectionHeightCapPx
          : Math.min(resolvedSectionHeightCapPx, configuredCardHeightCapPx)
      );
      const requestedCardHeightOverride = Math.max(0, Number(cardHeightOverride) || 0);
      const cardMarginBottom = Math.max(0, Number(cardMarginBottomByClass[className]) || 0);
      const rowCount = classChartData.length;
      const estimatedCardHeight = estimateCardHeight(rowCount, ROW_HEIGHT_ESTIMATE, CARD_OVERHEAD_ESTIMATE);
      const shouldStretchScrollableCard = isCompactPlusDensity && estimatedCardHeight > resolvedCardHeightCapPx;
      // Stretched cards grow to natural desired height — see renderOmopFilterCard
      // for the equivalent reasoning. Pre-measurement (measuredCardHeight === 0)
      // we still gate via the measured>0 ternary below to avoid oscillation.
      // Math.min(resolvedSectionHeightCapPx, ...) wrapper deliberately removed:
      // oversized cards are permitted to exceed the section cap up to their
      // full natural content height (requestedCardHeightOverride is already
      // capped at the chart's intrinsic size by distributeSlack).
      const stretchedCardHeightCapPx = shouldStretchScrollableCard
        ? Math.max(resolvedCardHeightCapPx, measuredCardHeight > 0 ? requestedCardHeightOverride : 0)
        : resolvedCardHeightCapPx;
      const boundedCardHeightOverride = Math.min(stretchedCardHeightCapPx, requestedCardHeightOverride);
      const canApplyCardHeightOverride = boundedCardHeightOverride > 0 && measuredCardHeight > 0;
      const shouldApplyCardHeightOverride =
        canApplyCardHeightOverride && (!isCompactPlusDensity || shouldStretchScrollableCard);
      const packedSpan = resolvePackedGridSpan({
        displayName: classDisplayName,
        rowCount,
      });
      const cardOuterStyle = stabilizeStyle(`outer:${filterType}:${className}`, {
        "--filter-section-height-cap": `${stretchedCardHeightCapPx}px`,
        "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(stretchedCardHeightCapPx)}px`,
        maxHeight: `${stretchedCardHeightCapPx}px`,
        ...(shouldStretchScrollableCard
          ? { minHeight: `${Math.round(stretchedCardHeightCapPx)}px` }
          : shouldApplyCardHeightOverride
          ? { minHeight: `${Math.round(boundedCardHeightOverride)}px` }
          : {}),
        // Explicit height (not just min/max) is required so that children using
        // height:100% can resolve against a definite size and fill the card.
        ...(shouldApplyCardHeightOverride
          ? { height: `${Math.round(boundedCardHeightOverride)}px` }
          : {}),
      });

      return (
        <Box
          key={`${keyPrefix}:${filterSet.id}:${className}`}
          className="filter-section-column"
          sx={getFilterSectionColumnSx(packedSpan)}
        >
          <FilterSectionCard
            classNameKey={className}
            classDisplayName={classDisplayName}
            classError={classError}
            sortMode={sortMode}
            density={isCompactDensity ? "compact" : "standard"}
            data={classChartDataForRender}
            selectedValues={selectedValuesForClass}
            selectedCount={selectedCount}
            onSelectionChange={onSelectionChangeForClass}
            onRowToggleExpand={isConcept ? undefined : handleAttributeParentExpansionChange(className)}
            fontScale={fontScale}
            customSortOrder={customSortOrder}
            inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
            showBarBehindDots={showBarBehindDots}
            getPatientSummary={getPatientSummary}
            onOpenPatientDocumentView={handleOpenPatientTab}
            onOpenFilterModal={handleOpenFilterModal}
            filterType={filterType}
            measureRef={setCardMeasureRef(filterType, className)}
            cardOuterStyle={cardOuterStyle}
            cardMarginBottom={cardMarginBottom}
            cardHeightCapPx={stretchedCardHeightCapPx}
            cardHeightOverride={shouldApplyCardHeightOverride ? Math.round(boundedCardHeightOverride) : undefined}
            cardSx={getCardSx(classIndex)}
            contentAreaSx={getCardContentAreaSx(sectionHeightCap, { fillHeight: shouldApplyCardHeightOverride })}
            isCompactDensity={isCompactDensity}
          />
        </Box>
      );
    };

    const renderedCardsByClassName = new Map(
      orderedClassNames.map((className, classIndex) => [className, renderAttributeCard(className, classIndex)])
    );

    if (useColumnWrappers) {
      return columnGroups.map((group, groupIndex) => (
        <Box
          key={`${keyPrefix}:${filterSet.id}:compact-plus-column-${groupIndex}`}
          className="filter-section-column filter-section-column-group"
          data-compact-plus-column="true"
          sx={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            // Explicit marginBottom on every child except the last works more
            // reliably than flex `gap` here because Paper carries
            // display:inline-block (see getCardSx). Flex `gap` between
            // inline-block flex items renders inconsistently across browsers,
            // which is what was making gaps "not always show up." A direct
            // margin sidesteps that. Wrapper Boxes (for attribute cards) and
            // bare Papers (for OMOP cards) are both covered by `& > *`.
            "& > *:not(:last-child)": {
              marginBottom: `${FILTER_PANEL_SPACING_PX}px`,
            },
          }}
        >
          {group.map((className) => renderedCardsByClassName.get(className))}
        </Box>
      ));
    }

    return orderedClassNames.map((className) => renderedCardsByClassName.get(className));
  };

  const renderOmopFilterSet = (filterSet, keyPrefix = "omop", { inlineAttributeFilterSets = [] } = {}) => {
    const renderedFilters = filterSet.filters;
    const classChartDataByClass = {};
    renderedFilters.forEach((filter) => {
      const className = filter.key;
      const isAgeAtDxClass = normalizeClassName(className) === AGE_AT_DX_CLASS;
      const classData =
        isAgeAtDxClass && ageAtDxSelectionMode === AGE_SELECTION_MODE.DECILE
          ? ageAtDxDecileChartData
          : chartDataByClass[className] || [];
      classChartDataByClass[className] = omopChartDataWithIncludedByClass[className] || classData;
    });
    const omopLayoutColumnCap = getFilterGridColumnCount(renderedFilters.length, filterSet.id);
    const {
      columnGroups,
      measuredCardHeightByClass,
      cardHeightOverrideByClass,
      cardMarginBottomByClass,
      sectionHeight,
      sectionHeightCap,
      useColumnWrappers,
    } = buildSectionLayout("omop", renderedFilters, classChartDataByClass, {
      maxColumns: omopLayoutColumnCap,
    });
    const filterByClassName = Object.fromEntries(renderedFilters.map((filter) => [filter.key, filter]));
    const orderedClassNames = renderedFilters.map((filter) => filter.key);
    const shouldStackEthnicityUnderGender =
      !isCompactPlusDensity &&
      filterSet.id === "demographics" &&
      orderedClassNames.includes("GENDER") &&
      orderedClassNames.includes("ETHNICITY");
    const injectedAttributeCardCount = inlineAttributeFilterSets.reduce(
      (sum, attributeFilterSet) => sum + (attributeFilterSet.filters?.length || 0),
      0
    );
    const omopGridItemCount = shouldStackEthnicityUnderGender
      ? Math.max(1, renderedFilters.length - 1)
      : Math.max(1, renderedFilters.length);
    const compactPlusOmopGridItemCount = useColumnWrappers ? Math.max(1, columnGroups.length) : omopGridItemCount;
    const totalGridItemCount = Math.max(1, compactPlusOmopGridItemCount + injectedAttributeCardCount);

    const renderOmopFilterCard = (className, classIndex, cardKeyPrefix = "") => {
      const filter = filterByClassName[className];
      if (!filter) {
        return null;
      }
      const classError = omopData.errorsByClass[className] || "";
      const classChartData = classChartDataByClass[className] || [];
      const classDisplayName = filter.displayName || getFilterDisplayName("omop", className);
      const selectedValuesForClass = selectedOmopValuesByClass[className] || EMPTY_SELECTION;
      const onSelectionChangeForClass = handleSelectionChange(setSelectedOmopValuesByClass, className);
      const sortMode = omopSortModeByClass[className] || getFilterDefaultSortMode("omop", className);
      const customSortOrder = getCustomSortOrderForDensity("omop", className);
      const classChartDataForRender = getChartDataForDensity(classChartData, "omop", className);
      const selectedCount = selectedValuesForClass.length;
      const cardHeightOverride = cardHeightOverrideByClass[className];
      const measuredCardHeight = Number(measuredCardHeightByClass[className]) || 0;
      const resolvedSectionHeightCapPx = resolveSectionHeightCapPx(sectionHeightCap);
      const configuredCardHeightCapPx = getFilterMaxHeightPx("omop", className);
      const resolvedCardHeightCapPx = Math.min(
        FILTER_CARD_MAX_HEIGHT_PX,
        configuredCardHeightCapPx == null
          ? resolvedSectionHeightCapPx
          : Math.min(resolvedSectionHeightCapPx, configuredCardHeightCapPx)
      );
      const requestedCardHeightOverride = Math.max(0, Number(cardHeightOverride) || 0);
      const cardMarginBottom = Math.max(0, Number(cardMarginBottomByClass[className]) || 0);
      const rowCount = classChartData.length;
      const estimatedCardHeight = estimateCardHeight(rowCount, ROW_HEIGHT_ESTIMATE, CARD_OVERHEAD_ESTIMATE);
      const shouldStretchScrollableCard = isCompactPlusDensity && estimatedCardHeight > resolvedCardHeightCapPx;
      // Stretched cards grow to their natural desired height (requestedCardHeightOverride
      // is already capped at the chart's natural content height by distributeSlack).
      // Deliberately no longer bound by resolvedSectionHeightCapPx — oversized
      // cards have permission to expand the section to fit their full content
      // so users don't have to scroll inside the card to see the last few rows.
      const stretchedCardHeightCapPx = shouldStretchScrollableCard
        ? Math.max(resolvedCardHeightCapPx, measuredCardHeight > 0 ? requestedCardHeightOverride : 0)
        : resolvedCardHeightCapPx;
      const boundedCardHeightOverride = Math.min(stretchedCardHeightCapPx, requestedCardHeightOverride);
      const canApplyCardHeightOverride = boundedCardHeightOverride > 0 && measuredCardHeight > 0;
      const shouldApplyCardHeightOverride =
        canApplyCardHeightOverride && (!isCompactPlusDensity || shouldStretchScrollableCard);
      const cardOuterStyle = stabilizeStyle(`outer:omop:${className}`, {
        "--filter-section-height-cap": `${stretchedCardHeightCapPx}px`,
        "--filter-card-chart-height-cap": `${resolveCardChartHeightCapPx(stretchedCardHeightCapPx)}px`,
        maxHeight: `${stretchedCardHeightCapPx}px`,
        ...(shouldStretchScrollableCard
          ? { minHeight: `${Math.round(stretchedCardHeightCapPx)}px` }
          : shouldApplyCardHeightOverride
          ? { minHeight: `${Math.round(boundedCardHeightOverride)}px` }
          : {}),
        ...(shouldApplyCardHeightOverride
          ? { height: `${Math.round(boundedCardHeightOverride)}px` }
          : {}),
      });
      return (
        <FilterSectionCard
          key={`${cardKeyPrefix}${keyPrefix}:${filterSet.id}:${className}`}
          classNameKey={className}
          classDisplayName={classDisplayName}
          classError={classError}
          sortMode={sortMode}
          density={isCompactDensity ? "compact" : "standard"}
          data={classChartDataForRender}
          selectedValues={selectedValuesForClass}
          selectedCount={selectedCount}
          onSelectionChange={onSelectionChangeForClass}
          fontScale={fontScale}
          customSortOrder={customSortOrder}
          inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
          showBarBehindDots={showBarBehindDots}
          getPatientSummary={getPatientSummary}
          onOpenPatientDocumentView={handleOpenPatientTab}
          onOpenFilterModal={handleOpenFilterModal}
          filterType="omop"
          measureRef={setCardMeasureRef("omop", className)}
          cardOuterStyle={cardOuterStyle}
          cardMarginBottom={cardMarginBottom}
          cardHeightCapPx={stretchedCardHeightCapPx}
          cardHeightOverride={shouldApplyCardHeightOverride ? Math.round(boundedCardHeightOverride) : undefined}
          cardSx={getCardSx(classIndex)}
          contentAreaSx={getCardContentAreaSx(sectionHeightCap, { fillHeight: shouldApplyCardHeightOverride })}
          isCompactDensity={isCompactDensity}
        />
      );
    };

    // When column wrappers are active, prefer the number of column groups the
    // layout produced (one per dedicated/LPT column) over the breakpoint cap.
    // Otherwise oversized sections get squeezed into too few columns and the
    // dedicated-column rule visibly fails. We still take the max with the
    // breakpoint-derived count so sections with few items don't shrink.
    const baseOmopGridColumns = getFilterGridColumnCount(totalGridItemCount, filterSet.id);
    const omopGridColumns = useColumnWrappers
      ? Math.max(baseOmopGridColumns, columnGroups.length)
      : baseOmopGridColumns;
    const renderedOmopCardsByClassName = new Map(
      orderedClassNames.map((className, classIndex) => [className, renderOmopFilterCard(className, classIndex)])
    );
    const compactPlusOmopColumns = useColumnWrappers
      ? columnGroups.map((group, groupIndex) => (
          <Box
            key={`${keyPrefix}:${filterSet.id}:compact-plus-column-${groupIndex}`}
            className="filter-section-column filter-section-column-group"
            data-compact-plus-column="true"
            sx={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              // Explicit marginBottom is more reliable than flex `gap` for
              // Paper children that carry display:inline-block.
              "& > *:not(:last-child)": {
                marginBottom: `${FILTER_PANEL_SPACING_PX}px`,
              },
            }}
          >
            {group.map((className) => renderedOmopCardsByClassName.get(className))}
          </Box>
        ))
      : null;

    return (
      <Stack
        key={`${keyPrefix}:${filterSet.id}`}
        spacing={FILTER_PANEL_SPACING_UNITS}
        className="filter-set"
        data-section-height-cap={sectionHeightCap}
        sx={getFilterSetSx(sectionHeight, sectionHeightCap)}
      >
        <Typography component="h2" variant="caption" sx={FILTER_SECTION_LABEL_SX}>
          {filterSet.label}
        </Typography>
        <Masonry
          className="filter-section-grid"
          data-column-cap={JSON.stringify(omopGridColumns)}
          data-section-height-cap={sectionHeightCap}
          columns={omopGridColumns}
          spacing={FILTER_PANEL_SPACING_UNITS}
          sx={getFilterGridSx(sectionHeightCap)}
        >
          {compactPlusOmopColumns ||
            orderedClassNames.map((className, classIndex) => {
              if (shouldStackEthnicityUnderGender && className === "ETHNICITY") {
                return null;
              }
              const stackedEthnicityCard = shouldStackEthnicityUnderGender && className === "GENDER";
              return (
                <Box
                  key={`${keyPrefix}:${filterSet.id}:${className}`}
                  className="filter-section-column"
                  sx={{
                    ...getFilterSectionColumnSx(1),
                    display: "flex",
                    flexDirection: "column",
                    gap: stackedEthnicityCard ? FILTER_PANEL_SPACING_UNITS : 0,
                  }}
                >
                  {renderOmopFilterCard(className, classIndex)}
                  {stackedEthnicityCard ? renderOmopFilterCard("ETHNICITY", classIndex + 0.25, "stacked:") : null}
                </Box>
              );
            })}
          {inlineAttributeFilterSets.flatMap((attributeFilterSet) =>
            renderAttributeFilterCards(attributeFilterSet, `cohort-inline:${filterSet.id}`, {
              sectionHeightCap,
            })
          )}
        </Masonry>
      </Stack>
    );
  };

  const renderAttributeFilterSet = (filterSet, keyPrefix = "attributes") => {
    const renderedFilters = filterSet.filters;
    const classChartDataByClass = {};
    renderedFilters.forEach((filter) => {
      const className = filter.key;
      const isConcept = String(filter.type || "").toLowerCase() === "concepts";
      if (isConcept) {
        const classData = conceptDisplayChartDataByClass[className] || [];
        classChartDataByClass[className] = conceptChartDataWithIncludedByClass[className] || classData;
      } else {
        const classData = attributeDisplayChartDataByClass[className] || [];
        classChartDataByClass[className] = attributeChartDataWithIncludedByClass[className] || classData;
      }
    });
    const attributeGridColumns = getFilterGridColumnCount(renderedFilters.length, filterSet.id);
    const { sectionHeight, sectionHeightCap } = buildSectionLayout(
      "attributes",
      renderedFilters,
      classChartDataByClass,
      { maxColumns: attributeGridColumns }
    );

    return (
      <Box
        key={`${keyPrefix}:${filterSet.id}`}
        className="filter-set"
        data-section-height-cap={sectionHeightCap}
        sx={{
          ...getFilterSetSx(sectionHeight, sectionHeightCap),
          minWidth: 0,
        }}
      >
        <Typography component="h2" variant="caption" sx={FILTER_SECTION_LABEL_SX}>
          {filterSet.label}
        </Typography>
        <Masonry
          className="filter-section-grid"
          data-column-cap={JSON.stringify(attributeGridColumns)}
          data-section-height-cap={sectionHeightCap}
          columns={attributeGridColumns}
          spacing={FILTER_PANEL_SPACING_UNITS}
          sx={getFilterGridSx(sectionHeightCap)}
        >
          {renderAttributeFilterCards(filterSet, keyPrefix, { sectionHeightCap })}
        </Masonry>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      {REDUCED_MOTION_STYLES}
      {reducedMotion ? TOGGLED_REDUCED_MOTION_STYLES : null}
      <Box
        sx={{
          minHeight: "100vh",
          fontSize: fontScalePercentLabel,
          bgcolor: "background.default",
          background: custom.pageBgExtra
            ? `${custom.pageBgExtra}, ${activeTheme.palette.background.default}`
            : undefined,
          p: { xs: 2, md: 4 },
          transition: "background-color 0.2s ease",
        }}
      >
        <Box component="main" aria-labelledby="filters-page-title">
          <Stack spacing={2} sx={{ pb: patientGridDrawerBottomPadding }}>
            <FiltersToolbar
              spacingUnits={FILTER_PANEL_SPACING_UNITS}
              totalPatientCount={totalPatientCount}
              selectedPatientCount={cohortSize}
              hasActiveFilters={hasSelections}
              isSelectedCountLoading={isCountLoading}
              fontScalePercentLabel={fontScalePercentLabel}
              canDecreaseFontScale={canDecreaseFontScale}
              canIncreaseFontScale={canIncreaseFontScale}
              onChangeFontScale={handleFontScaleChange}
              highContrast={highContrast}
              onToggleHighContrast={handleHighContrastToggle}
              reducedMotion={reducedMotion}
              onToggleReducedMotion={handleReducedMotionToggle}
              showBarBehindDots={showBarBehindDots}
              onToggleShowBarBehindDots={handleShowBarBehindDotsToggle}
              onResetAllFilters={handleResetAllFilters}
              canResetAllFilters={canResetAllFilters}
              filterLayoutToggleTooltip={filterLayoutToggleTooltip}
              isPerCardColumnLayout={isPerCardColumnLayout}
              onToggleFilterLayout={toggleFilterLayoutMode}
              filterPanelDensityMode={filterPanelDensityMode}
              onChangeFilterPanelDensityMode={handleFilterPanelDensityModeChange}
              isCompactPlusDensity={isCompactPlusDensity}
              stackGapPx={stackGapPx}
              onChangeStackGapPx={handleStackGapChange}
              slackDistributionMode={slackDistributionMode}
              onChangeSlackDistributionMode={handleSlackModeChange}
              themeKey={themeKey}
              onChangeTheme={handleThemeChange}
              getToggleButtonSx={getToggleButtonSx}
              themeEditorMenuValue={THEME_EDITOR_MENU_VALUE}
            />

            {shouldShowFilterLoadingState ? (
              <Typography variant="body2" color="text.secondary">
                Loading filters...
              </Typography>
            ) : null}

            {rootError ? <Alert severity="error">{rootError}</Alert> : null}
            {attributeRootError ? <Alert severity="error">{attributeRootError}</Alert> : null}
            {conceptRootError ? <Alert severity="error">{conceptRootError}</Alert> : null}

            {canRenderFilterSections ? (
              filterSectionsForDisplay.length > 0 ? (
                <Masonry
                  ref={registerFilterArea}
                  className="filter-set-layout-masonry"
                  columns={resolvedFilterSectionLayoutColumns}
                  spacing={FILTER_PANEL_SPACING_UNITS}
                  sequential
                  sx={{
                    m: 0,
                    width: "100%",
                    maxWidth: "100%",
                    alignContent: "flex-start",
                    "& > .filter-set-layout-item": {
                      minWidth: 0,
                      breakInside: "avoid",
                      pageBreakInside: "avoid",
                      WebkitColumnBreakInside: "avoid",
                    },
                  }}
                >
                  {filterSectionsForDisplay.map(({ id, kind, filterSet }) => {
                    const shouldInjectInlineAttributes =
                      kind === "omop" && filterSet.id === "cancer-type" && shouldInjectCohortOverviewAttributes;
                    return (
                      <Box
                        key={`${kind}:${id}`}
                        className="filter-set-layout-item filter-domain-lane"
                        data-filter-set-id={id}
                        data-filter-set-kind={kind}
                        sx={getFilterSetLaneSx(kind)}
                      >
                        {kind === "omop"
                          ? renderOmopFilterSet(filterSet, "omop", {
                              inlineAttributeFilterSets: shouldInjectInlineAttributes
                                ? cohortOverviewInlineAttributeFilterSets
                                : [],
                            })
                          : renderAttributeFilterSet(filterSet, "attributes")}
                      </Box>
                    );
                  })}
                </Masonry>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No filter classes returned.
                </Typography>
              )
            ) : null}
            <PatientDrawer
              isVisible={isPatientGridDockVisible}
              isMaximized={isPatientGridDockMaximized}
              isExpanded={isPatientGridDockExpanded}
              filterSummaryText={patientGridDrawerFilterSummaryText}
              activeDrawerTab={activeDrawerTab}
              setActiveDrawerTab={setActiveDrawerTab}
              openPatientIds={openPatientIds}
              cohortSize={cohortSize}
              onClosePatientTab={handleClosePatientTab}
              panelId={patientGridDrawerPanelId}
              patientGridRows={patientGridRows}
              totalPatientGridPages={totalPatientGridPages}
              currentPatientGridPage={currentPatientGridPage}
              pageSize={patientGridPageSize}
              onPageChange={setCurrentPatientGridPage}
              isTableLoading={patientGridDrawerTableLoading}
              pageError={patientGridPageError}
              onRetryPatientSummary={handleRetryPatientSummary}
              statusText={patientGridDrawerStatusText}
              collapsedHeaderSummary={patientGridCollapsedHeaderSummary}
              onOpenPatientTab={handleOpenPatientTab}
              setIsExpanded={setIsPatientGridDockExpanded}
              setIsMaximized={setIsPatientGridDockMaximized}
            />
            <ThemeBuilderDialog
              open={isThemeBuilderOpen}
              onClose={handleThemeBuilderClose}
              themeBuilderThemeKey={themeBuilderThemeKey}
              onThemeChange={handleThemeBuilderThemeChange}
              onApplyTheme={handleThemeBuilderApplyTheme}
              activeThemeKey={themeKey}
              onResetTheme={handleThemeBuilderThemeReset}
              hasOverrides={hasThemeBuilderOverrides}
              onResetAll={handleThemeBuilderResetAll}
              hasAnyOverrides={hasAnyThemeColorOverrides}
              searchQuery={themeBuilderSearchQuery}
              onSearchQueryChange={setThemeBuilderSearchQuery}
              filteredColorEntries={filteredThemeBuilderColorEntries}
              totalColorEntryCount={themeBuilderColorEntries.length}
              themeOverrides={themeBuilderThemeOverrides}
              onEntryChange={handleThemeBuilderEntryChange}
            />
            <FilterDetailModal
              open={Boolean(activeFilterDetail)}
              onClose={handleCloseFilterModal}
              activeFilterDetail={activeFilterDetail}
              searchQuery={activeFilterSearchQuery}
              onSearchQueryChange={setActiveFilterSearchQuery}
              sortDimension={activeFilterSortDimension}
              onSortDimensionChange={handleModalSortDimensionChange}
              sortDirection={activeFilterSortDirection}
              onSortDirectionToggle={handleModalSortDirectionToggle}
              chartData={filteredModalChartData}
              onSelectionChange={
                activeFilterDetail
                  ? activeFilterDetail.type === "attributes"
                    ? handleSelectionChange(setSelectedAttributeValuesByClass, activeFilterDetail.className)
                    : activeFilterDetail.type === "concepts"
                    ? handleSelectionChange(setSelectedConceptValuesByClass, activeFilterDetail.className)
                    : handleSelectionChange(setSelectedOmopValuesByClass, activeFilterDetail.className)
                  : undefined
              }
              onRowToggleExpand={
                activeFilterDetail?.type === "attributes"
                  ? handleAttributeParentExpansionChange(activeFilterDetail.className)
                  : undefined
              }
              customSortOrder={
                activeFilterDetail
                  ? getCustomSortOrderForDensity(activeFilterDetail.type, activeFilterDetail.className)
                  : EMPTY_SELECTION
              }
              fontScale={fontScale}
              getPatientSummary={getPatientSummary}
              inlinePatientIdsThreshold={INLINE_PATIENT_IDS_THRESHOLD}
              showBarBehindDots={showBarBehindDots}
            />
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default FiltersView;
