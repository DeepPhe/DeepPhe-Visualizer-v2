import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { toDisplayName } from "../../utils/displayNames";

const SUMMARY_CATEGORY_PRIORITY = [
  "Location",
  "Laterality",
  "Grade",
  "Stage",
  "Metastatic Site",
  "Genes",
  "Histology",
];

function getFactLabel(fact = {}) {
  const rawLabel = String(fact?.value || fact?.prettyName || fact?.name || "").trim();
  if (!rawLabel) {
    return String(fact?.id || "Unknown").trim();
  }

  return toDisplayName(rawLabel) || rawLabel;
}

function InlineFactButton({ fact, onSelect = undefined, isActive = false }) {
  return (
    <Button
      size="small"
      variant="text"
      color={isActive ? "primary" : "inherit"}
      onClick={() => onSelect?.(fact.id)}
      sx={{
        minWidth: 0,
        px: 0,
        py: 0,
        lineHeight: 1.2,
        textTransform: "none",
        fontSize: "0.92rem",
        fontWeight: isActive ? 700 : 500,
        textDecorationLine: "underline",
        textDecorationColor: isActive ? "primary.main" : "rgba(25, 118, 210, 0.45)",
        textDecorationThickness: "1px",
        textUnderlineOffset: "2px",
        borderRadius: 0,
        "&:hover": {
          bgcolor: "transparent",
          textDecorationColor: "primary.main",
          textDecorationThickness: "2px",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 1,
        },
      }}
    >
      {getFactLabel(fact)}
    </Button>
  );
}

InlineFactButton.propTypes = {
  fact: PropTypes.shape({
    id: PropTypes.string,
    value: PropTypes.string,
    prettyName: PropTypes.string,
    name: PropTypes.string,
  }).isRequired,
  onSelect: PropTypes.func,
  isActive: PropTypes.bool,
};

function InlineFactGroup({ label, facts = [], activeFactId = "", onFactSelect = undefined }) {
  const rows = Array.isArray(facts) ? facts.filter((fact) => String(fact?.id || "").trim()) : [];
  if (rows.length === 0) {
    return null;
  }

  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", flexWrap: "wrap", gap: 0.45 }}>
      <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        {label}:
      </Typography>
      {rows.map((fact, index) => {
        const factId = String(fact.id || "").trim();
        return (
          <Box
            key={factId}
            component="span"
            sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.35 }}
          >
            <InlineFactButton
              fact={fact}
              onSelect={onFactSelect}
              isActive={activeFactId === factId}
            />
            {index < rows.length - 1 ? (
              <Typography component="span" variant="body2" color="text.secondary">
                ,
              </Typography>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

InlineFactGroup.propTypes = {
  label: PropTypes.string.isRequired,
  facts: PropTypes.arrayOf(PropTypes.object),
  activeFactId: PropTypes.string,
  onFactSelect: PropTypes.func,
};

function getCancerFactGroups(cancer = {}) {
  const groups = Array.isArray(cancer?.collatedCancerFacts) ? cancer.collatedCancerFacts : [];

  return [...groups].sort((leftGroup, rightGroup) => {
    const leftName = String(leftGroup?.categoryName || leftGroup?.category || "").trim();
    const rightName = String(rightGroup?.categoryName || rightGroup?.category || "").trim();

    const leftRank = SUMMARY_CATEGORY_PRIORITY.indexOf(leftName);
    const rightRank = SUMMARY_CATEGORY_PRIORITY.indexOf(rightName);

    if (leftRank !== -1 || rightRank !== -1) {
      const normalizedLeftRank = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank;
      const normalizedRightRank = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank;
      if (normalizedLeftRank !== normalizedRightRank) {
        return normalizedLeftRank - normalizedRightRank;
      }
    }

    return leftName.localeCompare(rightName, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function getTnmGroups(cancer = {}) {
  const tnmData = cancer?.tnm?.[0]?.data || {};

  return ["T", "N", "M"].map((key) => ({
    key,
    facts: Array.isArray(tnmData[key]) ? tnmData[key] : [],
  }));
}

function getTumorSummaryGroups(tumor = {}) {
  const categories = Array.isArray(tumor?.data) ? tumor.data : [];

  const preferredGroups = SUMMARY_CATEGORY_PRIORITY.map((categoryName) => {
    const matchedCategory = categories.find(
      (category) => String(category?.category || "").trim() === categoryName
    );

    return matchedCategory
      ? {
          label: categoryName,
          facts: Array.isArray(matchedCategory?.facts) ? matchedCategory.facts : [],
        }
      : null;
  }).filter(Boolean);

  if (preferredGroups.length > 0) {
    return preferredGroups;
  }

  return categories
    .filter((category) => Array.isArray(category?.facts) && category.facts.length > 0)
    .slice(0, 3)
    .map((category) => ({
      label: String(category?.category || "Category").trim(),
      facts: Array.isArray(category?.facts) ? category.facts : [],
    }));
}

function RelatedDocumentList({
  factSelection = null,
  selectedDocumentId = "",
  onSelectDocument = undefined,
}) {
  const relatedDocuments = Array.isArray(factSelection?.documents) ? factSelection.documents : [];

  if (relatedDocuments.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No documents contain this concept.
      </Typography>
    );
  }

  return (
    <Stack spacing={0.45}>
      {relatedDocuments.map((document) => {
        const documentId = String(document?.id || "").trim();

        return (
          <Button
            key={documentId}
            size="small"
            variant={selectedDocumentId === documentId ? "contained" : "outlined"}
            onClick={() => onSelectDocument?.(documentId)}
            sx={{ justifyContent: "flex-start", textTransform: "none" }}
          >
            {document?.name || documentId}
          </Button>
        );
      })}
    </Stack>
  );
}

RelatedDocumentList.propTypes = {
  factSelection: PropTypes.shape({
    documents: PropTypes.arrayOf(PropTypes.object),
  }),
  selectedDocumentId: PropTypes.string,
  onSelectDocument: PropTypes.func,
};

export default function CancerTumorSummaryCard({
  cancers = [],
  factSelection = null,
  selectedDocumentId = "",
  onFactSelect = undefined,
  onSelectDocument = undefined,
}) {
  const activeFactId = String(factSelection?.factId || "").trim();

  return (
    <Card elevation={0} sx={{ border: 1, borderColor: "divider" }}>
      <CardHeader
        title="Cancer and Tumor Detail"
        sx={{ py: 1, px: 1.5 }}
        titleTypographyProps={{ variant: "subtitle1", sx: { fontWeight: 700 } }}
      />
      <Divider />
      <CardContent sx={{ px: 1.5, py: 1, "&:last-child": { pb: 1 } }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} lg={9}>
            {(Array.isArray(cancers) ? cancers : []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No cancer summary data available for this patient.
              </Typography>
            ) : (
              <Stack divider={<Divider flexItem />} spacing={0}>
                {(Array.isArray(cancers) ? cancers : []).map((cancer) => {
                  const cancerFactGroups = getCancerFactGroups(cancer);
                  const tnmGroups = getTnmGroups(cancer);
                  const tumors = Array.isArray(cancer?.tumors?.listViewData)
                    ? cancer.tumors.listViewData
                    : [];

                  return (
                    <Box key={cancer.cancerId} sx={{ py: 1.1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        Cancer ID: {cancer.title}
                      </Typography>

                      <Box
                        sx={{
                          mt: 0.45,
                          display: "flex",
                          flexWrap: "wrap",
                          columnGap: 1.6,
                          rowGap: 0.4,
                        }}
                      >
                        {cancerFactGroups.map((group) => (
                          <InlineFactGroup
                            key={`${cancer.cancerId}-${group.category}`}
                            label={group.categoryName || group.category || "Category"}
                            facts={group.facts}
                            activeFactId={activeFactId}
                            onFactSelect={onFactSelect}
                          />
                        ))}
                      </Box>

                      {tnmGroups.some((group) => group.facts.length > 0) ? (
                        <Box
                          sx={{
                            mt: 0.45,
                            display: "flex",
                            flexWrap: "wrap",
                            columnGap: 1.6,
                            rowGap: 0.4,
                          }}
                        >
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            TNM:
                          </Typography>
                          {tnmGroups.map((group) => (
                            <InlineFactGroup
                              key={`${cancer.cancerId}-tnm-${group.key}`}
                              label={group.key}
                              facts={group.facts}
                              activeFactId={activeFactId}
                              onFactSelect={onFactSelect}
                            />
                          ))}
                        </Box>
                      ) : null}

                      {tumors.length > 0 ? (
                        <Box sx={{ mt: 0.45 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                            Tumor Summary
                          </Typography>
                          <Stack spacing={0.35}>
                            {tumors.map((tumor) => (
                              <Box key={`${cancer.cancerId}-${tumor.id}`}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {tumor.type || tumor.id || "Tumor"}
                                </Typography>
                                <Box
                                  sx={{
                                    mt: 0.1,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    columnGap: 1.4,
                                    rowGap: 0.35,
                                    pl: 0.5,
                                  }}
                                >
                                  {getTumorSummaryGroups(tumor).map((group) => (
                                    <InlineFactGroup
                                      key={`${tumor.id}-${group.label}`}
                                      label={group.label}
                                      facts={group.facts}
                                      activeFactId={activeFactId}
                                      onFactSelect={onFactSelect}
                                    />
                                  ))}
                                </Box>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Grid>

          <Grid item xs={12} lg={3}>
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                px: 1.2,
                py: 1,
                bgcolor: "background.default",
                position: { lg: "sticky" },
                top: { lg: 12 },
              }}
            >
              <Stack spacing={0.6}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Details
                </Typography>
                {factSelection ? (
                  <>
                    <Typography variant="body2">
                      <strong>Category:</strong> {factSelection.categoryName || "Unknown"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Name:</strong> {factSelection.prettyName || "Unknown"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Negated:</strong> {String(Boolean(factSelection?.valueObj?.negated))}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Confidence:</strong> {Number(factSelection?.valueObj?.confidence) || 0}%
                    </Typography>

                    <Box sx={{ pt: 0.4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Related documents
                      </Typography>
                      <RelatedDocumentList
                        factSelection={factSelection}
                        selectedDocumentId={selectedDocumentId}
                        onSelectDocument={onSelectDocument}
                      />
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Click a fact to see details here.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

CancerTumorSummaryCard.propTypes = {
  cancers: PropTypes.arrayOf(PropTypes.object),
  factSelection: PropTypes.shape({
    factId: PropTypes.string,
    categoryName: PropTypes.string,
    prettyName: PropTypes.string,
    valueObj: PropTypes.object,
    documents: PropTypes.arrayOf(PropTypes.object),
  }),
  selectedDocumentId: PropTypes.string,
  onFactSelect: PropTypes.func,
  onSelectDocument: PropTypes.func,
};
