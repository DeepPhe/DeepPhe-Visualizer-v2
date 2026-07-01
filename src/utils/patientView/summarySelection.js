// Resolves a Patient Summary item (a diagnosis, finding, biomarker, etc.) back
// to its source documents using the patient's local mention graph
// (patientData.documents[].mentions[] + patientData.concepts[]). This mirrors
// resolveFactSelection (factLinking.js), which does the same for cancer/tumor
// facts, but the summary items only carry a humanized name, so we join on a
// normalized class token instead of an explicit value id.
//
// Documents are ranked by the highest mention confidence for the term so the
// caller can open the single most confident source first, while still
// surfacing every other source document via documentIds.

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

// Lowercase + strip every non-alphanumeric so "In Situ", "InSitu" and
// "in_situ" all collapse to the same join key.
function normalizeMatchKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function lastUriSegment(value) {
  const raw = String(value || "").trim();
  const delimiterIndex = Math.max(raw.lastIndexOf("#"), raw.lastIndexOf("/"));
  return delimiterIndex >= 0 ? raw.slice(delimiterIndex + 1) : raw;
}

// Confidence arrives as either a 0–1 fraction or a 0–100 percentage depending
// on the source; normalize to a 0–1 fraction (matches documentMentions.js).
function normalizeConfidence(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return numericValue > 1 ? numericValue / 100 : numericValue;
}

function addKey(keySet, value) {
  const key = normalizeMatchKey(value);
  if (key) {
    keySet.add(key);
  }
}

// Ontology class tokens like "PN1StageFinding" surface to the reader as the
// humanized stage name "pN1" (humanizeStaging drops the "StageFinding" suffix),
// and summary items from the filter-summary API carry only that humanized name.
// So for any class token, register BOTH the full normalized form and the
// suffix-stripped form as match keys — that lets a name-only item ("pN1") still
// join to its concept/mention ("PN1StageFinding") without cross-matching the
// clinical variant ("N1StageFinding" -> "n1", which never equals "pn1").
function addClassKey(keySet, value) {
  addKey(keySet, value);
  const stripped = String(value || "").replace(/StageFinding$/i, "");
  if (stripped && stripped !== String(value || "")) {
    addKey(keySet, stripped);
  }
}

// True when either the full or suffix-stripped form of a class token is present
// in the item's key set (mirrors addClassKey for the document-mention scan).
function classKeyMatches(itemKeys, rawSegment) {
  const fullKey = normalizeMatchKey(rawSegment);
  if (fullKey && itemKeys.has(fullKey)) {
    return true;
  }
  const strippedKey = normalizeMatchKey(String(rawSegment || "").replace(/StageFinding$/i, ""));
  return Boolean(strippedKey) && itemKeys.has(strippedKey);
}

function buildItemMatchKeys(item) {
  const keys = new Set();
  addKey(keys, item?.name);
  addKey(keys, item?.value);
  addKey(keys, item?.label);
  addKey(keys, item?.preferredText);
  addClassKey(keys, lastUriSegment(item?.classUri));
  addClassKey(keys, lastUriSegment(item?.class));
  addClassKey(keys, lastUriSegment(item?.uri));
  return keys;
}

function buildConceptMatchKeys(concept) {
  const keys = new Set();
  addClassKey(keys, lastUriSegment(concept?.classUri));
  addKey(keys, concept?.name);
  addKey(keys, concept?.preferredText);
  return keys;
}

/**
 * Resolve a Patient Summary item to its source documents from patientData.
 *
 * @param {object} patientData       Normalized patient payload (documents, concepts).
 * @param {object} item              A summary item, e.g. { name: "In Situ", negated: false }.
 * @param {object} [options]
 * @param {string} [options.sectionKey]    Section key, e.g. "findings".
 * @param {string} [options.sectionLabel]  Human label, e.g. "Findings".
 * @returns {object|null} A factSelection-compatible object, or null when the
 *   item cannot be tied to any source document.
 */
export function resolveSummarySelection(patientData, item, { sectionKey = "", sectionLabel = "" } = {}) {
  const documents = normalizeArray(patientData?.documents);
  const concepts = normalizeArray(patientData?.concepts);

  const itemKeys = buildItemMatchKeys(item);
  if (itemKeys.size === 0 || documents.length === 0) {
    return null;
  }

  // 1. Match concepts by class/name → concept ids (for in-document highlighting)
  //    and their mention ids.
  const matchedConceptIds = new Set();
  const matchedMentionIds = new Set();

  concepts.forEach((concept) => {
    const conceptKeys = buildConceptMatchKeys(concept);
    const isMatch = [...conceptKeys].some((key) => itemKeys.has(key));
    if (!isMatch) {
      return;
    }

    const conceptId = String(concept?.id || "").trim();
    if (conceptId) {
      matchedConceptIds.add(conceptId);
    }
    normalizeArray(concept?.mentionIds)
      .map((mentionId) => String(mentionId || "").trim())
      .filter(Boolean)
      .forEach((mentionId) => matchedMentionIds.add(mentionId));
  });

  // 2. Scan documents for mentions matching by mention id (from step 1) or
  //    directly by class token, tracking the best confidence per document so
  //    the caller can open the most confident source first.
  const bestConfidenceByDocId = new Map();
  const documentById = new Map();

  documents.forEach((document) => {
    const documentId = String(document?.id || "").trim();
    if (!documentId) {
      return;
    }

    let bestConfidence = -1;
    normalizeArray(document?.mentions).forEach((mention) => {
      const mentionId = String(mention?.id || "").trim();
      const matchesById = Boolean(mentionId) && matchedMentionIds.has(mentionId);
      const matchesByClass = classKeyMatches(itemKeys, lastUriSegment(mention?.classUri));
      if (!matchesById && !matchesByClass) {
        return;
      }

      if (mentionId) {
        // Make sure class-matched mentions also drive highlighting.
        matchedMentionIds.add(mentionId);
      }
      const confidence = normalizeConfidence(mention?.confidence);
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
      }
    });

    if (bestConfidence >= 0) {
      bestConfidenceByDocId.set(documentId, bestConfidence);
      documentById.set(documentId, document);
    }
  });

  if (bestConfidenceByDocId.size === 0) {
    return null;
  }

  // 3. Pull in any concepts whose mentions we matched by class but missed by
  //    name, so the document viewer can still highlight them.
  concepts.forEach((concept) => {
    const conceptId = String(concept?.id || "").trim();
    if (!conceptId || matchedConceptIds.has(conceptId)) {
      return;
    }
    const hasMatchedMention = normalizeArray(concept?.mentionIds).some((mentionId) =>
      matchedMentionIds.has(String(mentionId || "").trim())
    );
    if (hasMatchedMention) {
      matchedConceptIds.add(conceptId);
    }
  });

  // Highest confidence first; tie-break on document id for stable ordering.
  const rankedDocumentIds = [...bestConfidenceByDocId.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([documentId]) => documentId);

  const prettyName = String(item?.name ?? item?.value ?? "").trim();

  return {
    factId: `summary:${sectionKey}:${normalizeMatchKey(prettyName)}`,
    source: "summary-item",
    sectionKey,
    categoryName: sectionLabel || sectionKey,
    prettyName,
    conceptIds: [...matchedConceptIds],
    mentionIds: [...matchedMentionIds],
    documentIds: rankedDocumentIds,
    documents: rankedDocumentIds.map((documentId) => documentById.get(documentId)),
    // Per-document confidence (highest mention confidence for the term in each
    // document), highest-first — drives the right-click document picker.
    documentRanking: rankedDocumentIds.map((documentId) => ({
      documentId,
      confidence: bestConfidenceByDocId.get(documentId) ?? 0,
      document: documentById.get(documentId),
    })),
    bestConfidence: bestConfidenceByDocId.get(rankedDocumentIds[0]) ?? 0,
  };
}
