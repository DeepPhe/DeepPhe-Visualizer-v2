const FACTS_TO_IGNORE = new Set([
  "HER2/Neu Status",
  "Progesterone Receptor Status",
  "Estrogen Receptor Status",
  "Course",
  "Lymph Involvement",
  "Treatments",
  "Behavior",
  "Tissue",
  "Quadrant",
  "Topography, minor",
  "Topography, major",
  "Test Results",
  "Procedures",
  "T Stage",
  "N Stage",
  "M Stage",
]);

const TNM_LABELS = new Set(["T Stage", "N Stage", "M Stage"]);

function normalizeFact(value = {}) {
  return {
    id: String(value.id || "").trim(),
    name: String(value.classUri || value.value || "").trim(),
    prettyName: String(value.value || value.classUri || "").trim(),
    value: String(value.value || value.classUri || "").trim(),
    classUri: String(value.classUri || "").trim(),
    conceptIds: Array.isArray(value.conceptIds) ? value.conceptIds : [],
    negated: Boolean(value.negated),
    uncertain: Boolean(value.uncertain),
    historic: Boolean(value.historic),
    confidence: Number(value.confidence) || 0,
  };
}

function buildTnmSummary(cancer = {}) {
  const tnmData = {};

  (Array.isArray(cancer.attributes) ? cancer.attributes : []).forEach((attribute) => {
    const attributeName = String(attribute?.name || "").trim();
    if (!TNM_LABELS.has(attributeName)) {
      return;
    }

    const letter = attributeName.charAt(0).toUpperCase();
    tnmData[letter] = (Array.isArray(attribute.values) ? attribute.values : [])
      .map(normalizeFact)
      .filter((fact) => fact.id);
  });

  if (Object.keys(tnmData).length === 0) {
    return [];
  }

  return [
    {
      type: "",
      data: tnmData,
    },
  ];
}

function buildTumorSummary(cancer = {}) {
  const tumors = Array.isArray(cancer.tumors) ? cancer.tumors : [];

  return tumors.map((tumor) => {
    const tumorId = String(tumor?.id || "").trim();
    const attributes = Array.isArray(tumor?.attributes) ? tumor.attributes : [];

    return {
      id: tumorId,
      type: tumorId,
      data: attributes
        .map((attribute) => {
          const category = String(attribute?.name || "").trim();
          if (!category || FACTS_TO_IGNORE.has(category)) {
            return null;
          }

          const facts = (Array.isArray(attribute.values) ? attribute.values : [])
            .map(normalizeFact)
            .filter((fact) => fact.id);

          if (facts.length === 0) {
            return null;
          }

          return {
            category,
            categoryClass: category,
            facts,
          };
        })
        .filter(Boolean),
    };
  });
}

function buildCollatedCancerFacts(cancer = {}) {
  return (Array.isArray(cancer.attributes) ? cancer.attributes : [])
    .map((attribute) => {
      const category = String(attribute?.name || "").trim();
      if (!category || FACTS_TO_IGNORE.has(category)) {
        return null;
      }

      const facts = (Array.isArray(attribute.values) ? attribute.values : [])
        .map(normalizeFact)
        .filter((fact) => fact.id);

      if (facts.length === 0) {
        return null;
      }

      return {
        category,
        categoryName: category,
        facts,
      };
    })
    .filter(Boolean);
}

export function transformCancerSummary(cancers = []) {
  return (Array.isArray(cancers) ? cancers : [])
    .map((cancer) => {
      const cancerId = String(cancer?.id || "").trim();
      if (!cancerId) {
        return null;
      }

      const tumors = buildTumorSummary(cancer);

      return {
        cancerId,
        title: cancerId,
        tnm: buildTnmSummary(cancer),
        tumors: {
          tumors,
          listViewData: tumors,
          tableViewData: [],
        },
        collatedCancerFacts: buildCollatedCancerFacts(cancer),
      };
    })
    .filter(Boolean);
}
