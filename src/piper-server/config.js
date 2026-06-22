/**
 * Configuration for the DeepPhe Piper Files Server (server.js).
 *
 * All values are environment-overridable so the server can point at a
 * different piper checkout without code changes:
 *   PIPER_FILES_DIR   directory containing .piper files
 *                     (default: <repo>/data/piperfiles)
 *   PIPER_MAX_BYTES   max file size served, in bytes (default: 1 MiB)
 *   PIPER_ROUTE_BASE  route prefix for all endpoints (default: /v1/piper-api)
 *   PIPER_ACTIVE_FILE filename (within PIPER_FILES_DIR) of the current run's
 *                     active piper file; unset means "not configured"
 */

const path = require("path");

/**
 * Default location of the piper files directory.
 *
 * When running normally, this lives at <repo>/data/piperfiles (relative to this
 * file). When running inside a packaged @yao-pkg/pkg binary, __dirname points
 * into the read-only snapshot filesystem, so resolve relative to the executable
 * instead — users drop a writable/swappable data/piperfiles folder next to the
 * binary. The PIPER_FILES_DIR env var always takes precedence.
 */
function defaultPiperFilesDir() {
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), "data", "piperfiles");
  }
  return path.join(__dirname, "..", "..", "data", "piperfiles");
}

const PIPER_FILES_DIR = path.resolve(process.env.PIPER_FILES_DIR || defaultPiperFilesDir());

const PIPER_MAX_BYTES =
  Number(process.env.PIPER_MAX_BYTES) > 0 ? Number(process.env.PIPER_MAX_BYTES) : 1024 * 1024;

const PIPER_ROUTE_BASE = process.env.PIPER_ROUTE_BASE || "/v1/piper-api";

/**
 * Resolve the absolute path of the current run's active piper file, or null
 * when no active file is configured. The server validates the basename and
 * containment within PIPER_FILES_DIR before serving it.
 */
async function resolveActivePiperFile() {
  const activeName = String(process.env.PIPER_ACTIVE_FILE || "").trim();
  if (!activeName) {
    return null;
  }
  return path.join(PIPER_FILES_DIR, activeName);
}

module.exports = {
  PIPER_FILES_DIR,
  PIPER_MAX_BYTES,
  PIPER_ROUTE_BASE,
  resolveActivePiperFile,
};
