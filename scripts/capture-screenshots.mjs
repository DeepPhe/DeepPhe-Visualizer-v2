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

// Feature-documentation capture set. Each entry illustrates one of the three
// guide focus areas — cohort filtering, patient results & grid, and the
// individual patient view — plus the home landing and the secondary display
// settings shot. Review-only captures (theme variants, every filter set/card,
// debug and accessibility views) are intentionally not generated here.
const SCREENSHOT_ORDER = [
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
  console.log(`Capturing ${config.file} (${config.route})`);
  const entry = {
    file: config.file,
    route: config.route,
    target: config.target,
    status: "captured",
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

    await capturePatientDetailsSeries(page);
    await captureEmbeddedPatientViewSeries(page);

    // Post-run validation: every targeted screenshot must exist on disk.
    for (const file of SCREENSHOT_ORDER) {
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
          note: "Screenshot file was not generated.",
        });
      }
    }

    await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2));

    const total = SCREENSHOT_ORDER.length;
    console.log(`Capture complete. Feature screenshots targeted: ${total}. Issues: ${failures.length}.`);
    console.log(`Summary written to ${SUMMARY_PATH}`);

    if (failures.length > 0) {
      const detail = failures
        .map((entry) => `- ${entry.file}: ${entry.note || "could not be captured as intended"}`)
        .join("\n");
      throw new Error(
        `One or more feature screenshots could not be captured cleanly:\n${detail}\n` +
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
