import React, { useCallback, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CssBaseline,
  FormControl,
  GlobalStyles,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { ThemeProvider } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { FILTER_SETS } from "./filterSets";
import { THEME_OPTIONS, THEME_STORAGE_KEY, getThemeByKey } from "../themes";

const CONTEXT_HEADER_SX = { fontWeight: 700, letterSpacing: 0.2 };

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

const REDUCED_MOTION_STYLES = (
  <GlobalStyles
    styles={{
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          transitionDuration: "0.01ms !important",
          animationDuration: "0.01ms !important",
        },
      },
    }}
  />
);

function cloneFilterEntry(filterEntry) {
  return {
    ...filterEntry,
    customSortOrder: Array.isArray(filterEntry?.customSortOrder)
      ? [...filterEntry.customSortOrder]
      : undefined,
  };
}

function cloneFilterSet(filterSet) {
  return {
    ...filterSet,
    filters: Array.isArray(filterSet?.filters) ? filterSet.filters.map(cloneFilterEntry) : [],
  };
}

function cloneFilterSets(sourceSets = FILTER_SETS) {
  return (Array.isArray(sourceSets) ? sourceSets : []).map(cloneFilterSet);
}

function getTypeChipColor(type) {
  return String(type || "").toLowerCase() === "omop" ? "primary" : "secondary";
}

function countEnabledFilters(filterSet) {
  return (Array.isArray(filterSet?.filters) ? filterSet.filters : []).filter(
    (filterEntry) => filterEntry?.enabled !== false
  ).length;
}

function FilterEntryRow({ filterEntry, onToggleEnabled }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              wordBreak: "break-word",
            }}
          >
            {filterEntry.key}
          </Typography>
          {filterEntry.displayName ? (
            <Typography variant="caption" color="text.secondary">
              displayName: {filterEntry.displayName}
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
          <Chip
            size="small"
            color={getTypeChipColor(filterEntry.type)}
            label={String(filterEntry.type || "").toUpperCase() || "UNKNOWN"}
          />
          {filterEntry.hasRollup ? <Chip size="small" variant="outlined" label="Rollup" /> : null}
          {filterEntry.specialBehavior ? (
            <Chip size="small" variant="outlined" label={`Behavior: ${filterEntry.specialBehavior}`} />
          ) : null}
          <Chip
            size="small"
            variant="outlined"
            label={`Sort: ${String(filterEntry.defaultSortMode || "alpha-asc")}`}
          />
          <Switch
            size="small"
            checked={filterEntry.enabled !== false}
            onChange={(event, checked) => onToggleEnabled(checked)}
            inputProps={{ "aria-label": `Toggle filter ${filterEntry.key} enabled` }}
          />
        </Box>
      </Box>
    </Paper>
  );
}

export default function FilterSetsConfigView() {
  const [themeKey, setThemeKey] = useState(getInitialThemeKey);
  const [workingFilterSets, setWorkingFilterSets] = useState(() => cloneFilterSets(FILTER_SETS));

  const activeTheme = useMemo(() => getThemeByKey(themeKey), [themeKey]);
  const custom = activeTheme.custom || {};

  const handleThemeChange = useCallback((event) => {
    const nextKey = String(event.target.value || "govuk");
    setThemeKey(nextKey);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextKey);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleToggleSetDisplay = useCallback((setId, nextDisplay) => {
    setWorkingFilterSets((previousSets) =>
      previousSets.map((filterSet) =>
        filterSet.id === setId ? { ...filterSet, display: Boolean(nextDisplay) } : filterSet
      )
    );
  }, []);

  const handleToggleFilterEnabled = useCallback((setId, filterIndex, nextEnabled) => {
    setWorkingFilterSets((previousSets) =>
      previousSets.map((filterSet) => {
        if (filterSet.id !== setId) {
          return filterSet;
        }

        const nextFilters = (Array.isArray(filterSet.filters) ? filterSet.filters : []).map(
          (filterEntry, index) =>
            index === filterIndex ? { ...filterEntry, enabled: Boolean(nextEnabled) } : filterEntry
        );
        return { ...filterSet, filters: nextFilters };
      })
    );
  }, []);

  const handleResetDefaults = useCallback(() => {
    setWorkingFilterSets(cloneFilterSets(FILTER_SETS));
  }, []);

  const handleExportConfig = useCallback(() => {}, []);

  const summary = useMemo(() => {
    const totalSets = workingFilterSets.length;
    const visibleSets = workingFilterSets.filter((filterSet) => filterSet.display !== false);
    const totalFilters = workingFilterSets.reduce(
      (sum, filterSet) => sum + (Array.isArray(filterSet.filters) ? filterSet.filters.length : 0),
      0
    );
    const enabledFiltersAcrossVisible = visibleSets.reduce(
      (sum, filterSet) => sum + countEnabledFilters(filterSet),
      0
    );

    return {
      totalSets,
      visibleSets,
      totalFilters,
      enabledFiltersAcrossVisible,
    };
  }, [workingFilterSets]);

  const getCardSx = useCallback(() => {
    const base = {
      p: custom.cardPadding || { xs: 2, md: 2.5 },
      border: 1,
      borderColor: "divider",
      position: "relative",
      transition: "opacity 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
      bgcolor: "background.paper",
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
        pointerEvents: "none",
      };
    }

    return base;
  }, [custom.cardBeforePseudo, custom.cardPadding]);

  const getHeaderSx = useCallback(
    () => ({
      ...CONTEXT_HEADER_SX,
      fontWeight: custom.headerFontWeight || 700,
      letterSpacing: custom.headerLetterSpacing || "0.2px",
      textTransform: custom.headerTransform || "none",
      fontSize: custom.headerFontSize || undefined,
      color: custom.headerColor || "text.primary",
    }),
    [custom.headerColor, custom.headerFontSize, custom.headerFontWeight, custom.headerLetterSpacing, custom.headerTransform]
  );

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      {REDUCED_MOTION_STYLES}
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          background: custom.pageBgExtra
            ? `${custom.pageBgExtra}, ${activeTheme.palette.background.default}`
            : undefined,
          p: { xs: 2, md: 4 },
          transition: "background-color 0.2s ease",
        }}
      >
        <Box component="main" aria-labelledby="filter-sets-config-title">
          <Stack spacing={2}>
            <Box
              sx={{
                position: "sticky",
                top: { xs: 8, md: 12 },
                zIndex: 10,
              }}
            >
              <Paper elevation={0} sx={{ p: 1.25, border: 1, borderColor: "divider" }}>
                <Stack spacing={1.25}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography id="filter-sets-config-title" component="h1" variant="h6" sx={getHeaderSx()}>
                        Filter Sets Config
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Live configuration dashboard using a local editable copy of FILTER_SETS.
                      </Typography>
                    </Box>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestartAltIcon fontSize="small" />}
                        onClick={handleResetDefaults}
                      >
                        Reset to Defaults
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
                        onClick={handleExportConfig}
                      >
                        Export Config
                      </Button>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        <PaletteOutlinedIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
                        <FormControl
                          size="small"
                          sx={{
                            minWidth: 130,
                            fontSize: "0.75rem",
                            height: 32,
                            bgcolor: "background.paper",
                          }}
                        >
                          <InputLabel id="filter-sets-config-theme-select-label">Theme</InputLabel>
                          <Select
                            labelId="filter-sets-config-theme-select-label"
                            id="filter-sets-config-theme-select"
                            value={themeKey}
                            onChange={handleThemeChange}
                            label="Theme"
                            sx={{ height: 32, "& .MuiSelect-select": { py: 0.5 } }}
                          >
                            {THEME_OPTIONS.map((option) => (
                              <MenuItem key={option.key} value={option.key} sx={{ fontSize: "0.8rem" }}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    </Box>
                  </Box>

                  <Paper variant="outlined" sx={{ p: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                    <Stack spacing={0.75}>
                      <Typography variant="body2" color="text.secondary">
                        {summary.visibleSets.length} of {summary.totalSets} sets visible |{" "}
                        {summary.enabledFiltersAcrossVisible} filters enabled across visible sets |{" "}
                        {summary.totalFilters} total filters
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {summary.visibleSets.length > 0 ? (
                          summary.visibleSets.map((filterSet) => (
                            <Chip key={filterSet.id} size="small" label={filterSet.label} variant="outlined" />
                          ))
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No filter sets are currently marked visible.
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                </Stack>
              </Paper>
            </Box>

            <Stack spacing={1.5}>
              {workingFilterSets.map((filterSet) => {
                const setVisible = filterSet.display !== false;
                const enabledFilterCount = countEnabledFilters(filterSet);

                return (
                  <Paper
                    key={filterSet.id}
                    elevation={0}
                    sx={{
                      ...getCardSx(),
                      opacity: setVisible ? 1 : 0.58,
                    }}
                  >
                    <Stack spacing={1}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 1.5,
                          flexWrap: "wrap",
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography component="h2" variant="h6" sx={getHeaderSx()}>
                            {filterSet.label}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                          >
                            {filterSet.id}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${filterSet.filters.length} filter${filterSet.filters.length === 1 ? "" : "s"}`}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Display
                          </Typography>
                          <Switch
                            checked={setVisible}
                            onChange={(event, checked) => handleToggleSetDisplay(filterSet.id, checked)}
                            inputProps={{ "aria-label": `Toggle ${filterSet.label} display` }}
                          />
                        </Box>
                      </Box>

                      <Accordion
                        disableGutters
                        elevation={0}
                        sx={{
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                          bgcolor: "transparent",
                          "&::before": { display: "none" },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          aria-controls={`${filterSet.id}-filters-content`}
                          id={`${filterSet.id}-filters-header`}
                          sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              width: "100%",
                              alignItems: "center",
                              justifyContent: "space-between",
                              pr: 1,
                              gap: 1,
                            }}
                          >
                            <Typography component="h3" variant="subtitle2" sx={CONTEXT_HEADER_SX}>
                              Filter Entries
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {enabledFilterCount}/{filterSet.filters.length} enabled
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0.5 }}>
                          <Stack spacing={0.75}>
                            {filterSet.filters.map((filterEntry, filterIndex) => (
                              <FilterEntryRow
                                key={`${filterSet.id}:${filterEntry.key}:${filterIndex}`}
                                filterEntry={filterEntry}
                                onToggleEnabled={(nextEnabled) =>
                                  handleToggleFilterEnabled(filterSet.id, filterIndex, nextEnabled)
                                }
                              />
                            ))}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>

            <Box component="nav" aria-label="Primary navigation" sx={{ mt: 1 }}>
              <MuiLink
                component={RouterLink}
                to="/"
                underline="hover"
                sx={{ width: "fit-content", color: "text.secondary" }}
              >
                Back Home
              </MuiLink>
            </Box>
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
