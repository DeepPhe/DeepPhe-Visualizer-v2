#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCREENSHOT_ROOT_DIR = path.resolve(
  process.env.VIZ2_SCREENSHOT_DIR || path.join(ROOT_DIR, "..", "Viz2_screenshots")
);
const CAPTURE_DIR = path.join(SCREENSHOT_ROOT_DIR, "playwright");
const TRACKED_SCREENSHOT_DIR = path.join(ROOT_DIR, "docs", "assets", "screenshots");
const END_USER_SCREENSHOT_DIR = path.join(TRACKED_SCREENSHOT_DIR, "end-user");

// [captureName, semanticName, required]
//
// `required` entries back pages that always reference the image and must be
// present for a complete docs build. `optional` entries back newer interaction
// captures that can be data- or environment-dependent; when a fresh capture is
// unavailable the mapping keeps whatever tracked image already exists and does
// not fail the pipeline, so the site never ships a broken image reference.
// See docs/contributors/screenshot-capture.md.
const SCREENSHOT_MAP = [
  ["02-filters-overview.png", "cohort-explorer-overview.png", true],
  ["03-identified-patients-panel.png", "identified-patients-summary.png", true],
  ["04-theme-selector-open.png", "display-settings.png", true],
  ["05-theme-builder.png", "theme-builder.png", false],
  ["09-filter-age-at-dx.png", "age-at-diagnosis-filter.png", true],
  ["10-patient-dots-bars-behind.png", "patient-dots-bars-behind.png", false],
  ["21-filter-selection-active-state.png", "active-filter-selection.png", true],
  ["22-patient-details-overview.png", "selected-patients-drawer.png", true],
  ["23-patient-details-column-menu.png", "visible-patient-columns.png", true],
  ["24-patient-details-expanded-row.png", "expanded-patient-row.png", true],
  ["25-patient-details-empty-search.png", "patient-search-no-results.png", true],
  ["26-zero-result-guidance.png", "zero-result-guidance.png", false],
  ["27-patient-row-context-menu.png", "patient-row-context-menu.png", false],
  ["32-embedded-patient-drawer.png", "embedded-patient-view.png", true],
  ["33-patient-summary-card.png", "patient-summary-card.png", true],
  ["34-patient-summary-source-picker.png", "patient-summary-source-picker.png", false],
  ["35-patient-summary-confidence-slider.png", "patient-summary-confidence-slider.png", false],
  ["40-standalone-patient-lookup.png", "standalone-patient-lookup.png", false],
  ["41-patient-fact-linked-timeline.png", "patient-fact-linked-timeline.png", false],
  ["42-document-viewer-concept-list.png", "document-viewer-concept-list.png", false],
  ["43-document-viewer-group-filter.png", "document-viewer-group-filter.png", false],
  ["44-document-viewer-confidence-filter.png", "document-viewer-confidence-filter.png", false],
  ["45-collapsed-date-episode-controls.png", "collapsed-date-episode-controls.png", false],
  ["46-document-timeline.png", "document-timeline.png", false],
  ["47-filter-details-dialog.png", "filter-details-dialog.png", false],
  ["48-display-controls.png", "display-controls.png", false],
  ["49-drawer-window-controls.png", "drawer-window-controls.png", false],
  ["50-csv-export-button.png", "csv-export-button.png", false],
  ["51-filter-hierarchical-values.png", "filter-hierarchical-values.png", false],
  ["52-filter-disabled-values.png", "filter-disabled-values.png", false],
];

function findSource(captureName, semanticName) {
  const candidates = [
    path.join(CAPTURE_DIR, captureName),
    path.join(TRACKED_SCREENSHOT_DIR, captureName),
    path.join(END_USER_SCREENSHOT_DIR, semanticName),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function prepareScreenshots() {
  await fsp.mkdir(END_USER_SCREENSHOT_DIR, { recursive: true });

  const missingRequired = [];
  const missingOptional = [];

  for (const [captureName, semanticName, required] of SCREENSHOT_MAP) {
    const source = findSource(captureName, semanticName);
    const destination = path.join(END_USER_SCREENSHOT_DIR, semanticName);

    if (!source) {
      // No fresh capture and no tracked image at all.
      if (fs.existsSync(destination)) {
        continue; // keep the existing tracked image
      }
      (required ? missingRequired : missingOptional).push(captureName);
      continue;
    }

    if (path.resolve(source) !== path.resolve(destination)) {
      await fsp.copyFile(source, destination);
    }
  }

  if (missingOptional.length > 0) {
    console.warn(
      `Optional documentation screenshots not available (pages fall back to prose):\n${missingOptional
        .map((name) => `- ${name}`)
        .join("\n")}`
    );
  }

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required documentation screenshots:\n${missingRequired.map((name) => `- ${name}`).join("\n")}`
    );
  }
}

prepareScreenshots()
  .then(() => {
    console.log(`Documentation screenshots ready: ${END_USER_SCREENSHOT_DIR}`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
