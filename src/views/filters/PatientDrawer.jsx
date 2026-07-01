import React from "react";
import PropTypes from "prop-types";
import { Box, IconButton, Paper, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
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
  collapsedHeaderSummary = null,
  onOpenPatientTab = undefined,
  setIsExpanded = undefined,
  setIsMaximized = undefined,
}) {
  if (!isVisible) {
    return null;
  }

  const cohortLabel = Math.max(0, Number(cohortSize) || 0).toLocaleString();

  return (
    <Box
      sx={{
        position: "fixed",
        left: "10%",
        right: "10%",
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
          borderRadius: 2,
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
        {filterSummaryText ? (
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              px: 1.5,
              py: 0.75,
              bgcolor: "action.hover",
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                lineHeight: 1.35,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={filterSummaryText}
            >
              {`Filters: ${filterSummaryText}`}
            </Typography>
          </Box>
        ) : null}
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
              label={`Selected Patients (${cohortLabel})`}
              id="drawer-tab-0"
              aria-controls="drawer-tabpanel-0"
              sx={{ textTransform: "none", fontWeight: 600 }}
            />
            {openPatientIds.map((patientId, index) => (
              <Tab
                key={patientId}
                id={`drawer-tab-${index + 1}`}
                aria-controls={`drawer-tabpanel-${index + 1}`}
                sx={{ textTransform: "none" }}
                label={
                  <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}
                    >
                      {patientId}
                    </Typography>
                    <Box
                      component="span"
                      role="button"
                      aria-label={`Close patient tab for ${patientId}`}
                      onClick={(event) => onClosePatientTab?.(patientId, event)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onClosePatientTab?.(patientId, event);
                        }
                      }}
                      tabIndex={0}
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        fontSize: "0.6rem",
                        lineHeight: 1,
                        ml: 0.25,
                        "&:hover": { bgcolor: "action.hover" },
                        "&:focus-visible": {
                          outline: "2px solid",
                          outlineColor: "primary.main",
                          outlineOffset: 1,
                        },
                      }}
                    >
                      ×
                    </Box>
                  </Box>
                }
              />
            ))}
          </Tabs>
          <Box
            role="group"
            aria-label="Drawer window controls"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, ml: 0.25 }}
          >
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
          sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 1.25 }}
        >
          {activeDrawerTab === 0 ? (
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
              title={`Selected Patients (${cohortLabel})`}
              subtitle={isExpanded ? statusText : ""}
              collapsible
              expanded={isExpanded}
              onToggleExpanded={() => setIsExpanded?.((previousValue) => !previousValue)}
              compactHeader
              toggleButtonTestId="patient-grid-drawer-toggle"
              collapsiblePanelId={panelId}
              collapsedHeaderSummary={collapsedHeaderSummary}
              onPatientOpen={onOpenPatientTab}
              openPatientIds={openPatientIds}
            />
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
  collapsedHeaderSummary: PropTypes.node,
  onOpenPatientTab: PropTypes.func,
  setIsExpanded: PropTypes.func,
  setIsMaximized: PropTypes.func,
};
