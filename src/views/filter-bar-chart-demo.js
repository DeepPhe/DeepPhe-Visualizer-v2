import React, { useMemo, useState } from "react";
import { Box, Chip, Slider, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import FilterBarChart from "../components/FilterBarChart";

function FilterBarChartDemoView() {
  const [selectedValues, setSelectedValues] = useState([]);
  const [filterWidthPercent, setFilterWidthPercent] = useState(20);
  const [fontScale, setFontScale] = useState(1);

  const categories = useMemo(
    () => [
      { label: "Asian", count: 412 },
      { label: "Black", count: 638 },
      { label: "Hispanic", count: 529 },
      { label: "White", count: 1104 },
      { label: "Other", count: 148 },
      { label: "Unknown", count: 63 },
    ],
    []
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, md: 4 } }}>
      <Stack spacing={2.5}>
        <Typography variant="h4" color="text.primary">
          Filter Bar Chart Demo
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Click bars to add/remove active values. Parent state controls current selection.
        </Typography>

        <Box sx={{ maxWidth: 360 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Filter Width: {filterWidthPercent}%
          </Typography>
          <Slider
            value={filterWidthPercent}
            min={20}
            max={100}
            step={5}
            marks={[
              { value: 20, label: "20%" },
              { value: 60, label: "60%" },
              { value: 100, label: "100%" },
            ]}
            valueLabelDisplay="auto"
            onChange={(_, nextValue) => setFilterWidthPercent(Number(nextValue))}
            aria-label="Filter width percent"
          />
        </Box>

        <Box sx={{ maxWidth: 360 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Font Size: {Math.round(fontScale * 100)}%
          </Typography>
          <Slider
            value={fontScale}
            min={0.8}
            max={1.6}
            step={0.1}
            marks={[
              { value: 0.8, label: "80%" },
              { value: 1, label: "100%" },
              { value: 1.6, label: "160%" },
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${Math.round(Number(value) * 100)}%`}
            onChange={(_, nextValue) => setFontScale(Number(nextValue))}
            aria-label="Font size scale"
          />
        </Box>

        <Box sx={{ width: { xs: "100%", md: `${filterWidthPercent}%` } }}>
          <FilterBarChart
            title="Race Distribution"
            categories={categories}
            selectedValues={selectedValues}
            onSelectionChange={setSelectedValues}
            height={320}
            fontScale={fontScale}
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Selected Values
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {selectedValues.length > 0 ? (
              selectedValues.map((value) => <Chip key={value} label={value} size="small" />)
            ) : (
              <Typography variant="body2" color="text.secondary">
                None
              </Typography>
            )}
          </Stack>
        </Box>

        <Stack direction="row" spacing={2}>
          <Typography
            component={RouterLink}
            to="/filter-list-control-demo"
            sx={{ color: "primary.main", textDecoration: "none", width: "fit-content" }}
          >
            View List Control Demo
          </Typography>
          <Typography
            component={RouterLink}
            to="/"
            sx={{ color: "primary.main", textDecoration: "none", width: "fit-content" }}
          >
            Back Home
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

export default FilterBarChartDemoView;
