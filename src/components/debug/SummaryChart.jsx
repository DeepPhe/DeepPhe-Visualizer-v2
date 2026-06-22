import React from "react";
import PropTypes from "prop-types";
import { alpha, useTheme } from "@mui/material/styles";
import { BarChart } from "@mui/x-charts/BarChart";
import { sortDistributionAlphanumerically } from "../../utils/dataProcessing";
import FilterableValueCountTable from "./FilterableValueCountTable";

const MAX_BAR_CHART_VALUES = 12;

function SummaryChart({ distribution }) {
  const theme = useTheme();
  const sortedDistribution = sortDistributionAlphanumerically(distribution);

  if (sortedDistribution.length > MAX_BAR_CHART_VALUES) {
    return <FilterableValueCountTable rows={sortedDistribution} />;
  }

  return (
    <BarChart
      height={260}
      grid={{ horizontal: true }}
      yAxis={[
        {
          width: 84,
          tickLabelStyle: {
            fontSize: 12,
            fill: theme.palette.text.secondary,
          },
          valueFormatter: (value) => Number(value).toLocaleString(),
        },
      ]}
      xAxis={[
        {
          scaleType: "band",
          data: sortedDistribution.map((item) => item.label),
          tickLabelStyle: {
            angle: -35,
            textAnchor: "end",
            fontSize: 12,
            fill: theme.palette.text.secondary,
          },
        },
      ]}
      series={[
        {
          data: sortedDistribution.map((item) => item.count),
          color: alpha(theme.palette.primary.main, 0.85),
        },
      ]}
      margin={{ top: 16, right: 12, bottom: 86, left: 88 }}
      sx={{
        ".MuiChartsGrid-line": {
          stroke: theme.palette.grey[300],
          strokeDasharray: "4 4",
        },
      }}
    />
  );
}

SummaryChart.propTypes = {
  distribution: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      count: PropTypes.number,
    })
  ),
};

export default SummaryChart;
