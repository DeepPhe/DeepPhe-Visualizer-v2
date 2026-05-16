# CLAUDE.md — DeepPhe Visualizer v3

## Project Overview

**DeepPhe Visualizer v3** is a React 18 / Material-UI 5 web application for cancer phenotype extraction and analysis. It presents complex oncology data — patient timelines, tumor summaries, pathology reports, and biomarker grids — to clinicians and researchers.

**Stack:** React 18, Material-UI 5, CRACO, React Router 6, TanStack Table, MUI X Charts, Emotion, Sass, Node 18+

**Core concerns:**
- Medical data accuracy and clarity are paramount — errors or confusion here affect clinical decisions
- WCAG 2.1 AA accessibility compliance is a hard requirement
- Users are domain experts (oncologists, researchers), not general consumers — but they are often time-pressured and switching contexts rapidly

---

## Role: Development Partner

Claude's primary job is to help build, debug, and improve DeepPhe Visualizer v3. This means writing real code, tracing bugs to their root cause, proposing architecture improvements, and implementing features — not just reviewing or advising.

When helping with development:
- **Read before writing** — Before implementing anything, look at the relevant existing files to understand current patterns, naming conventions, and data shapes. Don't invent abstractions that conflict with what's already there.
- **Be concrete** — Prefer working code over descriptions of what code should do.
- **Respect the stack** — Use MUI 5 components and theming over raw CSS; use TanStack Table APIs correctly; use React Router 6 patterns (loaders, `useNavigate`, etc.); follow the existing hook/controller/client separation.
- **Stay in the file structure** — New components go in `src/components/`, new views in `src/views/`, business logic in `src/controllers/`, API calls in `src/clients/`. Don't scatter logic across layers.
- **Match existing patterns** — Look at a nearby file to understand how data flows before adding new state or props. Don't introduce a new state management pattern unless there's a clear reason.

---

## Development Guidelines

### React & Component Patterns

- Prefer functional components with hooks. No class components.
- Custom hooks live in `src/hooks/`. Extract reusable logic there rather than duplicating it across components.
- Keep components focused — if a component is doing both data fetching and complex rendering, split it.
- Use `React.memo`, `useMemo`, and `useCallback` where renders are expensive (e.g., patient grid with large datasets), but don't pre-optimize unnecessarily.
- Avoid prop drilling more than 2 levels deep — use context or lift state to a controller.

### MUI 5 / Theming

- Use theme tokens from `themes.js` for colors, spacing, and typography — never hardcode hex values or pixel sizes that conflict with the theme.
- Use `sx` prop for one-off layout tweaks. Use `styled()` or Emotion for reusable component-level styles.
- Use MUI's `<Grid>` and `<Box>` for layout; avoid custom flexbox wrappers unless MUI's layout components genuinely can't do the job.
- Check `themes.js` before adding a new color — it may already be defined.

### Data & API

- API calls live in `src/clients/`. Components and controllers should not call `fetch` or `axios` directly.
- Data transformation (reshaping API responses for display) belongs in `src/controllers/`, not inside components.
- Handle loading, error, and empty states explicitly for every async operation — silently failing or showing a blank screen is not acceptable in a medical context.
- Be careful with filter logic — a filter that silently excludes patients is a data correctness bug, not just a UX issue.

### TanStack Table

- Column definitions belong close to the view that uses them, not in a shared global location unless the same columns appear in multiple places.
- Use `columnHelper` for type-safe column definitions.
- Sorting, filtering, and pagination state should be controlled (passed in as state + setter) when the parent needs to react to it (e.g., for URL sync or analytics).

### MUI X Charts / Data Visualization

- Always label axes. Never rely on tooltips alone to convey what an axis represents.
- Use the theme's color palette for series colors — don't invent new colors for charts.
- For time-series data, ensure the x-axis domain is explicitly set so the scale doesn't shift when data changes.

### Accessibility (WCAG 2.1 AA — Required)

These are not optional and must be maintained in any code Claude writes or modifies:
- All interactive elements must have accessible names (`aria-label`, `aria-labelledby`, or visible label).
- All interactions must be keyboard-operable — test with Tab, Enter, Space, and arrow keys.
- Color must never be the sole means of conveying information (add text or icon).
- Dynamic updates (filter results, loading states) must use `aria-live` regions.
- Minimum contrast: 4.5:1 for normal text, 3:1 for large text and UI components.

---

## Key Files and Architecture

```
src/
  components/         # Shared UI components (PatientGrid, HorizontalBarFilter, etc.)
  views/              # Top-level page/view components
  controllers/        # Business logic and data transformation
  hooks/              # Custom React hooks
  clients/            # API client code
  constants/          # App-wide enums and config values
  utils/              # Utility functions
  themes.js           # MUI theme configuration (colors, typography, spacing)
  styles.css          # Global styles
```

Before implementing a feature or fixing a bug, check:
- `themes.js` — for the color palette, spacing scale, and typography to stay consistent
- The component's test file (if present in `__tests__/`) — to understand expected behavior and avoid breaking it
- Related controllers and clients — to understand the data shapes flowing into the component

---

## Domain Context

This app is used in clinical and research oncology contexts. Keep these facts in mind:

- **User expertise is high but time is low** — Clinicians know oncology deeply but are context-switching under time pressure. Labels, tooltips, and empty states should be precise, not verbose.
- **Data errors have real stakes** — A filter that silently excludes patients, a timeline event on the wrong date, or a mislabeled biomarker can affect clinical judgment. Double-check data transformation logic.
- **Data is probabilistic** — Many values (NLP-extracted phenotypes) carry confidence scores or uncertainty. The UI should represent this honestly; don't flatten uncertainty into binary states.
- **Cohort comparison is a primary workflow** — Researchers compare subgroups. Keep this in mind when building filter, grid, and chart features.
- **Printing and export matter** — Visualizations are shared in presentations or printed. Don't break print layouts.

---

## Debugging Approach

When tracking down a bug:
1. Read the component and its data source before guessing — most bugs in this app come from data transformation mismatches between the API response and what the component expects.
2. Check whether the issue is in the client (wrong fetch), controller (wrong transformation), or component (wrong rendering logic) before touching any code.
3. For visual bugs, check `themes.js` and the component's `sx`/`styled` usage before assuming the bug is in component logic.
4. For filter/grid bugs, verify that the TanStack Table state (column filters, sorting) matches what's being passed to the API or applied client-side — these are often out of sync.
