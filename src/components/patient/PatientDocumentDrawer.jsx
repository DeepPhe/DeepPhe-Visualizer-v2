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

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      transitionDuration={180}
      // A temporary Drawer sits at theme.zIndex.drawer (1200), but the Selected
      // Patients drawer sits at modal - 1 (1299), so inside the cohort view the
      // viewer opened *behind* it. Modal level clears that without outranking
      // real dialogs, which share this level and win on DOM order.
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
      ModalProps={{
        onKeyDown: handleDrawerKeyDown,
        slotProps: {
          backdrop: {
            "data-testid": "patient-document-drawer-backdrop",
          },
        },
      }}
      PaperProps={{
        "data-testid": "patient-document-drawer",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": drawerLabel,
        sx: {
          width: { xs: "100vw", sm: "min(92vw, 760px)", lg: "min(72vw, 1040px)" },
          maxWidth: "100vw",
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
};
