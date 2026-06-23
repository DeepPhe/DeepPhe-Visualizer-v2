/**
 * DeepPhe Visualizer v2 — unified production server.
 *
 * This is the entry point packaged into a self-contained executable with
 * @yao-pkg/pkg. A single process:
 *   1. serves the built React SPA from the embedded build/ snapshot,
 *   2. mounts the read-only piper-files API (src/piper-server/router.js),
 *   3. reverse-proxies the DeepPhe data API to a runtime-configurable upstream
 *      so one binary works against any backend with no CORS.
 *
 * Runtime configuration (environment variables):
 *   PORT                  port to listen on (default 3000)
 *   DEEPPHE_API_LOCATION  upstream DeepPhe data API origin (default http://localhost:3333)
 *   PIPER_FILES_DIR       directory of .piper files (see src/piper-server/config.js)
 *   PIPER_ACTIVE_FILE     active piper filename within PIPER_FILES_DIR
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { createPiperRouter } = require("./src/piper-server/router");

const PORT = process.env.PORT || 3000;
const DEEPPHE_API_LOCATION = (
  process.env.DEEPPHE_API_LOCATION || "http://localhost:3333"
).replace(/\/+$/, "");
const DEEPPHE_API_BASE_PATH = "/v1/deepphe-api";

// build/ is embedded into the pkg snapshot via the "pkg.assets" config. At
// runtime __dirname resolves into that snapshot, so this path works both when
// running from source (node serve.js) and inside the packaged binary.
const BUILD_DIR = path.join(__dirname, "build");
const INDEX_HTML_PATH = path.join(BUILD_DIR, "index.html");

// Read the SPA shell once at startup. Sending it from memory for the fallback
// route is more robust under the read-only pkg snapshot than res.sendFile.
let indexHtml;
try {
  indexHtml = fs.readFileSync(INDEX_HTML_PATH, "utf-8");
} catch (error) {
  console.error(`Failed to read ${INDEX_HTML_PATH}: ${error.message}`);
  console.error("Did you run the web build before packaging? (npm run package:web)");
  process.exit(1);
}

const app = express();

// 1. Piper-files API (read-only), mounted at its own /v1/piper-api base.
app.use(createPiperRouter());

// 2. OpenAPI document: fetch it from the upstream and rewrite servers[0].url to
// a relative path so the SPA issues same-origin requests that flow back through
// the reverse proxy below (the client reads servers[0].url to build API URLs).
app.get("/openapi.json", async (req, res) => {
  try {
    const upstreamUrl = `${DEEPPHE_API_LOCATION}/openapi.json`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
    });

    if (!upstreamRes.ok) {
      res.status(502).json({
        error: `Upstream DeepPhe API returned ${upstreamRes.status} for /openapi.json`,
      });
      return;
    }

    const spec = await upstreamRes.json();
    spec.servers = [{ url: DEEPPHE_API_BASE_PATH }];
    res.json(spec);
  } catch (error) {
    res.status(502).json({
      error: `Failed to reach upstream DeepPhe API at ${DEEPPHE_API_LOCATION}: ${error.message}`,
    });
  }
});

// 3. Reverse proxy for the DeepPhe data API. A context filter (not a mount
// path) is used so the full /v1/deepphe-api/... path is preserved when
// forwarded to the upstream origin.
app.use(
  createProxyMiddleware(DEEPPHE_API_BASE_PATH, {
    target: DEEPPHE_API_LOCATION,
    changeOrigin: true,
  })
);

// Unified health check.
app.get("/healthz", (req, res) => {
  res.json({ status: "ok", upstream: DEEPPHE_API_LOCATION });
});

// 4. Static assets from the build (hashed JS/CSS, favicon, /docs/viz2, etc.).
app.use(
  express.static(BUILD_DIR, {
    maxAge: "1y",
    etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// 5. SPA fallback: serve index.html for any unmatched GET so client-side
// routes (e.g. /filters) deep-link correctly. Non-GET requests 404.
app.use((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(404).end();
    return;
  }
  res.setHeader("Cache-Control", "no-cache");
  res.type("html").send(indexHtml);
});

app.listen(PORT, () => {
  console.log(`DeepPhe Visualizer v2 running on http://localhost:${PORT}`);
  console.log(`Proxying DeepPhe data API -> ${DEEPPHE_API_LOCATION}`);
});
