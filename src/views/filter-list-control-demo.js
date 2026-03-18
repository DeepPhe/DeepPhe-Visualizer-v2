import React, { useMemo, useState } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import FilterListControl from "../components/FilterListControl";

function FilterListControlDemoView() {
  const [selectedValues, setSelectedValues] = useState([]);

  const categories = useMemo(
    () => [
      { label: "Adenocarcinoma", count: 1943 },
      { label: "Adenoma", count: 842 },
      { label: "Atypical Hyperplasia", count: 286 },
      { label: "Basal-like", count: 472 },
      { label: "Benign", count: 311 },
      { label: "Carcinoma in situ", count: 163 },
      { label: "Ductal", count: 901 },
      { label: "ER Positive", count: 1362 },
      { label: "ER Negative", count: 558 },
      { label: "Grade 1", count: 418 },
      { label: "Grade 2", count: 973 },
      { label: "Grade 3", count: 721 },
      { label: "HER2 Positive", count: 402 },
      { label: "HER2 Negative", count: 1505 },
      { label: "High Risk", count: 281 },
      { label: "Invasive", count: 1017 },
      { label: "Luminal A", count: 634 },
      { label: "Luminal B", count: 479 },
      { label: "Metastatic", count: 327 },
      { label: "Node Positive", count: 611 },
      { label: "Node Negative", count: 1108 },
      { label: "PR Positive", count: 1248 },
      { label: "PR Negative", count: 643 },
      { label: "Triple Negative", count: 285 },
      { label: "Unknown", count: 117 },
    ],
    []
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, md: 4 } }}>
      <Stack spacing={2.5}>
        <Typography variant="h4" color="text.primary">
          Filter List Control Demo
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This control is optimized for large filter sets and uses the same click-to-add/click-to-remove behavior.
        </Typography>

        <FilterListControl
          title="Tumor Phenotype Values"
          categories={categories}
          selectedValues={selectedValues}
          onSelectionChange={setSelectedValues}
          maxHeight={420}
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
            to="/filter-bar-chart-demo"
            sx={{ color: "primary.main", textDecoration: "none", width: "fit-content" }}
          >
            View Bar Chart Demo
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

export default FilterListControlDemoView;
