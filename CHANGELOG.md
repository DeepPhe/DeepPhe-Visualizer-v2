# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive unit testing infrastructure
- GitHub Actions CI/CD pipeline
- Code coverage reporting with Codecov

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

