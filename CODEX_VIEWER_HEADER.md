# Codex Task — Document Viewer Contextual Header

## Goal

Replace the static "Document Viewer" title in `PatientDocumentViewerCard` with a rich, contextual subheader that tells the clinician *exactly* how and why the current document is showing: which fact badge they clicked, which cancer/tumor it came from, whether they picked it from the timeline, whether it was auto-selected on load, or whether they clicked a linked document in the fact detail panel.

## Files to change

| File | Action |
|------|--------|
| `src/views/patient.jsx` | Add `selectionContext` state + three selection handlers + pass prop to viewer |
| `src/components/EmbeddedPatientView.jsx` | Same state + handler changes as `patient.jsx` |
| `src/components/patient/PatientDocumentViewerCard.jsx` | Add `selectionContext` prop + `SelectionSummary` component + use in header |

Do not modify any other file.

---

## Background: how `selectionContext` is derived

`resolveFactSelection` (in `src/utils/patientView/factLinking.js`) already returns:
- `source`: `"cancer-attribute"` (fact is on the cancer) or `"tumor-attribute"` (fact is on a tumor)
- `cancerId`: the cancer's string ID, matches `cancer.cancerId || cancer.title` in `cancerSummary`
- `tumorId`: the tumor's string ID (empty string when source is `"cancer-attribute"`)
- `categoryName`: e.g., `"Location"`, `"Grade"`, `"Gene"`
- `prettyName`: e.g., `"Upper-Outer Quadrant of the Breast"`

`timelineData.reportData` items have `id`, `type`, `name`, `formattedDate`, `episode`.

`cancerSummary` is an array. Each item has `cancerId` (or `title` as fallback) and `tumors.listViewData` — an array of tumor objects each with `id`.

---

## Part 1 — `selectionContext` shape

Define this shape as a JSDoc comment near the top of `patient.jsx` and `EmbeddedPatientView.jsx`. Do not create a separate file.

```js
/**
 * @typedef {Object} SelectionContext
 * @property {"auto"|"timeline"|"fact"|"related-document"} source
 * @property {string|null} [documentType]   - report type, e.g. "NOTE"
 * @property {string|null} [documentDate]   - formatted date string, e.g. "2010/02/05"
 * @property {string|null} [episodeLabel]   - e.g. "Treatment"
 * @property {string|null} [categoryName]   - fact category, e.g. "Location"
 * @property {string|null} [prettyName]     - fact value, e.g. "Upper-Outer Quadrant of the Breast"
 * @property {boolean}     [isTumorLevel]   - true when fact is on a tumor, not the cancer
 * @property {number|null} [cancerIndex]    - 1-based position in cancerSummary array
 * @property {number|null} [tumorIndex]     - 1-based position in cancer's tumor list
 */
```

---

## Part 2 — Changes to `src/views/patient.jsx`

### 2a. Add `selectionContext` state

Add immediately after the existing `selectedDocumentId` state declaration:

```js
const [selectionContext, setSelectionContext] = useState(null);
```

### 2b. Add a helper to find cancer and tumor index from `cancerSummary`

Add this function **inside** the `PatientView` component body, after the `selectionContext` state declaration. It is used by the handlers below.

```js
const resolveCancerTumorIndex = useCallback(
  (cancerId, tumorId) => {
    const normalizedCancerId = String(cancerId || "").trim();
    const normalizedTumorId = String(tumorId || "").trim();

    if (!normalizedCancerId) {
      return { cancerIndex: null, tumorIndex: null };
    }

    const cancerIndex = cancerSummary.findIndex(
      (cancer) =>
        String(cancer?.cancerId || cancer?.title || "").trim() === normalizedCancerId
    );

    if (cancerIndex === -1) {
      return { cancerIndex: null, tumorIndex: null };
    }

    if (!normalizedTumorId) {
      return { cancerIndex: cancerIndex + 1, tumorIndex: null };
    }

    const tumors = Array.isArray(cancerSummary[cancerIndex]?.tumors?.listViewData)
      ? cancerSummary[cancerIndex].tumors.listViewData
      : [];

    const tumorIndex = tumors.findIndex(
      (tumor) => String(tumor?.id || "").trim() === normalizedTumorId
    );

    return {
      cancerIndex: cancerIndex + 1,
      tumorIndex: tumorIndex === -1 ? null : tumorIndex + 1,
    };
  },
  [cancerSummary]
);
```

### 2c. Add `handleSelectDocumentFromTimeline`

This replaces the bare `setSelectedDocumentId` passed to `PatientDocumentsCard`. It looks up the document's metadata from `timelineData.reportData` to build context.

Add after `resolveCancerTumorIndex`:

```js
const handleSelectDocumentFromTimeline = useCallback(
  (docId) => {
    const normalizedDocId = String(docId || "").trim();
    setSelectedDocumentId(normalizedDocId);

    const report = (timelineData?.reportData || []).find(
      (r) => String(r?.id || "").trim() === normalizedDocId
    );

    setSelectionContext({
      source: "timeline",
      documentType: String(report?.type || "").trim() || null,
      documentDate: String(report?.formattedDate || "").trim() || null,
      episodeLabel: String(report?.episode || "").trim() || null,
    });
  },
  [timelineData]
);
```

### 2d. Add `handleSelectRelatedDocument`

This handles clicks on the "Related documents" list inside the fact detail panel in `CancerTumorSummaryCard`. At the time this fires, `factSelection` is already set, so we can enrich with fact context.

Add after `handleSelectDocumentFromTimeline`:

```js
const handleSelectRelatedDocument = useCallback(
  (docId) => {
    const normalizedDocId = String(docId || "").trim();
    setSelectedDocumentId(normalizedDocId);

    const report = (timelineData?.reportData || []).find(
      (r) => String(r?.id || "").trim() === normalizedDocId
    );

    const { cancerIndex, tumorIndex } = resolveCancerTumorIndex(
      factSelection?.cancerId,
      factSelection?.tumorId
    );

    setSelectionContext({
      source: "related-document",
      categoryName: factSelection?.categoryName || null,
      prettyName: factSelection?.prettyName || null,
      isTumorLevel: factSelection?.source === "tumor-attribute",
      cancerIndex,
      tumorIndex,
      documentType: String(report?.type || "").trim() || null,
      documentDate: String(report?.formattedDate || "").trim() || null,
    });
  },
  [factSelection, timelineData, resolveCancerTumorIndex]
);
```

### 2e. Update `handleFactSelect`

Find the existing `handleFactSelect` function. After `setFactSelection(nextSelection)`, add context tracking. Also update the `setSelectedDocumentId` call to include context. Replace the function body with:

```js
const handleFactSelect = (factId) => {
  const normalizedFactId = String(factId || "").trim();
  if (!normalizedFactId || !patientData) {
    return;
  }

  if (factSelection?.factId === normalizedFactId) {
    setFactSelection(null);
    setSelectionContext(null);
    return;
  }

  const nextSelection = resolveFactSelection(patientData, normalizedFactId);
  setFactSelection(nextSelection);

  if (nextSelection?.documentIds?.length > 0) {
    const firstDocId = String(nextSelection.documentIds[0] || "").trim();
    setSelectedDocumentId(firstDocId);

    const { cancerIndex, tumorIndex } = resolveCancerTumorIndex(
      nextSelection.cancerId,
      nextSelection.tumorId
    );

    setSelectionContext({
      source: "fact",
      categoryName: nextSelection.categoryName || null,
      prettyName: nextSelection.prettyName || null,
      isTumorLevel: nextSelection.source === "tumor-attribute",
      cancerIndex,
      tumorIndex,
    });
  }
};
```

### 2f. Set auto-selection context on patient load

Inside `handleLoadPatient`, find the block that calls `setSelectedDocumentId(getMostRecentDocumentId(...))`. Replace that single call with:

```js
const mostRecentId = getMostRecentDocumentId(nextTimeline.reportData);
const mostRecentReport = (nextTimeline.reportData || []).find(
  (r) => String(r?.id || "").trim() === mostRecentId
);
setSelectedDocumentId(mostRecentId);
setSelectionContext({
  source: "auto",
  documentType: String(mostRecentReport?.type || "").trim() || null,
  documentDate: String(mostRecentReport?.formattedDate || "").trim() || null,
  episodeLabel: String(mostRecentReport?.episode || "").trim() || null,
});
```

Also add `setSelectionContext(null)` alongside every other `setSelectedDocumentId("")` call inside `handleLoadPatient` (the error path and the reset at the top of `handleLoadPatient`).

### 2g. Update the `PatientDocumentsCard` and `CancerTumorSummaryCard` `onSelectDocument` props

In the JSX, replace:

```jsx
// PatientDocumentsCard — was: onSelectDocument={setSelectedDocumentId}
onSelectDocument={handleSelectDocumentFromTimeline}

// CancerTumorSummaryCard — was: onSelectDocument={setSelectedDocumentId}
onSelectDocument={handleSelectRelatedDocument}
```

### 2h. Pass `selectionContext` to `PatientDocumentViewerCard`

In the JSX, add `selectionContext={selectionContext}` to the `PatientDocumentViewerCard` usage:

```jsx
<PatientDocumentViewerCard
  embedded
  document={selectedDocument}
  concepts={patientData.concepts}
  factSelection={factSelection}
  selectionContext={selectionContext}
/>
```

---

## Part 3 — Changes to `src/components/EmbeddedPatientView.jsx`

Apply the **identical** changes from Part 2 (sections 2a through 2h) to `EmbeddedPatientView.jsx`.

The component already has `cancerSummary`, `factSelection`, `timelineData`, `selectedDocumentId`, `patientData`, and `handleFactSelect` — all the same variables. The only naming differences:
- The data-loading effect uses `run()` instead of `handleLoadPatient` — add the auto-selection context at the same point where `setSelectedDocumentId(getMostRecentDocumentId(...))` is called inside `run()`.
- The reset paths (catch block and empty-patientId early return) should also call `setSelectionContext(null)`.

The prop additions for `PatientDocumentViewerCard`, the `handleSelectDocumentFromTimeline`, and `handleSelectRelatedDocument` handlers are identical to `patient.jsx`.

---

## Part 4 — Changes to `src/components/patient/PatientDocumentViewerCard.jsx`

### 4a. Add `SelectionSummary` component

Add this component above the `export default function PatientDocumentViewerCard` declaration. It renders the contextual subheader as a row of separator-joined spans.

```jsx
function SelectionSummary({ context }) {
  if (!context) {
    return null;
  }

  // Build an ordered list of { text, variant } segments
  const segments = [];

  const push = (text, variant = "normal") => {
    const normalized = String(text || "").trim();
    if (normalized) {
      segments.push({ text: normalized, variant });
    }
  };

  switch (context.source) {
    case "auto":
      push("Auto-selected", "muted");
      push("most recent document", "muted");
      if (context.documentType) push(context.documentType, "meta");
      if (context.documentDate) push(context.documentDate, "meta");
      if (context.episodeLabel) push(context.episodeLabel, "meta");
      break;

    case "timeline":
      push("Timeline", "muted");
      if (context.documentType) push(context.documentType, "accent");
      if (context.documentDate) push(context.documentDate, "meta");
      if (context.episodeLabel) push(context.episodeLabel, "meta");
      break;

    case "fact": {
      // Source label
      push(context.isTumorLevel ? "Tumor fact" : "Cancer fact", "muted");
      // Cancer / tumor position
      if (context.cancerIndex != null) {
        push(
          context.tumorIndex != null
            ? `Cancer ${context.cancerIndex} · Tumor ${context.tumorIndex}`
            : `Cancer ${context.cancerIndex}`,
          "accent"
        );
      }
      // What the fact is
      if (context.categoryName) push(context.categoryName, "meta");
      if (context.prettyName) push(context.prettyName, "strong");
      break;
    }

    case "related-document": {
      push("Linked document", "muted");
      if (context.cancerIndex != null) {
        push(
          context.tumorIndex != null
            ? `Cancer ${context.cancerIndex} · Tumor ${context.tumorIndex}`
            : `Cancer ${context.cancerIndex}`,
          "accent"
        );
      }
      if (context.categoryName) push(context.categoryName, "meta");
      if (context.prettyName) push(context.prettyName, "strong");
      if (context.documentType) push(context.documentType, "meta");
      if (context.documentDate) push(context.documentDate, "meta");
      break;
    }

    default:
      break;
  }

  if (segments.length === 0) {
    return null;
  }

  return (
    <Box
      component="span"
      sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.4, mt: 0.15 }}
    >
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <Typography
              component="span"
              variant="caption"
              aria-hidden="true"
              sx={{ color: "text.disabled", lineHeight: 1, userSelect: "none" }}
            >
              ·
            </Typography>
          )}
          <Typography
            component="span"
            variant="caption"
            sx={{
              lineHeight: 1.4,
              color:
                segment.variant === "muted"
                  ? "text.disabled"
                  : segment.variant === "accent"
                  ? "primary.main"
                  : segment.variant === "strong"
                  ? "text.primary"
                  : "text.secondary",
              fontWeight:
                segment.variant === "strong" || segment.variant === "accent" ? 600 : 400,
            }}
          >
            {segment.text}
          </Typography>
        </React.Fragment>
      ))}
    </Box>
  );
}

SelectionSummary.propTypes = {
  context: PropTypes.shape({
    source: PropTypes.oneOf(["auto", "timeline", "fact", "related-document"]),
    documentType: PropTypes.string,
    documentDate: PropTypes.string,
    episodeLabel: PropTypes.string,
    categoryName: PropTypes.string,
    prettyName: PropTypes.string,
    isTumorLevel: PropTypes.bool,
    cancerIndex: PropTypes.number,
    tumorIndex: PropTypes.number,
  }),
};
```

### 4b. Add `selectionContext` prop to `PatientDocumentViewerCard`

In the function signature, add `selectionContext = null` to the destructured props.

### 4c. Update the CardHeader in both render paths (no-document and with-document)

Both the "no document selected" branch and the main branch have a `CardHeader`. In **both**, replace the current `subheader` (which shows `document?.name || document?.id`) with the `SelectionSummary` component. The document name moves to the title when embedded.

**No-document branch** (currently `title="Document Viewer"`):

```jsx
<CardHeader
  title="Document Viewer"
  sx={{ py: embedded ? 1 : undefined, px: embedded ? 1.5 : undefined }}
  titleTypographyProps={{ variant: titleVariant, sx: { fontWeight: 700 } }}
/>
```

Leave this branch unchanged — there is no document, so no context to show.

**Main branch** (currently `title="Document Viewer"`, `subheader={document?.name || document?.id}`):

Replace with:

```jsx
<CardHeader
  title={document?.name || document?.id || "Document Viewer"}
  subheader={<SelectionSummary context={selectionContext} />}
  sx={{ py: embedded ? 1 : undefined, px: embedded ? 1.5 : undefined }}
  titleTypographyProps={{ variant: titleVariant, sx: { fontWeight: 700 } }}
  subheaderTypographyProps={{ component: "div", variant: "caption" }}
/>
```

Note: `subheaderTypographyProps={{ component: "div" }}` is required because `SelectionSummary` renders `<Box>` (a block element) inside the subheader and React will warn about a `<p>` containing block-level children otherwise.

### 4d. Update `PatientDocumentViewerCard.propTypes`

Add:

```js
selectionContext: PropTypes.shape({
  source: PropTypes.oneOf(["auto", "timeline", "fact", "related-document"]),
  documentType: PropTypes.string,
  documentDate: PropTypes.string,
  episodeLabel: PropTypes.string,
  categoryName: PropTypes.string,
  prettyName: PropTypes.string,
  isTumorLevel: PropTypes.bool,
  cancerIndex: PropTypes.number,
  tumorIndex: PropTypes.number,
}),
```

---

## Acceptance criteria

**Auto-selection (patient loads):**
Subheader reads: `Auto-selected · most recent document · NOTE · 2010/02/05 · Treatment`
(omitting any null fields)

**Timeline dot or document list click:**
Subheader reads: `Timeline · NOTE · 2010/02/05 · Treatment`

**Fact badge click — cancer-level fact:**
Subheader reads: `Cancer fact · Cancer 1 · Location · Upper-Outer Quadrant of the Breast`

**Fact badge click — tumor-level fact:**
Subheader reads: `Tumor fact · Cancer 1 · Tumor 2 · Grade · 2`

**Toggling a fact badge off (clicking an active badge):**
`selectionContext` is set to `null`. `SelectionSummary` renders nothing. The subheader disappears cleanly.

**Related document click (from fact detail panel):**
Subheader reads: `Linked document · Cancer 1 · Location · Upper-Outer Quadrant of the Breast · NOTE · 2010/02/05`

**No regressions:**
- `PatientDocumentViewerCard` still renders normally when `selectionContext` is not passed (defaults to `null`, subheader is empty).
- All existing fact badge click, concept toggle, group filter, and confidence filter behavior is unchanged.
- The `PatientDocumentsCard` `onSelectDocument` callback still receives a single string argument — `handleSelectDocumentFromTimeline` and `handleSelectRelatedDocument` both accept `(docId)` only.
