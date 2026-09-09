import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { Box, Drawer } from "@mui/material";
import PatientDocumentViewerCard from "./PatientDocumentViewerCard";

export default function PatientDocumentDrawer({
  open = false,
  document = null,
  concepts = [],
  factSelection = null,
  selectionContext = null,
  onClose = undefined,
  confidenceThreshold = undefined,
  onConfidenceThresholdChange = undefined,
  selectedConceptIds = undefined,
  onSelectedConceptIdsChange = undefined,
  container = null,
}) {
  const isOpen = Boolean(open && document);
  const drawerLabel = document?.name
    ? `Document viewer for ${document.name}`
    : "Patient document viewer";

  const handleClose = useCallback(
    (event, reason) => {
      if (reason === "escapeKeyDown") {
        event?.stopPropagation?.();
      }
      onClose?.();
    },
    [onClose]
  );

  const handleDrawerKeyDown = useCallback((event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
    }
  }, []);

  // Inside the cohort view the viewer belongs to the Selected Patients drawer,
  // so it is portalled into that panel and positioned within it. As a page-level
  // drawer it opened *behind* the panel anyway: a temporary Drawer sits at
  // theme.zIndex.drawer (1200) and the panel sits at modal - 1 (1299).
  const isContained = Boolean(container);

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      transitionDuration={180}
      container={container || undefined}
      sx={
        isContained
          ? { position: "absolute" }
          : // Modal level clears the panel without outranking real dialogs,
            // which share this level and win on DOM order.
            { zIndex: (theme) => theme.zIndex.modal }
      }
      ModalProps={{
        onKeyDown: handleDrawerKeyDown,
        // inset:0 makes the root fill the panel so the paper's right:0 resolves
        // against it; overflow:hidden clips the slide-in transform, which starts
        // off to the right and would otherwise widen the panel's scroll area.
        ...(isContained
          ? { style: { position: "absolute", inset: 0, overflow: "hidden" } }
          : {}),
        slotProps: {
          backdrop: {
            "data-testid": "patient-document-drawer-backdrop",
            ...(isContained ? { style: { position: "absolute" } } : {}),
          },
        },
      }}
      PaperProps={{
        "data-testid": "patient-document-drawer",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": drawerLabel,
        ...(isContained ? { style: { position: "absolute" } } : {}),
        sx: {
          width: isContained
            ? { xs: "100%", sm: "min(92%, 760px)", lg: "min(72%, 1040px)" }
            : { xs: "100vw", sm: "min(92vw, 760px)", lg: "min(72vw, 1040px)" },
          maxWidth: "100%",
          bgcolor: "background.paper",
          overflow: "hidden",
          boxShadow: (theme) => theme.shadows[14],
        },
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <PatientDocumentViewerCard
          selectedConceptIds={selectedConceptIds}
          onSelectedConceptIdsChange={onSelectedConceptIdsChange}
          embedded
          document={document}
          concepts={concepts}
          factSelection={factSelection}
          selectionContext={selectionContext}
          onClose={onClose}
          confidenceThreshold={confidenceThreshold}
          onConfidenceThresholdChange={onConfidenceThresholdChange}
        />
      </Box>
    </Drawer>
  );
}

PatientDocumentDrawer.propTypes = {
  open: PropTypes.bool,
  document: PropTypes.object,
  concepts: PropTypes.arrayOf(PropTypes.object),
  factSelection: PropTypes.object,
  selectionContext: PropTypes.object,
  onClose: PropTypes.func,
  confidenceThreshold: PropTypes.number,
  onConfidenceThresholdChange: PropTypes.func,
  selectedConceptIds: PropTypes.arrayOf(PropTypes.string),
  onSelectedConceptIdsChange: PropTypes.func,
  /** When set, the viewer is portalled into this node and positioned inside it. */
  container: PropTypes.any,
};
