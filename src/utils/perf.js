/**
 * Lightweight runtime-perf helpers shared across data loaders and the API
 * client. (perfTracker.js handles the richer span/trace buffer; these are the
 * small primitives that were previously copy-pasted into five modules.)
 */

const IS_PERF_LOGGING_ENABLED = process.env.NODE_ENV !== "production";

/**
 * High-resolution monotonic timestamp in milliseconds, falling back to
 * Date.now() where performance.now() is unavailable (e.g. some test envs).
 * @returns {number}
 */
export function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * Dev-only namespaced perf log. No-ops in production.
 * @param {string} label   Bracketed namespace, e.g. "usePatientData".
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 */
export function logPerf(label, message, details = {}) {
  if (!IS_PERF_LOGGING_ENABLED) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[${label}] ${message}`, details);
}
