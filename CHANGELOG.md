# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Documentation pipeline: MkDocs site, screenshot capture, and PDF export
  scripts (`npm run docs:review`)
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
  - LICENSE (MIT)

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

- **0.1.0** - Initial release (March 17, 2026)

