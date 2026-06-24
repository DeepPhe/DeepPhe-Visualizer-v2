---
title: Maintain documentation screenshots
sidebar_label: Screenshot capture
---

# Maintain documentation screenshots

This contributor page describes how screenshots used by the end-user guide are produced.

## Prerequisites

| Requirement | Check |
| --- | --- |
| Node.js 20 or later | `node --version` |
| Visualizer on port 3000 | `curl -s http://localhost:3000` |
| Data API on port 3333 | `curl -s http://localhost:3333/health` |
| Playwright Chromium | `npx playwright install chromium` |

## Capture and build

Start the Visualizer and Data API, then run:

```bash
npm run capture:screenshots
npm run docs:build
```

The capture script writes numbered source images to:

```text
../Viz2_screenshots/playwright/
```

`scripts/prepare-docs.mjs` maps the source captures to stable, task-oriented names under:

```text
docs/assets/screenshots/end-user/
```

The Docusaurus site is generated in `site/`.

## Generate the full feature guide

```bash
npm run docs:generate
```

This captures the feature screenshots, builds the Docusaurus site, and exports the printable guide PDF.

## Safety

Use synthetic demonstration data for documentation captures. Inspect every image before committing it to confirm that it contains no protected health information or unintended patient identifiers.
