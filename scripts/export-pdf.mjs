#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const SITE_DIR = path.resolve("site");
const OUTPUT_PDF = path.resolve("output/reports/deepphe-ui-review.pdf");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveSitePath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://127.0.0.1").pathname);
  const normalizedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const candidate = path.normalize(path.join(SITE_DIR, normalizedPath));

  if (!candidate.startsWith(SITE_DIR)) {
    return null;
  }

  return candidate;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
}

async function createStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const safePath = resolveSitePath(req.url || "/");
      if (!safePath) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Bad request");
        return;
      }

      let targetPath = safePath;
      if (!fs.existsSync(targetPath)) {
        const withIndex = path.join(targetPath, "index.html");
        if (fs.existsSync(withIndex)) {
          targetPath = withIndex;
        }
      }

      if (!fs.existsSync(targetPath)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const body = await fsp.readFile(targetPath);
      res.writeHead(200, { "Content-Type": contentTypeFor(targetPath) });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error instanceof Error ? error.message : "Internal server error");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { server, port };
}

async function ensureSiteArtifacts() {
  const fullReportHtml = path.join(SITE_DIR, "full-report", "index.html");
  if (!fs.existsSync(fullReportHtml)) {
    throw new Error(
      "Missing MKDocs output for /full-report/. Run scripts/build-mkdocs.sh before exporting PDF."
    );
  }

  await fsp.mkdir(path.dirname(OUTPUT_PDF), { recursive: true });
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images || []);
    await Promise.all(
      images.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              })
      )
    );
  });
}

async function run() {
  await ensureSiteArtifacts();

  const { server, port } = await createStaticServer();
  const url = `http://127.0.0.1:${port}/full-report/`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "screen" });
    await waitForImages(page);

    await page.pdf({
      path: OUTPUT_PDF,
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
      preferCSSPageSize: true,
    });

    console.log(`PDF exported: ${OUTPUT_PDF}`);
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
