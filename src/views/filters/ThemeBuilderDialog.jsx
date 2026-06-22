import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { MONOSPACE_STACK, THEME_OPTIONS } from "../../themes";
import { toColorInputHexValue } from "./themeColorOverrides";

/**
 * The Theme Builder dialog: pick a theme, then override individual color
 * tokens/paths (with a search filter). Presentational — all state and
 * persistence live in FiltersView (via useThemeBuilderState-style handlers).
 */
export default function ThemeBuilderDialog({
  open,
  onClose,
  themeBuilderThemeKey,
  onThemeChange,
  onApplyTheme,
  activeThemeKey,
  onResetTheme,
  hasOverrides,
  onResetAll,
  hasAnyOverrides,
  searchQuery,
  onSearchQueryChange,
  filteredColorEntries,
  totalColorEntryCount,
  themeOverrides,
  onEntryChange,
}) {
  const overrideCount = Object.keys(themeOverrides).length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="theme-builder-modal-title">
      <DialogTitle id="theme-builder-modal-title">Theme Builder</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel id="theme-builder-theme-select-label">Theme</InputLabel>
              <Select
                labelId="theme-builder-theme-select-label"
                value={themeBuilderThemeKey}
                label="Theme"
                onChange={onThemeChange}
              >
                {THEME_OPTIONS.map((option) => (
                  <MenuItem key={option.key} value={option.key}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              onClick={onApplyTheme}
              disabled={themeBuilderThemeKey === activeThemeKey}
            >
              {themeBuilderThemeKey === activeThemeKey ? "Active Theme" : "Use This Theme"}
            </Button>
            <Button variant="outlined" color="warning" size="small" onClick={onResetTheme} disabled={!hasOverrides}>
              Reset Theme Colors
            </Button>
            <Button variant="outlined" color="warning" size="small" onClick={onResetAll} disabled={!hasAnyOverrides}>
              Reset All Themes
            </Button>
          </Stack>
          <TextField
            size="small"
            label="Search color paths"
            placeholder="palette.primary.main or #00619E"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
          <Typography variant="caption" color="text.secondary">
            Showing {filteredColorEntries.length.toLocaleString()} of {totalColorEntryCount.toLocaleString()} color
            entries · {overrideCount.toLocaleString()} overrides for this theme
          </Typography>
          <Box
            sx={{
              maxHeight: { xs: "52vh", md: "60vh" },
              overflowY: "auto",
              pr: 0.5,
            }}
          >
            <Stack spacing={1}>
              {filteredColorEntries.length > 0 ? (
                filteredColorEntries.map((entry) => {
                  const overriddenValue = themeOverrides[entry.id];
                  const displayValue = overriddenValue ?? entry.defaultValue;
                  const colorPickerValue = toColorInputHexValue(displayValue);
                  const hasEntryOverride = typeof overriddenValue === "string" && overriddenValue.length > 0;

                  return (
                    <Paper key={entry.id} variant="outlined" sx={{ p: 1 }}>
                      <Stack spacing={0.75}>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", fontFamily: MONOSPACE_STACK, wordBreak: "break-word" }}
                        >
                          {entry.pathLabel}
                          {entry.kind === "token" ? ` [color ${entry.tokenIndex + 1}]` : ""}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                          {colorPickerValue ? (
                            <TextField
                              size="small"
                              type="color"
                              label="Pick"
                              value={colorPickerValue}
                              onChange={(event) => onEntryChange(entry, event.target.value)}
                              sx={{ width: 96, flexShrink: 0 }}
                              inputProps={{
                                "aria-label": `${entry.pathLabel} color picker`,
                              }}
                            />
                          ) : null}
                          <TextField
                            size="small"
                            fullWidth
                            label={entry.kind === "direct" ? "Color value" : "Color token"}
                            value={displayValue}
                            onChange={(event) => onEntryChange(entry, event.target.value)}
                            inputProps={{
                              "aria-label": `${entry.pathLabel} color value`,
                            }}
                          />
                          <Button
                            size="small"
                            onClick={() => onEntryChange(entry, entry.defaultValue)}
                            disabled={!hasEntryOverride}
                          >
                            Reset
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No matching color entries for this query.
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

ThemeBuilderDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  themeBuilderThemeKey: PropTypes.string,
  onThemeChange: PropTypes.func,
  onApplyTheme: PropTypes.func,
  activeThemeKey: PropTypes.string,
  onResetTheme: PropTypes.func,
  hasOverrides: PropTypes.bool,
  onResetAll: PropTypes.func,
  hasAnyOverrides: PropTypes.bool,
  searchQuery: PropTypes.string,
  onSearchQueryChange: PropTypes.func,
  filteredColorEntries: PropTypes.array,
  totalColorEntryCount: PropTypes.number,
  themeOverrides: PropTypes.object,
  onEntryChange: PropTypes.func,
};
