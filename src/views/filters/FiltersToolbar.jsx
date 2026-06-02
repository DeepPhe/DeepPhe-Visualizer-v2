import React from "react";
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContrastIcon from "@mui/icons-material/Contrast";
import MotionPhotosOffIcon from "@mui/icons-material/MotionPhotosOff";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import { Link as RouterLink } from "react-router-dom";
import {
  FILTER_PANEL_DENSITY_MODE,
  SLACK_DISTRIBUTION_MODE,
  STACK_GAP_OPTIONS,
} from "../../hooks/useFilterPagePreferences";
import { THEME_OPTIONS } from "../../themes";

export default function FiltersToolbar({
  spacingUnits = 1,
  fontScalePercentLabel = "100%",
  canDecreaseFontScale = false,
  canIncreaseFontScale = false,
  onChangeFontScale = undefined,
  highContrast = false,
  onToggleHighContrast = undefined,
  reducedMotion = false,
  onToggleReducedMotion = undefined,
  onResetAllFilters = undefined,
  canResetAllFilters = false,
  filterLayoutToggleTooltip = "",
  isPerCardColumnLayout = false,
  onToggleFilterLayout = undefined,
  filterPanelDensityMode = FILTER_PANEL_DENSITY_MODE.STANDARD,
  onChangeFilterPanelDensityMode = undefined,
  isCompactPlusDensity = false,
  stackGapPx = 12,
  onChangeStackGapPx = undefined,
  slackDistributionMode = SLACK_DISTRIBUTION_MODE.PROPORTIONAL,
  onChangeSlackDistributionMode = undefined,
  themeKey = "",
  onChangeTheme = undefined,
  getToggleButtonSx = () => ({}),
  themeEditorMenuValue = "__theme-builder__",
  homeRoute = "/debug",
}) {
  return (
    <Box
      sx={{
        position: "sticky",
        top: { xs: 8, md: 12 },
        zIndex: 10,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: spacingUnits,
          gridTemplateColumns: { xs: "1fr" },
          alignItems: "start",
        }}
      >
        <Paper elevation={0} data-testid="identified-patients-panel" sx={{ p: 1, border: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.25,
                flexWrap: "wrap",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  flexWrap: "wrap",
                  minWidth: 0,
                  flex: "1 1 260px",
                }}
              >
                <Box component="nav" aria-label="Primary navigation" sx={{ display: "inline-flex", flexShrink: 0 }}>
                  <MuiLink
                    component={RouterLink}
                    to={homeRoute}
                    underline="none"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      color: "text.primary",
                      "&:hover": {
                        color: "text.primary",
                        textDecoration: "underline",
                      },
                    }}
                  >
                    <ArrowBackIcon fontSize="small" />
                    <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                      Home
                    </Typography>
                  </MuiLink>
                </Box>
                <Typography
                  id="filters-page-title"
                  component="h1"
                  variant="subtitle1"
                  data-testid="filters-page-heading"
                  sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}
                >
                  DeepPhe Patient Cohort Explorer
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  maxWidth: "100%",
                }}
              >
                <Box
                  role="group"
                  aria-label="Font size"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.25,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    height: 32,
                    pl: 0.5,
                    pr: 0.25,
                    bgcolor: "background.paper",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: "text.primary", fontWeight: 600, letterSpacing: 0.2, userSelect: "none" }}
                  >
                    Aa
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => onChangeFontScale?.(-1)}
                    disabled={!canDecreaseFontScale}
                    aria-label="Decrease font size"
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography
                    variant="caption"
                    sx={{
                      minWidth: 40,
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                      userSelect: "none",
                    }}
                  >
                    {fontScalePercentLabel}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => onChangeFontScale?.(1)}
                    disabled={!canIncreaseFontScale}
                    aria-label="Increase font size"
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Tooltip title={highContrast ? "High contrast (on)" : "High contrast"}>
                  <IconButton
                    size="small"
                    onClick={onToggleHighContrast}
                    aria-label={highContrast ? "Disable high contrast" : "Enable high contrast"}
                    aria-pressed={highContrast}
                    sx={getToggleButtonSx(highContrast)}
                  >
                    <ContrastIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={reducedMotion ? "Reduce motion (on)" : "Reduce motion"}>
                  <IconButton
                    size="small"
                    onClick={onToggleReducedMotion}
                    aria-label={reducedMotion ? "Disable reduced motion" : "Enable reduced motion"}
                    aria-pressed={reducedMotion}
                    sx={getToggleButtonSx(reducedMotion)}
                  >
                    <MotionPhotosOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onResetAllFilters}
                  data-testid="reset-all-filters-button"
                  disabled={!canResetAllFilters}
                  sx={{
                    height: 32,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    bgcolor: "background.paper",
                  }}
                >
                  Reset filters
                </Button>
                <Tooltip title={filterLayoutToggleTooltip}>
                  <IconButton
                    size="small"
                    aria-label={filterLayoutToggleTooltip}
                    data-testid="filter-layout-mode-toggle"
                    onClick={onToggleFilterLayout}
                    sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper" }}
                  >
                    {isPerCardColumnLayout ? <ViewColumnIcon fontSize="small" /> : <ViewStreamIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <FormControl
                  size="small"
                  sx={{
                    minWidth: 116,
                    height: 32,
                    bgcolor: "background.paper",
                  }}
                >
                  <InputLabel id="filter-density-select-label">Density</InputLabel>
                  <Select
                    labelId="filter-density-select-label"
                    id="filter-density-select"
                    value={filterPanelDensityMode}
                    onChange={onChangeFilterPanelDensityMode}
                    label="Density"
                    inputProps={{
                      "aria-label": "Filter density",
                    }}
                    sx={{
                      height: 32,
                      "& .MuiSelect-select": { py: 0.5 },
                    }}
                  >
                    <MenuItem value={FILTER_PANEL_DENSITY_MODE.STANDARD} sx={{ fontSize: "0.8rem" }}>
                      Standard
                    </MenuItem>
                    <MenuItem value={FILTER_PANEL_DENSITY_MODE.COMPACT} sx={{ fontSize: "0.8rem" }}>
                      Compact
                    </MenuItem>
                    <MenuItem value={FILTER_PANEL_DENSITY_MODE.COMPACT_PLUS} sx={{ fontSize: "0.8rem" }}>
                      Compact+
                    </MenuItem>
                  </Select>
                </FormControl>
                {isCompactPlusDensity ? (
                  <>
                    <FormControl size="small" sx={{ minWidth: 96, height: 32, bgcolor: "background.paper" }}>
                      <InputLabel id="stack-gap-label">Stack gap</InputLabel>
                      <Select
                        labelId="stack-gap-label"
                        label="Stack gap"
                        value={stackGapPx}
                        onChange={onChangeStackGapPx}
                        inputProps={{ "aria-label": "Stack gap between cards" }}
                        sx={{ height: 32, "& .MuiSelect-select": { py: 0.5 } }}
                      >
                        {STACK_GAP_OPTIONS.map((px) => (
                          <MenuItem key={px} value={px} sx={{ fontSize: "0.8rem" }}>
                            {px}px
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 132, height: 32, bgcolor: "background.paper" }}>
                      <InputLabel id="slack-mode-label">Slack</InputLabel>
                      <Select
                        labelId="slack-mode-label"
                        label="Slack"
                        value={slackDistributionMode}
                        onChange={onChangeSlackDistributionMode}
                        inputProps={{ "aria-label": "Slack distribution mode" }}
                        sx={{ height: 32, "& .MuiSelect-select": { py: 0.5 } }}
                      >
                        <MenuItem value={SLACK_DISTRIBUTION_MODE.PROPORTIONAL} sx={{ fontSize: "0.8rem" }}>
                          Proportional
                        </MenuItem>
                        <MenuItem value={SLACK_DISTRIBUTION_MODE.EQUAL} sx={{ fontSize: "0.8rem" }}>
                          Equal share
                        </MenuItem>
                        <MenuItem value={SLACK_DISTRIBUTION_MODE.TALLEST} sx={{ fontSize: "0.8rem" }}>
                          Tallest takes all
                        </MenuItem>
                        <MenuItem value={SLACK_DISTRIBUTION_MODE.NONE} sx={{ fontSize: "0.8rem" }}>
                          No fill
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </>
                ) : null}
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
                    <InputLabel
                      id="theme-select-label"
                      htmlFor="theme-select-input"
                      sx={{ "&.MuiInputLabel-shrink": { color: "text.primary" } }}
                    >
                      Theme
                    </InputLabel>
                    <Select
                      labelId="theme-select-label"
                      id="theme-select"
                      value={themeKey}
                      onChange={onChangeTheme}
                      label="Theme"
                      inputProps={{
                        id: "theme-select-input",
                        "aria-label": "Theme",
                        "aria-labelledby": "theme-select-label",
                      }}
                      sx={{
                        height: 32,
                        "& .MuiSelect-select": { py: 0.5 },
                      }}
                    >
                      {THEME_OPTIONS.map((option) => (
                        <MenuItem key={option.key} value={option.key} sx={{ fontSize: "0.8rem" }}>
                          {option.label}
                        </MenuItem>
                      ))}
                      <MenuItem
                        value={themeEditorMenuValue}
                        sx={{ fontSize: "0.8rem", fontStyle: "italic", borderTop: 1, borderColor: "divider" }}
                      >
                        Theme Builder...
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
