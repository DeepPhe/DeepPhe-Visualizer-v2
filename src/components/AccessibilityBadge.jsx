import React from "react";
import AccessibleForwardIcon from "@mui/icons-material/AccessibleForward";
import { Chip, Tooltip } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function AccessibilityBadge({ label = "WCAG 2.1 AA", to = "/accessibility", sx = {} }) {
  return (
    <Tooltip title="View accessibility statement">
      <Chip
        component={RouterLink}
        to={to}
        clickable
        icon={<AccessibleForwardIcon sx={{ fontSize: 16 }} />}
        label={label}
        size="small"
        sx={{
          borderRadius: 1,
          border: "1px solid",
          borderColor: "primary.main",
          bgcolor: "action.hover",
          color: "text.primary",
          fontWeight: 600,
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
          ...sx,
        }}
      />
    </Tooltip>
  );
}

