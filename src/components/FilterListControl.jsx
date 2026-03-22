import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Checkbox,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

const DEFAULT_MAX_HEIGHT = 360;

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) {
    return [];
  }

  return categories
    .map((item) => {
      const label = String(item?.label ?? "").trim();
      const parsedCount = Number(item?.count);
      const count = Number.isFinite(parsedCount) ? Math.max(0, parsedCount) : 0;
      return { label, count };
    })
    .filter((item) => item.label.length > 0);
}

export default function FilterListControl({
  title,
  categories,
  selectedValues,
  onSelectionChange,
  maxHeight = DEFAULT_MAX_HEIGHT,
  fontScale = 1,
}) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("value");
  const [sortDirection, setSortDirection] = useState("asc");
  const normalizedCategories = useMemo(() => normalizeCategories(categories), [categories]);
  const safeSelectedValues = useMemo(
    () => (Array.isArray(selectedValues) ? selectedValues : []),
    [selectedValues]
  );
  const selectedSet = useMemo(() => new Set(safeSelectedValues), [safeSelectedValues]);
  const hasSelections = selectedSet.size > 0;

  const visibleCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? normalizedCategories.filter((item) => item.label.toLowerCase().includes(query))
      : normalizedCategories;

    return [...filtered].sort((a, b) => {
      if (sortBy === "count") {
        const countCompare = a.count - b.count;
        if (countCompare !== 0) {
          return sortDirection === "asc" ? countCompare : -countCompare;
        }
      }

      const labelCompare = a.label.localeCompare(b.label, undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return sortDirection === "asc" ? labelCompare : -labelCompare;
    });
  }, [normalizedCategories, searchQuery, sortBy, sortDirection]);

  const handleToggle = (label) => {
    if (typeof onSelectionChange !== "function") {
      return;
    }

    if (selectedSet.has(label)) {
      onSelectionChange(safeSelectedValues.filter((value) => value !== label));
      return;
    }

    const nextValues = [...safeSelectedValues, label];
    onSelectionChange([...new Set(nextValues)]);
  };

  return (
    <Box sx={{ width: "100%" }}>
      {title ? (
        <Typography
          variant="subtitle1"
          color="text.primary"
          sx={{
            mb: 1.5,
            fontWeight: 600,
            fontSize: `calc(${theme.typography.subtitle1.fontSize} * ${fontScale})`,
          }}
        >
          {title}
        </Typography>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5 }}>
        <TextField
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          label="Search values"
          placeholder="Type to filter labels"
          size="small"
          fullWidth
          sx={{
            "& .MuiInputBase-input": {
              fontSize: `${0.875 * fontScale}rem`,
            },
            "& .MuiInputLabel-root": {
              fontSize: `${0.875 * fontScale}rem`,
            },
          }}
        />
        <FormControl
          size="small"
          sx={{
            minWidth: 140,
            "& .MuiInputLabel-root": {
              fontSize: `${0.875 * fontScale}rem`,
            },
            "& .MuiSelect-select": {
              fontSize: `${0.875 * fontScale}rem`,
            },
          }}
        >
          <InputLabel id="filter-list-sort-by-label">Sort by</InputLabel>
          <Select
            labelId="filter-list-sort-by-label"
            value={sortBy}
            label="Sort by"
            onChange={(event) => setSortBy(String(event.target.value))}
          >
            <MenuItem value="value">Value</MenuItem>
            <MenuItem value="count">Count</MenuItem>
          </Select>
        </FormControl>
        <IconButton
          aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
          onClick={() =>
            setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"))
          }
          sx={{
            alignSelf: { xs: "flex-start", sm: "center" },
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          {sortDirection === "asc" ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Box
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          maxHeight,
          overflowY: "auto",
          bgcolor: "background.paper",
        }}
      >
        {visibleCategories.length > 0 ? (
          <List disablePadding dense>
            {visibleCategories.map((item, index) => {
              const isSelected = selectedSet.has(item.label);
              const isDimmed = hasSelections && !isSelected;

              return (
                <ListItem
                  key={item.label}
                  disablePadding
                  divider={index < visibleCategories.length - 1}
                  sx={{ opacity: isDimmed ? 0.48 : 1 }}
                >
                  <ListItemButton
                    onClick={() => handleToggle(item.label)}
                    aria-pressed={isSelected}
                    aria-label={`${item.label} ${item.count}`}
                  >
                    <Checkbox edge="start" checked={isSelected} tabIndex={-1} disableRipple />
                    <ListItemText
                      primary={item.label}
                      secondary={`${item.count.toLocaleString()} records`}
                      primaryTypographyProps={{
                        variant: "body2",
                        color: isSelected ? "text.primary" : "text.secondary",
                        sx: { fontSize: `${0.875 * fontScale}rem` },
                      }}
                      secondaryTypographyProps={{
                        variant: "caption",
                        sx: { fontSize: `${0.75 * fontScale}rem` },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ p: 2, fontSize: `calc(${theme.typography.body2.fontSize} * ${fontScale})` }}
          >
            No matching values.
          </Typography>
        )}
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: "block",
          mt: 1,
          fontFamily: theme.typography.fontFamily,
          fontSize: `${0.75 * fontScale}rem`,
        }}
      >
        Showing {visibleCategories.length.toLocaleString()} of {normalizedCategories.length.toLocaleString()} values
      </Typography>
    </Box>
  );
}

FilterListControl.propTypes = {
  title: PropTypes.string,
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    })
  ),
  selectedValues: PropTypes.arrayOf(PropTypes.string),
  onSelectionChange: PropTypes.func.isRequired,
  maxHeight: PropTypes.number,
  fontScale: PropTypes.number,
};

FilterListControl.defaultProps = {
  title: "",
  categories: [],
  selectedValues: [],
  maxHeight: DEFAULT_MAX_HEIGHT,
  fontScale: 1,
};
