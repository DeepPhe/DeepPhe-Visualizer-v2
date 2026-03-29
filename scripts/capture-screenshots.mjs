#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve("output/playwright");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "capture-summary.json");
const VIEWPORT = { width: 2200, height: 1400 };
const PLACEHOLDER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgR8iNQwAAAAASUVORK5CYII=";

const SCREENSHOT_ORDER = [
  "01-home.png",
  "02-filters-overview.png",
  "03-identified-patients-panel.png",
  "04-theme-selector-open.png",
  "05-theme-obsidian.png",
  "06-theme-solstice.png",
  "07-theme-vapor.png",
  "08-filterset-demographics.png",
  "09-filter-age-at-dx.png",
  "10-filter-race.png",
  "11-filter-gender.png",
  "12-filter-ethnicity.png",
  "13-filterset-cancer-type.png",
  "14-filter-cancer.png",
  "15-filterset-staging.png",
  "16-filter-stage.png",
  "17-filter-t-stage.png",
  "18-filter-n-stage.png",
  "19-filter-m-stage.png",
  "20-filter-lymph-involvement.png",
  "21-filter-selection-active-state.png",
  "22-patient-details-overview.png",
  "23-patient-details-column-menu.png",
  "24-patient-details-expanded-row.png",
  "25-patient-details-empty-search.png",
  "26-horizontal-bar-chart-demo.png",
  "27-filter-bar-chart-demo.png",
  "28-filter-list-control-demo.png",
  "29-patient-grid-demo.png",
  "30-debug-view.png",
  "31-accessibility-view.png",
];

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  viewport: VIEWPORT,
  screenshots: [],
  missingStates: [],
  runtimeNotes: [],
};

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
  await target
    .screenshot({ path: filePath(name), timeout: 45000, animations: "disabled" })
    .catch(async () => {
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
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      entry.note = `${entry.note} | fallback screenshot failed: ${fallbackMessage}`;
      await fs.writeFile(
        filePath(config.file),
        Buffer.from(PLACEHOLDER_PNG_BASE64, "base64")
      );
    }
    console.warn(`Fallback used for ${config.file}: ${entry.note}`);
  }

  summary.screenshots.push(entry);
  if (entry.status !== "captured") {
    summary.missingStates.push(entry);
  }
}

function filterCardLocator(page, title) {
  const heading = page.getByRole("heading", { name: title, exact: true }).first();
  return heading.locator("xpath=ancestor::div[contains(@class,'MuiPaper-root')][1]");
}

async function captureFilterSetViewport(page, file, filterSetLabel) {
  await withCapture(page, {
    file,
    route: "/filters",
    target: `${filterSetLabel} filter set`,
    fallbackFullPage: false,
    run: async () => {
      const heading = page.getByRole("heading", { name: filterSetLabel, exact: true }).first();
      const exists = await waitForLocator(heading, 10000);
      if (!exists) {
        throw new Error(`Could not find filter set heading: ${filterSetLabel}`);
      }
      await heading.scrollIntoViewIfNeeded();
      await sleep(250);
      await captureViewport(page, file, false);
    },
  });
}

async function captureFilterCard(page, file, filterName) {
  await withCapture(page, {
    file,
    route: "/filters",
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

async function chooseTheme(page, label) {
  let option = page.getByRole("option", { name: label, exact: true }).first();
  if ((await option.count()) === 0 || !(await option.isVisible().catch(() => false))) {
    await openThemeMenu(page);
  }

  option = page.getByRole("option", { name: label, exact: true }).first();
  const exists = await waitForLocator(option, 5000);
  if (!exists) {
    throw new Error(`Theme option not found: ${label}`);
  }
  await option.click();
  await sleep(350);
}

async function toggleCardHeightStates(page) {
  const toFit = page.getByLabel("Switch to fit content heights").first();
  const toNormalized = page.getByLabel("Switch to normalized row heights").first();

  const sawDefault = (await toFit.count()) > 0;
  if (sawDefault) {
    await toFit.click();
    await sleep(250);
  }

  const sawFit = (await toNormalized.count()) > 0;
  if (sawFit) {
    await toNormalized.click();
    await sleep(250);
  }

  if (sawDefault && sawFit) {
    summary.runtimeNotes.push(
      "Card height toggle automation exercised both states: normalized and fit-content."
    );
  } else {
    summary.runtimeNotes.push(
      "Card height toggle state coverage was partial due to missing toggle control at runtime."
    );
    summary.missingStates.push({
      file: "02-filters-overview.png",
      route: "/filters",
      target: "Card height toggle state coverage",
      status: "fallback",
      note: "Could not verify both card height states from the UI.",
    });
  }
}

async function activateFilterSelection(page) {
  const candidateCards = [
    "Age at Dx",
    "Race",
    "Gender",
    "Ethnicity",
    "Cancer",
    "Stage",
    "T Stage",
    "N Stage",
    "M Stage",
    "Lymph Involvement",
  ];

  for (const name of candidateCards) {
    const card = filterCardLocator(page, name);
    if ((await card.count()) === 0) {
      continue;
    }

    await card.first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(200);

    const interactive = card.locator("[role='button'][aria-pressed]");
    if ((await interactive.count()) > 0) {
      await interactive.first().click({ force: true });
      await sleep(750);
      return { activated: true, cardName: name };
    }

    const fallbackButtons = card.locator("button[aria-label^='Toggle ']");
    if ((await fallbackButtons.count()) > 0) {
      await fallbackButtons.first().click();
      await sleep(750);
      return { activated: true, cardName: name };
    }
  }

  return { activated: false, cardName: "" };
}

async function capturePatientDetailsSeries(page) {
  const detailsHeading = page.getByRole("heading", { name: /Patient Details/i }).first();
  const detailsVisible = await waitForLocator(detailsHeading, 15000);

  if (!detailsVisible) {
    summary.runtimeNotes.push(
      "Patient Details did not render on /filters after filter selection; falling back to /patient-grid-demo coverage."
    );

    await gotoRoute(page, "/patient-grid-demo");
    await page.getByRole("heading", { name: "Patient Grid Demo", exact: true }).first().waitFor({
      state: "visible",
      timeout: 10000,
    });

    const fallbackCard = page.getByRole("heading", { name: /Patient Details/i }).first()
      .locator("xpath=ancestor::div[contains(@class,'MuiCard-root')][1]");

    await withCapture(page, {
      file: "22-patient-details-overview.png",
      route: "/patient-grid-demo",
      target: "Patient Details overview",
      fallbackFullPage: false,
      run: async () => {
        await captureLocatorOrFallback(page, fallbackCard, "22-patient-details-overview.png", false);
      },
    });

    await withCapture(page, {
      file: "23-patient-details-column-menu.png",
      route: "/patient-grid-demo",
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
      route: "/patient-grid-demo",
      target: "Expanded row details",
      fallbackFullPage: false,
      run: async () => {
        const expandButton = page.locator("button[aria-label^='Expand row details']").first();
        if ((await expandButton.count()) === 0) {
          throw new Error("No expandable patient row available in fallback route");
        }

        await expandButton.click();
        await waitForLocator(page.getByText("Diagnoses", { exact: true }).first(), 3000);
        await captureViewport(page, "24-patient-details-expanded-row.png", false);
      },
    });

    await withCapture(page, {
      file: "25-patient-details-empty-search.png",
      route: "/patient-grid-demo",
      target: "Patient Details empty search state",
      fallbackFullPage: false,
      run: async () => {
        const search = page.getByPlaceholder("Search patient details...").first();
        const hasSearch = await waitForLocator(search, 4000);
        if (!hasSearch) {
          throw new Error("Patient details search input not found");
        }
        await search.fill("__no_patient_results_expected__");
        const emptyText = page.getByText("No patients match your search.", { exact: true }).first();
        await waitForLocator(emptyText, 5000);
        await captureViewport(page, "25-patient-details-empty-search.png", false);
        await search.fill("");
      },
    });

    return;
  }

  const detailsCard = detailsHeading.locator("xpath=ancestor::div[contains(@class,'MuiCard-root')][1]");

  await withCapture(page, {
    file: "22-patient-details-overview.png",
    route: "/filters",
    target: "Patient Details overview",
    fallbackFullPage: false,
    run: async () => {
      await captureLocatorOrFallback(page, detailsCard, "22-patient-details-overview.png", false);
    },
  });

  await withCapture(page, {
    file: "23-patient-details-column-menu.png",
    route: "/filters",
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
    route: "/filters",
    target: "Expanded row details",
    fallbackFullPage: false,
    run: async () => {
      const expandButton = page.locator("button[aria-label^='Expand row details']").first();
      if ((await expandButton.count()) === 0) {
        throw new Error("No expandable rows were available in patient details");
      }

      await expandButton.click();
      await waitForLocator(page.getByText("Diagnoses", { exact: true }).first(), 5000);
      await captureLocatorOrFallback(page, detailsCard, "24-patient-details-expanded-row.png", false);
    },
  });

  await withCapture(page, {
    file: "25-patient-details-empty-search.png",
    route: "/filters",
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

      await captureLocatorOrFallback(page, detailsCard, "25-patient-details-empty-search.png", false);
      await search.fill("");
    },
  });
}

async function captureRouteViewport(page, route, heading, file) {
  await gotoRoute(page, route);
  await page.getByRole("heading", { name: heading, exact: true }).first().waitFor({
    state: "visible",
    timeout: 12000,
  });

  await withCapture(page, {
    file,
    route,
    target: `${heading} route view`,
    fallbackFullPage: false,
    run: async () => {
      await captureViewport(page, file, false);
    },
  });
}

async function run() {
  await ensureOutput();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await gotoRoute(page, "/");
    await page.getByRole("heading", { name: "DeepPhe Visualizer v3", exact: true }).first().waitFor({
      state: "visible",
      timeout: 10000,
    });
    await withCapture(page, {
      file: "01-home.png",
      route: "/",
      target: "Home route",
      fallbackFullPage: false,
      run: async () => {
        await captureViewport(page, "01-home.png", false);
      },
    });

    await gotoRoute(page, "/filters");
    await page.getByRole("heading", { name: "Patient Cohort Explorer", exact: true }).first().waitFor({
      state: "visible",
      timeout: 15000,
    });

    await withCapture(page, {
      file: "02-filters-overview.png",
      route: "/filters",
      target: "Filters overview",
      fallbackFullPage: false,
      run: async () => {
        await captureViewport(page, "02-filters-overview.png", false);
      },
    });

    await toggleCardHeightStates(page);

    await withCapture(page, {
      file: "03-identified-patients-panel.png",
      route: "/filters",
      target: "Identified Patients panel",
      fallbackFullPage: false,
      run: async () => {
        const panel = page
          .getByRole("heading", { name: "Identified Patients", exact: true })
          .first()
          .locator("xpath=ancestor::div[contains(@class,'MuiPaper-root')][1]");
        await captureLocatorOrFallback(page, panel, "03-identified-patients-panel.png", false);
      },
    });

    await withCapture(page, {
      file: "04-theme-selector-open.png",
      route: "/filters",
      target: "Theme selector menu open",
      fallbackFullPage: false,
      run: async () => {
        await openThemeMenu(page);
        await captureViewport(page, "04-theme-selector-open.png", false);
      },
    });

    await withCapture(page, {
      file: "05-theme-obsidian.png",
      route: "/filters",
      target: "Theme switched to Obsidian",
      fallbackFullPage: false,
      run: async () => {
        await chooseTheme(page, "Obsidian");
        await captureViewport(page, "05-theme-obsidian.png", false);
      },
    });

    await withCapture(page, {
      file: "06-theme-solstice.png",
      route: "/filters",
      target: "Theme switched to Solstice",
      fallbackFullPage: false,
      run: async () => {
        await chooseTheme(page, "Solstice");
        await captureViewport(page, "06-theme-solstice.png", false);
      },
    });

    await withCapture(page, {
      file: "07-theme-vapor.png",
      route: "/filters",
      target: "Theme switched to Vapor",
      fallbackFullPage: false,
      run: async () => {
        await chooseTheme(page, "Vapor");
        await captureViewport(page, "07-theme-vapor.png", false);
      },
    });

    await captureFilterSetViewport(page, "08-filterset-demographics.png", "Demographics");
    await captureFilterCard(page, "09-filter-age-at-dx.png", "Age at Dx");
    await captureFilterCard(page, "10-filter-race.png", "Race");
    await captureFilterCard(page, "11-filter-gender.png", "Gender");
    await captureFilterCard(page, "12-filter-ethnicity.png", "Ethnicity");

    await captureFilterSetViewport(page, "13-filterset-cancer-type.png", "Cancer Type");
    await captureFilterCard(page, "14-filter-cancer.png", "Cancer");

    await captureFilterSetViewport(page, "15-filterset-staging.png", "Staging");
    await captureFilterCard(page, "16-filter-stage.png", "Stage");
    await captureFilterCard(page, "17-filter-t-stage.png", "T Stage");
    await captureFilterCard(page, "18-filter-n-stage.png", "N Stage");
    await captureFilterCard(page, "19-filter-m-stage.png", "M Stage");
    await captureFilterCard(page, "20-filter-lymph-involvement.png", "Lymph Involvement");

    const activeSelection = await activateFilterSelection(page);
    await withCapture(page, {
      file: "21-filter-selection-active-state.png",
      route: "/filters",
      target: "Active filter selection state",
      fallbackFullPage: false,
      run: async () => {
        if (!activeSelection.activated) {
          throw new Error("Could not activate any filter value on /filters");
        }

        const card = filterCardLocator(page, activeSelection.cardName);
        await captureLocatorOrFallback(page, card, "21-filter-selection-active-state.png", false);
      },
    });

    if (!activeSelection.activated) {
      summary.runtimeNotes.push(
        "No selectable filter values were available on /filters; active-state capture uses fallback viewport content."
      );
    }

    await capturePatientDetailsSeries(page);

    await captureRouteViewport(
      page,
      "/horizontal-bar-chart-demo",
      "Horizontal Bar Chart Demo",
      "26-horizontal-bar-chart-demo.png"
    );
    await captureRouteViewport(
      page,
      "/filter-bar-chart-demo",
      "Filter Bar Chart Demo",
      "27-filter-bar-chart-demo.png"
    );
    await captureRouteViewport(
      page,
      "/filter-list-control-demo",
      "Filter List Control Demo",
      "28-filter-list-control-demo.png"
    );
    await captureRouteViewport(
      page,
      "/patient-grid-demo",
      "Patient Grid Demo",
      "29-patient-grid-demo.png"
    );
    await captureRouteViewport(page, "/debug", "Debug View", "30-debug-view.png");
    await captureRouteViewport(
      page,
      "/accessibility",
      "Accessibility Statement",
      "31-accessibility-view.png"
    );

    for (const file of SCREENSHOT_ORDER) {
      await fs.access(filePath(file)).catch(() => {
        summary.missingStates.push({
          file,
          route: "n/a",
          target: "Post-run validation",
          status: "fallback",
          note: "Screenshot file was not generated.",
        });
      });
    }

    await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2));

    const missingCount = summary.missingStates.length;
    const total = SCREENSHOT_ORDER.length;
    console.log(
      `Capture complete. Screenshots targeted: ${total}. Missing/fallback states: ${missingCount}.`
    );
    console.log(`Summary written to ${SUMMARY_PATH}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch(async (error) => {
  summary.runtimeNotes.push(
    `Fatal capture error: ${error instanceof Error ? error.message : String(error)}`
  );
  await ensureOutput();
  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2));
  console.error(error);
  process.exit(1);
});
