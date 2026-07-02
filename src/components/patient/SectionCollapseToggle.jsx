import React from "react";
import PropTypes from "prop-types";
import { IconButton, Tooltip } from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/**
 * Shared collapse/expand disclosure button for the patient viewer panels.
 *
 * Keeps every panel header identical and WCAG-labeled in one place: the button
 * always carries an accessible "Expand/Collapse <label> section" name,
 * reflects state with aria-expanded, and points at the panel body via
 * aria-controls so screen readers announce the relationship.
 */
export default function SectionCollapseToggle({
  expanded = true,
  onToggle = undefined,
  label = "",
  panelId = undefined,
}) {
  const actionLabel = `${expanded ? "Collapse" : "Expand"} ${label} section`;

  return (
    <Tooltip title={actionLabel}>
      <IconButton
        size="small"
        aria-label={actionLabel}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => onToggle?.()}
      >
        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

SectionCollapseToggle.propTypes = {
  expanded: PropTypes.bool,
  onToggle: PropTypes.func,
  label: PropTypes.string,
  panelId: PropTypes.string,
};
