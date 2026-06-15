/**
 * Tests for the DeepPhe data client. The client was previously only ever mocked
 * by consumers, so its core correctness logic — filter validation/normalization,
 * the primary /filter/count contract, and (critically) the client-side cohort
 * set-intersection fallback — had no direct coverage. A wrong intersection here
 * silently returns the wrong cohort, which the app treats as ground truth.
 *
 * Strategy: mock global.fetch and drive the real exported functions end-to-end.
 * Module-level caches (openapi spec, resolved count path) are reset before each
 * test via jest.resetModules() so tests don't leak state into one another.
 */

const OPENAPI_SPEC = {
  servers: [{ url: "/v1/deepphe-api" }],
  paths: {
    "/deepphe/filter/count": { post: {} },
  },
};

function makeResponse(payload, { ok = true, status = 200, statusText = "OK", contentType = "application/json" } = {}) {
  return {
    ok,
    status,
    statusText,
    headers: {
      get: (header) => (String(header).toLowerCase() === "content-type" ? contentType : null),
    },
    json: async () => payload,
    text: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)),
  };
}

// Installs a fetch mock that always answers the openapi.json probe with the
// shared spec and delegates every other request to the supplied handler.
function setupFetch(handler) {
  global.fetch = jest.fn(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.endsWith("/openapi.json")) {
      return makeResponse(OPENAPI_SPEC);
    }
    const response = await handler(requestUrl, init);
    if (!response) {
      throw new Error(`Unexpected fetch in test: ${requestUrl}`);
    }
    return response;
  });
}

function getParam(url, key) {
  return new URL(url, "http://localhost").searchParams.get(key);
}

let client;

beforeEach(() => {
  jest.resetModules();
  client = require("../deepphe-data-api");
});

afterEach(() => {
  delete global.fetch;
});

describe("fetchDeepPheFilterCount — validation", () => {
  beforeEach(() => setupFetch(() => makeResponse({ count: 0 })));

  it("rejects when filters is not a non-empty array", async () => {
    await expect(client.fetchDeepPheFilterCount({ filters: [] })).rejects.toThrow(
      "filters must be a non-empty array"
    );
    await expect(client.fetchDeepPheFilterCount({})).rejects.toThrow("filters must be a non-empty array");
  });

  it("rejects an unsupported filter type", async () => {
    await expect(
      client.fetchDeepPheFilterCount({ filters: [{ type: "bogus", class: "X", instances: ["a"] }] })
    ).rejects.toThrow(/type must be one of/);
  });

  it("rejects a filter with no class", async () => {
    await expect(
      client.fetchDeepPheFilterCount({ filters: [{ type: "omop", class: "  ", instances: ["a"] }] })
    ).rejects.toThrow(/class is required/);
  });

  it("rejects a filter with no instances", async () => {
    await expect(
      client.fetchDeepPheFilterCount({ filters: [{ type: "omop", class: "GENDER", instances: ["", "  "] }] })
    ).rejects.toThrow(/at least one value/);
  });
});

describe("fetchDeepPheFilterCount — primary endpoint", () => {
  it("returns the count payload and posts normalized, de-duplicated instances", async () => {
    let countBody;
    setupFetch((url, init) => {
      if (url.includes("/filter/count") && init?.method === "POST") {
        countBody = JSON.parse(init.body);
        return makeResponse({ count: 5, patient_ids: ["p1", "p2", "p3", "p4", "p5"] });
      }
      return null;
    });

    const result = await client.fetchDeepPheFilterCount({
      filters: [{ type: "omop", class: "GENDER", instances: ["Male", "Male", " Male ", "Female"] }],
    });

    expect(result.count).toBe(5);
    expect(countBody.filters).toEqual([{ type: "omop", class: "GENDER", instances: ["Male", "Female"] }]);
  });

  it("adds includePatientIds=true to the query when patient IDs are requested", async () => {
    let countUrl;
    setupFetch((url, init) => {
      if (url.includes("/filter/count") && init?.method === "POST") {
        countUrl = url;
        return makeResponse({ count: 2, patient_ids: ["p1", "p2"] });
      }
      return null;
    });

    await client.fetchDeepPheFilterCount({
      filters: [{ type: "omop", class: "GENDER", instances: ["Male"] }],
      includePatientIds: true,
    });

    expect(getParam(countUrl, "includePatientIds")).toBe("true");
  });
});

describe("fetchDeepPheFilterCount — client-side intersection fallback", () => {
  it("intersects per-filter patient sets when the count endpoint lacks the value column", async () => {
    setupFetch((url, init) => {
      // Primary count endpoint fails with the sqlite "no such column: value"
      // error, which (with an attributes filter present) triggers the fallback.
      if (url.includes("/filter/count") && init?.method === "POST") {
        return makeResponse("no such column: value", { ok: false, status: 500, contentType: "text/plain" });
      }
      // Per-filter patient lookups used by the fallback.
      if (url.includes("/attributes/instances/patients")) {
        const groupname = getParam(url, "groupname");
        if (groupname === "BEHAVIOR") {
          return makeResponse({ rows: [{ value: "Malignant", patient_ids: ["p1", "p2", "p3"] }] });
        }
        if (groupname === "HISTOLOGY") {
          return makeResponse({ rows: [{ value: "Ductal", patient_ids: ["p3", "p2", "p4"] }] });
        }
      }
      return null;
    });

    const result = await client.fetchDeepPheFilterCount({
      filters: [
        { type: "attributes", class: "BEHAVIOR", instances: ["Malignant"] },
        { type: "attributes", class: "HISTOLOGY", instances: ["Ductal"] },
      ],
      includePatientIds: true,
    });

    // Intersection of {p1,p2,p3} and {p2,p3,p4} is {p2,p3}, returned sorted.
    expect(result.count).toBe(2);
    expect(result.patient_ids).toEqual(["p2", "p3"]);
    expect(result.timing.itemCounts).toEqual([3, 3]);
  });

  it("only matches rows whose value matches the requested instances", async () => {
    setupFetch((url, init) => {
      if (url.includes("/filter/count") && init?.method === "POST") {
        return makeResponse("no such column: value", { ok: false, status: 500, contentType: "text/plain" });
      }
      if (url.includes("/attributes/instances/patients")) {
        return makeResponse({
          rows: [
            { value: "Malignant", patient_ids: ["p1", "p2"] },
            { value: "Benign", patient_ids: ["p9"] },
          ],
        });
      }
      return null;
    });

    const result = await client.fetchDeepPheFilterCount({
      filters: [{ type: "attributes", class: "BEHAVIOR", instances: ["Malignant"] }],
      includePatientIds: true,
    });

    // The "Benign" row (p9) must be excluded — only "Malignant" was requested.
    expect(result.count).toBe(2);
    expect(result.patient_ids).toEqual(["p1", "p2"]);
  });
});

describe("fetchDeepPheFilterCountBatch", () => {
  it("returns an empty array for no queries without hitting the network", async () => {
    setupFetch(() => null);
    await expect(client.fetchDeepPheFilterCountBatch([])).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("posts the normalized queries and returns the positional results array", async () => {
    let batchBody;
    setupFetch((url, init) => {
      if (url.includes("/filter/count/batch") && init?.method === "POST") {
        batchBody = JSON.parse(init.body);
        return makeResponse({ results: [{ count: 1 }, { count: 2 }] });
      }
      return null;
    });

    const results = await client.fetchDeepPheFilterCountBatch([
      { filters: [{ type: "omop", class: "GENDER", instances: ["Male"] }] },
      { filters: [{ type: "omop", class: "RACE", instances: ["White"] }] },
    ]);

    expect(results).toEqual([{ count: 1 }, { count: 2 }]);
    expect(batchBody.queries).toHaveLength(2);
    expect(batchBody.queries[0].filters[0].class).toBe("GENDER");
  });

  it("throws when the batch response is missing a results array", async () => {
    setupFetch((url, init) => {
      if (url.includes("/filter/count/batch") && init?.method === "POST") {
        return makeResponse({ notResults: true });
      }
      return null;
    });

    await expect(
      client.fetchDeepPheFilterCountBatch([
        { filters: [{ type: "omop", class: "GENDER", instances: ["Male"] }] },
      ])
    ).rejects.toThrow(/missing results array/);
  });
});

describe("fetchDeepPheFilterSummary", () => {
  it("de-duplicates and trims patient IDs into the request body", async () => {
    let summaryBody;
    setupFetch((url, init) => {
      if (url.includes("/filter/summary") && init?.method === "POST") {
        summaryBody = JSON.parse(init.body);
        return makeResponse([{ patient_id: "p1" }]);
      }
      return null;
    });

    await client.fetchDeepPheFilterSummary(["p1", " p1 ", "p2", ""]);

    expect(summaryBody).toEqual({ patient_ids: ["p1", "p2"] });
  });

  it("rejects when no patient IDs are supplied", async () => {
    setupFetch(() => null);
    await expect(client.fetchDeepPheFilterSummary([])).rejects.toThrow(/at least one patient ID/);
    await expect(client.fetchDeepPheFilterSummary(["", "  "])).rejects.toThrow(/at least one patient ID/);
  });
});
