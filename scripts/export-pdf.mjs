#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const SITE_DIR = path.resolve("site");
const OUTPUT_PDF = path.resolve("output/reports/deepphe-visualizer-user-guide.pdf");
const CONFIG_PATH = path.resolve("docs-site/docusaurus.config.ts");

// Docusaurus prefixes asset URLs and page routes with `baseUrl`, but writes the
// files to the site root *without* that prefix. Read the configured baseUrl so
// the static server can strip it when resolving files, and so we load the guide
// at the baseUrl-prefixed route the built HTML actually references.
function readBaseUrl() {
  try {
    const source = fs.readFileSync(CONFIG_PATH, "utf8");
    const match = source.match(/baseUrl:\s*['"]([^'"]+)['"]/);
    if (match) {
      let base = match[1];
      if (!base.startsWith("/")) base = `/${base}`;
      if (!base.endsWith("/")) base = `${base}/`;
      return base;
    }
  } catch {
    // Fall through to serving from the root.
  }
  return "/";
}

const BASE_URL = readBaseUrl();

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

function stripBaseUrl(pathname) {
  const baseNoTrailingSlash = BASE_URL.replace(/\/$/, "");
  if (
    baseNoTrailingSlash &&
    (pathname === baseNoTrailingSlash || pathname.startsWith(`${baseNoTrailingSlash}/`))
  ) {
    const stripped = pathname.slice(baseNoTrailingSlash.length);
    return stripped === "" ? "/" : stripped;
  }
  return pathname;
}

function withinSiteDir(candidate) {
  const normalized = path.normalize(candidate);
  return normalized === SITE_DIR || normalized.startsWith(`${SITE_DIR}${path.sep}`)
    ? normalized
    : null;
}

// Resolve a request path to a file on disk, tolerating both `baseUrl` prefixing
// and `trailingSlash: false` (which emits `foo.html` rather than `foo/index.html`).
function resolveSitePath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://127.0.0.1").pathname);
  const rel = stripBaseUrl(pathname);

  const candidates = rel.endsWith("/")
    ? [path.join(SITE_DIR, rel, "index.html")]
    : [
        path.join(SITE_DIR, rel), // exact hit — assets (.css/.js/.png/…)
        path.join(SITE_DIR, `${rel}.html`), // trailingSlash:false page
        path.join(SITE_DIR, rel, "index.html"), // trailingSlash:true page / directory
      ];

  for (const candidate of candidates) {
    const safe = withinSiteDir(candidate);
    if (safe && fs.existsSync(safe) && fs.statSync(safe).isFile()) {
      return safe;
    }
  }

  return null;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
}

async function createStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const targetPath = resolveSitePath(req.url || "/");
      if (!targetPath) {
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
  if (!resolveSitePath(`${BASE_URL}printable-guide`)) {
    throw new Error(
      "Missing Docusaurus output for the printable guide. Run `npm run docs:build` before exporting the PDF."
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
  const url = `http://127.0.0.1:${port}${BASE_URL}printable-guide`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts?.ready);
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
