const DIAGNOSIS_CLASS_URIS = new Set([
  "BasalCellCarcinoma",
  "Carcinoma",
  "InvasiveCarcinoma",
  "MalignantBasalCellNeoplasm",
  "MalignantNeoplasm",
  "MalignantSkinNeoplasm",
  "Neoplasm",
  "SkinBasalCellCarcinoma",
  "SkinBasosquamousCellCarcinoma",
  "SkinCarcinoma",
  "SkinNeoplasm",
  "TumorMass",
]);

const STAGING_CLASS_URIS = new Set([
  "PT1sStageFinding",
  "PT1StageFinding",
  "PT2StageFinding",
  "PT3StageFinding",
  "PT4StageFinding",
  "NXStageFinding",
  "N0StageFinding",
  "N1StageFinding",
  "N2StageFinding",
  "N3StageFinding",
  "MXStageFinding",
  "M0StageFinding",
  "M1StageFinding",
  "TXStageFinding",
  "T0StageFinding",
  "T1StageFinding",
  "T2StageFinding",
  "T3StageFinding",
  "T4StageFinding",
]);

const BIOMARKER_CLASS_URIS = new Set([
  "ARStatus",
  "BRD4Gene",
  "ERStatus",
  "EstrogenReceptor",
  "EstrogenReceptorFamily",
  "EstrogenReceptorStatus",
  "HER2Status",
  "LTAWtAllele",
  "Lymphotoxin_sub_Alpha",
  "ProgesteroneReceptorStatus",
  "PRStatus",
]);

const PROCEDURE_CLASS_URIS = new Set([
  "Biopsy",
  "Excision",
  "Mastectomy",
  "ShaveBiopsy",
  "SkinBiopsy",
]);

const TREATMENT_CLASS_URIS = new Set([
  "AC",
  "ACT",
  "BEP",
  "CAP",
  "CAPOX",
  "Carboplatin_sl_Paclitaxel",
  "Chemotherapy",
  "Cisplatin_sl_Cyclophosphamide_sl_Doxorubicin",
  "Cisplatin_sl_Etoposide",
  "Docetaxel_sl_Cyclophosphamide",
  "FEC",
  "FOLFIRI",
  "FOLFOX",
  "Fluorouracil_sl_Epirubicin_sl_Cyclophosphamide",
  "FolinicAcid_sl_Fluorouracil_sl_Irinotecan",
  "FolinicAcid_sl_Fluorouracil_sl_Oxaliplatin",
  "RadiationTherapy",
  "RCHOP",
  "TC",
]);

const FINDING_CLASS_URIS = new Set([
  "Blockage",
  "Cyst",
  "Dimension",
  "Erosion",
  "InSitu",
  "Invasion",
  "Invasive",
  "Injury",
  "Lesion",
  "Lymphovascular",
  "NecroticProcess",
  "Nuclear",
  "SurgicalMarginsStatus",
  "SolidGrowthPattern",
  "SkinDisorder",
  "SkinErosion",
  "SkinCyst",
  "TissueDamage",
  "TumorSize",
]);

const REGIMEN_ABBREVIATIONS = {
  Cisplatin_sl_Cyclophosphamide_sl_Doxorubicin: "CAP",
  Cyclophosphamide_sl_Doxorubicin: "AC",
  Docetaxel_sl_Cyclophosphamide: "TC",
  Carboplatin_sl_Paclitaxel: "CP",
  Fluorouracil_sl_Epirubicin_sl_Cyclophosphamide: "FEC",
  FolinicAcid_sl_Fluorouracil_sl_Oxaliplatin: "FOLFOX",
  FolinicAcid_sl_Fluorouracil_sl_Irinotecan: "FOLFIRI",
  Capecitabine_sl_Oxaliplatin: "CAPOX",
  Doxorubicin_sl_Bleomycin_sl_Vinblastine_sl_Dacarbazine: "ABVD",
  Rituximab_sl_Cyclophosphamide_sl_Doxorubicin_slVincristine_sl_Prednisone: "R-CHOP",
  Bleomycin_sl_Etoposide_sl_Cisplatin: "BEP",
  Doxorubicin_sl_Cyclophosphamide_sl_Paclitaxel: "AC-T",
  Vincristine_sl_Doxorubicin_sl_Dexamethasone: "VAD",
};

const LATERALITY_MAP = {
  LEFT: "L",
  RIGHT: "R",
  BILATERAL: "Bilateral",
};

const REL_ASSOCIATED_SITE = "hasassociatedsite";
const REL_LATERALITY = "haslaterality";
const REL_TREATMENT = "hastreatment";
const REL_PROCEDURE = "hasprocedure";

function normalizeToken(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const hashIndex = raw.lastIndexOf("#");
  const slashIndex = raw.lastIndexOf("/");
  const delimiterIndex = Math.max(hashIndex, slashIndex);
  if (delimiterIndex >= 0) {
    return raw.slice(delimiterIndex + 1).trim();
  }

  return raw;
}

function camelCaseToSpaced(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeConfidence(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return numericValue > 1 ? numericValue / 100 : numericValue;
}

function classifyClassUri(classUri) {
  if (DIAGNOSIS_CLASS_URIS.has(classUri)) {
    return "diagnosis";
  }
  if (STAGING_CLASS_URIS.has(classUri)) {
    return "staging";
  }
  if (BIOMARKER_CLASS_URIS.has(classUri)) {
    return "biomarker";
  }
  if (PROCEDURE_CLASS_URIS.has(classUri)) {
    return "procedure";
  }
  if (TREATMENT_CLASS_URIS.has(classUri)) {
    return "treatment";
  }
  if (FINDING_CLASS_URIS.has(classUri)) {
    return "finding";
  }

  return "";
}

function humanizeStaging(classUri) {
  const stripped = String(classUri || "").replace(/StageFinding$/i, "");
  if (/^[PC][TNM]/.test(stripped)) {
    return stripped.charAt(0).toLowerCase() + stripped.slice(1);
  }
  return stripped;
}

function humanizeTreatment(classUri) {
  if (!String(classUri || "").includes("_sl_")) {
    return camelCaseToSpaced(classUri);
  }

  const parts = String(classUri)
    .split("_sl_")
    .map((part) => camelCaseToSpaced(part))
    .filter(Boolean);
  const base = parts.join(" / ");
  const abbreviation = REGIMEN_ABBREVIATIONS[classUri];
  return abbreviation ? `${base} (${abbreviation})` : base;
}

function humanizeClassUri(classUri, bucket) {
  if (bucket === "staging") {
    return humanizeStaging(classUri);
  }
  if (bucket === "treatment") {
    return humanizeTreatment(classUri);
  }
  return camelCaseToSpaced(classUri);
}

function createBucketAccumulator() {
  return {
    diagnosis: new Map(),
    staging: new Map(),
    biomarker: new Map(),
    procedure: new Map(),
    treatment: new Map(),
    finding: new Map(),
  };
}

function toKey(classUri, negated) {
  return `${classUri}::${negated ? "1" : "0"}`;
}

function pushMention(accumulator, bucket, mention, documentId) {
  const classUri = normalizeToken(mention?.classUri);
  if (!classUri) {
    return null;
  }

  const key = toKey(classUri, Boolean(mention?.negated));
  const bucketMap = accumulator[bucket];
  const existing = bucketMap.get(key) || {
    classUri,
    negated: Boolean(mention?.negated),
    uncertain: Boolean(mention?.uncertain),
    docIds: new Set(),
    sites: new Set(),
    lateralities: new Set(),
  };

  existing.uncertain = existing.uncertain || Boolean(mention?.uncertain);
  existing.docIds.add(String(documentId || ""));
  bucketMap.set(key, existing);
  return existing;
}

function getRelatedMentionIds(documentRelations, mentionId, relationName) {
  if (!mentionId) {
    return [];
  }

  return (Array.isArray(documentRelations) ? documentRelations : [])
    .filter((relation) => String(relation?.relation || "").toLowerCase() === relationName)
    .flatMap((relation) => {
      if (relation?.fromId === mentionId) {
        return [relation.toId];
      }
      if (relation?.toId === mentionId) {
        return [relation.fromId];
      }
      return [];
    })
    .map((id) => String(id || "").trim())
    .filter(Boolean);
}

function sortByDocFreqThenName(items) {
  return [...items].sort((leftItem, rightItem) => {
    if ((rightItem.docFreq || 0) !== (leftItem.docFreq || 0)) {
      return (rightItem.docFreq || 0) - (leftItem.docFreq || 0);
    }
    return String(leftItem.name || "").localeCompare(String(rightItem.name || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function toDocuments(patientJson) {
  if (Array.isArray(patientJson?.documents)) {
    return patientJson.documents;
  }
  if (Array.isArray(patientJson)) {
    return patientJson;
  }
  return [];
}

export function buildPatientSummary(patientJson, { minConfidence = 0.75 } = {}) {
  const documents = toDocuments(patientJson);
  const patientId =
    String(patientJson?.patientId || patientJson?.id || patientJson?.name || "").trim() ||
    "unknown";

  const mentionLookup = new Map();
  const accumulator = createBucketAccumulator();

  documents.forEach((document) => {
    const documentId = String(document?.id || document?.documentId || "").trim();
    (Array.isArray(document?.mentions) ? document.mentions : []).forEach((mention) => {
      const mentionId = String(mention?.id || "").trim();
      const confidence = normalizeConfidence(mention?.confidence);
      if (!mentionId || confidence < minConfidence) {
        return;
      }

      mentionLookup.set(mentionId, {
        mention,
        documentId,
        relations: Array.isArray(document?.mentionRelations) ? document.mentionRelations : [],
      });
    });
  });

  mentionLookup.forEach(({ mention, documentId }) => {
    const classUri = normalizeToken(mention?.classUri);
    const bucket = classifyClassUri(classUri);
    if (!bucket) {
      return;
    }

    pushMention(accumulator, bucket, mention, documentId);
  });

  mentionLookup.forEach(({ mention, documentId, relations }, mentionId) => {
    const classUri = normalizeToken(mention?.classUri);
    if (classifyClassUri(classUri) !== "diagnosis") {
      return;
    }

    const diagnosisEntry = pushMention(accumulator, "diagnosis", mention, documentId);
    if (!diagnosisEntry) {
      return;
    }

    const siteIds = getRelatedMentionIds(relations, mentionId, REL_ASSOCIATED_SITE);
    siteIds.forEach((relatedId) => {
      const related = mentionLookup.get(relatedId);
      const siteClassUri = normalizeToken(related?.mention?.classUri);
      if (siteClassUri) {
        diagnosisEntry.sites.add(camelCaseToSpaced(siteClassUri));
      }
    });

    const lateralityIds = getRelatedMentionIds(relations, mentionId, REL_LATERALITY);
    lateralityIds.forEach((relatedId) => {
      const related = mentionLookup.get(relatedId);
      const lateralityClassUri = normalizeToken(related?.mention?.classUri).toUpperCase();
      const mappedLaterality = LATERALITY_MAP[lateralityClassUri];
      if (mappedLaterality) {
        diagnosisEntry.lateralities.add(mappedLaterality);
      }
    });

    const treatmentIds = [
      ...getRelatedMentionIds(relations, mentionId, REL_TREATMENT),
      ...getRelatedMentionIds(relations, mentionId, REL_PROCEDURE),
    ];

    treatmentIds.forEach((relatedId) => {
      const related = mentionLookup.get(relatedId);
      if (!related?.mention) {
        return;
      }
      const relatedClassUri = normalizeToken(related.mention.classUri);
      const relatedBucket = classifyClassUri(relatedClassUri);
      if (relatedBucket === "treatment" || relatedBucket === "procedure") {
        pushMention(accumulator, relatedBucket, related.mention, related.documentId);
      }
    });
  });

  const activeDx = sortByDocFreqThenName(
    [...accumulator.diagnosis.values()]
      .filter((item) => !item.negated)
      .map((item) => {
        const site = [...item.sites].join(" / ");
        const laterality = [...item.lateralities].join(" / ");
        return {
          name: humanizeClassUri(item.classUri, "diagnosis"),
          site: site || undefined,
          laterality: laterality || undefined,
          uncertain: Boolean(item.uncertain),
          docFreq: item.docIds.size,
        };
      })
  );
  const negatedDx = [...accumulator.diagnosis.values()]
    .filter((item) => item.negated)
    .map((item) => ({ name: humanizeClassUri(item.classUri, "diagnosis") }))
    .sort((leftItem, rightItem) =>
      leftItem.name.localeCompare(rightItem.name, undefined, { numeric: true, sensitivity: "base" })
    );

  const staging = [...accumulator.staging.values()]
    .filter((item) => !item.negated)
    .map((item) => ({ name: humanizeClassUri(item.classUri, "staging") }))
    .sort((leftItem, rightItem) =>
      leftItem.name.localeCompare(rightItem.name, undefined, { numeric: true, sensitivity: "base" })
    );
  const biomarkers = [...accumulator.biomarker.values()]
    .filter((item) => !item.negated)
    .map((item) => ({ name: humanizeClassUri(item.classUri, "biomarker") }))
    .sort((leftItem, rightItem) =>
      leftItem.name.localeCompare(rightItem.name, undefined, { numeric: true, sensitivity: "base" })
    );
  const procedures = sortByDocFreqThenName(
    [...accumulator.procedure.values()]
      .filter((item) => !item.negated)
      .map((item) => ({
        name: humanizeClassUri(item.classUri, "procedure"),
        docFreq: item.docIds.size,
      }))
  );
  const treatments = sortByDocFreqThenName(
    [...accumulator.treatment.values()]
      .filter((item) => !item.negated)
      .map((item) => ({
        name: humanizeClassUri(item.classUri, "treatment"),
        docFreq: item.docIds.size,
      }))
  );
  const activeFindings = [...accumulator.finding.values()]
    .filter((item) => !item.negated)
    .map((item) => ({ name: humanizeClassUri(item.classUri, "finding") }))
    .sort((leftItem, rightItem) =>
      leftItem.name.localeCompare(rightItem.name, undefined, { numeric: true, sensitivity: "base" })
    );
  const negatedFindings = [...accumulator.finding.values()]
    .filter((item) => item.negated)
    .map((item) => ({ name: humanizeClassUri(item.classUri, "finding") }))
    .sort((leftItem, rightItem) =>
      leftItem.name.localeCompare(rightItem.name, undefined, { numeric: true, sensitivity: "base" })
    );

  return {
    patientId,
    docCount: documents.length,
    activeDx,
    negatedDx,
    staging,
    biomarkers,
    procedures,
    treatments,
    activeFindings,
    negatedFindings,
  };
}
