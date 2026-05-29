# Codex Task — Patient View Tab in Selected Patients Drawer

## Overview

When a user double-clicks the expanded detail row in the patient grid (the row showing "DIAGNOSES · STAGING · BIOMARKERS · …"), open that patient's full profile in a new tab inside the Selected Patients drawer. The drawer gains a tab bar: a permanent "Patients" tab (the existing grid) plus one closeable tab per open patient. Max 5 patient tabs open at once.

## Files to create or modify

| File | Action |
|------|--------|
| `src/components/EmbeddedPatientView.jsx` | **CREATE** — inline patient profile component |
| `src/components/PatientGrid.jsx` | **MODIFY** — add `onPatientOpen` prop + double-click on detail row |
| `src/views/filters.js` | **MODIFY** — add tab state, tab bar UI, wire `onPatientOpen` |

Do not modify any other file.

---

## Part 1 — Create `src/components/EmbeddedPatientView.jsx`

This component loads and displays a single patient's profile inline, reusing the same card components as `src/views/patient.jsx`. It has no search form, no navigation bar, and no theme provider — the parent supplies the theme.

### Imports

```js
import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import PatientDemographicsCard from "./patient/PatientDemographicsCard";
import CancerTumorSummaryCard from "./patient/CancerTumorSummaryCard";
import PatientDocumentsCard from "./patient/PatientDocumentsCard";
import PatientDocumentViewerCard from "./patient/PatientDocumentViewerCard";
import { loadPatientProfile } from "../controllers/patient";
import { transformCancerSummary } from "../utils/patientView/transformCancerSummary";
import { transformDocumentTimeline } from "../utils/patientView/transformDocumentTimeline";
import { resolveFactSelection } from "../utils/patientView/factLinking";
```

### Helper (copy verbatim from `src/views/patient.jsx`)

```js
function getMostRecentDocumentId(reportData = []) {
  if (!Array.isArray(reportData) || reportData.length === 0) {
    return "";
  }
  return String(reportData[reportData.length - 1]?.id || "").trim();
}
```

### Component signature

```js
export default function EmbeddedPatientView({ patientId = "" }) {
```

### State

```js
  const [patientData, setPatientData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [cancerSummary, setCancerSummary] = useState([]);
  const [factSelection, setFactSelection] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestIdRef = useRef(0);
```

### Data loading effect

Trigger whenever `patientId` changes. Use the same request-ID guard pattern as `patient.jsx` to discard stale responses.

```js
  useEffect(() => {
    const normalizedId = String(patientId || "").trim();
    if (!normalizedId) {
      setPatientData(null);
      setTimelineData(null);
      setCancerSummary([]);
      setFactSelection(null);
      setSelectedDocumentId("");
      setErrorMessage("");
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setErrorMessage("");

    const run = async () => {
      try {
        const nextPatientData = await loadPatientProfile(normalizedId);
        if (requestIdRef.current !== requestId) return;

        const nextTimeline = transformDocumentTimeline({
          patientId: nextPatientData.patientId,
          patientName: nextPatientData.patientName,
          demographics: nextPatientData.demographics,
          documents: nextPatientData.documents,
        });
        const nextCancerSummary = transformCancerSummary(nextPatientData.cancers);

        setPatientData(nextPatientData);
        setTimelineData(nextTimeline);
        setCancerSummary(nextCancerSummary);
        setFactSelection(null);
        setSelectedDocumentId(getMostRecentDocumentId(nextTimeline.reportData));
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        setPatientData(null);
        setTimelineData(null);
        setCancerSummary([]);
        setFactSelection(null);
        setSelectedDocumentId("");
        setErrorMessage(error?.message || "Failed to load patient details.");
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    };

    run();
    return undefined;
  }, [patientId]);
```

### Derived state

```js
  const selectedDocument = useMemo(() => {
    const documents = Array.isArray(patientData?.documents) ? patientData.documents : [];
    if (documents.length === 0) return null;
    return documents.find((doc) => doc.id === selectedDocumentId) || documents[0];
  }, [patientData, selectedDocumentId]);
```

### Fact selection handler (copy from `patient.jsx`)

```js
  const handleFactSelect = (factId) => {
    const normalizedFactId = String(factId || "").trim();
    if (!normalizedFactId || !patientData) return;

    if (factSelection?.factId === normalizedFactId) {
      setFactSelection(null);
      return;
    }

    const nextSelection = resolveFactSelection(patientData, normalizedFactId);
    setFactSelection(nextSelection);

    if (nextSelection?.documentIds?.length > 0) {
      setSelectedDocumentId(String(nextSelection.documentIds[0] || "").trim());
    }
  };
```

### Render — loading state

```jsx
  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
          Loading {patientId}…
        </Typography>
      </Box>
    );
  }
```

### Render — error state

```jsx
  if (errorMessage) {
    return (
      <Alert severity="error" sx={{ m: 1.5 }}>
        {errorMessage}
      </Alert>
    );
  }
```

### Render — no data yet (blank `patientId`)

```jsx
  if (!patientData) {
    return null;
  }
```

### Render — patient cards

Use the same 4-column grid pattern from `src/views/patient.jsx`. All four cards receive `embedded` prop.

```jsx
  return (
    <Box sx={{ overflow: "auto", maxHeight: "inherit" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: selectedDocument
              ? "200px minmax(0, 1fr) 280px minmax(0, 2fr)"
              : "200px minmax(0, 1fr) 280px",
          },
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          mx: 1.5,
          mb: 1.5,
        }}
      >
        <Box
          sx={{
            minWidth: { lg: 160 },
            maxWidth: { lg: 200 },
            borderRight: { lg: 1 },
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <PatientDemographicsCard patientData={patientData} />
        </Box>

        <Box
          sx={{
            minWidth: 0,
            borderTop: { xs: 1, lg: 0 },
            borderColor: "divider",
          }}
        >
          <CancerTumorSummaryCard
            cancers={cancerSummary}
            factSelection={factSelection}
            selectedDocumentId={selectedDocumentId}
            onFactSelect={handleFactSelect}
            onSelectDocument={setSelectedDocumentId}
          />
        </Box>

        <Box
          sx={{
            minWidth: 0,
            borderTop: { xs: 1, lg: 0 },
            borderLeft: { lg: 1 },
            borderColor: "divider",
          }}
        >
          <PatientDocumentsCard
            embedded
            timelineData={timelineData}
            selectedDocumentId={selectedDocumentId}
            relatedDocumentIds={factSelection?.documentIds || []}
            onSelectDocument={setSelectedDocumentId}
          />
        </Box>

        {selectedDocument ? (
          <Box
            sx={{
              minWidth: 0,
              borderTop: { xs: 1, lg: 0 },
              borderLeft: { lg: 1 },
              borderColor: "divider",
            }}
          >
            <PatientDocumentViewerCard
              embedded
              document={selectedDocument}
              concepts={patientData.concepts}
              factSelection={factSelection}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
```

### PropTypes

```js
EmbeddedPatientView.propTypes = {
  patientId: PropTypes.string,
};
```

---

## Part 2 — Modify `src/components/PatientGrid.jsx`

### 2a. Add `onPatientOpen` prop

In the `PatientGrid` function signature, add `onPatientOpen = undefined` to the destructured props:

```js
export default function PatientGrid({
  // … existing props …
  onPatientOpen = undefined,
}) {
```

### 2b. Pass `onPatientOpen` into `createColumns`

`createColumns` already receives `{ onToggleRow }`. Add `onPatientOpen` to the same object:

Change the call site:

```js
// BEFORE
const columns = useMemo(() => createColumns({ onToggleRow: toggleRowExpansion }), [toggleRowExpansion]);

// AFTER
const columns = useMemo(
  () => createColumns({ onToggleRow: toggleRowExpansion, onPatientOpen }),
  [toggleRowExpansion, onPatientOpen]
);
```

`createColumns` does not need to change — `onPatientOpen` is not used in column cells.

### 2c. Add double-click to the detail-row `TableRow`

Find the `TableRow` that wraps `<DetailPanel row={row} />`. It currently looks like:

```jsx
{row.getIsExpanded() ? (
  <TableRow>
    <TableCell
      colSpan={totalColumnCount}
      sx={{
        py: 0,
        px: 0,
        bgcolor: theme.custom?.rowHoverBg || alpha(theme.palette.primary.main, 0.08),
      }}
    >
      <DetailPanel row={row} />
    </TableCell>
  </TableRow>
) : null}
```

Replace it with:

```jsx
{row.getIsExpanded() ? (
  <TableRow
    onDoubleClick={
      typeof onPatientOpen === "function"
        ? () => onPatientOpen(row.original?.patientId)
        : undefined
    }
    sx={{
      cursor: typeof onPatientOpen === "function" ? "pointer" : "default",
    }}
  >
    <TableCell
      colSpan={totalColumnCount}
      title={
        typeof onPatientOpen === "function"
          ? `Double-click to open patient view for ${row.original?.patientId}`
          : undefined
      }
      sx={{
        py: 0,
        px: 0,
        bgcolor: theme.custom?.rowHoverBg || alpha(theme.palette.primary.main, 0.08),
      }}
    >
      <DetailPanel row={row} />
    </TableCell>
  </TableRow>
) : null}
```

### 2d. Update `PatientGrid.propTypes`

Add:

```js
  onPatientOpen: PropTypes.func,
```

---

## Part 3 — Modify `src/views/filters.js`

### 3a. Add MUI imports

`Tab` and `Tabs` are not currently imported. Add them to the existing `@mui/material` import block:

```js
import {
  // … existing …
  Tab,
  Tabs,
} from "@mui/material";
```

Also add `CloseIcon`:

```js
import CloseIcon from "@mui/icons-material/Close";
```

### 3b. Import `EmbeddedPatientView`

Add with the other component imports:

```js
import EmbeddedPatientView from "../components/EmbeddedPatientView";
```

### 3c. Add state for open patient tabs

Add these two state declarations near the other patient-grid state declarations (around the `currentPatientGridPage` declarations):

```js
const [openPatientIds, setOpenPatientIds] = useState([]); // array of patientId strings, max 5
const [activeDrawerTab, setActiveDrawerTab] = useState(0); // 0 = patient grid, 1-N = patient views
```

### 3d. Add handler `handleOpenPatientTab`

Add this handler near `handleRetryPatientSummary`:

```js
const MAX_OPEN_PATIENT_TABS = 5;

const handleOpenPatientTab = useCallback((patientId) => {
  const normalizedId = String(patientId || "").trim();
  if (!normalizedId) return;

  setOpenPatientIds((previous) => {
    const existingIndex = previous.indexOf(normalizedId);
    if (existingIndex !== -1) {
      // Tab already open — just switch to it
      setActiveDrawerTab(existingIndex + 1);
      return previous;
    }

    const next = [...previous, normalizedId].slice(-MAX_OPEN_PATIENT_TABS);
    setActiveDrawerTab(next.length); // index of the newly added tab (1-based)
    return next;
  });

  // Ensure the drawer is expanded when opening a patient tab
  setIsPatientGridDockExpanded(true);
}, []);
```

### 3e. Add handler `handleClosePatientTab`

```js
const handleClosePatientTab = useCallback((patientId, event) => {
  event.stopPropagation(); // prevent tab switch on close click
  setOpenPatientIds((previous) => {
    const index = previous.indexOf(patientId);
    const next = previous.filter((id) => id !== patientId);

    // Adjust active tab: if closing the active tab or a tab before it, move left
    setActiveDrawerTab((previousTab) => {
      const closingTabIndex = index + 1; // 1-based tab index
      if (previousTab === closingTabIndex) {
        return Math.max(0, closingTabIndex - 1);
      }
      if (previousTab > closingTabIndex) {
        return previousTab - 1;
      }
      return previousTab;
    });

    return next;
  });
}, []);
```

### 3f. Replace the `Paper` drawer content

Find the entire block starting with `<Paper elevation={10} data-testid="patient-grid-drawer" ...>` and ending with `</Paper>`. Replace the interior content as follows.

**The `Paper` element's own props and `sx` remain unchanged.** Only its children change.

Replace:

```jsx
<Paper elevation={10} data-testid="patient-grid-drawer" onKeyDown={...} sx={...}>
  <Box sx={{ px: 1.5, py: 1.25, minHeight: 0 }}>
    <PatientGrid
      data={patientGridRows}
      {/* ... all existing props ... */}
    />
  </Box>
</Paper>
```

With:

```jsx
<Paper elevation={10} data-testid="patient-grid-drawer" onKeyDown={(event) => {
  if (event.key === "Escape" && isPatientGridDockExpanded) {
    setIsPatientGridDockExpanded(false);
  }
}} sx={{
  pointerEvents: "auto",
  overflow: "hidden",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: alpha(activeTheme.palette.background.paper, 0.9),
  opacity: 0.9,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow: (theme) => theme.shadows[12],
  maxHeight: { xs: "60vh", md: "min(64vh, 640px)" },
  transition: "box-shadow 0.2s ease, transform 0.2s ease",
  display: "flex",
  flexDirection: "column",
}}>
  {/* Tab bar — always visible even when drawer is collapsed */}
  <Box sx={{ borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
    <Tabs
      value={activeDrawerTab}
      onChange={(_, nextTab) => setActiveDrawerTab(nextTab)}
      variant="scrollable"
      scrollButtons="auto"
      aria-label="Patient drawer tabs"
      sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5, fontSize: "0.75rem" } }}
    >
      <Tab
        label={`Selected Patients (${Math.max(0, Number(cohortSize) || 0).toLocaleString()})`}
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
              <Typography component="span" variant="caption" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>
                {patientId}
              </Typography>
              <Box
                component="span"
                role="button"
                aria-label={`Close patient tab for ${patientId}`}
                onClick={(event) => handleClosePatientTab(patientId, event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleClosePatientTab(patientId, event);
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
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
                }}
              >
                ×
              </Box>
            </Box>
          }
        />
      ))}
    </Tabs>
  </Box>

  {/* Tab panels */}
  <Box
    role="tabpanel"
    id="drawer-tabpanel-0"
    aria-labelledby="drawer-tab-0"
    hidden={activeDrawerTab !== 0}
    sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 1.25 }}
  >
    {activeDrawerTab === 0 ? (
      <PatientGrid
        data={patientGridRows}
        cohortSize={cohortSize}
        totalCohortCount={cohortSize}
        totalPages={totalPatientGridPages}
        currentPage={currentPatientGridPage}
        pageSize={PATIENT_GRID_PAGE_SIZE}
        onPageChange={setCurrentPatientGridPage}
        isLoading={patientGridDrawerTableLoading}
        error={patientGridPageError}
        onRetry={handleRetryPatientSummary}
        embedded
        title={`Selected Patients (${Math.max(0, Number(cohortSize) || 0).toLocaleString()})`}
        subtitle={isPatientGridDockExpanded ? patientGridDrawerStatusText : ""}
        collapsible
        expanded={isPatientGridDockExpanded}
        onToggleExpanded={() => setIsPatientGridDockExpanded((previousValue) => !previousValue)}
        compactHeader
        toggleButtonTestId="patient-grid-drawer-toggle"
        collapsiblePanelId={patientGridDrawerPanelId}
        collapsedHeaderSummary={patientGridCollapsedHeaderSummary}
        onPatientOpen={handleOpenPatientTab}
      />
    ) : null}
  </Box>

  {openPatientIds.map((patientId, index) => (
    <Box
      key={patientId}
      role="tabpanel"
      id={`drawer-tabpanel-${index + 1}`}
      aria-labelledby={`drawer-tab-${index + 1}`}
      hidden={activeDrawerTab !== index + 1}
      sx={{ flex: 1, minHeight: 0, overflowY: "auto", py: 1.5 }}
    >
      {activeDrawerTab === index + 1 ? (
        <EmbeddedPatientView patientId={patientId} />
      ) : null}
    </Box>
  ))}
</Paper>
```

> **Note on `display: flex, flexDirection: column` on Paper:** The existing `Paper` does not have these. They are required to let the tab panels fill available height. Add them to the Paper's `sx` as shown above.

---

## Acceptance criteria

**Double-click trigger**
- Double-clicking the detail row (the expanded row showing DIAGNOSES / STAGING / BIOMARKERS etc.) opens the patient's tab in the drawer.
- Single-clicking the detail row still only expands/collapses — no change to existing behavior.
- If the patient tab is already open, double-clicking switches to the existing tab without adding a duplicate.

**Tab bar**
- "Selected Patients" tab is always the leftmost tab (index 0).
- Each patient tab shows the patient ID in monospace and a close button (×).
- Closing a patient tab removes it; focus stays on the nearest remaining tab (never out of bounds).
- Maximum 5 patient tabs. When the 6th patient is opened, the oldest tab is silently discarded (FIFO via `.slice(-5)`).

**Patient view content**
- The `EmbeddedPatientView` shows a spinner while loading.
- On success, it renders all four card components in the same grid layout as `patient.jsx`.
- Fact badges are clickable and link to documents.
- The document viewer column is conditionally visible (only when a document is selected), matching the behavior implemented in `CODEX_TASKS.md Task 1`.

**Accessibility**
- The tab bar uses `role="tabpanel"` / `aria-labelledby` / `aria-controls` correctly.
- The close button (×) has `role="button"`, `aria-label`, and is keyboard-operable (Enter / Space).
- The drawer Escape key still collapses the drawer regardless of which tab is active.

**No regressions**
- All existing `PatientGrid` props continue to work unchanged when `onPatientOpen` is not provided.
- The grid's expand/collapse, sort, search, pagination, and CSV export are unaffected.
- The `CloseIcon` import is only needed if you use the MUI icon — using the `×` character (as shown) avoids the icon import entirely; remove the `import CloseIcon` line if the icon is not used.
