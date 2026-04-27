function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeDateValue(value) {
  return String(value || "").trim();
}

function isDocumentLikeRecord(value) {
  const source = toObject(value);
  const id = String(source.id || source.documentId || "").trim();
  if (!id) {
    return false;
  }

  return (
    source.type !== undefined ||
    source.date !== undefined ||
    source.episode !== undefined ||
    source.text !== undefined ||
    Array.isArray(source.sections)
  );
}

function normalizeMention(mention = {}) {
  const mentionObject = toObject(mention);
  return {
    ...mentionObject,
    id: String(mentionObject.id || "").trim(),
    begin: Number(mentionObject.begin),
    end: Number(mentionObject.end),
  };
}

function normalizeDocument(document = {}) {
  const source = toObject(document);
  const id = String(source.id || source.documentId || "").trim();

  return {
    ...source,
    id,
    documentId: id,
    name: String(source.name || source.title || id || "Untitled document").trim(),
    type: String(source.type || "Unknown").trim() || "Unknown",
    date: normalizeDateValue(source.date),
    episode: String(source.episode || "Unknown").trim() || "Unknown",
    text: typeof source.text === "string" ? source.text : "",
    mentions: Array.isArray(source.mentions) ? source.mentions.map(normalizeMention) : [],
    mentionRelations: Array.isArray(source.mentionRelations) ? source.mentionRelations : [],
    sections: Array.isArray(source.sections) ? source.sections : [],
  };
}

export function resolveDocumentsFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload
      .filter((item) => isDocumentLikeRecord(item))
      .map(normalizeDocument)
      .filter((document) => document.id);
  }

  const payloadObject = toObject(payload);
  const nestedData = toObject(payloadObject.data);

  const documentCandidates = [
    payloadObject.documents,
    nestedData.documents,
    payloadObject.data,
    payloadObject.results,
  ].find((candidate) => Array.isArray(candidate));

  if (!Array.isArray(documentCandidates)) {
    return [];
  }

  return documentCandidates.map(normalizeDocument).filter((document) => document.id);
}

export function mergeDocuments(primaryDocuments = [], secondaryDocuments = []) {
  const mergedById = new Map();

  const mergeInOrder = (documents) => {
    documents.forEach((document) => {
      const normalizedDocument = normalizeDocument(document);
      if (!normalizedDocument.id) {
        return;
      }

      const existingDocument = mergedById.get(normalizedDocument.id) || {};
      mergedById.set(normalizedDocument.id, {
        ...existingDocument,
        ...normalizedDocument,
        mentions:
          normalizedDocument.mentions.length > 0
            ? normalizedDocument.mentions
            : existingDocument.mentions || [],
        mentionRelations:
          normalizedDocument.mentionRelations.length > 0
            ? normalizedDocument.mentionRelations
            : existingDocument.mentionRelations || [],
        sections:
          normalizedDocument.sections.length > 0
            ? normalizedDocument.sections
            : existingDocument.sections || [],
        text:
          typeof normalizedDocument.text === "string" && normalizedDocument.text.length > 0
            ? normalizedDocument.text
            : existingDocument.text || "",
      });
    });
  };

  mergeInOrder(primaryDocuments);
  mergeInOrder(secondaryDocuments);

  return [...mergedById.values()];
}

export function extractPatientObject(payload) {
  if (!payload) {
    return {};
  }

  if (Array.isArray(payload)) {
    const rows = payload.map((row) => toObject(row)).filter((row) => Object.keys(row).length > 0);

    const explicitPatientRow = rows.find(
      (row) =>
        Array.isArray(row.cancers) ||
        Array.isArray(row.concepts) ||
        Array.isArray(row.documents) ||
        Array.isArray(row.conceptRelations) ||
        row.patientId !== undefined ||
        row.patient_id !== undefined
    );
    if (explicitPatientRow) {
      return explicitPatientRow;
    }

    const likelyHeaderRow = rows.find((row) => !isDocumentLikeRecord(row));
    if (likelyHeaderRow) {
      return likelyHeaderRow;
    }

    return {};
  }

  const payloadObject = toObject(payload);
  const nestedData = toObject(payloadObject.data);

  if (payloadObject.patient && typeof payloadObject.patient === "object") {
    return toObject(payloadObject.patient);
  }

  if (nestedData.patient && typeof nestedData.patient === "object") {
    return toObject(nestedData.patient);
  }

  if (
    Array.isArray(payloadObject.documents) ||
    Array.isArray(payloadObject.concepts) ||
    Array.isArray(payloadObject.cancers)
  ) {
    return payloadObject;
  }

  if (
    Array.isArray(nestedData.documents) ||
    Array.isArray(nestedData.concepts) ||
    Array.isArray(nestedData.cancers)
  ) {
    return nestedData;
  }

  return payloadObject;
}

export function parseDocumentDate(dateValue) {
  const rawValue = normalizeDateValue(dateValue);
  if (!rawValue) {
    return null;
  }

  const digitsOnly = rawValue.replace(/[^0-9]/g, "");
  if (digitsOnly.length >= 8) {
    const year = Number(digitsOnly.slice(0, 4));
    const month = Number(digitsOnly.slice(4, 6));
    const day = Number(digitsOnly.slice(6, 8));
    const hours = digitsOnly.length >= 10 ? Number(digitsOnly.slice(8, 10)) : 0;
    const minutes = digitsOnly.length >= 12 ? Number(digitsOnly.slice(10, 12)) : 0;

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return new Date(year, month - 1, day, Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0);
    }
  }

  const parsedMs = Date.parse(rawValue);
  if (Number.isFinite(parsedMs)) {
    return new Date(parsedMs);
  }

  return null;
}

function toIsoDate(dateObject) {
  if (!(dateObject instanceof Date) || Number.isNaN(dateObject.getTime())) {
    return "";
  }

  const year = dateObject.getFullYear();
  const month = `${dateObject.getMonth() + 1}`.padStart(2, "0");
  const day = `${dateObject.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDemographics(patientObject, patientId, documents) {
  const demographics = toObject(patientObject.demographics);
  const sortedDocumentDates = documents
    .map((document) => parseDocumentDate(document.date))
    .filter(Boolean)
    .sort((leftDate, rightDate) => leftDate.getTime() - rightDate.getTime());

  const firstEncounterDate = sortedDocumentDates.length > 0 ? sortedDocumentDates[0] : null;
  const lastEncounterDate =
    sortedDocumentDates.length > 0 ? sortedDocumentDates[sortedDocumentDates.length - 1] : null;

  return {
    patientId,
    patientName: String(
      patientObject.patientName || patientObject.name || demographics.name || ""
    ).trim(),
    gender: String(patientObject.gender || demographics.gender || "").trim(),
    race: String(patientObject.race || demographics.race || "").trim(),
    ethnicity: String(patientObject.ethnicity || demographics.ethnicity || "").trim(),
    birthDate: String(patientObject.birthDate || demographics.birthDate || "").trim(),
    firstEncounterDate: toIsoDate(firstEncounterDate),
    lastEncounterDate: toIsoDate(lastEncounterDate),
  };
}

export function normalizePatientPayload({
  patientPayload,
  documentsPayload,
  fallbackPatientId,
} = {}) {
  const patientObject = extractPatientObject(patientPayload);
  const patientId = String(
    patientObject.id || patientObject.patientId || patientObject.name || fallbackPatientId || ""
  ).trim();

  const documentsFromPatient = resolveDocumentsFromPayload(patientObject);
  const documentsFromPatientPayload = resolveDocumentsFromPayload(patientPayload);
  const documentsFromEndpoint = resolveDocumentsFromPayload(documentsPayload);
  const documents = mergeDocuments(
    mergeDocuments(documentsFromPatient, documentsFromPatientPayload),
    documentsFromEndpoint
  );

  return {
    patientId,
    patientName: String(patientObject.name || patientObject.patientName || patientId).trim(),
    documents,
    concepts: Array.isArray(patientObject.concepts) ? patientObject.concepts : [],
    conceptRelations: Array.isArray(patientObject.conceptRelations)
      ? patientObject.conceptRelations
      : [],
    cancers: Array.isArray(patientObject.cancers) ? patientObject.cancers : [],
    demographics: buildDemographics(patientObject, patientId, documents),
    rawPatient: patientObject,
  };
}

export function hasDocumentText(documents = []) {
  return documents.some((document) => typeof document.text === "string" && document.text.length > 0);
}
