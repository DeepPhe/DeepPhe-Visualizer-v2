#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";
const SCREENSHOT_ROOT_DIR = process.env.VIZ3_SCREENSHOT_DIR
  ? path.resolve(process.env.VIZ3_SCREENSHOT_DIR)
  : path.resolve("..", "Viz3_screenshots");
const OUTPUT_DIR = path.join(SCREENSHOT_ROOT_DIR, "playwright");
const REPORT_PATH = path.join(OUTPUT_DIR, "filter-card-bottom-alignment.json");
const VIEWPORT = { width: 2200, height: 1400 };

const BOTTOM_TOLERANCE_PX = parseFiniteNumber(process.env.BOTTOM_TOLERANCE_PX, 1);
const HEADLESS = process.env.HEADLESS !== "false";

function parseFiniteNumber(rawValue, fallback) {
  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundToHundredth(value) {
  return Math.round(value * 100) / 100;
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function gotoFilters(page) {
  const filtersUrl = new URL("/filters", BASE_URL).toString();
  await page.goto(filtersUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  await page.getByRole("heading", { name: "Patient Cohort Explorer", exact: true }).first().waitFor({
    state: "visible",
    timeout: 15000,
  });

  await page.locator(".filter-section-grid .filter-card").first().waitFor({
    state: "visible",
    timeout: 15000,
  });

  await page.waitForTimeout(800);
}

async function collectSectionMetrics(page) {
  return page.evaluate(() => {
    const round = (value) => Math.round(value * 100) / 100;
    const sectionGridNodes = Array.from(document.querySelectorAll(".filter-section-grid"));

    const getFilterTitleFromCard = (cardNode) => {
      const openButton = cardNode.querySelector('button[aria-label^="Open "]');
      const ariaLabel = String(openButton?.getAttribute("aria-label") || "").trim();
      const match = ariaLabel.match(/^Open\s+(.+)\s+filter$/i);
      return match ? match[1].trim() : "";
    };

    return sectionGridNodes.map((sectionGridNode, sectionIndex) => {
      const sectionHeadingText = String(sectionGridNode.parentElement?.querySelector("h2")?.textContent || "").trim();
      const sectionName = sectionHeadingText || `Section ${sectionIndex + 1}`;

      const columnNodes = Array.from(sectionGridNode.querySelectorAll(":scope > .filter-section-column"));
      const columns = columnNodes.map((columnNode, columnIndex) => {
        const columnRect = columnNode.getBoundingClientRect();
        const cards = Array.from(columnNode.querySelectorAll(":scope > .filter-card")).map((cardNode) => {
          const cardRect = cardNode.getBoundingClientRect();
          return {
            title: getFilterTitleFromCard(cardNode) || "(untitled)",
            columnIndex,
            top: round(cardRect.top),
            bottom: round(cardRect.bottom),
            height: round(cardRect.height),
          };
        });
        const lastCardBottom = cards.length > 0 ? cards[cards.length - 1].bottom : null;

        return {
          columnIndex,
          cardCount: cards.length,
          top: round(columnRect.top),
          bottom: round(columnRect.bottom),
          height: round(columnRect.height),
          lastCardBottom,
          cards,
        };
      });

      return {
        sectionName,
        columnCap: Number(sectionGridNode.getAttribute("data-column-cap") || 0),
        cardCount: columns.reduce((sum, column) => sum + column.cardCount, 0),
        columnCount: columns.length,
        columns,
      };
    });
  });
}

function buildAlignmentReport(sectionMetrics) {
  const checkedSections = [];
  const skippedSections = [];
  const failingSections = [];

  sectionMetrics.forEach((section) => {
    const nonEmptyColumns = section.columns.filter((column) => column.cardCount > 0);
    if (nonEmptyColumns.length < 2) {
      skippedSections.push({
        sectionName: section.sectionName,
        columnCap: section.columnCap,
        cardCount: section.cardCount,
        columnCount: section.columnCount,
        nonEmptyColumnCount: nonEmptyColumns.length,
      });
      return;
    }

    const lastCardBottoms = nonEmptyColumns
      .map((column) => Number(column.lastCardBottom))
      .filter((value) => Number.isFinite(value));
    const minLastCardBottom = Math.min(...lastCardBottoms);
    const maxLastCardBottom = Math.max(...lastCardBottoms);
    const bottomDelta = roundToHundredth(maxLastCardBottom - minLastCardBottom);

    const sectionResult = {
      sectionName: section.sectionName,
      columnCap: section.columnCap,
      cardCount: section.cardCount,
      columnCount: section.columnCount,
      checkedColumnCount: nonEmptyColumns.length,
      minBottom: roundToHundredth(minLastCardBottom),
      maxBottom: roundToHundredth(maxLastCardBottom),
      bottomDelta,
      columns: nonEmptyColumns,
    };

    checkedSections.push(sectionResult);
    if (bottomDelta > BOTTOM_TOLERANCE_PX) {
      failingSections.push(sectionResult);
    }
  });

  return { checkedSections, skippedSections, failingSections };
}

function printFailureDetails(failingSections) {
  failingSections.forEach((section) => {
    console.error(
      `Section "${section.sectionName}" failed: bottom delta ${section.bottomDelta}px exceeds tolerance ${BOTTOM_TOLERANCE_PX}px`
    );
    section.columns.forEach((column) => {
      console.error(
        `  - column ${column.columnIndex}: last card bottom ${column.lastCardBottom}px (${column.cardCount} card(s))`
      );
      column.cards.forEach((card) => {
        console.error(`      • ${card.title}: height ${card.height}px, bottom ${card.bottom}px`);
      });
    });
  });
}

async function run() {
  await ensureOutputDir();

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await gotoFilters(page);
    const sectionMetrics = await collectSectionMetrics(page);
    const { checkedSections, skippedSections, failingSections } = buildAlignmentReport(sectionMetrics);

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      viewport: VIEWPORT,
      bottomTolerancePx: BOTTOM_TOLERANCE_PX,
      checkedSectionCount: checkedSections.length,
      skippedSectionCount: skippedSections.length,
      failingSectionCount: failingSections.length,
      checkedSections,
      skippedSections,
    };

    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

    if (checkedSections.length === 0) {
      throw new Error("No sections had at least two non-empty columns. Could not validate bottom alignment.");
    }

    if (failingSections.length > 0) {
      printFailureDetails(failingSections);
      throw new Error(
        `Filter card bottom alignment failed in ${failingSections.length} section(s). Full report: ${REPORT_PATH}`
      );
    }

    console.log(`Filter card bottom alignment passed for ${checkedSections.length} section(s). Report: ${REPORT_PATH}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
