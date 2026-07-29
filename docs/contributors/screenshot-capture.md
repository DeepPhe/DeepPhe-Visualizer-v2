---
title: Maintain documentation screenshots
sidebar_label: Screenshot capture
---

# Maintain documentation screenshots

This page describes how the end-user guide's screenshots are produced.

## Prerequisites

| Requirement | Check |
| --- | --- |
| Node.js 20 or later (required by `docs:build`; Playwright alone needs only 18) | `node --version` |
| Visualizer reachable (see `APP_URL`) | `curl -s "$APP_URL"` |
| Data API on port 3333 | `curl -s http://localhost:3333/health` |
| Playwright Chromium | `npx playwright install chromium` |

Capture against a **production build** of the Visualizer (for example, build the app and serve `build/` as a single-page app). A production build hides development-only diagnostics, so the images are clean.

## Capture and build

```bash
npm run capture:screenshots
npm run docs:build
```

Useful environment variables:

- `APP_URL` — the Visualizer base URL (default `http://localhost:3000`).
- `VIZ2_SCREENSHOT_DIR` — where source captures are written (default `../Viz2_screenshots`).
- `DOC_PATIENT_ID` — the synthetic patient used for the standalone-patient and Document Viewer captures (default `fake_patient3`).
- `COLLAPSED_DATE_PATIENT_ID` — a synthetic patient whose notes collapse to one date, used for the timeline's episode-dropdown fallback capture (optional).
- `CAPTURE_ONLY` — a comma-separated list of file-name fragments. When set, only matching captures are written, so one data-dependent series can be re-taken without re-shooting the whole set. See [Re-take a single series](#re-take-a-single-series).

The capture script forces the **Standard** theme so images are consistent, disables animations, and waits for content to load before each shot.

### Guided-workflow captures

The [Stage IV metastatic evidence workflow](../guided-workflows/validate-stage-iv-metastatic-evidence.md) needs specific records: one patient whose structure and source notes agree, and one carrying contradictory extractions. Those captures are all optional, and each has an override:

- `EXERCISE_CORROBORATED_PATIENT_ID` — the patient with a metastatic second cancer confirmed by a later pathology report (default `fake_patient125`).
- `EXERCISE_CONFLICTED_PATIENT_ID` — the patient whose TNM value disagrees with their stage, and whose radiology report both asserts and negates metastatic disease (default `fake_patient460`).
- `EXERCISE_STAGE_VALUE` — the Stage card value the exercise filters on (default `Stage IV`).
- `EXERCISE_AGE_BAND` — the Age at Dx band that, combined with the stage value, narrows the cohort far enough for the conflicted patient to render as a clickable [patient dot](../cohort-explorer/patient-dots.md) (default `30-39`).

If you change any of these, re-read the exercise page: it quotes cohort counts and findings that come from these specific records.

### Re-take a single series

```bash
CAPTURE_ONLY=exercise npm run capture:screenshots
```

Captures whose file name contains the fragment are written; every other tracked image is left untouched. Useful when one series is flaky or data-dependent and a full re-run would churn — or degrade — images that are already good.

## Required vs. optional captures

`scripts/capture-screenshots.mjs` splits its targets into two sets:

- **Required** captures back pages that always show an image; the run fails if any required capture cannot be produced cleanly.
- **Optional** captures back newer interaction states that depend on data (for example, the collapsed-date timeline, the zero-result cohort guidance, or hierarchical/disabled filter values) or that are illustrative extras. A missed optional capture is reported but does not fail the run — the page falls back to prose, so its image reference must stay commented until a real capture is committed.

`scripts/prepare-docs.mjs` maps the numbered source captures to stable, task-oriented names under `docs/assets/screenshots/end-user/`. For an optional capture that was not produced, it keeps any existing tracked image and never leaves a broken reference. If neither a fresh capture nor a tracked image exists, the page falls back to prose only.

## Generate the full feature guide

```bash
npm run docs:generate
```

This captures the feature screenshots, builds the Docusaurus site, and exports the printable-guide PDF.

## Safety

- Use only **synthetic** demonstration data and **fake** patient identifiers.
- Never capture real patient information.
- Visually inspect every generated image for unintended identifiers before committing it.
- Run the automated identifier check, but do not treat it as a substitute for visual review:

```bash
npm run lint:patient-ids
```
