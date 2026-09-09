/**
 * Local mock of the DeepPhe data API, serving the vendored fixtures in
 * mock-api/fixtures (copied verbatim from DeepPhe-Viz-v2-alpha).
 *
 * Why this exists: the real dphe-data-api ships a different ingest of the same
 * fake patients, so its concept ids (fake_patient1_30062026210318_C_*) do not
 * match the ids in public/data/event-timelines/fake_patient1.tsv
 * (fake_patient1_30072025201756_C_*). The numbering does not correspond either
 * -- C_35 is "Estrogen Receptor Status" in the alpha fixture and "N2" in the
 * data-api one -- so the Event Timeline can only be exercised against the
 * fixtures the TSV was derived from.
 *
 * Dependency-free (node:http only). Run: node mock-api/server.js
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3333);
const BASE = "/v1/deepphe-api/deepphe";
// Fixtures are vendored under mock-api/fixtures so this runs from a clean
// clone with no sibling checkouts. Override FIXTURE_DIR to point elsewhere.
const FIXTURE_DIR = process.env.FIXTURE_DIR || path.join(__dirname, "fixtures");
const DEMOGRAPHICS_FILE =
  process.env.DEMOGRAPHICS_FILE ||
  path.join(__dirname, "..", "public", "data", "demographics", "patient_demographics.json");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

const demographicsRecords = readJson(DEMOGRAPHICS_FILE, []);

// The client discovers available endpoints from the spec before it will call
// anything, so serve the real API's spec verbatim.
const openApiSpec = readJson(path.join(__dirname, "openapi.json"), { openapi: "3.0.0", paths: {} });

const patientIds = fs
  .readdirSync(FIXTURE_DIR)
  .filter((name) => /^fake_patient\d+\.json$/.test(name))
  .map((name) => name.replace(/\.json$/, ""))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const fixtureCache = new Map();
function loadPatient(patientId) {
  if (!patientIds.includes(patientId)) return null;
  if (!fixtureCache.has(patientId)) {
    fixtureCache.set(patientId, readJson(path.join(FIXTURE_DIR, `${patientId}.json`), null));
  }
  return fixtureCache.get(patientId);
}

// dpheGroup -> the filter/summary bucket the cohort explorer reads.
const SUMMARY_BUCKETS = [
  ["diagnoses", ["disease or disorder", "neoplasm", "mass"]],
  ["staging", ["disease stage qualifier", "generic tnm finding", "pathologic tnm finding"]],
  ["grading", ["disease grade qualifier"]],
  ["biomarkers", ["gene", "gene product", "clinical test result"]],
  ["procedures", ["intervention or procedure", "imaging device"]],
  ["treatments", ["pharmacologic substance", "chemo/immuno/hormone therapy regimen"]],
  ["findings", ["finding"]],
  ["behavior", ["behavior"]],
  ["anatomy", ["body part", "lymph node", "side", "spatial qualifier", "body fluid or substance"]],
  ["clinical_course", ["clinical course", "temporal qualifier"]],
  ["qualifiers", ["general qualifier", "property or attribute", "severity", "quantitative concept"]],
];

function bucketFor(dpheGroup) {
  const group = String(dpheGroup || "").toLowerCase();
  const match = SUMMARY_BUCKETS.find(([, groups]) => groups.includes(group));
  return match ? match[0] : "other_concepts";
}

function buildSummary(patientId, index) {
  const patient = loadPatient(patientId);
  if (!patient) return null;

  const record =
    demographicsRecords.find((entry) => entry?.PatientID === patientId) || {};
  const summary = {
    patient_id: patientId,
    sequential_id: index + 1,
    demographics: {
      age_at_dx: record.AgeAtDiagnosis != null ? String(record.AgeAtDiagnosis) : "Unknown",
      gender: record.Gender || "Unknown",
      race: record.Race || "Unknown",
      ethnicity: "Unknown",
      cancer_type: record.CancerType || "Unknown",
    },
  };

  SUMMARY_BUCKETS.forEach(([bucket]) => {
    summary[bucket] = [];
  });
  summary.other_concepts = [];

  const seen = new Set();
  (patient.concepts || []).forEach((concept) => {
    const name = String(concept?.preferredText || "").trim();
    if (!name) return;
    const bucket = bucketFor(concept?.dpheGroup);
    const key = `${bucket}|${name}`;
    if (seen.has(key)) return;
    seen.add(key);

    const entry = { name };
    if (concept?.negated) entry.negated = true;
    if (concept?.uncertain) entry.uncertain = true;
    if (concept?.historic) entry.historic = true;
    summary[bucket].push(entry);
  });

  return summary;
}

/**
 * The cohort explorer's filters are built from {classes, instancesByClass}
 * rollups. Derive them from the same fixtures the patient endpoints serve, so
 * the cohort view and the patient view always agree.
 */
function buildRollup(rows, { includePatientIds }) {
  const byClass = new Map();
  let nextId = 1;

  rows.forEach(({ className, key, fields, patientId }) => {
    if (!byClass.has(className)) byClass.set(className, new Map());
    const instances = byClass.get(className);
    if (!instances.has(key)) {
      instances.set(key, { id: nextId++, ...fields, patients: new Set() });
    }
    instances.get(key).patients.add(patientId);
  });

  const instancesByClass = {};
  [...byClass.keys()].sort().forEach((className) => {
    instancesByClass[className] = [...byClass.get(className).values()].map((entry) => {
      const { patients, ...rest } = entry;
      const instance = { ...rest, num_patients: patients.size };
      if (includePatientIds) instance.patient_ids = [...patients];
      return instance;
    });
  });

  return { classes: Object.keys(instancesByClass), instancesByClass };
}

function eachPatient(callback) {
  patientIds.forEach((patientId) => {
    const patient = loadPatient(patientId);
    if (patient) callback(patientId, patient);
  });
}

const flag = (value) => (value ? 1 : 0);

function omopSummary(options) {
  const rows = [];
  patientIds.forEach((patientId) => {
    const record = demographicsRecords.find((entry) => entry?.PatientID === patientId) || {};
    const values = {
      AGE_AT_DX: record.AgeAtDiagnosis != null ? String(record.AgeAtDiagnosis) : "Unknown",
      ETHNICITY: "Unknown",
      GENDER: record.Gender || "Unknown",
      RACE: record.Race || "Unknown",
      CANCER: record.CancerType || "Unknown",
    };
    Object.entries(values).forEach(([className, value]) => {
      rows.push({
        className,
        key: value,
        fields: { [className.toLowerCase()]: value },
        patientId,
      });
    });
  });
  return buildRollup(rows, options);
}

function conceptsSummary(options) {
  const rows = [];
  eachPatient((patientId, patient) => {
    (patient.concepts || []).forEach((concept) => {
      const className = String(concept?.dpheGroup || "").trim();
      const classUri = String(concept?.classUri || "").trim();
      if (!className || !classUri) return;
      rows.push({
        className,
        key: `${classUri}|${flag(concept.negated)}`,
        fields: { dpheGroup: className, classUri, negated: flag(concept.negated) },
        patientId,
      });
    });
  });
  return buildRollup(rows, options);
}

function cancersSummary(options) {
  const rows = [];
  eachPatient((patientId, patient) => {
    (patient.cancers || []).forEach((cancer) => {
      const classUri = String(cancer?.classUri || "").trim();
      if (!classUri) return;
      rows.push({
        className: classUri,
        key: `${classUri}|${flag(cancer.negated)}|${flag(cancer.uncertain)}|${flag(cancer.historic)}`,
        fields: {
          classUri,
          negated: flag(cancer.negated),
          uncertain: flag(cancer.uncertain),
          historic: flag(cancer.historic),
        },
        patientId,
      });
    });
  });
  return buildRollup(rows, options);
}

function attributesSummary(options) {
  const rows = [];
  eachPatient((patientId, patient) => {
    const holders = [];
    (patient.cancers || []).forEach((cancer) => {
      holders.push(cancer);
      (cancer.tumors || []).forEach((tumor) => holders.push(tumor));
    });

    holders.forEach((holder) => {
      (holder.attributes || []).forEach((attribute) => {
        const attributeName = String(attribute?.name || "").trim();
        if (!attributeName) return;
        (attribute.values || []).forEach((value) => {
          const classUri = String(value?.classUri || "").trim();
          if (!classUri) return;
          rows.push({
            className: attributeName,
            key: `${attributeName}|${classUri}|${flag(value.negated)}|${flag(value.uncertain)}|${flag(value.historic)}`,
            fields: {
              attribute_name: attributeName,
              classUri,
              negated: flag(value.negated),
              uncertain: flag(value.uncertain),
              historic: flag(value.historic),
            },
            patientId,
          });
        });
      });
    });
  });
  return buildRollup(rows, options);
}

const SUMMARY_ROUTES = {
  "/omop/summary": omopSummary,
  "/deepphe/concepts/summary": conceptsSummary,
  "/deepphe/cancers/summary": cancersSummary,
  "/deepphe/attributes/summary": attributesSummary,
};

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname;

  if (req.method === "OPTIONS") {
    return send(res, 204, {});
  }

  if (url.pathname === "/openapi.json") {
    return send(res, 200, openApiSpec);
  }

  const apiPath = url.pathname.startsWith("/v1/deepphe-api")
    ? url.pathname.slice("/v1/deepphe-api".length)
    : url.pathname;
  const summaryBuilder = SUMMARY_ROUTES[apiPath];
  if (summaryBuilder && req.method === "GET") {
    const includePatientIds = url.searchParams.get("includePatientIds") !== "false";
    return send(res, 200, summaryBuilder({ includePatientIds }));
  }

  const classesMatch = /^\/(?:deepphe\/)?(attributes|cancers|concepts)\/classes$/.exec(apiPath);
  if (classesMatch && req.method === "GET") {
    const builder = SUMMARY_ROUTES[`/deepphe/${classesMatch[1]}/summary`];
    return send(res, 200, builder({ includePatientIds: false }).classes);
  }

  if (route === "/filter/summary" && req.method === "POST") {
    const body = await readBody(req);
    const requested = Array.isArray(body.patient_ids) ? body.patient_ids : [];
    if (requested.length === 0) {
      return send(res, 400, {
        error: "Missing required body parameter: patient_ids (must be a non-empty array)",
      });
    }
    const rows = requested
      .map((id) => {
        const summary = buildSummary(id, patientIds.indexOf(id));
        return summary ? { patient_id: id, json_text: JSON.stringify(summary) } : null;
      })
      .filter(Boolean);
    return send(res, 200, rows);
  }

  // Every patient id the cohort explorer can offer.
  if (route === "/patients" || route === "/patient/ids") {
    return send(res, 200, patientIds);
  }

  const patientMatch = /^\/patient\/([^/]+)(\/.*)?$/.exec(route);
  if (patientMatch && req.method === "GET") {
    const patientId = decodeURIComponent(patientMatch[1]);
    const suffix = patientMatch[2] || "";
    const patient = loadPatient(patientId);

    if (!patient) {
      return send(res, 404, { error: `No patient found: ${patientId}` });
    }
    if (suffix === "" || suffix === "/") {
      return send(res, 200, patient);
    }
    if (suffix === "/documents") {
      return send(res, 200, patient.documents || []);
    }
    if (suffix === "/documents/episodes") {
      const counts = {};
      (patient.documents || []).forEach((doc) => {
        const episode = doc?.episode || "Unknown";
        counts[episode] = (counts[episode] || 0) + 1;
      });
      return send(res, 200, counts);
    }
    if (suffix === "/cancers") {
      return send(res, 200, patient.cancers || []);
    }
    if (suffix === "/concepts") {
      return send(res, 200, {
        concepts: patient.concepts || [],
        conceptRelations: patient.conceptRelations || [],
      });
    }
  }

  send(res, 404, { error: `Not mocked: ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `DeepPhe mock API on http://localhost:${PORT}${BASE} — ${patientIds.length} patients from ${FIXTURE_DIR}`
  );
});
