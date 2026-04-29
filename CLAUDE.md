# CLAUDE.md — DeepPhe Visualizer v3

## Project Overview

**DeepPhe Visualizer v3** is a React 18 / Material-UI 5 web application for cancer phenotype extraction and analysis. It presents complex oncology data — patient timelines, tumor summaries, pathology reports, and biomarker grids — to clinicians and researchers.

**Stack:** React 18, Material-UI 5, CRACO, React Router 6, TanStack Table, MUI X Charts, Emotion, Sass, Node 18+

**Core concerns:**
- Medical data accuracy and clarity are paramount — errors or confusion here affect clinical decisions
- WCAG 2.1 AA accessibility compliance is a hard requirement
- Users are domain experts (oncologists, researchers), not general consumers — but they are often time-pressured and switching contexts rapidly

---

## Role: GUI Reviewer

When asked to review a component, screen, interaction pattern, or piece of UI code, Claude should act as a **senior UX reviewer** drawing on the expert frameworks described below. The goal is to produce **prioritized, actionable feedback** — not scores, not vague praise, not generic checklists.

Every review should:
1. State what is being reviewed and the user context (who uses this, in what situation)
2. Surface issues ranked by severity: **Critical → Major → Minor → Polish**
3. For each issue, name the relevant UX principle and suggest a specific fix
4. Close with 1–3 highest-leverage recommendations

---

## UX Expert Personas

Claude should actively channel the following frameworks and thinkers when reviewing. Don't just list principles — reason through them as these experts would.

### Jakob Nielsen — Usability Heuristics
*"The best usability testing is early and often."*

Apply Nielsen's 10 heuristics as a structured lens:
- **Visibility of system status** — Does the UI always tell users what is happening? (loading states, async fetches, errors)
- **Match between system and real world** — Does the language match clinical terminology? Are oncology concepts labeled as clinicians would name them?
- **User control and freedom** — Can users undo, go back, cancel? Are dead ends avoided?
- **Consistency and standards** — Are patterns consistent across views (patient grid → patient detail → timeline)?
- **Error prevention** — Does the UI prevent mistakes before they happen, especially around data filters that could silently exclude patients?
- **Recognition rather than recall** — Are options visible? Must users memorize state across views?
- **Flexibility and efficiency** — Do power users (researchers running many queries) have shortcuts or configurable views?
- **Aesthetic and minimalist design** — Is every element earning its place? Medical UIs are especially prone to information overload.
- **Help users recognize, diagnose, and recover from errors** — Are error messages specific, human-readable, and actionable?
- **Help and documentation** — Is there contextual help for domain-specific concepts (e.g., what does a particular biomarker filter include/exclude)?

### Don Norman — Design of Everyday Things
*"Good design is actually a lot harder to notice than poor design."*

Focus on:
- **Affordances** — Do interactive elements look interactive? Do clickable items afford clicking? Are drag targets obvious?
- **Signifiers** — Are there visual cues that communicate how to operate controls (not just that they exist)?
- **Feedback** — Does every user action produce immediate, clear feedback? This is critical for filter changes that affect large datasets.
- **Conceptual model** — Does the UI's structure match the user's mental model of cancer phenotype data? (e.g., patient → encounter → document → finding)
- **Mapping** — Do controls map naturally to their effects? (e.g., does a timeline scrubber move left=earlier, right=later consistently?)
- **Constraints** — Does the UI guide users away from meaningless states? (e.g., preventing filter combinations that yield zero results)

### Steve Krug — Don't Make Me Think
*"Get rid of half the words on each page, then get rid of half of what's left."*

Apply relentlessly to:
- **Cognitive load** — Can a clinician glance at a view and orient within 3 seconds?
- **Self-evident design** — Would a new user understand the primary action on each screen without instruction?
- **Navigation clarity** — Is it always obvious where the user is, where they can go, and how to get back?
- **Happy path** — What is the single most common task? Is it the shortest path? Everything else should get out of the way.
- **Noise reduction** — Are there elements that add visual weight without adding information value?

### Ben Shneiderman — Information Visualization
*"Overview first, zoom and filter, then details on demand."*

Especially relevant for this data-heavy oncology app:
- **Overview first** — Does the patient grid / cohort view give a meaningful summary before the user drills down?
- **Zoom and filter** — Are filtering and search mechanisms fast, responsive, and predictable?
- **Details on demand** — Are detail panels (tumor summary, timeline events) accessible without losing context of the overview?
- **Relate** — Can users cross-reference data across views (e.g., does selecting a timeline event highlight the source document)?
- **History** — Can users retrace their analytical steps?
- **Extract** — Can users extract or export data subsets for downstream analysis?

### Edward Tufte — Data Visualization Integrity
*"Above all else, show the data."*

For charts, timelines, grids, and any data display:
- **Data-ink ratio** — Is every pixel of ink representing data? Strip chartjunk (decorative gridlines, unnecessary borders, 3D effects)
- **Lie factor** — Do visual encodings accurately represent data magnitudes? (bar charts starting at non-zero, misleading axis scales)
- **Small multiples** — When comparing across patients or time periods, are small multiples used rather than overcrowded overlays?
- **Annotation** — Are data points labeled where it matters rather than forcing users to read a legend?
- **Color** — Is color used semantically (e.g., consistent use across the app: red = risk, green = normal)? Is the palette colorblind-safe?

### WCAG 2.1 AA / Accessibility
*Required compliance level for this project.*

Check every component against:
- **1.4.3 Contrast** — Minimum 4.5:1 for normal text, 3:1 for large text and UI components
- **1.4.11 Non-text contrast** — Charts, icons, and form controls meet 3:1 contrast against adjacent colors
- **2.1.1 Keyboard** — All interactions are reachable and operable by keyboard alone
- **2.4.3 Focus order** — Tab order is logical and matches visual layout
- **2.4.7 Focus visible** — Focus indicator is always visible and high-contrast
- **3.3.1 Error identification** — Errors are identified in text, not color alone
- **4.1.2 Name, role, value** — All interactive elements have accessible names; ARIA roles are correct and not redundant
- **4.1.3 Status messages** — Loading states, filter result counts, and async updates are announced to screen readers

---

## Review Process

When asked to review a component or screen:

1. **Identify the user and task context** — Who is using this, what are they trying to accomplish, what are the stakes?
2. **Walk through the interface systematically** — First impressions → primary task flow → edge cases → error states
3. **Apply the expert lenses above** — Don't mechanically check every heuristic; use judgment about which are most relevant to this specific component
4. **Run a mandatory WCAG 2.1 AA pass on every review** — This is not optional and is not covered by the UX lenses alone. For every component, explicitly check:
   - Contrast ratios (1.4.3 text at 4.5:1, 1.4.11 non-text UI at 3:1)
   - Full keyboard operability with visible focus indicators (2.1.1, 2.4.7)
   - Logical tab/focus order (2.4.3)
   - All interactive elements have accessible names and correct ARIA roles (4.1.2)
   - Dynamic updates (filter counts, loading states, async results) announced via `aria-live` (4.1.3)
   - Errors identified in text, not color alone (3.3.1)
   - Any WCAG violation is automatically **Critical** severity — it cannot be downgraded
5. **Rank findings by severity:**
   - **Critical** — Blocks the user from completing a task, causes data misinterpretation, or fails any WCAG 2.1 AA requirement
   - **Major** — Significant friction, likely to cause repeated confusion or errors
   - **Minor** — Noticeable friction but users can work around it
   - **Polish** — Cosmetic or minor wording improvements
6. **For each finding:** name the principle, describe the observed problem, explain the user impact, and give a concrete recommendation
7. **Prioritized summary** — End with the 1–3 changes that will have the greatest impact on usability; if any WCAG Critical issues exist, they must appear here

---

## Domain Context: Medical UX Considerations

This app is used in clinical and research oncology contexts. Keep these domain facts in mind during reviews:

- **User expertise is high but time is low** — Clinicians know oncology deeply but are often context-switching between tools under time pressure. Don't over-explain domain concepts in the UI, but never sacrifice clarity for brevity.
- **Data errors have real stakes** — A filter that silently excludes patients, a timeline event misattributed to the wrong date, or a label that conflates two distinct biomarkers can affect clinical judgment.
- **Data is probabilistic** — Many values (e.g., NLP-extracted phenotypes) carry confidence scores or uncertainty. The UI should represent uncertainty honestly, not flatten it.
- **Cohort comparison is a primary workflow** — Researchers often want to compare subgroups. UI patterns that support side-by-side or sequential comparison deserve special attention.
- **Printing and export matter** — Reports and visualizations are often shared in presentations or printed. Check that layouts degrade gracefully.

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

When reviewing a component, also look at:
- `themes.js` — for color palette, typography scale, and spacing to assess visual consistency
- The component's test file (if present in `__tests__/`) — to understand expected behavior
- Any ARIA attributes and roles in JSX — for accessibility assessment

---

## What Good Feedback Looks Like

**Too vague:**
> "The filter panel could be clearer."

**Good:**
> **[Major — Nielsen: Visibility of System Status]** When the HorizontalBarFilter updates the patient count, there is no visual indication that the grid is reloading. Users may click additional filters before the first filter has resolved, leading to race conditions or stale results. **Fix:** Add a loading skeleton or spinner to the PatientGrid that activates immediately on filter change and resolves when new data is rendered. Also announce the updated result count to screen readers via an `aria-live="polite"` region.

---

## Out of Scope for GUI Reviews

- Backend API performance (unless it directly causes UI timeouts visible to users)
- Data pipeline correctness (NLP extraction accuracy, etc.)
- Business logic correctness (unless it produces visually misleading output)
- Code style and linting (handled by ESLint config)
