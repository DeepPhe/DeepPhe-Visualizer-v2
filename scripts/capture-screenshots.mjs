#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";
const SCREENSHOT_ROOT_DIR = process.env.VIZ2_SCREENSHOT_DIR
  ? path.resolve(process.env.VIZ2_SCREENSHOT_DIR)
  : path.resolve("..", "Viz2_screenshots");
const OUTPUT_DIR = path.join(SCREENSHOT_ROOT_DIR, "playwright");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "capture-summary.json");
const VIEWPORT = { width: 2200, height: 1400 };

// A deterministic synthetic patient used for the standalone-patient and
// document-viewer captures. It carries multiple cancers, structured facts, and
// notes with real dates (a normal timeline rather than the collapsed-date
// fallback). Override with DOC_PATIENT_ID if your dataset differs.
const DOC_PATIENT_ID = process.env.DOC_PATIENT_ID || "fake_patient3";
// A patient whose notes collapse to a single usable date, exercising the
// timeline's episode-dropdown fallback. Optional; skipped if it does not resolve.
const COLLAPSED_DATE_PATIENT_ID = process.env.COLLAPSED_DATE_PATIENT_ID || "fake_patient7";

// The two patients the guided exercise walks through. The first has a record
// whose structure and source notes agree; the second carries contradictory
// extractions (a TNM value that disagrees with its stage, and a note that both
// asserts and negates metastatic disease). Both are dataset-specific — override
// them, or accept that the exercise captures fall back to prose.
// See docs/getting-started/guided-exercise.md.
const EXERCISE_CORROBORATED_PATIENT_ID =
  process.env.EXERCISE_CORROBORATED_PATIENT_ID || "fake_patient125";
const EXERCISE_CONFLICTED_PATIENT_ID =
  process.env.EXERCISE_CONFLICTED_PATIENT_ID || "fake_patient460";
// The staging value the exercise filters on, and a second card that visibly
// repaints with in-cohort counts once that filter is active.
const EXERCISE_STAGE_VALUE = process.env.EXERCISE_STAGE_VALUE || "Stage IV";

// The targeted-therapy exercise (docs/getting-started/exercise-targeted-therapy.md)
// builds a HER2-drug cohort through the Treatments search dialog, then reads the
// biomarker repaint. Data-specific — override for a different dataset.
const THERAPY_DRUG = process.env.THERAPY_DRUG || "Trastuzumab";

// The treatment-outcome exercise (docs/getting-started/exercise-compare-outcomes.md)
// contrasts two response values from the Clinical Course of Disease card.
const OUTCOME_RESPONDER_VALUE =
  process.env.OUTCOME_RESPONDER_VALUE || "Pathologic Complete Response";
const OUTCOME_PROGRESSOR_VALUE =
  process.env.OUTCOME_PROGRESSOR_VALUE || "Progressive Disease";
const OUTCOME_COURSE_CARD = process.env.OUTCOME_COURSE_CARD || "Clinical Course of Disease";
// The age band that, combined with the staging value, narrows the cohort far
// enough for the conflicted patient to appear as a clickable patient dot.
const EXERCISE_AGE_BAND = process.env.EXERCISE_AGE_BAND || "30-39";

// Feature-documentation capture set. `REQUIRED_SCREENSHOTS` back pages that
// always show the image and must capture cleanly. `OPTIONAL_SCREENSHOTS` back
// newer interaction captures that can be data- or environment-dependent; a
// failure there is reported but does not fail the run, and prepare-docs.mjs
// keeps any existing tracked image so the site never ships a broken reference.
const REQUIRED_SCREENSHOTS = [
  "02-filters-overview.png",
  "03-identified-patients-panel.png",
  "04-theme-selector-open.png",
  "09-filter-age-at-dx.png",
  "21-filter-selection-active-state.png",
  "22-patient-details-overview.png",
  "23-patient-details-column-menu.png",
  "24-patient-details-expanded-row.png",
  "25-patient-details-empty-search.png",
  "32-embedded-patient-drawer.png",
  "33-patient-summary-card.png",
];

const OPTIONAL_SCREENSHOTS = [
  "05-theme-builder.png",
  "10-patient-dots-bars-behind.png",
  "26-zero-result-guidance.png",
  "27-patient-row-context-menu.png",
  "34-patient-summary-source-picker.png",
  "35-patient-summary-confidence-slider.png",
  "40-standalone-patient-lookup.png",
  "41-patient-fact-linked-timeline.png",
  "42-document-viewer-concept-list.png",
  "43-document-viewer-group-filter.png",
  "44-document-viewer-confidence-filter.png",
  "45-collapsed-date-episode-controls.png",
  "46-document-timeline.png",
  "47-filter-details-dialog.png",
  "48-display-controls.png",
  "49-drawer-window-controls.png",
  "50-csv-export-button.png",
  "51-filter-hierarchical-values.png",
  "52-filter-disabled-values.png",
  "60-exercise-stage-filter-selected.png",
  "61-exercise-cross-filter-counts.png",
  "62-exercise-cancer-tumor-detail.png",
  "63-exercise-relapse-timeline.png",
  "64-exercise-source-pathology.png",
  "65-exercise-conflicted-summary.png",
  "66-exercise-negated-concepts.png",
  "70-therapy-treatment-search.png",
  "71-therapy-gene-repaint.png",
  "72-therapy-her2-gap.png",
  "73-therapy-cohort-table.png",
  "80-outcome-responders-stage.png",
  "81-outcome-responders-behavior.png",
  "82-outcome-progressors-stage.png",
  "83-outcome-progressors-behavior.png",
];

const SCREENSHOT_ORDER = [...REQUIRED_SCREENSHOTS, ...OPTIONAL_SCREENSHOTS];

// Subset filter. `CAPTURE_ONLY` takes a comma-separated list of file-name
// fragments (for example "exercise" or "42-document-viewer"); when set, only
// matching captures are written. Re-taking one data-dependent series is then
// possible without re-shooting — and potentially degrading — the whole set.
const CAPTURE_ONLY = (process.env.CAPTURE_ONLY || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

function isRequested(file) {
  return CAPTURE_ONLY.length === 0 || CAPTURE_ONLY.some((fragment) => file.includes(fragment));
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  viewport: VIEWPORT,
  screenshots: [],
};

// Captures that could not be produced as intended. A documentation run must
// fail loudly rather than publish a guide with a missing or wrong-target image.
const failures = [];

function filePath(name) {
  return path.join(OUTPUT_DIR, name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureOutput() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function gotoRoute(page, route) {
  const url = new URL(route, BASE_URL).toString();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await sleep(250);
}

async function waitForLocator(locator, timeout = 12000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

async function captureViewport(page, name, fullPage = false) {
  await page.screenshot({
    path: filePath(name),
    fullPage,
    timeout: 45000,
    animations: "disabled",
  });
}

async function captureLocatorOrFallback(page, locator, name, fallbackFullPage = false) {
  const count = await locator.count();
  if (count === 0) {
    throw new Error("Target locator not found");
  }
  const target = locator.first();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(250);
  await target.screenshot({ path: filePath(name), timeout: 45000, animations: "disabled" }).catch(async () => {
    await page.screenshot({
      path: filePath(name),
      fullPage: fallbackFullPage,
      timeout: 45000,
      animations: "disabled",
    });
    throw new Error("Element screenshot failed; captured fallback viewport");
  });
}

async function withCapture(page, config) {
  if (!isRequested(config.file)) {
    return;
  }

  console.log(`Capturing ${config.file} (${config.route})`);
  const entry = {
    file: config.file,
    route: config.route,
    target: config.target,
    status: "captured",
    optional: Boolean(config.optional),
    note: "",
  };

  try {
    await config.run();
  } catch (error) {
    entry.status = "fallback";
    entry.note = error instanceof Error ? error.message : String(error);
    try {
      await captureViewport(page, config.file, config.fallbackFullPage || false);
    } catch (fallbackError) {
      entry.status = "failed";
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      entry.note = `${entry.note} | fallback screenshot failed: ${fallbackMessage}`;
    }
    console.warn(`Could not capture ${config.file} as intended (${entry.status}): ${entry.note}`);
  }

  summary.screenshots.push(entry);
  if (entry.status !== "captured") {
    failures.push(entry);
  }
}

// Filter cards are `.filter-card` papers identified by their "Open <name> filter"
// button, not by a heading element.
function filterCardLocator(page, title) {
  return page.locator(`.filter-card:has(button[aria-label="Open ${title} filter"])`).first();
}

async function captureFilterCard(page, file, filterName) {
  await withCapture(page, {
    file,
    route: "/",
    target: `${filterName} filter card`,
    fallbackFullPage: false,
    run: async () => {
      const card = filterCardLocator(page, filterName);
      await captureLocatorOrFallback(page, card, file, false);
    },
  });
}

async function openThemeMenu(page) {
  const byId = page.locator("#theme-select").first();
  const byLabel = page.getByLabel("Theme").first();
  const trigger = (await byId.count()) > 0 ? byId : byLabel;

  if ((await trigger.count()) === 0) {
    throw new Error("Theme selector trigger not found");
  }

  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await trigger.click();
  const hasOptions = await waitForLocator(page.getByRole("option", { name: "Obsidian", exact: true }), 5000);
  if (!hasOptions) {
    throw new Error("Theme menu did not open");
  }
}

// Select a value in the first filter card that has selectable bars. The bars are
// SVG overlays whose React handler only fires on keyboard activation, so we focus
// the bar and press Enter rather than clicking. Returns the card so the caller can
// screenshot its active state.
async function activateFilterSelection(page) {
  const cards = page.locator(".filter-card");
  const cardCount = await cards.count();

  for (let index = 0; index < cardCount; index += 1) {
    const card = cards.nth(index);
    const bars = card.locator(".horizontal-bar-filter-row-overlay[role='button']");
    if ((await bars.count()) === 0) {
      continue;
    }

    await card.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(200);

    const bar = bars.first();
    await bar.focus().catch(() => {});
    await page.keyboard.press("Enter");
    await sleep(900);

    const label = (await bar.getAttribute("aria-label")) || "";
    if (/\bSelected\b/i.test(label)) {
      const openLabel =
        (await card.locator(".filter-card-open-button").first().getAttribute("aria-label")) || "";
      const cardName = openLabel.replace(/^Open\s+/i, "").replace(/\s+filter$/i, "").trim();
      return { activated: true, card, cardName };
    }
  }

  return { activated: false, card: null, cardName: "" };
}

async function capturePatientDetailsSeries(page) {
  const embeddedDetailsRegion = page.locator("[data-testid='patient-grid-embedded']").first();
  const legacyDetailsHeading = page.getByRole("heading", { name: /Patient Details/i }).first();
  const embeddedDetailsVisible = await waitForLocator(embeddedDetailsRegion, 15000);
  const legacyDetailsVisible = embeddedDetailsVisible ? false : await waitForLocator(legacyDetailsHeading, 2000);
  const detailsVisible = embeddedDetailsVisible || legacyDetailsVisible;

  if (!detailsVisible) {
    console.warn("Patient Details did not render on the Cohort Explorer after filter selection.");

    const missingSeries = [
      {
        file: "22-patient-details-overview.png",
        target: "Patient Details overview",
      },
      {
        file: "23-patient-details-column-menu.png",
        target: "Patient Details column chooser menu",
      },
      {
        file: "24-patient-details-expanded-row.png",
        target: "Expanded row details",
      },
      {
        file: "25-patient-details-empty-search.png",
        target: "Patient Details empty search state",
      },
    ];

    for (const entry of missingSeries) {
      await withCapture(page, {
        file: entry.file,
        route: "/",
        target: entry.target,
        fallbackFullPage: false,
        run: async () => {
          throw new Error("Patient Details panel is unavailable on the Cohort Explorer.");
        },
      });
    }

    return;
  }

  const detailsRegion = embeddedDetailsVisible
    ? embeddedDetailsRegion
    : legacyDetailsHeading.locator("xpath=ancestor::div[contains(@class,'MuiCard-root')][1]");

  await withCapture(page, {
    file: "22-patient-details-overview.png",
    route: "/",
    target: "Patient Details overview",
    fallbackFullPage: false,
    run: async () => {
      await captureLocatorOrFallback(page, detailsRegion, "22-patient-details-overview.png", false);
    },
  });

  await withCapture(page, {
    file: "23-patient-details-column-menu.png",
    route: "/",
    target: "Patient Details column chooser menu",
    fallbackFullPage: false,
    run: async () => {
      const columnButton = page.getByLabel("Toggle visible patient columns").first();
      const hasButton = await waitForLocator(columnButton, 5000);
      if (!hasButton) {
        throw new Error("Column chooser button not found");
      }

      await columnButton.click();
      const menuReady = await waitForLocator(page.getByText("Toggle all columns", { exact: true }).first(), 5000);
      if (!menuReady) {
        throw new Error("Column chooser menu did not open");
      }

      const menu = page.locator("[role='menu']").first();
      await captureLocatorOrFallback(page, menu, "23-patient-details-column-menu.png", false);
      await page.keyboard.press("Escape").catch(() => {});
    },
  });

  await withCapture(page, {
    file: "24-patient-details-expanded-row.png",
    route: "/",
    target: "Expanded row details",
    fallbackFullPage: false,
    run: async () => {
      const expandButton = page.locator("button[aria-label^='Expand row details']").first();
      if ((await expandButton.count()) === 0) {
        throw new Error("No expandable rows were available in patient details");
      }

      await expandButton.click();
      await waitForLocator(page.getByText("Diagnoses", { exact: true }).first(), 5000);
      await captureLocatorOrFallback(page, detailsRegion, "24-patient-details-expanded-row.png", false);
    },
  });

  // Right-click context menu on the expanded detail row (Open in new tab / Go to tab).
  await withCapture(page, {
    file: "27-patient-row-context-menu.png",
    route: "/",
    target: "Patient row right-click context menu",
    optional: true,
    run: async () => {
      // Right-click the expanded detail row itself — its cell spans every column
      // and carries the context-menu handler. Text nodes inside can be off-screen,
      // so target the cell near its top-left, away from interactive children.
      const detailCell = page.locator("td[colspan]").first();
      if (!(await waitForLocator(detailCell, 5000))) {
        throw new Error("Expanded detail row not available to right-click");
      }
      await detailCell.scrollIntoViewIfNeeded().catch(() => {});
      await detailCell.click({ button: "right", position: { x: 40, y: 20 } });
      const menu = page.locator('[role="menu"]:has-text("Open in new tab")').first();
      if (!(await waitForLocator(menu, 5000))) {
        throw new Error("Row context menu did not open");
      }
      await sleep(300);
      await captureLocatorOrFallback(page, menu, "27-patient-row-context-menu.png", false);
      await page.keyboard.press("Escape").catch(() => {});
    },
  });

  await withCapture(page, {
    file: "25-patient-details-empty-search.png",
    route: "/",
    target: "Patient Details empty search state",
    fallbackFullPage: false,
    run: async () => {
      const search = page.getByPlaceholder("Search patient details...").first();
      const hasSearch = await waitForLocator(search, 5000);
      if (!hasSearch) {
        throw new Error("Patient details search input not found");
      }

      await search.fill("__no_patient_results_expected__");
      const emptyText = page.getByText("No patients match your search.", { exact: true }).first();
      const hasEmpty = await waitForLocator(emptyText, 8000);
      if (!hasEmpty) {
        throw new Error("Empty-search state text did not appear");
      }

      await captureLocatorOrFallback(page, detailsRegion, "25-patient-details-empty-search.png", false);
      await search.fill("");
    },
  });
}

async function captureEmbeddedPatientViewSeries(page) {
  // The patient grid drawer should already be visible and expanded from capturePatientDetailsSeries.
  // Expand a row to reveal "Show in Document Viewer", then open the embedded patient tab.

  const expandButton = page.locator("button[aria-label^='Expand row details']").first();
  const hasExpandButton = await waitForLocator(expandButton, 6000);

  const missingFiles = [
    { file: "32-embedded-patient-drawer.png", target: "Embedded patient view (drawer)" },
    { file: "33-patient-summary-card.png", target: "Patient Summary Card" },
  ];

  if (!hasExpandButton) {
    console.warn("EmbeddedPatientView capture skipped: no expandable patient rows found.");
    for (const entry of missingFiles) {
      await withCapture(page, {
        file: entry.file,
        route: "/",
        target: entry.target,
        fallbackFullPage: false,
        run: async () => {
          throw new Error("No expandable patient rows available.");
        },
      });
    }
    return;
  }

  await expandButton.scrollIntoViewIfNeeded().catch(() => {});
  await expandButton.click();
  await sleep(600);

  const openButton = page.getByRole("button", { name: "Show in Document Viewer" }).first();
  const hasOpenButton = await waitForLocator(openButton, 6000);

  if (!hasOpenButton) {
    console.warn(
      "EmbeddedPatientView capture skipped: 'Show in Document Viewer' button not found after row expand."
    );
    for (const entry of missingFiles) {
      await withCapture(page, {
        file: entry.file,
        route: "/",
        target: entry.target,
        fallbackFullPage: false,
        run: async () => {
          throw new Error("'Show in Document Viewer' button was not found.");
        },
      });
    }
    return;
  }

  await openButton.click();
  await sleep(500);

  const drawer = page.locator("[data-testid='patient-grid-drawer']").first();
  const drawerVisible = await waitForLocator(drawer, 8000);

  if (!drawerVisible) {
    console.warn(
      "EmbeddedPatientView capture skipped: patient-grid-drawer did not appear after opening patient tab."
    );
    for (const entry of missingFiles) {
      await withCapture(page, {
        file: entry.file,
        route: "/",
        target: entry.target,
        fallbackFullPage: false,
        run: async () => {
          throw new Error("patient-grid-drawer not visible after patient tab opened.");
        },
      });
    }
    return;
  }

  // Wait for the patient data loading spinner to clear.
  await drawer
    .locator("[role='progressbar']")
    .first()
    .waitFor({ state: "hidden", timeout: 15000 })
    .catch(() => {});
  await sleep(500);

  await withCapture(page, {
    file: "32-embedded-patient-drawer.png",
    route: "/",
    target: "Embedded patient view (drawer with patient data)",
    fallbackFullPage: false,
    run: async () => {
      await captureLocatorOrFallback(page, drawer, "32-embedded-patient-drawer.png", false);
    },
  });

  await withCapture(page, {
    file: "33-patient-summary-card.png",
    route: "/",
    target: "Patient Summary Card (diagnoses, staging, biomarkers)",
    fallbackFullPage: false,
    run: async () => {
      // The card title is a CardHeader span (not a heading). The scroll region is
      // only present when the patient actually has structured summary sections.
      const summaryCard = page
        .locator('.MuiCard-root:has([data-testid="patient-summary-card-scroll"])')
        .first();
      const hasCard = await waitForLocator(summaryCard, 6000);
      if (!hasCard) {
        throw new Error("Patient Summary Card has no section data for the opened patient");
      }
      await captureLocatorOrFallback(page, summaryCard, "33-patient-summary-card.png", false);
    },
  });

  // Patient Summary minimum-confidence slider. Lower the threshold from its
  // 100% default so the header slider sits mid-track and the "N findings hidden
  // below X% confidence" live message is visible in the shot.
  await withCapture(page, {
    file: "35-patient-summary-confidence-slider.png",
    route: "/",
    target: "Patient Summary confidence slider (findings-hidden state)",
    optional: true,
    run: async () => {
      const summaryCard = page
        .locator('.MuiCard-root:has([data-testid="patient-summary-card-scroll"])')
        .first();
      if (!(await waitForLocator(summaryCard, 6000))) {
        throw new Error("Patient Summary Card not available for the confidence-slider capture");
      }
      const slider = summaryCard.getByRole("slider").first();
      if (!(await waitForLocator(slider, 5000))) {
        throw new Error("Confidence slider not found in the Patient Summary Card header");
      }
      // Step down from 100% to 75% (5% steps) via the keyboard, the same path a
      // keyboard user takes; the MUI slider updates on ArrowDown.
      await slider.focus().catch(() => {});
      for (let step = 0; step < 5; step += 1) {
        await page.keyboard.press("ArrowDown");
      }
      await sleep(500);
      await captureLocatorOrFallback(
        page,
        summaryCard,
        "35-patient-summary-confidence-slider.png",
        false
      );
    },
  });

  // Multi-source Patient Summary item → confidence-ranked document picker.
  await withCapture(page, {
    file: "34-patient-summary-source-picker.png",
    route: "/",
    target: "Patient Summary multi-source document picker",
    optional: true,
    run: async () => {
      const multiSource = page
        .locator('[data-testid="patient-summary-card-scroll"] button[aria-label*="choose from"]')
        .first();
      if (!(await waitForLocator(multiSource, 6000))) {
        throw new Error("No multi-source Patient Summary item for the opened patient");
      }
      await multiSource.scrollIntoViewIfNeeded().catch(() => {});
      await multiSource.click();
      const menu = page.locator('[role="menu"]').first();
      if (!(await waitForLocator(menu, 5000))) {
        throw new Error("Document picker menu did not open");
      }
      await sleep(400);
      await captureLocatorOrFallback(page, menu, "34-patient-summary-source-picker.png", false);
      await page.keyboard.press("Escape").catch(() => {});
    },
  });
}

// ---------------------------------------------------------------------------
// Additional feature captures (Theme Builder, standalone patient + Document
// Viewer, and interaction states). These use withCapture with optional:true so
// a data- or selector-dependent miss is reported but never fails the run.
// ---------------------------------------------------------------------------

function documentViewerCard(page) {
  return page.locator('.MuiCard-root:has([aria-label="Document viewer controls"])').first();
}

async function loadStandalonePatient(page, patientId) {
  await gotoRoute(page, "/patient");
  const idField = page.getByLabel("Patient ID").first();
  const hasField = await waitForLocator(idField, 8000);
  if (!hasField) {
    throw new Error("Patient Lookup field not found");
  }
  await idField.fill(patientId);
  const loadButton = page.getByRole("button", { name: /^Load Patient$/ }).first();
  await loadButton.click();
  // The section titles are MUI CardHeader spans, not heading-role elements, so
  // wait on their text and on the "Loaded patient:" status line instead.
  const loaded = await waitForLocator(
    page.getByText(`Loaded patient:`, { exact: false }).first(),
    25000
  );
  const hasDetail = await waitForLocator(
    page.getByText("Cancer and Tumor Detail", { exact: false }).first(),
    8000
  );
  if (!loaded && !hasDetail) {
    throw new Error(`Patient ${patientId} did not load`);
  }
  await sleep(900);
}

async function captureThemeBuilder(page) {
  await withCapture(page, {
    file: "05-theme-builder.png",
    route: "/",
    target: "Theme Builder dialog",
    optional: true,
    run: async () => {
      await gotoRoute(page, "/");
      await openThemeMenu(page);
      const item = page.getByRole("option", { name: /Theme Builder/i }).first();
      const hasItem = await waitForLocator(item, 5000);
      if (!hasItem) {
        throw new Error("Theme Builder menu item not found");
      }
      await item.click();
      const dialog = page.getByRole("dialog", { name: /Theme Builder/i }).first();
      const opened = await waitForLocator(dialog, 6000);
      if (!opened) {
        throw new Error("Theme Builder dialog did not open");
      }
      await sleep(400);
      await captureLocatorOrFallback(page, dialog, "05-theme-builder.png", false);
      await page.keyboard.press("Escape").catch(() => {});
    },
  });
}

async function captureStandaloneSeries(page) {
  // Standalone Patient Lookup form (before loading a patient).
  await withCapture(page, {
    file: "40-standalone-patient-lookup.png",
    route: "/patient",
    target: "Standalone Patient Lookup form",
    optional: true,
    run: async () => {
      await gotoRoute(page, "/patient");
      const form = page.locator('.MuiPaper-root:has(input[name="patient-id"])').first();
      const hasForm = await waitForLocator(form, 8000);
      if (!hasForm) {
        throw new Error("Patient Lookup form not found");
      }
      await page.getByLabel("Patient ID").first().fill(DOC_PATIENT_ID);
      await captureLocatorOrFallback(page, form, "40-standalone-patient-lookup.png", false);
    },
  });

  // Load the deterministic patient once; reuse for the Document Viewer shots.
  let patientLoaded = true;
  try {
    await loadStandalonePatient(page, DOC_PATIENT_ID);
  } catch (error) {
    patientLoaded = false;
    console.warn(`Standalone patient captures skipped: ${error.message}`);
  }

  if (!patientLoaded) {
    for (const file of [
      "41-patient-fact-linked-timeline.png",
      "42-document-viewer-concept-list.png",
      "43-document-viewer-group-filter.png",
      "44-document-viewer-confidence-filter.png",
    ]) {
      await withCapture(page, {
        file,
        route: "/patient",
        target: "Standalone patient (unavailable)",
        optional: true,
        run: async () => {
          throw new Error(`Patient ${DOC_PATIENT_ID} did not load.`);
        },
      });
    }
    return;
  }

  // Patient Document Timeline chart (the normal date-positioned view).
  await withCapture(page, {
    file: "46-document-timeline.png",
    route: "/patient",
    target: "Patient Document Timeline chart",
    optional: true,
    run: async () => {
      const timelineCard = page
        .locator('.MuiCard-root:has(:text("Patient Document Timeline"))')
        .first();
      if (!(await waitForLocator(timelineCard, 6000))) {
        throw new Error("Patient Document Timeline card not found");
      }
      await timelineCard.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, timelineCard, "46-document-timeline.png", false);
    },
  });

  // Document Viewer — Concept List (default tab).
  await withCapture(page, {
    file: "42-document-viewer-concept-list.png",
    route: "/patient",
    target: "Document Viewer — Concept List",
    optional: true,
    run: async () => {
      const card = documentViewerCard(page);
      if ((await card.count()) === 0) {
        throw new Error("Document Viewer card not found");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, card, "42-document-viewer-concept-list.png", false);
    },
  });

  // Document Viewer — Group Filter tab.
  await withCapture(page, {
    file: "43-document-viewer-group-filter.png",
    route: "/patient",
    target: "Document Viewer — Group Filter",
    optional: true,
    run: async () => {
      const tab = page.getByRole("tab", { name: "Group Filter" }).first();
      if (!(await waitForLocator(tab, 5000))) {
        throw new Error("Group Filter tab not found");
      }
      await tab.click();
      await sleep(400);
      await captureLocatorOrFallback(page, documentViewerCard(page), "43-document-viewer-group-filter.png", false);
    },
  });

  // Document Viewer — Confidence Filter tab.
  await withCapture(page, {
    file: "44-document-viewer-confidence-filter.png",
    route: "/patient",
    target: "Document Viewer — Confidence Filter",
    optional: true,
    run: async () => {
      const tab = page.getByRole("tab", { name: "Confidence Filter" }).first();
      if (!(await waitForLocator(tab, 5000))) {
        throw new Error("Confidence Filter tab not found");
      }
      await tab.click();
      await sleep(400);
      await captureLocatorOrFallback(
        page,
        documentViewerCard(page),
        "44-document-viewer-confidence-filter.png",
        false
      );
    },
  });

  // Cancer/Tumor fact selected → fact-linked timeline (dashed markers).
  await withCapture(page, {
    file: "41-patient-fact-linked-timeline.png",
    route: "/patient",
    target: "Selected cancer/tumor fact with linked timeline",
    optional: true,
    fallbackFullPage: true,
    run: async () => {
      // Fact badges are buttons inside the Cancer and Tumor Detail card.
      const detailCard = page
        .locator('.MuiCard-root:has(:text("Cancer and Tumor Detail"))')
        .first();
      const factButton = detailCard.locator("button").first();
      if ((await factButton.count()) === 0) {
        throw new Error("No selectable cancer/tumor fact found");
      }
      await factButton.click();
      await sleep(700);
      await captureViewport(page, "41-patient-fact-linked-timeline.png", false);
    },
  });
}

// Select one value on a named filter card. Bar overlays are SVG rects whose
// React handler only fires on keyboard activation, so focus and press Enter
// rather than clicking — the same approach as activateFilterSelection.
async function selectFilterValue(page, filterName, value) {
  const card = filterCardLocator(page, filterName);
  if (!(await waitForLocator(card, 10000))) {
    throw new Error(`${filterName} filter card not found`);
  }

  await card.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(250);

  const bar = card
    .locator(`.horizontal-bar-filter-row-overlay[role='button'][aria-label^="${value}:"]`)
    .first();
  if ((await bar.count()) === 0) {
    throw new Error(`Value "${value}" not found on the ${filterName} card`);
  }

  await bar.focus().catch(() => {});
  await page.keyboard.press("Enter");
  await sleep(1200);

  const label = (await bar.getAttribute("aria-label")) || "";
  if (!/\bSelected\b/i.test(label)) {
    throw new Error(`Value "${value}" did not enter the selected state`);
  }

  return card;
}

// Scroll a target so its top sits near the top of the viewport. Filter cards
// captured while the Selected Patients drawer is open would otherwise be
// overlapped by it — the drawer is fixed to the bottom of the window, and an
// element screenshot renders whatever covers the element's box.
async function scrollElementClearOfDrawer(page, locator, topMargin = 120) {
  await locator
    .evaluate((element, margin) => {
      const { top } = element.getBoundingClientRect();
      window.scrollBy({ top: top - margin, left: 0, behavior: "instant" });
    }, topMargin)
    .catch(() => {});
  await sleep(400);
}

// Open the most recent document of a given type from the patient timeline.
// Points are rendered in date order, so the last match is the latest one.
async function selectLatestTimelineDocument(page, typeLabel) {
  const points = page.locator(`circle[aria-label*="Type ${typeLabel}."]`);
  const count = await points.count();
  if (count === 0) {
    throw new Error(`No "${typeLabel}" points on the document timeline`);
  }

  const target = points.nth(count - 1);
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ force: true });

  const loaded = await waitForLocator(
    page.getByText(`Selected:`, { exact: false }).first(),
    8000
  );
  if (!loaded) {
    throw new Error(`Selecting a "${typeLabel}" point did not load a document`);
  }
  await sleep(900);
}

// The guided exercise (docs/getting-started/guided-exercise.md) teaches cohort
// cross-filtering and then contrasts two patient records. These captures are
// data-dependent by nature — they depend on a specific staging value and two
// specific patients — so every one of them is optional.
async function captureGuidedExerciseSeries(page) {
  // Step 2: the Stage card with the exercise's staging value selected, and a
  // second card showing the in-cohort/total counts that selection produces.
  // The selection happens once, outside withCapture, because both captures
  // depend on it — withCapture handles its own failures and never rethrows.
  await gotoRoute(page, "/");

  let stageSelectionError = "";
  let stageCard = null;
  try {
    stageCard = await selectFilterValue(page, "Stage", EXERCISE_STAGE_VALUE);
  } catch (error) {
    stageSelectionError = error instanceof Error ? error.message : String(error);
  }

  await withCapture(page, {
    file: "60-exercise-stage-filter-selected.png",
    route: "/",
    target: `Stage card with ${EXERCISE_STAGE_VALUE} selected`,
    optional: true,
    run: async () => {
      if (!stageCard) {
        throw new Error(stageSelectionError);
      }
      await scrollElementClearOfDrawer(page, stageCard);
      await captureLocatorOrFallback(page, stageCard, "60-exercise-stage-filter-selected.png", false);
    },
  });

  await withCapture(page, {
    file: "61-exercise-cross-filter-counts.png",
    route: "/",
    target: "Metastatic Behavior card showing in-cohort counts",
    optional: true,
    run: async () => {
      if (!stageCard) {
        throw new Error(`"${EXERCISE_STAGE_VALUE}" could not be selected: ${stageSelectionError}`);
      }
      const card = filterCardLocator(page, "Metastatic Behavior");
      if (!(await waitForLocator(card, 8000))) {
        throw new Error("Metastatic Behavior card not found");
      }
      await scrollElementClearOfDrawer(page, card);
      await captureLocatorOrFallback(page, card, "61-exercise-cross-filter-counts.png", false);
    },
  });

  // Steps 3a–3c: the record whose structure and source notes agree.
  const corroboratedFiles = [
    "62-exercise-cancer-tumor-detail.png",
    "63-exercise-relapse-timeline.png",
    "64-exercise-source-pathology.png",
  ];

  try {
    await loadStandalonePatient(page, EXERCISE_CORROBORATED_PATIENT_ID);
  } catch (error) {
    for (const file of corroboratedFiles) {
      await withCapture(page, {
        file,
        route: "/patient",
        target: "Guided exercise patient (unavailable)",
        optional: true,
        run: async () => {
          throw new Error(`Patient ${EXERCISE_CORROBORATED_PATIENT_ID} did not load: ${error.message}`);
        },
      });
    }
    return captureGuidedExerciseConflicted(page);
  }

  await withCapture(page, {
    file: "62-exercise-cancer-tumor-detail.png",
    route: "/patient",
    target: "Cancer and Tumor Detail with a metastatic second cancer",
    optional: true,
    run: async () => {
      const card = page.locator('.MuiCard-root:has(:text("Cancer and Tumor Detail"))').first();
      if (!(await waitForLocator(card, 8000))) {
        throw new Error("Cancer and Tumor Detail card not found");
      }
      await captureLocatorOrFallback(page, card, "62-exercise-cancer-tumor-detail.png", false);
    },
  });

  await withCapture(page, {
    file: "63-exercise-relapse-timeline.png",
    route: "/patient",
    target: "Document timeline showing a gap followed by a relapse cluster",
    optional: true,
    run: async () => {
      const card = page.locator('.MuiCard-root:has(:text("Patient Document Timeline"))').first();
      if (!(await waitForLocator(card, 8000))) {
        throw new Error("Patient Document Timeline card not found");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, card, "63-exercise-relapse-timeline.png", false);
    },
  });

  await withCapture(page, {
    file: "64-exercise-source-pathology.png",
    route: "/patient",
    target: "Document Viewer on the most recent pathology report",
    optional: true,
    run: async () => {
      await selectLatestTimelineDocument(page, "Surgical Pathology Report");
      const card = documentViewerCard(page);
      if ((await card.count()) === 0) {
        throw new Error("Document Viewer card not found");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, card, "64-exercise-source-pathology.png", false);
    },
  });

  return captureGuidedExerciseConflicted(page);
}

// Steps 4b–4d: the record that disagrees with itself.
//
// The Patient Summary card exists only in the embedded (drawer) patient view,
// not on the standalone /patient route, so this capture reaches the patient the
// way the exercise does: narrow the cohort until the patient renders as a dot,
// then click the dot to open their tab in the drawer.
async function captureGuidedExerciseConflicted(page) {
  await withCapture(page, {
    file: "65-exercise-conflicted-summary.png",
    route: "/",
    target: "Patient Summary with conflicted and negated findings",
    optional: true,
    run: async () => {
      await gotoRoute(page, "/");
      await selectFilterValue(page, "Stage", EXERCISE_STAGE_VALUE);
      await selectFilterValue(page, "Age at Dx", EXERCISE_AGE_BAND);

      // Only this patient's dot will do. Dots are drawn per filter value from
      // that value's own patient list, so the page is full of dots belonging to
      // other patients — taking "any" dot would silently capture the wrong
      // record. Wait for the cohort to settle rather than reading the count
      // immediately: dots appear only once patient IDs have loaded.
      const dot = page
        .locator(`[role="button"][aria-label^="Patient ${EXERCISE_CONFLICTED_PATIENT_ID}."]`)
        .first();
      if (!(await waitForLocator(dot, 15000))) {
        throw new Error(
          `No patient dot for ${EXERCISE_CONFLICTED_PATIENT_ID} under ` +
            `${EXERCISE_STAGE_VALUE} + ${EXERCISE_AGE_BAND}`
        );
      }

      // Activate with the keyboard, not a click. Dots are small, densely packed
      // SVG circles and the drawer overlays the lower page, so a forced click
      // can land on a neighbouring dot and open the wrong patient.
      await dot.scrollIntoViewIfNeeded().catch(() => {});
      await dot.focus();
      await page.keyboard.press("Enter");

      const drawer = page.locator("[data-testid='patient-grid-drawer']").first();
      if (!(await waitForLocator(drawer, 10000))) {
        throw new Error("Patient drawer did not open after activating the patient dot");
      }

      // Confirm the drawer really opened the intended patient before capturing.
      const patientTab = drawer
        .getByRole("tab", { name: new RegExp(EXERCISE_CONFLICTED_PATIENT_ID) })
        .first();
      if (!(await waitForLocator(patientTab, 10000))) {
        throw new Error(
          `Drawer did not open a tab for ${EXERCISE_CONFLICTED_PATIENT_ID}`
        );
      }
      await drawer
        .locator("[role='progressbar']")
        .first()
        .waitFor({ state: "hidden", timeout: 15000 })
        .catch(() => {});
      await sleep(700);

      // The scroll region — and the confidence slider with its hidden-findings
      // count — render only while the section is expanded.
      const expandToggle = page
        .locator('button[aria-label="Expand Patient Summary section"]')
        .first();
      if ((await expandToggle.count()) > 0) {
        await expandToggle.click();
        await sleep(600);
      }

      // Same locator as 33-patient-summary-card: the title is a CardHeader span,
      // and the scroll region only exists when structured sections are present.
      const card = page
        .locator('.MuiCard-root:has([data-testid="patient-summary-card-scroll"])')
        .first();
      if (!(await waitForLocator(card, 8000))) {
        throw new Error("Patient Summary card not found or has no summary sections");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, card, "65-exercise-conflicted-summary.png", false);
    },
  });

  // The Document Viewer does render standalone, so the concept-list capture
  // uses the deterministic /patient route.
  await withCapture(page, {
    file: "66-exercise-negated-concepts.png",
    route: "/patient",
    target: "Concept List showing affirmed and negated mentions in one note",
    optional: true,
    run: async () => {
      await loadStandalonePatient(page, EXERCISE_CONFLICTED_PATIENT_ID);
      await selectLatestTimelineDocument(page, "Radiology Report");
      const card = documentViewerCard(page);
      if ((await card.count()) === 0) {
        throw new Error("Document Viewer card not found");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, card, "66-exercise-negated-concepts.png", false);
    },
  });
}

// Open a filter card's Details dialog and type a search term. Returns the dialog
// locator (matching rows visible) without selecting anything, so the caller can
// both capture the search state and then select a value.
async function openFilterDialogAndSearch(page, filterName, searchTerm) {
  const openButton = page.locator(`button[aria-label="Open ${filterName} filter"]`).first();
  if (!(await waitForLocator(openButton, 8000))) {
    throw new Error(`"Open ${filterName} filter" button not found`);
  }
  await openButton.scrollIntoViewIfNeeded().catch(() => {});
  await openButton.click();

  const dialog = page.getByRole("dialog").first();
  if (!(await waitForLocator(dialog, 6000))) {
    throw new Error(`${filterName} details dialog did not open`);
  }
  // The input's accessible name comes from its inputProps aria-label
  // ("Search filter values"), which overrides the visible "Search values"
  // TextField label — so match the input directly.
  const search = dialog
    .locator('input[aria-label="Search filter values"], input[placeholder="Type to filter labels"]')
    .first();
  if (!(await waitForLocator(search, 6000))) {
    throw new Error("Search field not found in the details dialog");
  }
  await search.fill(searchTerm);
  await sleep(600);
  return dialog;
}

// Open a filter card's Details dialog without searching. Used when the whole
// value list is wanted — e.g. the Stage dialog, which lists every stage in a
// scrollable list and clearly dims unavailable values, where the compact card
// clips its fourth row once values render as (taller) patient-dot rows.
async function openFilterDialog(page, filterName) {
  const openButton = page.locator(`button[aria-label="Open ${filterName} filter"]`).first();
  if (!(await waitForLocator(openButton, 8000))) {
    throw new Error(`"Open ${filterName} filter" button not found`);
  }
  await openButton.scrollIntoViewIfNeeded().catch(() => {});
  await openButton.click();
  const dialog = page.getByRole("dialog").first();
  if (!(await waitForLocator(dialog, 6000))) {
    throw new Error(`${filterName} details dialog did not open`);
  }
  await sleep(500);
  return dialog;
}

// Close an open details dialog so it does not overlay later captures.
async function closeDialog(page, dialog) {
  const closeButton = dialog.getByRole("button", { name: /close/i }).first();
  if ((await closeButton.count()) > 0) {
    await closeButton.click();
  } else {
    await page.keyboard.press("Escape").catch(() => {});
  }
  await sleep(400);
}

// The targeted-therapy exercise: build a HER2-drug cohort through the Treatments
// search dialog (the facet is far too long to scroll), then read the biomarker
// repaint as a data-quality check, and finish in the patient table. Every capture
// is data-dependent and therefore optional.
async function captureTargetedTherapySeries(page) {
  await gotoRoute(page, "/");

  // Open the Treatments dialog and search for the drug. The selection is applied
  // here (outside withCapture, which never rethrows) so later cards can repaint.
  let therapyError = "";
  let therapySelected = false;
  let dialog = null;
  try {
    dialog = await openFilterDialogAndSearch(page, "Treatments", THERAPY_DRUG);
  } catch (error) {
    therapyError = error instanceof Error ? error.message : String(error);
  }

  await withCapture(page, {
    file: "70-therapy-treatment-search.png",
    route: "/",
    target: `Treatments details dialog searched for ${THERAPY_DRUG}`,
    optional: true,
    run: async () => {
      if (!dialog) {
        throw new Error(therapyError);
      }
      await captureLocatorOrFallback(page, dialog, "70-therapy-treatment-search.png", false);
    },
  });

  if (dialog) {
    try {
      // Select the exact-drug row (not a combination regimen containing the name).
      const row = dialog
        .locator(`[role="button"][aria-label^="${THERAPY_DRUG}:"]`)
        .first();
      if (!(await waitForLocator(row, 5000))) {
        throw new Error(`No "${THERAPY_DRUG}" row in the dialog`);
      }
      await row.click();
      await sleep(600);
      await closeDialog(page, dialog);
      await sleep(400);
      therapySelected = true;
    } catch (error) {
      therapyError = error instanceof Error ? error.message : String(error);
    }
  }

  // The gene enrichment: with the drug cohort active, the Genes details dialog
  // reports how many of them carry the HER2/ERBB2 gene, as in-cohort / total.
  // The dialog is used rather than the compact card because the card renders
  // only its first few (alphabetical) rows, which can bury the ERBB2 row.
  await withCapture(page, {
    file: "71-therapy-gene-repaint.png",
    route: "/",
    target: "Genes details dialog showing ERBB2 in-cohort count",
    optional: true,
    run: async () => {
      if (!therapySelected) {
        throw new Error(`"${THERAPY_DRUG}" could not be selected: ${therapyError}`);
      }
      const genesDialog = await openFilterDialogAndSearch(page, "Genes", "ERBB");
      const erbbRow = genesDialog.locator('[aria-label^="ERBB 2 Gene:"]').first();
      if (!(await waitForLocator(erbbRow, 5000))) {
        throw new Error("ERBB2 row not found in the Genes dialog");
      }
      await captureLocatorOrFallback(page, genesDialog, "71-therapy-gene-repaint.png", false);
      // Close so the dialog does not overlay the following card captures.
      await closeDialog(page, genesDialog);
    },
  });

  // The gap: a recorded HER2 status finding exists for far fewer patients.
  await withCapture(page, {
    file: "72-therapy-her2-gap.png",
    route: "/",
    target: "HER2/Neu Status card showing partial coverage",
    optional: true,
    run: async () => {
      if (!therapySelected) {
        throw new Error(`"${THERAPY_DRUG}" could not be selected: ${therapyError}`);
      }
      const card = filterCardLocator(page, "HER2/Neu Status");
      if (!(await waitForLocator(card, 8000))) {
        throw new Error("HER2/Neu Status card not found");
      }
      await scrollElementClearOfDrawer(page, card);
      await captureLocatorOrFallback(page, card, "72-therapy-her2-gap.png", false);
    },
  });

  // The patient table: columns (incl. Biomarkers / Treatments), the column
  // chooser, and CSV export, sorted by document count.
  await withCapture(page, {
    file: "73-therapy-cohort-table.png",
    route: "/",
    target: "Selected Patients table with CSV export, sorted by document count",
    optional: true,
    run: async () => {
      if (!therapySelected) {
        throw new Error(`"${THERAPY_DRUG}" could not be selected: ${therapyError}`);
      }
      const region = page.locator("[data-testid='patient-grid-embedded']").first();
      if (!(await waitForLocator(region, 12000))) {
        throw new Error("Selected Patients table not visible");
      }
      // Sort by document count so the richest records lead (two clicks =
      // descending). Best effort — the capture is worthwhile even unsorted.
      const header = region.locator('th:has-text("Document Count"), [role="columnheader"]:has-text("Document Count")').first();
      if ((await header.count()) > 0) {
        await header.click().catch(() => {});
        await sleep(300);
        await header.click().catch(() => {});
        await sleep(500);
      }
      await region.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, region, "73-therapy-cohort-table.png", false);
    },
  });
}

// The treatment-outcome exercise: contrast two response groups. The headline is
// the Stage card, where a whole stage value goes disabled for each group in a
// different place. All captures are data-dependent and optional.
async function captureOutcomeComparisonSeries(page) {
  // Responders.
  await gotoRoute(page, "/");
  let responderError = "";
  let responderSelected = false;
  try {
    await selectFilterValue(page, OUTCOME_COURSE_CARD, OUTCOME_RESPONDER_VALUE);
    responderSelected = true;
  } catch (error) {
    responderError = error instanceof Error ? error.message : String(error);
  }

  await withCapture(page, {
    file: "80-outcome-responders-stage.png",
    route: "/",
    target: `Stage dialog for ${OUTCOME_RESPONDER_VALUE} (Stage IV disabled)`,
    optional: true,
    run: async () => {
      if (!responderSelected) {
        throw new Error(responderError);
      }
      const dialog = await openFilterDialog(page, "Stage");
      await captureLocatorOrFallback(page, dialog, "80-outcome-responders-stage.png", false);
      await closeDialog(page, dialog);
    },
  });

  await withCapture(page, {
    file: "81-outcome-responders-behavior.png",
    route: "/",
    target: `Metastatic Behavior card for ${OUTCOME_RESPONDER_VALUE}`,
    optional: true,
    run: async () => {
      if (!responderSelected) {
        throw new Error(responderError);
      }
      const card = filterCardLocator(page, "Metastatic Behavior");
      if (!(await waitForLocator(card, 8000))) {
        throw new Error("Metastatic Behavior card not found");
      }
      await scrollElementClearOfDrawer(page, card);
      await captureLocatorOrFallback(page, card, "81-outcome-responders-behavior.png", false);
    },
  });

  // Progressors.
  await gotoRoute(page, "/");
  let progressorError = "";
  let progressorSelected = false;
  try {
    await selectFilterValue(page, OUTCOME_COURSE_CARD, OUTCOME_PROGRESSOR_VALUE);
    progressorSelected = true;
  } catch (error) {
    progressorError = error instanceof Error ? error.message : String(error);
  }

  await withCapture(page, {
    file: "82-outcome-progressors-stage.png",
    route: "/",
    target: `Stage dialog for ${OUTCOME_PROGRESSOR_VALUE} (Stage IV present)`,
    optional: true,
    run: async () => {
      if (!progressorSelected) {
        throw new Error(progressorError);
      }
      const dialog = await openFilterDialog(page, "Stage");
      await captureLocatorOrFallback(page, dialog, "82-outcome-progressors-stage.png", false);
      await closeDialog(page, dialog);
    },
  });

  await withCapture(page, {
    file: "83-outcome-progressors-behavior.png",
    route: "/",
    target: `Metastatic Behavior card for ${OUTCOME_PROGRESSOR_VALUE}`,
    optional: true,
    run: async () => {
      if (!progressorSelected) {
        throw new Error(progressorError);
      }
      const card = filterCardLocator(page, "Metastatic Behavior");
      if (!(await waitForLocator(card, 8000))) {
        throw new Error("Metastatic Behavior card not found");
      }
      await scrollElementClearOfDrawer(page, card);
      await captureLocatorOrFallback(page, card, "83-outcome-progressors-behavior.png", false);
    },
  });
}

async function captureCollapsedDateTimeline(page) {
  await withCapture(page, {
    file: "45-collapsed-date-episode-controls.png",
    route: "/patient",
    target: "Timeline collapsed-date episode controls",
    optional: true,
    run: async () => {
      await loadStandalonePatient(page, COLLAPSED_DATE_PATIENT_ID);
      const timelineCard = page.locator('.MuiCard-root:has(:text("Patient Document Timeline"))').first();
      const showAll = timelineCard.getByText("Show all documents", { exact: true }).first();
      if (!(await waitForLocator(showAll, 5000))) {
        throw new Error(
          `Patient ${COLLAPSED_DATE_PATIENT_ID} does not show the collapsed-date fallback`
        );
      }
      await captureLocatorOrFallback(page, timelineCard, "45-collapsed-date-episode-controls.png", false);
    },
  });
}

// Toolbar display controls: font size, high contrast, reduced motion, and the
// bars-behind-dots toggle sit in one row. Capture the row as a single figure.
async function captureDisplayControls(page) {
  await withCapture(page, {
    file: "48-display-controls.png",
    route: "/",
    target: "Toolbar display controls (font size, contrast, motion, bars behind dots)",
    optional: true,
    run: async () => {
      const fontGroup = page.locator('[role="group"][aria-label="Font size"]').first();
      if (!(await waitForLocator(fontGroup, 6000))) {
        throw new Error("Font size control group not found in the toolbar");
      }
      // The controls share one flex row — capture that row (the group's parent).
      const controlsRow = fontGroup.locator("xpath=..");
      await controlsRow.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, controlsRow, "48-display-controls.png", false);
    },
  });
}

// Bars-behind-dots effect. The toggle defaults OFF, so enable it, capture a card
// that shows the proportional bar drawn behind the patient dots, then restore it.
async function captureBarsBehindDots(page) {
  await withCapture(page, {
    file: "10-patient-dots-bars-behind.png",
    route: "/",
    target: "Filter card with bars drawn behind patient dots",
    optional: true,
    run: async () => {
      // Ensure the toggle is on. It is often already on (a remembered setting), in
      // which case only the "Hide…" button exists — that is fine, leave it on.
      const turnOn = page.getByRole("button", { name: "Show bars behind patient dots" }).first();
      if (await turnOn.count()) {
        await turnOn.click();
        await sleep(600);
      }
      // Capture a card that actually has patient dots so the bars-behind effect shows.
      const card = page.locator(".filter-card:has(.horizontal-bar-filter-patient-dot)").first();
      if (!(await waitForLocator(card, 6000))) {
        throw new Error("No filter card with patient dots found");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, card, "10-patient-dots-bars-behind.png", false);
    },
  });
}

// Filter details dialog: opened from a filter card's "Open <name> filter" button.
// Shows the in-dialog search, sort, and value-selection controls.
async function captureFilterDetailDialog(page) {
  await withCapture(page, {
    file: "47-filter-details-dialog.png",
    route: "/",
    target: "Filter details dialog (search / sort / select values)",
    optional: true,
    run: async () => {
      const openButton = page.locator('button[aria-label="Open Age at Dx filter"]').first();
      if (!(await waitForLocator(openButton, 6000))) {
        throw new Error("Filter card 'Open Age at Dx filter' button not found");
      }
      await openButton.scrollIntoViewIfNeeded().catch(() => {});
      await openButton.click();
      const dialog = page.getByRole("dialog").first();
      if (!(await waitForLocator(dialog, 6000))) {
        throw new Error("Filter details dialog did not open");
      }
      // Wait for the in-dialog search field so the capture shows the full control set.
      await waitForLocator(dialog.getByLabel("Search values"), 4000);
      await sleep(400);
      await captureLocatorOrFallback(page, dialog, "47-filter-details-dialog.png", false);
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(200);
    },
  });
}

// Zero-result cohort guidance. Best effort: selecting one value across several
// distinct cards drives most datasets to a non-overlapping (empty) cohort. We
// stop as soon as the count readout reads zero and capture the guidance panel.
// Data-dependent — if the cohort never empties, this reports a fallback and the
// page keeps its prose. Run last so it does not disturb the populated-cohort shots.
async function captureZeroResultGuidance(page) {
  await withCapture(page, {
    file: "26-zero-result-guidance.png",
    route: "/",
    target: "Zero-result cohort guidance",
    optional: true,
    run: async () => {
      await gotoRoute(page, "/");
      const cards = page.locator(".filter-card");
      const cardCount = await cards.count();
      const readout = page.locator('[data-testid="patient-count-readout"]').first();
      let reachedZero = false;

      for (let index = 0; index < cardCount && !reachedZero; index += 1) {
        const card = cards.nth(index);
        const bars = card.locator(".horizontal-bar-filter-row-overlay[role='button']");
        if ((await bars.count()) === 0) continue;
        await card.scrollIntoViewIfNeeded().catch(() => {});
        await bars.first().focus().catch(() => {});
        await page.keyboard.press("Enter");
        await sleep(900);
        const text = ((await readout.textContent().catch(() => "")) || "").trim();
        if (/\b0\b/.test(text)) {
          reachedZero = true;
        }
      }

      if (!reachedZero) {
        throw new Error("Could not drive the cohort to zero with the available data");
      }
      await sleep(300);
      const panel = page.locator('[data-testid="identified-patients-panel"]').first();
      await captureLocatorOrFallback(page, panel, "26-zero-result-guidance.png", false);
    },
  });
}

// Hierarchical (expandable) filter values. Data-dependent: needs a card whose
// values roll up into a tree. Expand the first expandable parent, then capture.
async function captureHierarchicalValues(page) {
  await withCapture(page, {
    file: "51-filter-hierarchical-values.png",
    route: "/",
    target: "Filter card with hierarchical (expandable) values",
    optional: true,
    run: async () => {
      await gotoRoute(page, "/");
      const card = page
        .locator('.filter-card:has(.horizontal-bar-filter-row-expand-hitbox[role="button"])')
        .first();
      if (!(await waitForLocator(card, 6000))) {
        throw new Error("No hierarchical (expandable) filter values in this dataset");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      // Expand the first parent so its child values are visible in the capture.
      await card
        .locator('.horizontal-bar-filter-row-expand-hitbox[role="button"]')
        .first()
        .click()
        .catch(() => {});
      await sleep(600);
      await captureLocatorOrFallback(page, card, "51-filter-hierarchical-values.png", false);
    },
  });
}

// Disabled (dimmed) filter values. Depends on an active selection that leaves
// some non-overlapping values unselectable — run just after a selection.
async function captureDisabledValues(page) {
  await withCapture(page, {
    file: "52-filter-disabled-values.png",
    route: "/",
    target: "Filter card with disabled (dimmed) values",
    optional: true,
    run: async () => {
      const card = page
        .locator(".filter-card:has(.horizontal-bar-filter-row.is-disabled)")
        .first();
      if (!(await waitForLocator(card, 6000))) {
        throw new Error("No disabled filter values in the current selection state");
      }
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(300);
      await captureLocatorOrFallback(page, card, "52-filter-disabled-values.png", false);
    },
  });
}

// Selected Patients drawer window controls (minimize / maximize). Requires the
// drawer to be open (an active cohort).
async function captureDrawerWindowControls(page) {
  await withCapture(page, {
    file: "49-drawer-window-controls.png",
    route: "/",
    target: "Selected Patients drawer window controls (minimize / maximize)",
    optional: true,
    run: async () => {
      const controls = page.locator('[aria-label="Drawer window controls"]').first();
      if (!(await waitForLocator(controls, 6000))) {
        throw new Error("Drawer window controls not found (drawer not open?)");
      }
      await controls.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(200);
      await captureLocatorOrFallback(page, controls, "49-drawer-window-controls.png", false);
    },
  });
}

// CSV export control in the Selected Patients drawer toolbar.
async function captureCsvExportButton(page) {
  await withCapture(page, {
    file: "50-csv-export-button.png",
    route: "/",
    target: "CSV export control in the Selected Patients drawer",
    optional: true,
    run: async () => {
      const exportButton = page
        .getByRole("button", { name: "Export filtered cohort rows to CSV" })
        .first();
      if (!(await waitForLocator(exportButton, 6000))) {
        throw new Error("CSV export button not found");
      }
      await exportButton.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(200);
      // Capture the toolbar cluster around the export control, not the bare icon.
      const toolbarCluster = exportButton.locator("xpath=..");
      await captureLocatorOrFallback(page, toolbarCluster, "50-csv-export-button.png", false);
    },
  });
}

async function run() {
  await ensureOutput();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "light",
  });
  // Force the "Standard" (govuk) app theme for documentation screenshots, regardless
  // of the OS color scheme. Without this the app falls back to Obsidian under a dark
  // preference. THEME_STORAGE_KEY is "filterPageTheme" (see src/themes.js).
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("filterPageTheme", "govuk");
    } catch {
      // localStorage unavailable; the app default still resolves to Standard in light mode.
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    // The Cohort Explorer is the app root ("/"); there is no separate "/filters" route.
    await gotoRoute(page, "/");
    await page.locator("[data-testid='filters-page-heading']").first().waitFor({
      state: "visible",
      timeout: 20000,
    });

    await withCapture(page, {
      file: "02-filters-overview.png",
      route: "/",
      target: "Filters overview",
      fallbackFullPage: false,
      run: async () => {
        await captureViewport(page, "02-filters-overview.png", false);
      },
    });

    await withCapture(page, {
      file: "03-identified-patients-panel.png",
      route: "/",
      target: "Identified Patients panel",
      fallbackFullPage: false,
      run: async () => {
        const panel = page.locator("[data-testid='identified-patients-panel']").first();
        await captureLocatorOrFallback(page, panel, "03-identified-patients-panel.png", false);
      },
    });

    // Secondary (Reference) shot: the display/theme selector for the display-settings page.
    await withCapture(page, {
      file: "04-theme-selector-open.png",
      route: "/",
      target: "Theme selector menu open",
      fallbackFullPage: false,
      run: async () => {
        await openThemeMenu(page);
        await captureViewport(page, "04-theme-selector-open.png", false);
        await page.keyboard.press("Escape").catch(() => {});
        await sleep(250);
      },
    });

    // Cohort filtering: one representative filter card.
    await captureFilterCard(page, "09-filter-age-at-dx.png", "Age at Dx");
    // Bars-behind-dots display toggle: enable it, capture the effect, restore.
    await captureBarsBehindDots(page);
    // Toolbar display controls (font size, high contrast, reduced motion, bars behind dots).
    await captureDisplayControls(page);
    // The filter details dialog opened from a filter card.
    await captureFilterDetailDialog(page);
    // Hierarchical (expandable) filter values, if the dataset has any.
    await captureHierarchicalValues(page);

    // Reference & Explore-a-Patient captures.
    await captureThemeBuilder(page);
    await captureStandaloneSeries(page);
    await captureCollapsedDateTimeline(page);

    await gotoRoute(page, "/");
    const activeSelection = await activateFilterSelection(page);
    await withCapture(page, {
      file: "21-filter-selection-active-state.png",
      route: "/",
      target: "Active filter selection state",
      fallbackFullPage: false,
      run: async () => {
        if (!activeSelection.activated) {
          throw new Error("Could not activate any filter value on the Cohort Explorer");
        }

        await captureLocatorOrFallback(
          page,
          activeSelection.card,
          "21-filter-selection-active-state.png",
          false
        );
      },
    });

    // Re-capture the patient-count panel now that a filter is active, so the
    // results guide shows the "N of total patients selected" state (the earlier
    // 03 capture shows the unfiltered "All N patients" state).
    if (activeSelection.activated) {
      await withCapture(page, {
        file: "03-identified-patients-panel.png",
        route: "/",
        target: "Identified Patients panel (filtered/active count)",
        fallbackFullPage: false,
        run: async () => {
          const panel = page.locator("[data-testid='identified-patients-panel']").first();
          await captureLocatorOrFallback(page, panel, "03-identified-patients-panel.png", false);
        },
      });
    }

    // Disabled/dimmed values appear once a selection is active (from above).
    await captureDisabledValues(page);

    await capturePatientDetailsSeries(page);

    // Drawer window controls and CSV export live in the open Selected Patients drawer.
    await captureDrawerWindowControls(page);
    await captureCsvExportButton(page);

    await captureEmbeddedPatientViewSeries(page);

    // Guided-exercise series: cohort cross-filtering, then two contrasting
    // patient records. Runs before the zero-result capture because it needs a
    // non-empty cohort.
    await captureGuidedExerciseSeries(page);

    // Additional guided exercises: a targeted-therapy cohort, and a
    // treatment-outcome comparison. Both need a populated cohort, so they also
    // run before the zero-result capture.
    await captureTargetedTherapySeries(page);
    await captureOutcomeComparisonSeries(page);

    // Zero-result guidance runs last — it deliberately empties the cohort.
    await gotoRoute(page, "/");
    await captureZeroResultGuidance(page);

    // Post-run validation: every targeted screenshot must exist on disk.
    for (const file of SCREENSHOT_ORDER) {
      if (!isRequested(file)) {
        continue;
      }

      const exists = await fs
        .access(filePath(file))
        .then(() => true)
        .catch(() => false);
      if (!exists && !failures.some((entry) => entry.file === file)) {
        failures.push({
          file,
          route: "n/a",
          target: "Post-run validation",
          status: "failed",
          optional: OPTIONAL_SCREENSHOTS.includes(file),
          note: "Screenshot file was not generated.",
        });
      }
    }

    await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2));

    const targeted = SCREENSHOT_ORDER.filter(isRequested);
    const requiredTargeted = REQUIRED_SCREENSHOTS.filter(isRequested);
    const requiredFailures = failures.filter(
      (entry) => !entry.optional && !OPTIONAL_SCREENSHOTS.includes(entry.file)
    );
    const optionalFailures = failures.filter(
      (entry) => entry.optional || OPTIONAL_SCREENSHOTS.includes(entry.file)
    );
    console.log(
      `Capture complete. Targeted: ${targeted.length} (${requiredTargeted.length} required)` +
        `${CAPTURE_ONLY.length > 0 ? ` — filtered by CAPTURE_ONLY=${CAPTURE_ONLY.join(",")}` : ""}. ` +
        `Required issues: ${requiredFailures.length}. Optional issues: ${optionalFailures.length}.`
    );
    console.log(`Summary written to ${SUMMARY_PATH}`);

    if (optionalFailures.length > 0) {
      console.warn(
        "Optional captures not produced (pages fall back to prose / keep existing images):\n" +
          optionalFailures.map((entry) => `- ${entry.file}: ${entry.note || "not captured"}`).join("\n")
      );
    }

    if (requiredFailures.length > 0) {
      const detail = requiredFailures
        .map((entry) => `- ${entry.file}: ${entry.note || "could not be captured as intended"}`)
        .join("\n");
      throw new Error(
        `One or more required feature screenshots could not be captured cleanly:\n${detail}\n` +
          "Fix the app state or selectors and re-run before publishing the guide."
      );
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch(async (error) => {
  await ensureOutput();
  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2)).catch(() => {});
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
