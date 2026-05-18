import {
  fetchAttributesSummary,
  fetchCancersSummary,
  fetchConceptsSummary,
  fetchDeepPheFilterSummary,
  fetchOmopSummary,
  fetchPatient,
  fetchPatientCancers,
  fetchPatientConcepts,
  fetchPatientDocumentEpisodes,
  fetchPatientDocuments,
} from "../clients/deepphe-data-api";
import { VIZ2_DOCS_BASE_URL } from "../config";
import {
  hasDocumentText,
  normalizePatientPayload,
  resolveDocumentsFromPayload,
} from "../utils/patientView/normalizePatientPayload";

const FALLBACK_VIZ2_PATIENT_OPTIONS = [
  "fake_patient1",
  "fake_patient2",
  "fake_patient3",
  "fake_patient4",
  "fake_patient5",
  "fake_patient6",
  "fake_patient7",
  "patientX",
].map((patientId) => ({
  id: patientId,
  label: formatViz2PatientLabel(patientId),
}));

function resolveCancersPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.cancers)) {
    return payload.cancers;
  }

  if (Array.isArray(payload?.data?.cancers)) {
    return payload.data.cancers;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function resolveConceptsPayload(payload) {
  const concepts = Array.isArray(payload?.concepts)
    ? payload.concepts
    : Array.isArray(payload?.data?.concepts)
      ? payload.data.concepts
      : [];

  const conceptRelations = Array.isArray(payload?.conceptRelations)
    ? payload.conceptRelations
    : Array.isArray(payload?.data?.conceptRelations)
      ? payload.data.conceptRelations
      : [];

  return {
    concepts,
    conceptRelations,
  };
}

function mergeProfileWithCancerAndConceptData(
  profile,
  { cancersPayload, conceptsPayload } = {}
) {
  const resolvedCancers = resolveCancersPayload(cancersPayload);
  const resolvedConcepts = resolveConceptsPayload(conceptsPayload);

  return {
    ...profile,
    cancers: resolvedCancers.length > 0 ? resolvedCancers : profile.cancers,
    concepts: resolvedConcepts.concepts.length > 0 ? resolvedConcepts.concepts : profile.concepts,
    conceptRelations:
      resolvedConcepts.conceptRelations.length > 0
        ? resolvedConcepts.conceptRelations
        : profile.conceptRelations,
  };
}

function joinBaseUrl(baseUrl, pathFragment) {
  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  const normalizedPath = String(pathFragment || "").replace(/^\/+/, "");

  if (!normalizedBase) {
    return `/${normalizedPath}`;
  }

  return `${normalizedBase}/${normalizedPath}`;
}

function formatViz2PatientLabel(patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  const fakePatientMatch = normalizedPatientId.match(/^fake_patient(\d+)$/i);

  if (fakePatientMatch) {
    return `Fake_patient_${fakePatientMatch[1]}`;
  }

  return normalizedPatientId || "Unknown patient";
}

function normalizeViz2PatientOptions(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.patients)
      ? payload.patients
      : [];

  const normalizedRows = rows
    .map((row) => {
      if (typeof row === "string") {
        const normalizedId = row.trim();
        return normalizedId
          ? { id: normalizedId, label: formatViz2PatientLabel(normalizedId) }
          : null;
      }

      const normalizedId = String(row?.id || row?.patientId || "").trim();
      if (!normalizedId) {
        return null;
      }

      const normalizedLabel = String(row?.label || row?.name || "").trim();
      return {
        id: normalizedId,
        label: normalizedLabel || formatViz2PatientLabel(normalizedId),
      };
    })
    .filter(Boolean);

  const dedupedById = new Map();
  normalizedRows.forEach((row) => {
    dedupedById.set(row.id, row);
  });

  return [...dedupedById.values()].sort((leftRow, rightRow) =>
    leftRow.label.localeCompare(rightRow.label, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

async function fetchJson(url, errorPrefix) {
  let response;

  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch (networkError) {
    throw new Error(`${errorPrefix}: ${networkError?.message || "network error"}`);
  }

  if (!response.ok) {
    throw new Error(
      `${errorPrefix}: ${response.status} ${response.statusText || "request failed"}`
    );
  }

  try {
    return await response.json();
  } catch (parseError) {
    throw new Error(`${errorPrefix}: invalid JSON payload`);
  }
}

function collectPatientIdsFromValue(value, patientIds) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      const normalizedId = String(item || "").trim();
      if (normalizedId) {
        patientIds.add(normalizedId);
      }
    });
    return;
  }

  if (typeof value === "string") {
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((normalizedId) => patientIds.add(normalizedId));
    return;
  }

  const normalizedId = String(value || "").trim();
  if (normalizedId) {
    patientIds.add(normalizedId);
  }
}

function collectPatientIdsFromSummaryPayload(payload, patientIds = new Set()) {
  if (!payload || typeof payload !== "object") {
    return patientIds;
  }

  collectPatientIdsFromValue(payload.patient_ids, patientIds);
  collectPatientIdsFromValue(payload.patientIds, patientIds);
  collectPatientIdsFromValue(payload.patient_id, patientIds);
  collectPatientIdsFromValue(payload.patientId, patientIds);

  const rows = Array.isArray(payload.rows)
    ? payload.rows
    : Array.isArray(payload.data)
      ? payload.data
      : null;
  if (Array.isArray(rows)) {
    rows.forEach((row) => collectPatientIdsFromSummaryPayload(row, patientIds));
  }

  const instancesByClass =
    payload.instancesByClass && typeof payload.instancesByClass === "object"
      ? payload.instancesByClass
      : null;
  if (instancesByClass) {
    Object.values(instancesByClass).forEach((rowsForClass) => {
      if (!Array.isArray(rowsForClass)) {
        return;
      }

      rowsForClass.forEach((row) => collectPatientIdsFromSummaryPayload(row, patientIds));
    });
  }

  return patientIds;
}

function pickRandomValue(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }

  const index = Math.floor(Math.random() * values.length);
  return String(values[index] || "").trim();
}

function normalizeEpisodeCountKey(episodeValue) {
  const rawEpisode = String(episodeValue || "").trim();
  const normalizedEpisode = rawEpisode.toLowerCase();

  if (!normalizedEpisode) {
    return "unknown";
  }

  if (normalizedEpisode.includes("medical") && normalizedEpisode.includes("decision")) {
    return "medical decision-making";
  }

  if (normalizedEpisode.includes("pre") && normalizedEpisode.includes("diagnostic")) {
    return "pre-diagnostic";
  }

  if (normalizedEpisode === "unknown") {
    return "unknown";
  }

  if (normalizedEpisode.includes("diagnostic")) {
    return "diagnostic";
  }

  if (normalizedEpisode.includes("treat")) {
    return "treatment";
  }

  if (normalizedEpisode.includes("follow")) {
    return "follow-up";
  }

  return normalizedEpisode;
}

function buildEpisodeCountsFromDocuments(documents = []) {
  return (Array.isArray(documents) ? documents : []).reduce((accumulator, document) => {
    const episodeKey = normalizeEpisodeCountKey(document?.episode);
    accumulator[episodeKey] = Number(accumulator[episodeKey] || 0) + 1;
    return accumulator;
  }, {});
}

function normalizeEpisodeCountResponse(payload) {
  if (!payload) {
    return {};
  }

  if (Array.isArray(payload)) {
    return payload.reduce((accumulator, row) => {
      if (!row || typeof row !== "object") {
        return accumulator;
      }

      const episodeKey = normalizeEpisodeCountKey(
        row?.episode ?? row?.episodeType ?? row?.type ?? row?.label ?? row?.name ?? row?.key
      );
      const countValue = Number(row?.count ?? row?.total ?? row?.value);
      if (!Number.isFinite(countValue)) {
        return accumulator;
      }

      accumulator[episodeKey] = Number(accumulator[episodeKey] || 0) + countValue;
      return accumulator;
    }, {});
  }

  if (typeof payload !== "object") {
    return {};
  }

  if (Array.isArray(payload.episodes)) {
    return normalizeEpisodeCountResponse(payload.episodes);
  }

  if (Array.isArray(payload.rows)) {
    return normalizeEpisodeCountResponse(payload.rows);
  }

  if (Array.isArray(payload.data)) {
    return normalizeEpisodeCountResponse(payload.data);
  }

  const singleEpisode = payload?.episode ?? payload?.episodeType ?? payload?.type;
  const singleCount = Number(payload?.count ?? payload?.total ?? payload?.value);
  if (singleEpisode !== undefined && Number.isFinite(singleCount)) {
    return {
      [normalizeEpisodeCountKey(singleEpisode)]: singleCount,
    };
  }

  const numericEntries = Object.entries(payload).filter(([, value]) =>
    Number.isFinite(Number(value))
  );

  return numericEntries.reduce((accumulator, [episodeName, countValue]) => {
    const episodeKey = normalizeEpisodeCountKey(episodeName);
    accumulator[episodeKey] = Number(accumulator[episodeKey] || 0) + Number(countValue);
    return accumulator;
  }, {});
}

export async function loadRandomPatientId() {
  const summaryRequests = [
    fetchAttributesSummary({ includePatientIds: true }),
    fetchCancersSummary({ includePatientIds: true }),
    fetchConceptsSummary({ includePatientIds: true }),
    fetchOmopSummary({ includePatientIds: true }),
  ];

  const results = await Promise.allSettled(summaryRequests);
  const patientIds = new Set();

  results.forEach((result) => {
    if (result.status !== "fulfilled") {
      return;
    }

    collectPatientIdsFromSummaryPayload(result.value, patientIds);
  });

  const sortedIds = [...patientIds].sort((leftId, rightId) =>
    leftId.localeCompare(rightId, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
  const randomId = pickRandomValue(sortedIds);

  if (!randomId) {
    throw new Error("No patient IDs were available for random selection.");
  }

  return randomId;
}

export async function loadViz2PatientOptions() {
  const indexUrl = joinBaseUrl(VIZ2_DOCS_BASE_URL, "index.json");

  try {
    const payload = await fetchJson(indexUrl, "Failed to load Viz2 patient index");
    const normalizedOptions = normalizeViz2PatientOptions(payload);

    if (normalizedOptions.length > 0) {
      return normalizedOptions;
    }
  } catch {
    // Fall back to defaults when index is unavailable.
  }

  return FALLBACK_VIZ2_PATIENT_OPTIONS;
}

export async function loadViz2PatientProfile(patientId) {
  const normalizedPatientId = String(patientId || "").trim();
  if (!normalizedPatientId) {
    throw new Error("patientId is required");
  }

  const patientUrl = joinBaseUrl(VIZ2_DOCS_BASE_URL, `${normalizedPatientId}.json`);
  const patientPayload = await fetchJson(
    patientUrl,
    `Failed to load Viz2 patient "${normalizedPatientId}"`
  );

  const normalizedProfile = normalizePatientPayload({
    patientPayload,
    documentsPayload: patientPayload?.documents,
    fallbackPatientId: normalizedPatientId,
  });

  return mergeProfileWithCancerAndConceptData(normalizedProfile, {
    cancersPayload: patientPayload,
    conceptsPayload: patientPayload,
  });
}

export async function loadPatientDocumentEpisodeCounts(
  patientId,
  { documentIds, excludeProperties } = {}
) {
  const normalizedPatientId = String(patientId || "").trim();
  if (!normalizedPatientId) {
    throw new Error("patientId is required");
  }

  try {
    const episodesPayload = await fetchPatientDocumentEpisodes(normalizedPatientId, {
      documentIds,
      excludeProperties,
    });
    const normalizedCounts = normalizeEpisodeCountResponse(episodesPayload);
    if (Object.keys(normalizedCounts).length > 0) {
      return normalizedCounts;
    }
  } catch {
    // Fallback below computes counts from raw patient documents.
  }

  const documentsPayload = await fetchPatientDocuments(normalizedPatientId, {
    documentIds,
    excludeProperties,
  });
  const documents = resolveDocumentsFromPayload(documentsPayload);
  return buildEpisodeCountsFromDocuments(documents);
}

export async function loadPatientProfile(
  patientId,
  { documentIds, excludeProperties } = {}
) {
  const normalizedPatientId = String(patientId || "").trim();
  if (!normalizedPatientId) {
    throw new Error("patientId is required");
  }

  const [patientPayload, cancersPayload, conceptsPayload] = await Promise.all([
    fetchPatient(normalizedPatientId),
    fetchPatientCancers(normalizedPatientId).catch(() => null),
    fetchPatientConcepts(normalizedPatientId).catch(() => null),
  ]);
  let documentsPayload;

  try {
    documentsPayload = await fetchPatientDocuments(normalizedPatientId, {
      documentIds,
      excludeProperties,
    });
  } catch (error) {
    const fallbackProfile = normalizePatientPayload({
      patientPayload,
      fallbackPatientId: normalizedPatientId,
    });
    const mergedFallbackProfile = mergeProfileWithCancerAndConceptData(fallbackProfile, {
      cancersPayload,
      conceptsPayload,
    });

    if (hasDocumentText(mergedFallbackProfile.documents)) {
      return mergedFallbackProfile;
    }

    throw error;
  }

  const normalizedProfile = normalizePatientPayload({
    patientPayload,
    documentsPayload,
    fallbackPatientId: normalizedPatientId,
  });

  return mergeProfileWithCancerAndConceptData(normalizedProfile, {
    cancersPayload,
    conceptsPayload,
  });
}

export async function loadPatientFilterSummary(patientIds) {
  return fetchDeepPheFilterSummary(patientIds);
}
