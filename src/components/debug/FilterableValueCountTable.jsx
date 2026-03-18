import React, { useState } from "react";
import {
  Box,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { sortDistributionAlphanumerically } from "../../utils/dataProcessing";

function FilterableValueCountTable({ rows, valueHeader = "Value", maxHeight = 280 }) {
  const uniqueLabels = sortDistributionAlphanumerically(rows).map((item) => item.label);
  const [searchText, setSearchText] = useState("");
  const [selectedValue, setSelectedValue] = useState("ALL");
  const [sortField, setSortField] = useState("value");
  const [sortDirection, setSortDirection] = useState("asc");
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const label = String(row?.label || "");
    const passesDropdown = selectedValue === "ALL" || label === selectedValue;
    const passesSearch = label.toLowerCase().includes(normalizedSearch);
    return passesDropdown && passesSearch;
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortField === "count") {
      const countDifference = (Number(a?.count) || 0) - (Number(b?.count) || 0);
      if (countDifference !== 0) {
        return sortDirection === "asc" ? countDifference : -countDifference;
      }
    }

    const labelComparison = String(a?.label || "").localeCompare(String(b?.label || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (sortField === "value") {
      return sortDirection === "asc" ? labelComparison : -labelComparison;
    }

    return labelComparison;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "count" ? "desc" : "asc");
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
        <TextField
          select
          size="small"
          variant="outlined"
          label="Filter"
          value={selectedValue}
          onChange={(event) => setSelectedValue(event.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 200 } }}
        >
          <MenuItem value="ALL">All values</MenuItem>
          {uniqueLabels.map((label) => (
            <MenuItem key={label} value={label}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          variant="outlined"
          label="Search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Type to filter (e.g. etas)"
          fullWidth
        />
        <IconButton
          onClick={() => setIsExpanded((previous) => !previous)}
          aria-label={isExpanded ? "Collapse list" : "Expand list"}
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>
      <TableContainer
        sx={{
          maxHeight: isExpanded ? "none" : maxHeight,
          overflow: isExpanded ? "visible" : "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.paper",
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "text.secondary" }}>
                <TableSortLabel
                  active={sortField === "value"}
                  direction={sortField === "value" ? sortDirection : "asc"}
                  onClick={() => handleSort("value")}
                >
                  {valueHeader}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ color: "text.secondary" }}>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <TableSortLabel
                    active={sortField === "count"}
                    direction={sortField === "count" ? sortDirection : "desc"}
                    onClick={() => handleSort("count")}
                  >
                    Count
                  </TableSortLabel>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.length > 0 ? (
              sortedRows.map((item) => (
                <TableRow
                  id={item.id || undefined}
                  key={`${item.label}:${item.count}`}
                  sx={{ "&:nth-of-type(odd)": { bgcolor: "action.hover" } }}
                >
                  <TableCell sx={{ maxWidth: 320, wordBreak: "break-word", color: "text.primary" }}>
                    {item.label}
                  </TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>
                    {Number(item.count).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="body2" color="text.secondary">
                    No matching values.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

export default FilterableValueCountTable;
