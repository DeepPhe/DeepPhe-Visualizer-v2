import React from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import HorizontalBarFilter from "../../components/HorizontalBarFilter";
import {
  DEFAULT_FILTER_VALUE_SORT_MODE,
  FILTER_SORT_DIMENSION,
  FILTER_SORT_DIRECTION,
} from "./filterDefinitions";

const EMPTY_VALUES = Object.freeze([]);

/**
 * The per-class filter detail dialog: a search box, sort controls, and the
 * class's HorizontalBarFilter chart. Purely presentational — the selection /
 * expansion / custom-sort behavior is wired by FiltersView and passed in.
 */
export default function FilterDetailModal({
  open,
  onClose,
  activeFilterDetail,
  searchQuery,
  onSearchQueryChange,
  sortDimension,
  onSortDimensionChange,
  sortDirection,
  onSortDirectionToggle,
  chartData,
  onSelectionChange,
  onRowToggleExpand,
  customSortOrder,
  fontScale,
  getPatientSummary,
  inlinePatientIdsThreshold,
}) {
  const title = activeFilterDetail?.classDisplayName || "Filter details";
  const isAscending = sortDirection === FILTER_SORT_DIRECTION.ASC;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="filter-modal-title">
      <DialogTitle id="filter-modal-title">{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems="center">
            <TextField
              label="Search values"
              placeholder="Type to filter labels"
              size="small"
              fullWidth
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              inputProps={{
                "aria-label": "Search filter values",
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="filter-modal-sort-by-label">Sort by</InputLabel>
              <Select
                labelId="filter-modal-sort-by-label"
                value={sortDimension}
                label="Sort by"
                onChange={onSortDimensionChange}
              >
                <MenuItem value={FILTER_SORT_DIMENSION.COUNT}>Count</MenuItem>
                <MenuItem value={FILTER_SORT_DIMENSION.LABEL}>Label</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title={isAscending ? "Ascending" : "Descending"}>
              <IconButton
                onClick={onSortDirectionToggle}
                aria-label={isAscending ? "Sort ascending" : "Sort descending"}
                sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
              >
                {isAscending ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>
          {activeFilterDetail?.classError ? <Alert severity="error">{activeFilterDetail.classError}</Alert> : null}
          {chartData.length > 0 ? (
            <HorizontalBarFilter
              key={
                activeFilterDetail
                  ? `modal:${activeFilterDetail.type}:${activeFilterDetail.className}:${activeFilterDetail.sortMode}`
                  : "modal:chart"
              }
              className={
                activeFilterDetail?.type === "attributes"
                  ? "filter-modal-chart filter-modal-chart-attributes"
                  : "filter-modal-chart filter-modal-chart-omop"
              }
              title={title}
              showTitle={false}
              allowCollapse={false}
              showSortDimensionToggle={false}
              showSortCycleButton={false}
              data={chartData}
              selectedValues={activeFilterDetail?.selectedValues || EMPTY_VALUES}
              onSelectionChange={onSelectionChange}
              onRowToggleExpand={onRowToggleExpand}
              fontScale={fontScale}
              fillContainer={false}
              defaultSort={activeFilterDetail?.sortMode || DEFAULT_FILTER_VALUE_SORT_MODE}
              customSortOrder={customSortOrder}
              inlinePatientIdsThreshold={inlinePatientIdsThreshold}
              getPatientSummary={getPatientSummary}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No matching values.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

FilterDetailModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  activeFilterDetail: PropTypes.object,
  searchQuery: PropTypes.string,
  onSearchQueryChange: PropTypes.func,
  sortDimension: PropTypes.string,
  onSortDimensionChange: PropTypes.func,
  sortDirection: PropTypes.string,
  onSortDirectionToggle: PropTypes.func,
  chartData: PropTypes.array,
  onSelectionChange: PropTypes.func,
  onRowToggleExpand: PropTypes.func,
  customSortOrder: PropTypes.array,
  fontScale: PropTypes.number,
  getPatientSummary: PropTypes.func,
  inlinePatientIdsThreshold: PropTypes.number,
};
