function sanitizeFactId(factId) {
  return String(factId || "")
    .replace(/^list_view_/, "")
    .replace(/^table_view_/, "")
    .trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function findFactInCancerAttributes(cancer = {}, factId = "") {
  const targetFactId = sanitizeFactId(factId);

  for (const attribute of normalizeArray(cancer.attributes)) {
    const categoryName = String(attribute?.name || "").trim();
    for (const value of normalizeArray(attribute?.values)) {
      const valueId = String(value?.id || "").trim();
      if (!valueId || sanitizeFactId(valueId) !== targetFactId) {
        continue;
      }

      return {
        source: "cancer-attribute",
        cancerId: String(cancer?.id || "").trim(),
        tumorId: "",
        categoryName,
        attributeName: categoryName,
        prettyName: String(value?.value || value?.classUri || "").trim(),
        valueObj: value,
      };
    }
  }

  return null;
}

function findFactInTumorAttributes(cancer = {}, factId = "") {
  const targetFactId = sanitizeFactId(factId);

  for (const tumor of normalizeArray(cancer.tumors)) {
    const tumorId = String(tumor?.id || "").trim();

    for (const attribute of normalizeArray(tumor?.attributes)) {
      const categoryName = String(attribute?.name || "").trim();
      for (const value of normalizeArray(attribute?.values)) {
        const valueId = String(value?.id || "").trim();
        if (!valueId || sanitizeFactId(valueId) !== targetFactId) {
          continue;
        }

        return {
          source: "tumor-attribute",
          cancerId: String(cancer?.id || "").trim(),
          tumorId,
          categoryName,
          attributeName: categoryName,
          prettyName: String(value?.value || value?.classUri || "").trim(),
          valueObj: value,
        };
      }
    }
  }

  return null;
}

function findFact(cancers = [], factId = "") {
  for (const cancer of normalizeArray(cancers)) {
    const matchInCancerAttributes = findFactInCancerAttributes(cancer, factId);
    if (matchInCancerAttributes) {
      return matchInCancerAttributes;
    }

    const matchInTumors = findFactInTumorAttributes(cancer, factId);
    if (matchInTumors) {
      return matchInTumors;
    }
  }

  return null;
}

function findMentionIdsForConceptIds(concepts = [], conceptIds = []) {
  const targetConceptIds = new Set(
    normalizeArray(conceptIds)
      .map((conceptId) => String(conceptId || "").trim())
      .filter(Boolean)
  );

  const mentionIds = new Set();

  normalizeArray(concepts).forEach((concept) => {
    const conceptId = String(concept?.id || "").trim();
    if (!conceptId || !targetConceptIds.has(conceptId)) {
      return;
    }

    normalizeArray(concept?.mentionIds)
      .map((mentionId) => String(mentionId || "").trim())
      .filter(Boolean)
      .forEach((mentionId) => mentionIds.add(mentionId));
  });

  return [...mentionIds];
}

function findDocumentsForMentionIds(documents = [], mentionIds = []) {
  const targetMentionIds = new Set(
    normalizeArray(mentionIds)
      .map((mentionId) => String(mentionId || "").trim())
      .filter(Boolean)
  );

  return normalizeArray(documents).filter((document) => {
    const documentMentionIds = normalizeArray(document?.mentions)
      .map((mention) => String(mention?.id || "").trim())
      .filter(Boolean);

    return documentMentionIds.some((mentionId) => targetMentionIds.has(mentionId));
  });
}

export function resolveFactSelection(patientData, factId) {
  const normalizedFactId = sanitizeFactId(factId);
  if (!normalizedFactId) {
    return null;
  }

  const cancers = normalizeArray(patientData?.cancers);
  const concepts = normalizeArray(patientData?.concepts);
  const documents = normalizeArray(patientData?.documents);

  const matchedFact = findFact(cancers, normalizedFactId);
  if (!matchedFact) {
    return null;
  }

  const conceptIds = normalizeArray(matchedFact?.valueObj?.conceptIds)
    .map((conceptId) => String(conceptId || "").trim())
    .filter(Boolean);
  const mentionIds = findMentionIdsForConceptIds(concepts, conceptIds);
  const relatedDocuments = findDocumentsForMentionIds(documents, mentionIds);

  return {
    factId: normalizedFactId,
    source: matchedFact.source,
    cancerId: matchedFact.cancerId,
    tumorId: matchedFact.tumorId,
    categoryName: matchedFact.categoryName,
    attributeName: matchedFact.attributeName,
    prettyName: matchedFact.prettyName,
    valueObj: matchedFact.valueObj,
    conceptIds,
    mentionIds,
    documentIds: relatedDocuments.map((document) => document.id),
    documents: relatedDocuments,
  };
}
