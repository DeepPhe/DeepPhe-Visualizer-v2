import React from "react";
import PropTypes from "prop-types";
import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";

const BUTTON_SX = { width: 24, height: 24, p: 0.25 };

function ControlButton({ title, label, onClick, disabled, children }) {
  return (
    <Tooltip title={title}>
      {/* A disabled button fires no events, so the tooltip needs a wrapper. */}
      <span>
        <IconButton size="small" aria-label={label} onClick={onClick} disabled={disabled} sx={BUTTON_SX}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

ControlButton.propTypes = {
  title: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool.isRequired,
  children: PropTypes.node.isRequired,
};

/**
 * The shared zoom and pan controls for both patient timelines: zoom %, pan
 * earlier, zoom out, zoom in, pan later and reset. Each button is disabled when
 * it would do nothing, and its tooltip names the matching key.
 */
export default function TimelineZoomControls({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onPanEarlier,
  onPanLater,
  onReset,
  canZoomIn,
  canZoomOut,
  canPanEarlier,
  canPanLater,
  canReset,
  disabled = false,
  labels,
}) {
  return (
    <Stack direction="row" spacing={0.15} alignItems="center" role="group" aria-label={labels.group}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mr: 0.15, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
      >
        {`${zoomPercent}%`}
      </Typography>
      <ControlButton
        title="Pan earlier (←)"
        label={labels.panEarlier}
        onClick={onPanEarlier}
        disabled={disabled || !canPanEarlier}
      >
        <KeyboardArrowLeftIcon fontSize="small" />
      </ControlButton>
      <ControlButton
        title="Zoom out (−)"
        label={labels.zoomOut}
        onClick={onZoomOut}
        disabled={disabled || !canZoomOut}
      >
        <ZoomOutIcon fontSize="small" />
      </ControlButton>
      <ControlButton
        title="Zoom in (+)"
        label={labels.zoomIn}
        onClick={onZoomIn}
        disabled={disabled || !canZoomIn}
      >
        <ZoomInIcon fontSize="small" />
      </ControlButton>
      <ControlButton
        title="Pan later (→)"
        label={labels.panLater}
        onClick={onPanLater}
        disabled={disabled || !canPanLater}
      >
        <KeyboardArrowRightIcon fontSize="small" />
      </ControlButton>
      <ControlButton
        title="Reset zoom (0)"
        label={labels.reset}
        onClick={onReset}
        disabled={disabled || !canReset}
      >
        <RestartAltIcon fontSize="small" />
      </ControlButton>
    </Stack>
  );
}

TimelineZoomControls.propTypes = {
  zoomPercent: PropTypes.number.isRequired,
  onZoomIn: PropTypes.func.isRequired,
  onZoomOut: PropTypes.func.isRequired,
  onPanEarlier: PropTypes.func.isRequired,
  onPanLater: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  canZoomIn: PropTypes.bool.isRequired,
  canZoomOut: PropTypes.bool.isRequired,
  canPanEarlier: PropTypes.bool.isRequired,
  canPanLater: PropTypes.bool.isRequired,
  canReset: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
  labels: PropTypes.shape({
    group: PropTypes.string.isRequired,
    zoomIn: PropTypes.string.isRequired,
    zoomOut: PropTypes.string.isRequired,
    panEarlier: PropTypes.string.isRequired,
    panLater: PropTypes.string.isRequired,
    reset: PropTypes.string.isRequired,
  }).isRequired,
};
