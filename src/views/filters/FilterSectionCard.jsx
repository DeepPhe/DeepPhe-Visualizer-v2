import React, { memo } from "react";
import PropTypes from "prop-types";
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
  showBarBehindDots = false,
  getPatientSummary = undefined,
  onOpenPatientDocumentView = undefined,
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
            showBarBehindDots={showBarBehindDots}
            getPatientSummary={getPatientSummary}
            onOpenPatientDocumentView={onOpenPatientDocumentView}
          />
        </Box>
      </Box>
    </Paper>
  );
}

FilterSectionCard.propTypes = {
  classNameKey: PropTypes.string,
  classDisplayName: PropTypes.string,
  classError: PropTypes.string,
  sortMode: PropTypes.string,
  density: PropTypes.string,
  data: PropTypes.array,
  selectedValues: PropTypes.array,
  selectedCount: PropTypes.number,
  onSelectionChange: PropTypes.func,
  onRowToggleExpand: PropTypes.func,
  fontScale: PropTypes.number,
  customSortOrder: PropTypes.array,
  inlinePatientIdsThreshold: PropTypes.number,
  showBarBehindDots: PropTypes.bool,
  getPatientSummary: PropTypes.func,
  onOpenPatientDocumentView: PropTypes.func,
  onOpenFilterModal: PropTypes.func,
  filterType: PropTypes.string,
  measureRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  cardOuterStyle: PropTypes.object,
  cardMarginBottom: PropTypes.number,
  cardHeightCapPx: PropTypes.number,
  cardHeightOverride: PropTypes.number,
  cardSx: PropTypes.object,
  contentAreaSx: PropTypes.object,
  isCompactDensity: PropTypes.bool,
};

export default memo(FilterSectionCard);
