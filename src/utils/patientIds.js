/**
 * Shared patient-ID coercion helpers.
 *
 * Two deliberately distinct behaviors that were previously duplicated across
 * several modules under the same name. They are NOT interchangeable — picking
 * the wrong one would silently change a cohort:
 *
 *   parsePatientIds      — accepts a raw value (array | comma-string | scalar),
 *                          trims and de-duplicates, preserves input order.
 *   normalizePatientIds  — accepts an array of ids, trims, de-duplicates, and
 *                          returns them numeric-sorted.
 */

/**
 * Coerce a raw patient-id value into a clean, order-preserving, de-duplicated
 * array. Handles arrays, comma-separated strings, and lone scalars.
 * @param {unknown} rawValue
 * @returns {string[]}
 */
export function parsePatientIds(rawValue) {
  if (Array.isArray(rawValue)) {
    return [...new Set(rawValue.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  if (typeof rawValue === "string") {
    return [
      ...new Set(
        rawValue
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      ),
    ];
  }

  if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
    const normalized = String(rawValue).trim();
    return normalized ? [normalized] : [];
  }

  return [];
}

/**
 * Trim, de-duplicate, and numerically sort an array of patient ids.
 * @param {string[]} [patientIds]
 * @returns {string[]}
 */
export function normalizePatientIds(patientIds = []) {
  return [...new Set((Array.isArray(patientIds) ? patientIds : []).map((id) => String(id || "").trim()))]
    .filter(Boolean)
    .sort((leftId, rightId) => leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: "base" }));
}
