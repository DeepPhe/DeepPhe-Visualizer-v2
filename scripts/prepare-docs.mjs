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

const SCREENSHOT_MAP = [
  ["02-filters-overview.png", "cohort-explorer-overview.png"],
  ["03-identified-patients-panel.png", "identified-patients-summary.png"],
  ["09-filter-age-at-dx.png", "age-at-diagnosis-filter.png"],
  ["21-filter-selection-active-state.png", "active-filter-selection.png"],
  ["22-patient-details-overview.png", "selected-patients-drawer.png"],
  ["23-patient-details-column-menu.png", "visible-patient-columns.png"],
  ["24-patient-details-expanded-row.png", "expanded-patient-row.png"],
  ["25-patient-details-empty-search.png", "patient-search-no-results.png"],
  ["04-theme-selector-open.png", "display-settings.png"],
];

async function findSource(captureName, semanticName) {
  const candidates = [
    path.join(CAPTURE_DIR, captureName),
    path.join(TRACKED_SCREENSHOT_DIR, captureName),
    path.join(END_USER_SCREENSHOT_DIR, semanticName),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function prepareScreenshots() {
  await fsp.mkdir(END_USER_SCREENSHOT_DIR, { recursive: true });

  const missing = [];
  for (const [captureName, semanticName] of SCREENSHOT_MAP) {
    const source = await findSource(captureName, semanticName);
    const destination = path.join(END_USER_SCREENSHOT_DIR, semanticName);

    if (!source) {
      missing.push(captureName);
      continue;
    }

    if (path.resolve(source) !== path.resolve(destination)) {
      await fsp.copyFile(source, destination);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing documentation screenshots:\n${missing.map((name) => `- ${name}`).join("\n")}`
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
