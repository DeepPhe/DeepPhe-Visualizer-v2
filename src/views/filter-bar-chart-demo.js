import React, { useMemo, useState } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import FilterBarChart from "../components/FilterBarChart";

function FilterBarChartDemoView() {
  const [selectedValues, setSelectedValues] = useState([]);

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

        <FilterBarChart
          title="Race Distribution"
          categories={categories}
          selectedValues={selectedValues}
          onSelectionChange={setSelectedValues}
          height={320}
        />

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
