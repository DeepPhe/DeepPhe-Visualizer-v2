import { getFilterClassKey } from "./filterRequest";
import { normalizeInstanceValues } from "./filterDefinitions";

// Client-side filter math.
//
// For small cohorts we load the per-instance patient-id breakdown once and
// answer "how many patients match this filter set" with set algebra in the
// browser, instead of asking the server for every row of every card on each
// selection (the per-selection latency the included-counts batch otherwise
// incurs). The math mirrors the server exactly: a filter set matches the
// INTERSECTION across filters (one filter per class) of the UNION within a
// filter's instances — i.e. AND across classes, OR within a class. This is the
// same semantics the server applies to the resolved `{ type, class, instances }`
// filters produced by resolveRequestFilters, so feeding those resolved filters
// in here reproduces the server's count.

function normalizeIndexKey(value) {
  return String(value ?? "").trim();
}

/**
 * Build a lookup of patient ids by class instance from per-domain summaries.
 *
 * @param {Array<{ type: string, summaryByClass: Record<string, Array<{ value: string, patientIds?: string[] }>> }>} domains
 * @returns {Map<string, Map<string, Set<string>>>} classKey -> (instanceValue -> patientIds)
 */
export function buildPatientIdIndex(domains = []) {
  const index = new Map();

  (Array.isArray(domains) ? domains : []).forEach((domain) => {
    const type = domain?.type;
    const summaryByClass = domain?.summaryByClass || {};

    Object.entries(summaryByClass).forEach(([className, rows]) => {
      const classKey = getFilterClassKey(type, className);
      let classMap = index.get(classKey);
      if (!classMap) {
        classMap = new Map();
        index.set(classKey, classMap);
      }

      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const instanceKey = normalizeIndexKey(row?.value);
        if (!instanceKey) {
          return;
        }
        const patientIds = Array.isArray(row?.patientIds) ? row.patientIds : [];
        if (patientIds.length === 0) {
          return;
        }
        let instanceSet = classMap.get(instanceKey);
        if (!instanceSet) {
          instanceSet = new Set();
          classMap.set(instanceKey, instanceSet);
        }
        patientIds.forEach((patientId) => {
          const normalizedId = String(patientId ?? "").trim();
          if (normalizedId) {
            instanceSet.add(normalizedId);
          }
        });
      });
    });
  });

  return index;
}

/**
 * Whether the index can answer questions about every class in the given filters.
 * Used to decide if the client-side fast path is safe, or whether the caller
 * must fall back to the server.
 */
export function indexCoversFilters(index, resolvedFilters) {
  if (!(index instanceof Map)) {
    return false;
  }
  return (Array.isArray(resolvedFilters) ? resolvedFilters : []).every((filter) =>
    index.has(getFilterClassKey(filter?.type, filter?.class))
  );
}

/**
 * Compute the set of patient ids matching a resolved filter set: the
 * intersection across filters of the union within each filter's instances.
 *
 * Returns `null` when any filter references a class the index doesn't cover —
 * the caller must then fall back to the server rather than trust a wrong (and
 * possibly empty) result, which would incorrectly disable filter rows.
 *
 * @param {Array<{ type: string, class: string, instances: string[] }>} resolvedFilters
 * @param {Map<string, Map<string, Set<string>>>} index
 * @returns {Set<string> | null}
 */
export function computeFilterPatientSet(resolvedFilters, index) {
  if (!(index instanceof Map)) {
    return null;
  }

  const filters = Array.isArray(resolvedFilters) ? resolvedFilters : [];
  let result = null;

  for (const filter of filters) {
    const classMap = index.get(getFilterClassKey(filter?.type, filter?.class));
    if (!classMap) {
      return null;
    }

    const unionSet = new Set();
    normalizeInstanceValues(filter?.instances).forEach((instance) => {
      const instanceSet = classMap.get(normalizeIndexKey(instance));
      if (instanceSet) {
        instanceSet.forEach((patientId) => unionSet.add(patientId));
      }
    });

    if (result === null) {
      result = unionSet;
    } else {
      // Intersect, iterating the smaller set for speed.
      const [smaller, larger] = result.size <= unionSet.size ? [result, unionSet] : [unionSet, result];
      const intersection = new Set();
      smaller.forEach((patientId) => {
        if (larger.has(patientId)) {
          intersection.add(patientId);
        }
      });
      result = intersection;
    }

    if (result.size === 0) {
      break;
    }
  }

  return result || new Set();
}
