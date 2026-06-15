import React, { memo } from "react";
import { Alert, Box, Button, Paper } from "@mui/material";
import HorizontalBarFilter from "../../components/HorizontalBarFilter";

function FilterSectionCard({
  classNameKey = "",
  classDisplayName = "",
  classError = "",
  sortMode = "",
  density = "standard",
  data = [],
  selectedValues = [],
  selectedCount = 0,
  onSelectionChange = undefined,
  onRowToggleExpand = undefined,
  fontScale = 1,
  customSortOrder = [],
  inlinePatientIdsThreshold = 20,
  getPatientSummary = undefined,
  onOpenFilterModal = undefined,
  filterType = "attributes",
  measureRef = undefined,
  cardOuterStyle = undefined,
  cardMarginBottom = 0,
  cardHeightCapPx = 0,
  cardHeightOverride = undefined,
  cardSx = undefined,
  contentAreaSx = undefined,
  isCompactDensity = false,
}) {
  return (
    <Paper
      elevation={0}
      className="filter-card"
      ref={measureRef}
      style={cardOuterStyle}
      data-card-margin-bottom={Math.round(cardMarginBottom)}
      data-card-height-cap={cardHeightCapPx}
      data-card-height-override={cardHeightOverride}
      sx={cardSx}
    >
      <Box className="filter-card-content" sx={contentAreaSx}>
        <Box
          className="filter-card-body"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            flex: 1,
            minHeight: 0,
          }}
        >
          <Button
            className="filter-card-open-button"
            type="button"
            variant={selectedCount > 0 ? "contained" : "outlined"}
            onClick={() => onOpenFilterModal?.(filterType, classNameKey, classDisplayName)}
            aria-label={`Open ${classDisplayName} filter`}
            sx={{
              justifyContent: "space-between",
              textTransform: "none",
              fontWeight: 700,
              minHeight: isCompactDensity ? 24 : 32,
              py: isCompactDensity ? 0 : 0.25,
              px: isCompactDensity ? 0.75 : 1.25,
              fontSize: isCompactDensity ? "0.75rem" : undefined,
            }}
          >
            <Box
              component="span"
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "left",
                pr: 1,
              }}
              title={classDisplayName}
            >
              {classDisplayName}
            </Box>
            <Box component="span" sx={{ flexShrink: 0 }}>
              {selectedCount > 0 ? `${selectedCount} selected` : "Details"}
            </Box>
          </Button>
          {classError ? <Alert severity="error">{classError}</Alert> : null}
          <HorizontalBarFilter
            key={`inline:${filterType}:${classNameKey}:${sortMode}`}
            className="filter-card-chart"
            title={classDisplayName}
            showTitle={false}
            allowCollapse={false}
            showSortDimensionToggle={false}
            showSortCycleButton={false}
            fillContainer
            density={density}
            data={data}
            selectedValues={selectedValues}
            onSelectionChange={onSelectionChange}
            onRowToggleExpand={onRowToggleExpand}
            fontScale={fontScale}
            defaultSort={sortMode}
            customSortOrder={customSortOrder}
            inlinePatientIdsThreshold={inlinePatientIdsThreshold}
            getPatientSummary={getPatientSummary}
          />
        </Box>
      </Box>
    </Paper>
  );
}

export default memo(FilterSectionCard);
