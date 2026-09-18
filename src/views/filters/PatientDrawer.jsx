import React from "react";
import PropTypes from "prop-types";
import { Alert, Box, IconButton, Paper, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import RemoveIcon from "@mui/icons-material/Remove";
import EmbeddedPatientView from "../../components/EmbeddedPatientView";
import PatientGrid from "../../components/PatientGrid";

export default function PatientDrawer({
  isVisible = false,
  isMaximized = false,
  isExpanded = false,
  filterSummaryText = "",
  activeDrawerTab = 0,
  setActiveDrawerTab = undefined,
  openPatientIds = [],
  cohortSize = 0,
  onClosePatientTab = undefined,
  panelId = "",
  patientGridRows = [],
  totalPatientGridPages = 0,
  currentPatientGridPage = 0,
  pageSize = 10,
  onPageChange = undefined,
  isTableLoading = false,
  pageError = "",
  onRetryPatientSummary = undefined,
  statusText = "",
  emptyStateHint = "",
  onOpenPatientTab = undefined,
  setIsExpanded = undefined,
  setIsMaximized = undefined,
}) {
  if (!isVisible) {
    return null;
  }

  const cohortLabel = Math.max(0, Number(cohortSize) || 0).toLocaleString();
  const activePatientId = activeDrawerTab > 0 ? openPatientIds[activeDrawerTab - 1] || "" : "";

  return (
    <Box
      sx={{
        position: "fixed",
        left: isMaximized ? { xs: 4, md: 16 } : { xs: 4, md: 16, lg: "5%" },
        right: isMaximized ? { xs: 4, md: 16 } : { xs: 4, md: 16, lg: "5%" },
        bottom: { xs: 8, md: 16 },
        top: isMaximized ? { xs: 72, md: 84 } : "auto",
        zIndex: (theme) => theme.zIndex.modal - 1,
        pointerEvents: "none",
      }}
    >
      <Paper
        elevation={10}
        data-testid="patient-grid-drawer"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (isMaximized) {
              setIsMaximized?.(false);
              return;
            }
            if (isExpanded) {
              setIsExpanded?.(false);
            }
          }
        }}
        sx={{
          pointerEvents: "auto",
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: { xs: 1, md: 2 },
          bgcolor: "background.paper",
          boxShadow: (theme) => theme.shadows[12],
          maxHeight: isMaximized
            ? { xs: "calc(100vh - 88px)", md: "calc(100vh - 116px)" }
            : { xs: "72vh", md: "min(78vh, 820px)" },
          height: isMaximized ? { xs: "calc(100vh - 88px)", md: "calc(100vh - 116px)" } : "auto",
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          onDoubleClick={(event) => {
            const isInteractiveTarget = event.target.closest('button, [role="tab"], [role="button"]');
            if (isInteractiveTarget) return;
            setIsMaximized?.((previousValue) => {
              const nextValue = !previousValue;
              if (nextValue) {
                setIsExpanded?.(true);
              }
              return nextValue;
            });
          }}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            pr: 0.5,
          }}
        >
          <Tabs
            value={activeDrawerTab}
            onChange={(_, nextTab) => setActiveDrawerTab?.(nextTab)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Patient drawer tabs"
            sx={{
              minHeight: 36,
              flex: 1,
              minWidth: 0,
              "& .MuiTab-root": { minHeight: 36, py: 0.5, fontSize: "0.75rem" },
            }}
          >
            <Tab
              label={
                <Box
                  component="span"
                  title={filterSummaryText ? `Filters: ${filterSummaryText}` : undefined}
                  sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}
                >
                  <Typography component="span" variant="caption" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    {`Selected Patients (${cohortLabel})`}
                  </Typography>
                  {filterSummaryText ? (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {`— ${filterSummaryText}`}
                    </Typography>
                  ) : null}
                </Box>
              }
              id="drawer-tab-0"
              aria-controls="drawer-tabpanel-0"
              aria-label={
                filterSummaryText
                  ? `Selected Patients (${cohortLabel}). Filters: ${filterSummaryText}`
                  : `Selected Patients (${cohortLabel})`
              }
              sx={{
                textTransform: "none",
                fontWeight: 600,
                maxWidth: { xs: 260, sm: 520, lg: 760 },
              }}
            />
            {openPatientIds.map((patientId, index) => (
              <Tab
                key={patientId}
                id={`drawer-tab-${index + 1}`}
                aria-controls={`drawer-tabpanel-${index + 1}`}
                aria-label={`Patient ${patientId}. Press Delete or Backspace to close.`}
                onKeyDown={(event) => {
                  if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault();
                    onClosePatientTab?.(patientId, event);
                  }
                }}
                sx={{ textTransform: "none" }}
                label={
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}
                  >
                    {patientId}
                  </Typography>
                }
              />
            ))}
          </Tabs>
          <Box
            role="group"
            aria-label="Drawer window controls"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, ml: 0.25 }}
          >
            {activePatientId ? (
              <Tooltip title={`Close patient tab ${activePatientId}`}>
                <IconButton
                  size="small"
                  aria-label={`Close patient tab for ${activePatientId}`}
                  onClick={(event) => onClosePatientTab?.(activePatientId, event)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip title={isExpanded ? "Minimize (collapse to header) — Esc" : "Restore"}>
              <IconButton
                size="small"
                aria-label={isExpanded ? "Minimize selected patients drawer" : "Restore selected patients drawer"}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                data-testid="patient-grid-drawer-minimize"
                onClick={() => {
                  setIsExpanded?.((previousValue) => {
                    const nextValue = !previousValue;
                    if (!nextValue && isMaximized) {
                      setIsMaximized?.(false);
                    }
                    return nextValue;
                  });
                }}
              >
                {isExpanded ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={isMaximized ? "Restore (exit fullscreen) — Esc" : "Maximize (fullscreen)"}>
              <IconButton
                size="small"
                aria-label={isMaximized ? "Restore selected patients drawer size" : "Maximize selected patients drawer"}
                aria-pressed={isMaximized}
                data-testid="patient-grid-drawer-maximize"
                onClick={() => {
                  setIsMaximized?.((previousValue) => {
                    const nextValue = !previousValue;
                    if (nextValue) {
                      setIsExpanded?.(true);
                    }
                    return nextValue;
                  });
                }}
              >
                {isMaximized ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box
          role="tabpanel"
          id="drawer-tabpanel-0"
          aria-labelledby="drawer-tab-0"
          hidden={activeDrawerTab !== 0 || !isExpanded}
          style={{ display: activeDrawerTab === 0 && isExpanded ? "block" : "none" }}
          sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 1, md: 1.5 }, py: 1 }}
        >
          {activeDrawerTab === 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
              {emptyStateHint ? (
                <Alert severity="info" sx={{ mb: 1, flexShrink: 0 }}>
                  {emptyStateHint}
                </Alert>
              ) : null}
              <PatientGrid
                data={patientGridRows}
                cohortSize={cohortSize}
                totalCohortCount={cohortSize}
                totalPages={totalPatientGridPages}
                currentPage={currentPatientGridPage}
                pageSize={pageSize}
                onPageChange={onPageChange}
                isLoading={isTableLoading}
                error={pageError}
                onRetry={onRetryPatientSummary}
                embedded
                title=""
                subtitle={statusText}
                compactHeader
                collapsiblePanelId={panelId}
                onPatientOpen={onOpenPatientTab}
                openPatientIds={openPatientIds}
              />
            </Box>
          ) : null}
        </Box>

        {openPatientIds.map((patientId, index) => (
          <Box
            key={patientId}
            role="tabpanel"
            id={`drawer-tabpanel-${index + 1}`}
            aria-labelledby={`drawer-tab-${index + 1}`}
            hidden={activeDrawerTab !== index + 1 || !isExpanded}
            style={{
              display: activeDrawerTab === index + 1 && isExpanded ? "flex" : "none",
            }}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowX: "hidden",
              overflowY: "auto",
              overscrollBehavior: "contain",
              py: 1.5,
              flexDirection: "column",
            }}
          >
            {activeDrawerTab === index + 1 && isExpanded ? <EmbeddedPatientView patientId={patientId} /> : null}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}

PatientDrawer.propTypes = {
  isVisible: PropTypes.bool,
  isMaximized: PropTypes.bool,
  isExpanded: PropTypes.bool,
  filterSummaryText: PropTypes.string,
  activeDrawerTab: PropTypes.number,
  setActiveDrawerTab: PropTypes.func,
  openPatientIds: PropTypes.array,
  cohortSize: PropTypes.number,
  onClosePatientTab: PropTypes.func,
  panelId: PropTypes.string,
  patientGridRows: PropTypes.array,
  totalPatientGridPages: PropTypes.number,
  currentPatientGridPage: PropTypes.number,
  pageSize: PropTypes.number,
  onPageChange: PropTypes.func,
  isTableLoading: PropTypes.bool,
  pageError: PropTypes.string,
  onRetryPatientSummary: PropTypes.func,
  statusText: PropTypes.string,
  emptyStateHint: PropTypes.string,
  onOpenPatientTab: PropTypes.func,
  setIsExpanded: PropTypes.func,
  setIsMaximized: PropTypes.func,
};
