import { DEEPPHE_API_LOCATION } from "../config";
import { endSpan, startSpan } from "../utils/perfTracker";

const OPENAPI_JSON_PATH = "/openapi.json";
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
const JSON_CONTENT_TYPE = "application/json";
const DEFAULT_DEEPPHE_API_BASE_PATH = "/v1/deepphe-api";
const FILTER_COUNT_TYPES = ["omop", "attributes", "cancers", "concepts"];
const FILTER_COUNT_PATH_CANDIDATES = [
  "/deepphe/filter/count",
  "/deepphe/filters/count",
  "/filter/count",
  "/filters/count",
];
const FILTER_COUNT_PATIENT_PATH_CANDIDATES = [
  "/deepphe/filter/count/patients",
  "/deepphe/filters/count/patients",
  "/filter/count/patients",
  "/filters/count/patients",
];

let openApiSpecPromise;
let openApiSpecCache;
const filterCountPathCache = {
  withPatientIds: "",
  withoutPatientIds: "",
};
const summaryRequestPromiseCache = new Map();

const joinUrl = (base, path) => {
  const normalizedBase = String(base || "").replace(/\/+$/, "");
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;

  if (!normalizedBase) {
    return normalizedPath;
  }

  return `${normalizedBase}${normalizedPath}`;
};

export const DEEPPHE_OPENAPI_JSON_URL = joinUrl(
  DEEPPHE_API_LOCATION,
  OPENAPI_JSON_PATH
);

const normalizeMethod = (method) => String(method || "GET").trim().toUpperCase();
const normalizeClassName = (value) => String(value || "").trim().toUpperCase();

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

const ensureMethodIsSupported = (method) => {
  const normalizedMethod = normalizeMethod(method);
  if (!HTTP_METHODS.includes(normalizedMethod)) {
    throw new Error(`Unsupported HTTP method: ${method}`);
  }
  return normalizedMethod;
};

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const toQueryString = (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value
        .filter((item) => item !== undefined && item !== null && item !== "")
        .forEach((item) => params.append(key, String(item)));
      return;
    }

    params.append(key, String(value));
  });

  return params.toString();
};

const toCsvIfArray = (value) => {
  if (!Array.isArray(value)) {
    return value;
  }
  const values = value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
  return values.length > 0 ? values.join(",") : undefined;
};

const fillPathTemplate = (pathTemplate, pathParams = {}) => {
  return String(pathTemplate || "").replace(/{([^}]+)}/g, (match, key) => {
    const value = pathParams[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
};

const toPascalCase = (value) => {
  return String(value || "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
};

const getEndpointName = (path, method, operation = {}) => {
  if (operation.operationId) {
    return operation.operationId;
  }
  return `${normalizeMethod(method).toLowerCase()}${toPascalCase(path)}`;
};

const isRouteMissingError = (error) => {
  const message = String(error?.message || "");
  return message.includes("Cannot POST") || /\b404\b/.test(message);
};

const supportsPostOperation = (pathOperations) =>
  Object.keys(pathOperations || {}).some(
    (method) => normalizeMethod(method) === "POST"
  );

const uniq = (values = []) => [...new Set(values.filter(Boolean))];

const getFilterCountPathCandidatesFromOpenApi = (pathsByRoute, includePatientIds) => {
  const allPostPaths = Object.entries(pathsByRoute || {})
    .filter(([, pathOperations]) => supportsPostOperation(pathOperations))
    .map(([path]) => String(path));

  const patientCountMatches = allPostPaths.filter((path) =>
    /\/filters?\/count\/patients\/?$/i.test(path)
  );
  const countMatches = allPostPaths.filter((path) => /\/filters?\/count\/?$/i.test(path));
  const broadMatches = allPostPaths.filter(
    (path) => /filter/i.test(path) && /count/i.test(path)
  );

  const knownCandidates = includePatientIds
    ? [...FILTER_COUNT_PATIENT_PATH_CANDIDATES, ...FILTER_COUNT_PATH_CANDIDATES]
    : FILTER_COUNT_PATH_CANDIDATES;
  const knownMatches = knownCandidates.filter((path) => allPostPaths.includes(path));

  if (includePatientIds) {
    return uniq([...knownMatches, ...patientCountMatches, ...countMatches, ...broadMatches]);
  }

  return uniq([...knownMatches, ...countMatches, ...broadMatches]);
};

const getPreferredServerUrl = (openApiSpec) => {
  const serverUrl = String(openApiSpec?.servers?.[0]?.url || "").trim();

  if (!serverUrl || serverUrl === "/") {
    return joinUrl(DEEPPHE_API_LOCATION, DEFAULT_DEEPPHE_API_BASE_PATH);
  }

  if (isAbsoluteUrl(serverUrl)) {
    return serverUrl;
  }

  return joinUrl(DEEPPHE_API_LOCATION, serverUrl);
};

const buildEndpointUrl = (serverBaseUrl, pathTemplate, pathParams = {}, query = {}) => {
  const pathWithParams = fillPathTemplate(pathTemplate, pathParams);
  let endpointUrl;

  if (isAbsoluteUrl(pathWithParams)) {
    endpointUrl = pathWithParams;
  } else {
    try {
      const serverUrl = new URL(serverBaseUrl);
      const serverPathname = serverUrl.pathname.replace(/\/+$/, "");
      const normalizedPath = String(pathWithParams || "").startsWith("/")
        ? String(pathWithParams)
        : `/${pathWithParams}`;

      // Some OpenAPI docs include full base-prefixed paths (e.g. /v1/deepphe-api/...).
      if (
        serverPathname &&
        (normalizedPath === serverPathname || normalizedPath.startsWith(`${serverPathname}/`))
      ) {
        endpointUrl = `${serverUrl.origin}${normalizedPath}`;
      } else {
        endpointUrl = joinUrl(serverBaseUrl, normalizedPath);
      }
    } catch {
      endpointUrl = joinUrl(serverBaseUrl, pathWithParams);
    }
  }

  const queryString = toQueryString(query);
  return queryString ? `${endpointUrl}?${queryString}` : endpointUrl;
};

const parseResponsePayload = async (response) => {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes(JSON_CONTENT_TYPE)) {
    return response.json();
  }
  return response.text();
};

const createRequestInit = (method, body, headers = {}) => {
  const normalizedMethod = ensureMethodIsSupported(method);
  const finalHeaders = {
    Accept: JSON_CONTENT_TYPE,
    ...headers,
  };

  const requestInit = {
    method: normalizedMethod,
    headers: finalHeaders,
  };

  if (body !== undefined && body !== null) {
    const isBodyStringOrFormData =
      typeof body === "string" ||
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer;

    requestInit.body = isBodyStringOrFormData ? body : JSON.stringify(body);

    if (!isBodyStringOrFormData && !finalHeaders["Content-Type"]) {
      requestInit.headers["Content-Type"] = JSON_CONTENT_TYPE;
    }
  }

  return requestInit;
};

const requestFromOpenApi = async (openApiSpec, path, method, options = {}) => {
  const { pathParams = {}, query = {}, body, headers = {} } = options;
  const normalizedMethod = normalizeMethod(method);
  const serverBaseUrl = getPreferredServerUrl(openApiSpec);
  const url = buildEndpointUrl(serverBaseUrl, path, pathParams, query);
  const span = startSpan(`api:${normalizedMethod} ${path}`, "api_call", {
    url,
    method: normalizedMethod,
  });

  let response;
  try {
    response = await fetch(url, createRequestInit(method, body, headers));
  } catch (networkError) {
    endSpan(span, "error", { errorMessage: networkError?.message || "network error" });
    throw networkError;
  }

  let payload;
  try {
    payload = await parseResponsePayload(response);
  } catch (payloadError) {
    endSpan(span, "error", {
      httpStatus: response?.status,
      errorMessage: payloadError?.message || "Failed to parse API response payload",
    });
    throw payloadError;
  }

  if (!response.ok) {
    const payloadMessage =
      typeof payload === "string"
        ? payload
        : payload?.message || payload?.detail || payload?.error || "";
    endSpan(span, "error", { httpStatus: response.status, errorMessage: payloadMessage });
    throw new Error(
      `DeepPhe API request failed: ${normalizedMethod} ${url} -> ${
        payloadMessage || `${response.status} ${response.statusText}`
      }`
    );
  }

  endSpan(span, "ok", { httpStatus: response.status });
  return payload;
};

export async function fetchDeepPheOpenApiJson() {
  if (openApiSpecCache) {
    return openApiSpecCache;
  }

  if (openApiSpecPromise) {
    return openApiSpecPromise;
  }

  openApiSpecPromise = (async () => {
    const span = startSpan("api:GET /openapi.json", "api_call", {
      url: DEEPPHE_OPENAPI_JSON_URL,
      method: "GET",
    });
    let response;

    try {
      response = await fetch(DEEPPHE_OPENAPI_JSON_URL, {
        headers: { Accept: "application/json" },
      });
    } catch (networkError) {
      endSpan(span, "error", { errorMessage: networkError?.message || "network error" });
      throw networkError;
    }

    if (!response.ok) {
      endSpan(span, "error", {
        httpStatus: response.status,
        errorMessage: `${response.status} ${response.statusText}`,
      });
      throw new Error(
        `Failed to fetch DeepPhe OpenAPI JSON (${response.status} ${response.statusText})`
      );
    }

    let spec;
    try {
      spec = await response.json();
    } catch (parseError) {
      endSpan(span, "error", {
        httpStatus: response.status,
        errorMessage: parseError?.message || "Failed to parse OpenAPI JSON payload",
      });
      throw parseError;
    }

    endSpan(span, "ok", { httpStatus: response.status });
    openApiSpecCache = spec;
    return spec;
  })().catch((error) => {
    // Clear the cached promise on failure so subsequent calls can retry
    // instead of returning the same rejected promise forever.
    openApiSpecPromise = undefined;
    throw error;
  });

  return openApiSpecPromise;
}

export async function fetchDeepPheOpenApiPaths() {
  const spec = await fetchDeepPheOpenApiJson();
  return spec.paths || {};
}

export async function requestDeepPheEndpoint(path, method = "GET", options = {}) {
  const openApiSpec = await fetchDeepPheOpenApiJson();
  return requestFromOpenApi(openApiSpec, path, method, options);
}

export async function getDeepPheEndpointCallers() {
  const openApiSpec = await fetchDeepPheOpenApiJson();
  const endpoints = openApiSpec?.paths || {};
  const callers = {};

  Object.entries(endpoints).forEach(([path, pathOperations]) => {
    Object.entries(pathOperations || {}).forEach(([method, operation]) => {
      const normalizedMethod = normalizeMethod(method);
      if (!HTTP_METHODS.includes(normalizedMethod)) {
        return;
      }

      const endpointName = getEndpointName(path, normalizedMethod, operation);
      callers[endpointName] = (options = {}) =>
        requestFromOpenApi(openApiSpec, path, normalizedMethod, options);
    });
  });

  return callers;
}

export async function getDeepPheEndpointList() {
  const openApiSpec = await fetchDeepPheOpenApiJson();
  const endpoints = openApiSpec?.paths || {};

  return Object.entries(endpoints).flatMap(([path, pathOperations]) => {
    return Object.entries(pathOperations || {})
      .filter(([method]) => HTTP_METHODS.includes(normalizeMethod(method)))
      .map(([method, operation]) => ({
        name: getEndpointName(path, method, operation),
        path,
        method: normalizeMethod(method),
      }));
  });
}

const normalizeFilterCountFilter = (filterItem, index) => {
  const normalizedType = String(filterItem?.type || "")
    .trim()
    .toLowerCase();
  const normalizedClass = String(filterItem?.class || "").trim();
  const normalizedInstances = Array.isArray(filterItem?.instances)
    ? [...new Set(filterItem.instances.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];

  if (!FILTER_COUNT_TYPES.includes(normalizedType)) {
    throw new Error(
      `filters[${index}].type must be one of: ${FILTER_COUNT_TYPES.join(", ")}`
    );
  }
  if (!normalizedClass) {
    throw new Error(`filters[${index}].class is required`);
  }
  if (normalizedInstances.length === 0) {
    throw new Error(`filters[${index}].instances must include at least one value`);
  }

  return {
    type: normalizedType,
    class: normalizedClass,
    instances: normalizedInstances,
  };
};

const normalizeFilterCountFilters = (filters) => {
  if (!Array.isArray(filters) || filters.length === 0) {
    throw new Error("filters must be a non-empty array");
  }

  return filters.map(normalizeFilterCountFilter);
};

const isInternalServerError = (error) => {
  const message = String(error?.message || "");
  return /internal server error/i.test(message) || /\b500\b/.test(message);
};

const hasMissingValueColumnError = (error) => {
  const message = String(error?.message || "");
  return /no such column:\s*value/i.test(message);
};

const getFilterCountResultCount = (payload) => {
  const count = Number(payload?.count);
  return Number.isFinite(count) ? count : 0;
};

const getFilterCountResultPatientIds = (payload) => {
  const rawIds = Array.isArray(payload?.patient_ids)
    ? payload.patient_ids
    : Array.isArray(payload?.patientIds)
      ? payload.patientIds
      : [];

  return [...new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean))];
};

const normalizeInstanceVariant = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const toAttributeInstanceVariants = (value) => {
  const original = normalizeInstanceVariant(value);
  if (!original) {
    return [];
  }

  const variants = new Set([original]);
  const withSpaces = normalizeInstanceVariant(
    original
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Za-z])(\d)/g, "$1 $2")
      .replace(/(\d)([A-Za-z])/g, "$1 $2")
  );
  if (withSpaces) {
    variants.add(withSpaces);
  }

  const withoutFinding = normalizeInstanceVariant(withSpaces.replace(/\bFinding\b/gi, ""));
  if (withoutFinding) {
    variants.add(withoutFinding);
  }

  return [...variants];
};

const expandAttributeFilterInstances = (filters = []) => {
  let expanded = false;

  const nextFilters = filters.map((filterItem) => {
    if (filterItem.type !== "attributes") {
      return filterItem;
    }

    const nextInstances = [...new Set(filterItem.instances.flatMap(toAttributeInstanceVariants))];
    if (nextInstances.length > filterItem.instances.length) {
      expanded = true;
    }

    return {
      ...filterItem,
      instances: nextInstances,
    };
  });

  return {
    expanded,
    filters: nextFilters,
  };
};

const asRows = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
};

const normalizeMatchKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const getFilterValueFields = (filterItem) => {
  if (filterItem?.type === "omop") {
    const className = normalizeClassName(filterItem.class);
    if (className === "AGE_AT_DX") {
      return ["age_at_dx", "value", "age"];
    }
    if (className === "ETHNICITY") {
      return ["ethnicity", "value"];
    }
    if (className === "GENDER") {
      return ["gender", "value"];
    }
    if (className === "RACE") {
      return ["race", "value"];
    }
    if (className === "CANCER") {
      return ["cancer", "value", "classUri"];
    }
  }

  if (filterItem?.type === "attributes") {
    return ["value", "classUri", "name", "label"];
  }

  if (filterItem?.type === "cancers") {
    return ["value", "classUri", "name", "label"];
  }

  if (filterItem?.type === "concepts") {
    return ["value", "preferredText", "classUri", "name", "label"];
  }

  return ["value", "classUri", "name", "label"];
};

const getRowValueForFilter = (filterItem, row) => {
  const fields = getFilterValueFields(filterItem);
  for (const field of fields) {
    const value = row?.[field];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

const getFilterInstanceMatchKeys = (filterItem) => {
  if (!Array.isArray(filterItem?.instances)) {
    return new Set();
  }

  const expandedValues =
    filterItem.type === "attributes"
      ? filterItem.instances.flatMap(toAttributeInstanceVariants)
      : filterItem.instances;

  return new Set(expandedValues.map(normalizeMatchKey).filter(Boolean));
};

const getRowPatientIds = (row) => {
  const candidateValues = [
    row?.patient_ids,
    row?.patientIds,
    row?.patient_id,
    row?.patientId,
  ];

  const ids = [];
  candidateValues.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((id) => {
        const text = String(id || "").trim();
        if (text) {
          ids.push(text);
        }
      });
      return;
    }

    if (typeof value === "string") {
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((id) => ids.push(id));
      return;
    }

    if (value !== undefined && value !== null && value !== "") {
      ids.push(String(value).trim());
    }
  });

  return [...new Set(ids)];
};

const fetchRowsWithPatientIdsForFilter = async (filterItem) => {
  if (filterItem.type === "omop") {
    return requestDeepPheEndpoint("/omop/instances/patients", "GET", {
      query: { attribute: normalizeClassName(filterItem.class) },
    });
  }
  if (filterItem.type === "attributes") {
    return requestDeepPheEndpoint("/deepphe/attributes/instances/patients", "GET", {
      query: { groupname: filterItem.class },
    });
  }
  if (filterItem.type === "cancers") {
    return requestDeepPheEndpoint("/deepphe/cancers/instances/patients", "GET", {
      query: { classUri: filterItem.class },
    });
  }
  if (filterItem.type === "concepts") {
    return requestDeepPheEndpoint("/deepphe/concepts/instances/patients", "GET", {
      query: { dpheGroup: filterItem.class },
    });
  }

  throw new Error(`Unsupported filter type for fallback count: ${filterItem.type}`);
};

const resolvePatientIdsForFilter = async (filterItem) => {
  const payload = await fetchRowsWithPatientIdsForFilter(filterItem);
  const rows = asRows(payload);
  const matchKeys = getFilterInstanceMatchKeys(filterItem);
  const patientIds = new Set();

  rows.forEach((row) => {
    const rowValue = getRowValueForFilter(filterItem, row);
    if (!rowValue) {
      return;
    }

    if (!matchKeys.has(normalizeMatchKey(rowValue))) {
      return;
    }

    getRowPatientIds(row).forEach((id) => patientIds.add(id));
  });

  return patientIds;
};

const computeFilterCountFallback = async ({ filters, includePatientIds }) => {
  const totalStartTime = nowMs();
  const queryStartTime = nowMs();
  const patientIdSets = await Promise.all(filters.map(resolvePatientIdsForFilter));
  const queryEndTime = nowMs();
  const itemCounts = patientIdSets.map((set) => set.size);

  const bitmapStartTime = nowMs();
  if (patientIdSets.length === 0) {
    const totalEndTime = nowMs();
    return {
      count: 0,
      patient_ids: [],
      timing: {
        queryMs: queryEndTime - queryStartTime,
        bitmapMs: totalEndTime - bitmapStartTime,
        resolveMs: 0,
        totalMs: totalEndTime - totalStartTime,
        itemCounts,
      },
    };
  }

  const setsBySize = [...patientIdSets].sort((leftSet, rightSet) => leftSet.size - rightSet.size);
  const intersection = new Set(setsBySize[0]);
  setsBySize.slice(1).forEach((nextSet) => {
    [...intersection].forEach((id) => {
      if (!nextSet.has(id)) {
        intersection.delete(id);
      }
    });
  });
  const bitmapEndTime = nowMs();

  const resolveStartTime = nowMs();
  const patientIds = includePatientIds
    ? [...intersection].sort((leftId, rightId) =>
        leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: "base" })
      )
    : [];
  const resolveEndTime = nowMs();
  const totalEndTime = nowMs();

  return {
    count: intersection.size,
    patient_ids: patientIds,
    timing: {
      queryMs: queryEndTime - queryStartTime,
      bitmapMs: bitmapEndTime - bitmapStartTime,
      resolveMs: resolveEndTime - resolveStartTime,
      totalMs: totalEndTime - totalStartTime,
      itemCounts,
    },
  };
};

export const fetchDeepPheFilterCount = async ({
  filters,
  includePatientIds = false,
} = {}) => {
  const normalizedFilters = normalizeFilterCountFilters(filters);
  const expandedFiltersResult = expandAttributeFilterInstances(normalizedFilters);
  const cacheKey = includePatientIds ? "withPatientIds" : "withoutPatientIds";
  const openApiPaths = await fetchDeepPheOpenApiPaths();
  const discoveredCandidates = getFilterCountPathCandidatesFromOpenApi(
    openApiPaths,
    includePatientIds
  );
  const fallbackCandidates = includePatientIds
    ? [...FILTER_COUNT_PATIENT_PATH_CANDIDATES, ...FILTER_COUNT_PATH_CANDIDATES]
    : FILTER_COUNT_PATH_CANDIDATES;
  const candidatePaths = uniq([
    filterCountPathCache[cacheKey],
    ...discoveredCandidates,
    ...fallbackCandidates,
  ]);

  let lastError;

  for (const path of candidatePaths) {
    const usesPatientSuffix = /\/patients\/?$/i.test(path);
    const query = includePatientIds && !usesPatientSuffix ? { includePatientIds: "true" } : {};
    const body = { filters: normalizedFilters };

    try {
      const result = await requestDeepPheEndpoint(path, "POST", { query, body });
      const resultCount = getFilterCountResultCount(result);
      const resultPatientIds = getFilterCountResultPatientIds(result);

      if (includePatientIds && resultCount > 0 && resultPatientIds.length === 0) {
        lastError = new Error(
          `DeepPhe API request returned no patient IDs from ${path} for a non-empty cohort`
        );
        continue;
      }

      filterCountPathCache[cacheKey] = path;
      return result;
    } catch (error) {
      lastError = error;
      if (isInternalServerError(error) && expandedFiltersResult.expanded) {
        try {
          const retriedResult = await requestDeepPheEndpoint(path, "POST", {
            query,
            body: { filters: expandedFiltersResult.filters },
          });
          const retriedCount = getFilterCountResultCount(retriedResult);
          const retriedPatientIds = getFilterCountResultPatientIds(retriedResult);

          if (includePatientIds && retriedCount > 0 && retriedPatientIds.length === 0) {
            lastError = new Error(
              `DeepPhe API request returned no patient IDs from ${path} for a non-empty cohort`
            );
            continue;
          }

          filterCountPathCache[cacheKey] = path;
          return retriedResult;
        } catch (retryError) {
          lastError = retryError;
        }
      }

      if (
        hasMissingValueColumnError(lastError) &&
        normalizedFilters.some((filterItem) => filterItem.type === "attributes")
      ) {
        try {
          return await computeFilterCountFallback({
            filters: normalizedFilters,
            includePatientIds,
          });
        } catch (fallbackError) {
          lastError = fallbackError;
        }
      }

      if (isRouteMissingError(error)) {
        continue;
      }
      throw lastError;
    }
  }

  if (includePatientIds) {
    try {
      return await computeFilterCountFallback({
        filters: normalizedFilters,
        includePatientIds: true,
      });
    } catch (fallbackError) {
      lastError = fallbackError;
    }
  }

  if (lastError) {
    throw new Error(
      `DeepPhe filter count endpoint is unavailable on this server. Tried: ${candidatePaths.join(", ")}`
    );
  }

  throw new Error("DeepPhe filter count endpoint is unavailable on this server.");
};

export const fetchDeepPheFilterSummary = async (patientIds = []) => {
  const normalizedPatientIds = [...new Set(patientIds.map((id) => String(id || "").trim()))].filter(
    Boolean
  );

  if (normalizedPatientIds.length === 0) {
    throw new Error("patientIds must include at least one patient ID");
  }

  return requestDeepPheEndpoint("/deepphe/filter/summary", "POST", {
    body: {
      patient_ids: normalizedPatientIds,
    },
  });
};

const fetchSummaryWithDedup = async (path, { includePatientIds = true } = {}) => {
  const requestKey = `${path}|includePatientIds=${String(includePatientIds)}`;
  const cachedPromise = summaryRequestPromiseCache.get(requestKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const requestPromise = requestDeepPheEndpoint(path, "GET", {
    query: { includePatientIds },
  }).finally(() => {
    summaryRequestPromiseCache.delete(requestKey);
  });

  summaryRequestPromiseCache.set(requestKey, requestPromise);
  return requestPromise;
};

// Convenience wrappers for currently known DeepPhe endpoints.
export const fetchAttributesClasses = async () =>
  requestDeepPheEndpoint("/deepphe/attributes/classes");

export const fetchAttributesSummary = async ({ includePatientIds = true } = {}) =>
  fetchSummaryWithDedup("/deepphe/attributes/summary", {
    includePatientIds,
  });

export const fetchAttributesInstances = async ({
  groupname,
  patientId,
  includePatientIds = false,
} = {}) => {
  if (!groupname) {
    throw new Error("groupname is required");
  }

  const suffix = includePatientIds ? "/patients" : "";
  const path = patientId
    ? `/deepphe/attributes/instances/patient/{patientId}${suffix}`
    : `/deepphe/attributes/instances${suffix}`;

  return requestDeepPheEndpoint(path, "GET", {
    pathParams: patientId ? { patientId } : {},
    query: { groupname },
  });
};

export const fetchCancersClasses = async () =>
  requestDeepPheEndpoint("/deepphe/cancers/classes");

export const fetchCancersSummary = async ({ includePatientIds = true } = {}) =>
  fetchSummaryWithDedup("/deepphe/cancers/summary", {
    includePatientIds,
  });

export const fetchCancersInstances = async ({
  classUri,
  patientId,
  includePatientIds = false,
} = {}) => {
  if (!classUri) {
    throw new Error("classUri is required");
  }

  const suffix = includePatientIds ? "/patients" : "";
  const path = patientId
    ? `/deepphe/cancers/instances/patient/{patientId}${suffix}`
    : `/deepphe/cancers/instances${suffix}`;

  return requestDeepPheEndpoint(path, "GET", {
    pathParams: patientId ? { patientId } : {},
    query: { classUri },
  });
};

export const fetchConceptsClasses = async () =>
  requestDeepPheEndpoint("/deepphe/concepts/classes");

export const fetchConceptsSummary = async ({ includePatientIds = true } = {}) =>
  fetchSummaryWithDedup("/deepphe/concepts/summary", {
    includePatientIds,
  });

export const fetchConceptsInstances = async ({
  dpheGroup,
  patientId,
  includePatientIds = false,
} = {}) => {
  if (!dpheGroup) {
    throw new Error("dpheGroup is required");
  }

  const suffix = includePatientIds ? "/patients" : "";
  const path = patientId
    ? `/deepphe/concepts/instances/patient/{patientId}${suffix}`
    : `/deepphe/concepts/instances${suffix}`;

  return requestDeepPheEndpoint(path, "GET", {
    pathParams: patientId ? { patientId } : {},
    query: { dpheGroup },
  });
};

export const fetchOmopClasses = async () => requestDeepPheEndpoint("/omop/classes");

export const fetchOmopSummary = async ({ includePatientIds = true } = {}) =>
  fetchSummaryWithDedup("/omop/summary", {
    includePatientIds,
  });

export const fetchOmopInstances = async ({
  attribute,
  patientId,
  includePatientIds = false,
} = {}) => {
  if (!attribute) {
    throw new Error("attribute is required");
  }

  const suffix = includePatientIds ? "/patients" : "";
  const path = patientId
    ? `/omop/instances/patient/{patientId}${suffix}`
    : `/omop/instances${suffix}`;

  return requestDeepPheEndpoint(path, "GET", {
    pathParams: patientId ? { patientId } : {},
    query: { attribute: String(attribute).toUpperCase() },
  });
};

export const fetchPatient = async (patientId) => {
  if (!patientId) {
    throw new Error("patientId is required");
  }

  return requestDeepPheEndpoint("/deepphe/patient/{patientId}", "GET", {
    pathParams: { patientId },
  });
};

export const fetchPatientDocuments = async (
  patientId,
  { documentIds, excludeProperties } = {}
) => {
  if (!patientId) {
    throw new Error("patientId is required");
  }

  return requestDeepPheEndpoint("/deepphe/patient/{patientId}/documents", "GET", {
    pathParams: { patientId },
    query: {
      documentIds: toCsvIfArray(documentIds),
      excludeProperties: toCsvIfArray(excludeProperties),
    },
  });
};

export const fetchPatientDocumentEpisodes = async (
  patientId,
  { documentIds, excludeProperties } = {}
) => {
  if (!patientId) {
    throw new Error("patientId is required");
  }

  return requestDeepPheEndpoint("/deepphe/patient/{patientId}/documents/episodes", "GET", {
    pathParams: { patientId },
    query: {
      documentIds: toCsvIfArray(documentIds),
      excludeProperties: toCsvIfArray(excludeProperties),
    },
  });
};

export const fetchPatientCancers = async (patientId) => {
  if (!patientId) {
    throw new Error("patientId is required");
  }

  return requestDeepPheEndpoint("/deepphe/patient/{patientId}/cancers", "GET", {
    pathParams: { patientId },
  });
};

export const fetchPatientConcepts = async (patientId) => {
  if (!patientId) {
    throw new Error("patientId is required");
  }

  return requestDeepPheEndpoint("/deepphe/patient/{patientId}/concepts", "GET", {
    pathParams: { patientId },
  });
};
