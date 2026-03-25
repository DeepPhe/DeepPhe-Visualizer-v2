import React, { useMemo, useState } from "react";
import { Box, Chip, Slider, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import HorizontalBarChart from "../components/HorizontalBarChart";

function HorizontalBarChartDemoView() {
  const [chartWidthPercent, setChartWidthPercent] = useState(60);
  const [fontScale, setFontScale] = useState(1);
  const [selectedValues, setSelectedValues] = useState([]);

  const data = useMemo(
    () =>
      Array.from({ length: 113 }, (_, index) => ({
        label: `Option ${index + 1}`,
        value: 100 + ((index + 1) * 37) % 1900,
      })),
    []
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, md: 4 } }}>
      <Stack spacing={2.5}>
        <Typography variant="h4" color="text.primary">
          Horizontal Bar Chart Demo
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Use the chevron to collapse or expand the chart. Click rows to add or remove selections.
          Use the sort button to cycle count sorting and value (label) sorting.
        </Typography>

        <Box sx={{ maxWidth: 360 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Chart Width: {chartWidthPercent}%
          </Typography>
          <Slider
            value={chartWidthPercent}
            min={20}
            max={100}
            step={5}
            marks={[
              { value: 20, label: "20%" },
              { value: 60, label: "60%" },
              { value: 100, label: "100%" },
            ]}
            valueLabelDisplay="auto"
            onChange={(_, nextValue) => setChartWidthPercent(Number(nextValue))}
            aria-label="Chart width percent"
          />
        </Box>

        <Box sx={{ maxWidth: 360 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Font Size: {Math.round(fontScale * 100)}%
          </Typography>
          <Slider
            value={fontScale}
            min={0.8}
            max={2}
            step={0.1}
            marks={[
              { value: 0.8, label: "80%" },
              { value: 1, label: "100%" },
              { value: 2, label: "200%" },
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${Math.round(Number(value) * 100)}%`}
            onChange={(_, nextValue) => setFontScale(Number(nextValue))}
            aria-label="Font size scale"
          />
        </Box>

        <Box sx={{ width: { xs: "100%", md: `${chartWidthPercent}%` } }}>
          <HorizontalBarChart
            title="Tumor Phenotype Counts"
            data={data}
            selectedValues={selectedValues}
            onSelectionChange={setSelectedValues}
            height={360}
            fontScale={fontScale}
            defaultExpanded
            defaultSort="value-desc"
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
            to="/filter-bar-chart-demo"
            sx={{ color: "primary.main", textDecoration: "none", width: "fit-content" }}
          >
            View Filter Bar Demo
          </Typography>
          <Typography
            component={RouterLink}
            to="/filter-list-control-demo"
            sx={{ color: "primary.main", textDecoration: "none", width: "fit-content" }}
          >
            View Filter List Demo
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

export default HorizontalBarChartDemoView;
