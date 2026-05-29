# Codex Implementation Tasks — Patient View UX

Three self-contained tasks. Implement them independently and in order. Each task lists every file to touch, exactly what to change, and the acceptance criteria. Do not modify any file not listed.

---

## Task 1 — Conditional document viewer (show/hide on demand)

**Goal:** The Document Viewer column must be hidden until the user explicitly selects a document. When a document is selected the column expands in. When visible, focus moves to the viewer heading and a screen-reader announcement fires.

### Files to change

#### `src/views/patient.jsx`

**1a. Make the grid template column-count conditional on `selectedDocument`.**

Find the `Box` that has `display: "grid"` and `gridTemplateColumns`. Change `gridTemplateColumns` from:

```js
gridTemplateColumns: {
  xs: "minmax(0, 1fr)",
  lg: "200px minmax(0, 1fr) 280px minmax(0, 2fr)",
},
```

To:

```js
gridTemplateColumns: {
  xs: "minmax(0, 1fr)",
  lg: selectedDocument
    ? "200px minmax(0, 1fr) 280px minmax(0, 2fr)"
    : "200px minmax(0, 1fr) 280px",
},
```

**1b. Add an `aria-live` region immediately before the grid `Box`.**

Insert this element directly above the grid `Box` (inside the outer `Stack`):

```jsx
<Typography
  component="p"
  variant="caption"
  aria-live="polite"
  aria-atomic="true"
  sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}
>
  {selectedDocument
    ? `Document viewer opened: ${selectedDocument.name || selectedDocument.id}`
    : ""}
</Typography>
```

**1c. Conditionally render the 4th grid column.**

Find the `Box` that wraps `<PatientDocumentViewerCard embedded ... />`. Wrap the entire `Box` in a conditional:

```jsx
{selectedDocument ? (
  <Box
    sx={{
      minWidth: 0,
      minHeight: 0,
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
```

The `PatientDocumentViewerCard` must NOT render at all when `selectedDocument` is null.

---

#### `src/components/patient/PatientDocumentViewerCard.jsx`

**1d. Move focus to the viewer heading when the component mounts in embedded mode.**

Add a `useRef` for the heading and a `useEffect` that focuses it on mount. Only focus when `embedded` is `true`.

Add this import if not already present:

```js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

Inside `PatientDocumentViewerCard`, after the existing state declarations, add:

```js
const headingRef = useRef(null);

useEffect(() => {
  if (embedded && headingRef.current) {
    headingRef.current.focus();
  }
}, []); // run once on mount only
```

Pass `ref` and `tabIndex` to the `CardHeader` title. Replace the `CardHeader` in the non-null document branch with:

```jsx
<CardHeader
  title={
    <span ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
      {selectedDocument ? (selectedDocument.name || selectedDocument.id) : "Document Viewer"}
    </span>
  }
  subheader={document?.name || document?.id}
  sx={{ py: embedded ? 1 : undefined, px: embedded ? 1.5 : undefined }}
  titleTypographyProps={{ variant: titleVariant, sx: { fontWeight: 700 } }}
  subheaderTypographyProps={{ variant: "body2", color: "text.secondary" }}
/>
```

> Note: `tabIndex={-1}` allows programmatic focus without adding the element to the natural tab order. `outline: "none"` suppresses the focus ring on the non-interactive heading span (the focus is only for announcement, not navigation).

**Acceptance criteria for Task 1:**
- On page load with a patient loaded, the grid shows 3 columns; the Document Viewer is not rendered.
- Clicking a document in the list or a dot on the timeline shows the 4th column with the viewer.
- VoiceOver / NVDA announces "Document viewer opened: [doc name]" when the column appears.
- Keyboard focus moves to the document name heading inside the viewer on open.
- No TypeScript / PropTypes errors; `embedded` prop remains backward-compatible (defaults to `false`).

---

## Task 2 — Fix color-only encoding on concept chips (WCAG 1.4.1)

**Goal:** The concept chips in the Document Viewer's Concept List tab currently use color as the sole differentiator for semantic group (Anatomy, Finding, Disorder, etc.). Add a persistent legend above the chip list AND a short group-prefix label inside each chip so the encoding is not color-only.

### File to change

#### `src/components/patient/PatientDocumentViewerCard.jsx`

**2a. Define a short prefix map for each group family.**

Add this constant near the top of the file, after the `GROUP_FAMILY_RANK` declaration:

```js
const GROUP_FAMILY_PREFIX = {
  Anatomy: "A",
  Device: "Dv",
  Finding: "F",
  Disorder: "D",
  Severity: "Sv",
  Attribute: "At",
  Intervention: "Rx",
};

function getGroupPrefix(groupName) {
  const family = GROUP_FAMILY_BY_NAME[groupName];
  return GROUP_FAMILY_PREFIX[family] || groupName.slice(0, 2).toUpperCase();
}
```

**2b. Add a persistent legend above the concept chip list.**

Inside `TabPanel value={activeTab} index={0}` (the Concept List tab panel), find the `<Stack spacing={1}>` and insert a legend `Box` as its first child, directly above the "Concepts in Document" header row. Use `sortedGroupNames` and `highlightModel.groupColorByName` which are already in scope:

```jsx
{sortedGroupNames.length > 0 ? (
  <Box
    sx={{
      display: "flex",
      flexWrap: "wrap",
      gap: 1,
      pb: 0.75,
      borderBottom: 1,
      borderColor: "divider",
    }}
    role="list"
    aria-label="Concept group legend"
  >
    {sortedGroupNames.map((groupName) => {
      const family = GROUP_FAMILY_BY_NAME[groupName] || groupName;
      const prefix = getGroupPrefix(groupName);
      const color = highlightModel.groupColorByName[groupName] || DEFAULT_GROUP_COLOR;
      return (
        <Box
          key={groupName}
          role="listitem"
          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 10,
              height: 10,
              borderRadius: "2px",
              bgcolor: color,
              border: "1px solid rgba(0,0,0,0.2)",
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
            <strong>{prefix}</strong> {family}
          </Typography>
        </Box>
      );
    })}
  </Box>
) : null}
```

**2c. Prepend the group prefix to each chip label.**

Find the `Chip` component rendered inside `highlightModel.conceptRows.map(...)`. Change the `label` prop so it prepends the prefix. The chip's `label` is currently:

```jsx
label={
  <Box component="span" sx={{ ... }}>
    {`${conceptRow.label} (${conceptRow.mentionCount})`}
    {allMentionsNegated ? <Box ...>°</Box> : null}
  </Box>
}
```

Replace the text node `{`${conceptRow.label} (${conceptRow.mentionCount})`}` with:

```jsx
{`${getGroupPrefix(conceptRow.group)} · ${conceptRow.label} (${conceptRow.mentionCount})`}
```

The full updated `label` prop becomes:

```jsx
label={
  <Box
    component="span"
    sx={{
      position: "relative",
      display: "inline-block",
      pr: allMentionsNegated ? 1.1 : 0,
    }}
  >
    {`${getGroupPrefix(conceptRow.group)} · ${conceptRow.label} (${conceptRow.mentionCount})`}
    {allMentionsNegated ? (
      <Box
        component="span"
        aria-hidden
        sx={{
          position: "absolute",
          top: -5,
          right: 0,
          color: "error.main",
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        °
      </Box>
    ) : null}
  </Box>
}
```

**Acceptance criteria for Task 2:**
- A legend appears above the concept chip list showing each group family with its color swatch and prefix label (e.g., "A Anatomy", "F Finding").
- Each chip label reads "A · Upper-Outer Quadrant (5)" — prefix, middle-dot, concept name, count.
- The legend is announced by screen readers as a list (`role="list"`).
- The color swatches are `aria-hidden="true"` since the text label conveys the same information.
- Existing chip click behavior (concept toggle, `selectedConceptIdSet` highlight) is unchanged.
- No changes to the Group Filter or Confidence Filter tabs.

---

## Task 3 — Constrain timeline chart height

**Goal:** The timeline SVG currently reserves a fixed `rowHeight: 72` per document type row regardless of data density. Reduce the row height so the chart is more compact and does not dominate the Document Timeline column. Also add a CSS `max-height` to the SVG container so it cannot grow unbounded.

### Files to change

#### `src/utils/patientView/timelineChartLayout.js`

**3a. Reduce `rowHeight` in `DEFAULT_DIMENSIONS`.**

Find `DEFAULT_DIMENSIONS` and change `rowHeight` from `72` to `52`:

```js
const DEFAULT_DIMENSIONS = {
  svgWidth: 1320,
  plotLeft: 236,
  plotRight: 20,
  plotTop: 48,      // was 64 — reduce top padding
  rowHeight: 52,    // was 72 — more compact rows
  stackSpacing: 8,
  footerHeight: 44, // was 56 — reduce footer
  datePaddingDays: 21,
};
```

Change only `plotTop`, `rowHeight`, and `footerHeight`. Do not change `svgWidth`, `plotLeft`, `plotRight`, `stackSpacing`, or `datePaddingDays`.

Effect: for a patient with 3 document types the SVG height drops from 336 px to 240 px (at native resolution), and proportionally smaller at the rendered column width.

---

#### `src/components/patient/PatientDocumentsCard.jsx`

**3b. Cap the rendered height of the SVG container box.**

Find the `Box` wrapping the `<svg>` element. It currently has:

```jsx
<Box
  sx={{
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    overflowX: "auto",
    bgcolor: "background.paper",
    display: "flex",
    justifyContent: "center",
  }}
>
```

Add `maxHeight: 200` and `overflowY: "hidden"` to the `sx` prop:

```jsx
<Box
  sx={{
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    overflowX: "auto",
    overflowY: "hidden",
    bgcolor: "background.paper",
    display: "flex",
    justifyContent: "center",
    maxHeight: 200,
  }}
>
```

`overflowY: "hidden"` clips the SVG if the proportional height exceeds 200 px. Combined with the reduced `rowHeight` from Task 3a, the chart will fit within 200 px for most patient datasets (≤ 4 document types).

**Acceptance criteria for Task 3:**
- The timeline chart container never exceeds 200 px in height regardless of the number of document type rows.
- All timeline dots remain clickable; no interaction behavior changes.
- The horizontal scroll behaviour (`overflowX: "auto"`) is preserved — the SVG can still scroll horizontally at narrow column widths.
- No changes to `buildTimelineChartModel`'s return shape or any consumer of `timelineChartLayout.js` other than the dimension constants.
- Verify with 1-row, 3-row, and 5-row patient datasets that the chart renders without clipping the date axis tick labels at the bottom.
