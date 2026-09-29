# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Event Timeline** panel on the patient view: temporal relations packed into
  overlap-free lanes by Finding, Disease, Stage/Grade, and Treatment, with
  relation-specific end caps (On / Overlaps / After / Before), a per-lane
  density strip when a lane is collapsed, and a Patient Age axis derived from
  the patient's date of birth
- **Overview + detail date range** on both the **Patient Document Timeline** and
  the **Event Timeline**, from one shared implementation. An overview strip under
  each chart shows every document or event across the full date range with fixed
  end dates, and its two handles select the range the chart shows. Each handle
  labels its date while zoomed, handles can't cross, and range changes are
  announced to screen readers. Both timelines share the same controls: zoom %,
  zoom in and out, pan earlier and later, reset, and the `+` / `-` / `0` /
  `←` / `→` keys
- The Patient Document Timeline and the Event Timeline are **linked**: they
  share one date range covering every document and event, a slider, button or
  key in either moves both, and their strips, handles and date axes line up
  vertically on screens 620px and wider. A handle released within a few pixels
  of either end snaps to it
- Selecting a mark in the Event Timeline highlights its concepts in the
  Document Viewer, and clearing the concept there clears the mark
- Patient demographics (gender, race, birth date) are filled from a bundled
  demographics asset when the API does not supply them
- Minimum-confidence filter on the **Patient Summary** card: a header slider
  (50–100%, in 5% steps) that hides findings below the chosen extraction
  confidence, keeps findings that have no confidence score, and announces how
  many findings are hidden via an `aria-live` region
- Collapse/expand controls on the **Cancer & Tumor Summary**, **Documents**, and
  **Document Viewer** cards (matching the Patient Summary card), plus a
  collapsible concept column inside the Document Viewer
- Clickable **Patient Summary** findings that open their source note in the
  Document Viewer
- A **View** control on the patient view switches between the **Improved**
  presentation (default) and the **Alpha** one, and remembers the choice. The
  improved view compares the cancers in one matrix with tumors nested and
  undocumented fields shown as a dash, drops a level of nested borders, uses
  four text sizes, bands alternate event lanes, marks negated events with a
  dashed line as well as red, names the visible date range against the whole
  range, and replaces the two magnifier icons with + and −
- The improved Cancer and Tumor Detail keeps its height down: TNM reads as one
  row ("T1 M0") rather than three, rows with nothing to compare (nothing
  documented, or a tumor only repeating its cancer) fold behind a count, and in
  the patient drawer the panel opens folded to its header, which reports how
  many attributes differ. Nothing is dropped: the completeness count still
  counts every field, and one click shows the folded rows

### Changed
- **Filter cards use the free space beside them.** In Standard density a long
  filter card is capped and scrolls even when the column next to it has empty
  room. Each section's real columns are now planned (the same shortest-column-
  first placement the grid uses), and a scrolling card grows into free space in
  its own column, in whole rows, never taller than its own content. Short cards
  keep their natural size. This covers every filter section, including the
  Cancer Type & Primary Site section where attribute cards share a grid with
  the OMOP cards
- Scrolling filter cards now end on a whole row instead of mid-row, at any font
  size, so the last visible row is complete and the cut-off is unmistakable
- The Patient Document Timeline's date range slider was drawn against the full
  date range but sat under the zoomed axis, so its handle positions were easy to
  misread by months. Its handles now sit on the overview strip's own fixed axis
- The Event Timeline no longer zooms on mouse-wheel scroll (the page scrolls,
  as on the document timeline), zooms up to 1600% rather than without limit, and
  labels its axes with evenly spaced dates. Event and birth dates are now built
  at local midnight, like document dates, so linked timelines print the same
  calendar date for the same position in every time zone. Its pan buttons
  move a fifth of the visible range; they previously moved a fifth of the whole
  range, which skipped past events at high zoom
- `d3-zoom`, `d3-brush`, `d3-selection`, and `d3-axis` are no longer
  dependencies. `d3-scale` and `d3-interpolate`, which the Event Timeline
  imports directly, are now declared rather than resolved through `@mui/x-charts`
- **Patient Details** and **Cancer and Tumor Detail** now flow across the full
  panel width instead of stacking in a single column, reclaiming roughly 300px
  of vertical space above the fold on a wide screen
- Responsive layout improvements for smaller screens across the patient view
- Faster filter counting and patient-detail loading

### Fixed
- Screen-reader-only text was sized `width: 1` in MUI's `sx`, which resolves to
  `100%` rather than `1px` and pushed a horizontal scrollbar onto the patient
  view at wide viewports
- Patient drawer failing to load due to a JavaScript error
- Removed a mislabeled UI label

## [2.0.0] - 2026-06-29

### Added
- Cohort Explorer filters view (`/`) with configurable filter sets, modal
  filter details, compact/compact-plus density modes, theme builder, and a
  Selected Patients bottom drawer with pagination, CSV export, and
  window-style minimize/maximize controls
- Patient view (`/patient`) with demographics, cancer/tumor summary, document
  timeline chart, and a document viewer with concept overlays
- Embedded patient view inside the filter drawer (open patients as tabs)
- Concept (NLP phenotype) filters wired through a new concepts controller
- Batch filter-count endpoint support with per-row count caching and a
  concurrency-limited fallback to individual requests
- Tallest-aligned filter section layout with dedicated columns for long
  filters, scrollable card caps, and slack distribution bounded by content
  height (`filterLayout.js`)
- Performance tracker spans and milestones (`utils/perfTracker.js`)
- Task-oriented Docusaurus user guide for building cohorts, reviewing selected
  patients, opening patient details, and exporting results
- Feature-documentation pipeline that captures screenshots, builds the guide,
  and exports the printable user-guide PDF (`npm run docs:generate`)
- Read-only piper files server (`server.js` + `src/piper-server/config.js`)
- Comprehensive unit testing infrastructure
- GitHub Actions CI/CD pipeline

### Changed
- Filter sets restructured: "Pathology" became "Pathology & Grade", new
  "Tumor Anatomy" set, Cancer Type and Primary Site merged into one section
- Patient view reworked into a denser three-panel layout
- Filter visibility now gated on data load to remove the loading flash

### Fixed
- Test suite restored to green (161 tests across 22 suites): repaired a
  corrupted `useDataLoader` test file, unparseable `HorizontalBarFilter`
  tests, and stale expectations across the FiltersView, filterSets, patient,
  and route suites
- Generated artifacts (`site/`, `output/`, `.idea/`) untracked from git

## [0.1.0] - 2026-03-17

### Added
- Initial project setup with CRACO
- Material-UI 5.16 integration
- React Router 6.30 for navigation
- Debug view with data visualization
  - OMOP data section
  - Attributes section
  - Concepts section
  - Cancers section
- Modular architecture
  - Custom hooks (useDataLoader)
  - Reusable components (FilterableValueCountTable, SummaryChart, SectionJumpLinks)
  - Utility functions (dataProcessing)
  - API client auto-generated from OpenAPI spec
- Accessibility features
  - WCAG 2.1 AA compliance
  - axe-core runtime testing
  - ESLint jsx-a11y plugin
  - Keyboard navigation support
- Data visualization components
  - Bar charts with Material-UI X-Charts
  - Filterable and sortable tables
  - Age decile distribution analysis
  - Category distribution charts
- API integration
  - DeepPhe Data API client
  - Support for OMOP, attributes, concepts, and cancers endpoints
  - Error handling and loading states
- Development tools
  - ESLint 8.57 with accessibility rules
  - Prettier code formatting
  - Hot module replacement
- Documentation
  - README.md with badges and comprehensive docs
  - ACCESSIBILITY.md with WCAG guidelines
  - CONTRIBUTING.md with development guidelines
  - LICENSE (Apache 2.0)

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- N/A (initial release)

---

## Version History

- **2.0.0** - DeepPhe Visualizer v2 release (June 29, 2026)
- **0.1.0** - Initial release (March 17, 2026)
