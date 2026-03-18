import { DEEPPHE_API_LOCATION } from "../config";

const OPENAPI_JSON_PATH = "/openapi.json";
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
const JSON_CONTENT_TYPE = "application/json";
const DEFAULT_DEEPPHE_API_BASE_PATH = "/v1/deepphe-api";

let openApiSpecPromise;
let openApiSpecCache;

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
  const endpointUrl = joinUrl(serverBaseUrl, pathWithParams);
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
  const serverBaseUrl = getPreferredServerUrl(openApiSpec);
  const url = buildEndpointUrl(serverBaseUrl, path, pathParams, query);
  const response = await fetch(url, createRequestInit(method, body, headers));
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    const payloadMessage =
      typeof payload === "string"
        ? payload
        : payload?.message || payload?.detail || payload?.error || "";
    throw new Error(
      `DeepPhe API request failed: ${normalizeMethod(method)} ${url} -> ${
        payloadMessage || `${response.status} ${response.statusText}`
      }`
    );
  }

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
  const response = await fetch(DEEPPHE_OPENAPI_JSON_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch DeepPhe OpenAPI JSON (${response.status} ${response.statusText})`
    );
  }

    const spec = await response.json();
    openApiSpecCache = spec;
    return spec;
  })();

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

// Convenience wrappers for currently known DeepPhe endpoints.
export const fetchAttributesClasses = async () =>
  requestDeepPheEndpoint("/deepphe/attributes/classes");

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
