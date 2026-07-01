import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Stack,
  Tooltip,
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

function FactBadge({ fact, onSelect = undefined, isActive = false }) {
  return (
    <Button
      size="small"
      variant={isActive ? "contained" : "outlined"}
      onClick={() => onSelect?.(fact.id)}
      sx={{
        minWidth: 0,
        px: 0.8,
        py: 0.05,
        lineHeight: 1.1,
        textTransform: "none",
        fontSize: "0.73rem",
        fontWeight: 600,
        borderRadius: 999,
        maxWidth: "100%",
        whiteSpace: "normal",
        textAlign: "left",
      }}
    >
      {getFactLabel(fact)}
    </Button>
  );
}

FactBadge.propTypes = {
  fact: PropTypes.shape({
    id: PropTypes.string,
    value: PropTypes.string,
    prettyName: PropTypes.string,
    name: PropTypes.string,
  }).isRequired,
  onSelect: PropTypes.func,
  isActive: PropTypes.bool,
};

function FactBadgeGroup({
  label,
  facts = [],
  activeFactId = "",
  onFactSelect = undefined,
  sx = undefined,
}) {
  const rows = Array.isArray(facts) ? facts.filter((fact) => String(fact?.id || "").trim()) : [];

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        flexWrap: "wrap",
        columnGap: 0.55,
        rowGap: 0.35,
        minWidth: 0,
        ...sx,
      }}
    >
      <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {rows.length > 0 ? (
        rows.map((fact) => {
          const factId = String(fact.id || "").trim();
          return (
            <FactBadge
              key={factId}
              fact={fact}
              onSelect={onFactSelect}
              isActive={activeFactId === factId}
            />
          );
        })
      ) : (
        <Typography component="span" variant="caption" color="text.disabled">
          Unknown
        </Typography>
      )}
    </Box>
  );
}

FactBadgeGroup.propTypes = {
  label: PropTypes.string.isRequired,
  facts: PropTypes.arrayOf(PropTypes.object),
  activeFactId: PropTypes.string,
  onFactSelect: PropTypes.func,
  sx: PropTypes.object,
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

function getFactsByCategoryNames(cancerFactGroups = [], categoryNames = []) {
  const normalizedNames = new Set(
    (Array.isArray(categoryNames) ? categoryNames : [])
      .map((categoryName) => String(categoryName || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const seenFactIds = new Set();
  const groupedFacts = [];

  (Array.isArray(cancerFactGroups) ? cancerFactGroups : []).forEach((group) => {
    const groupName = String(group?.categoryName || group?.category || "").trim().toLowerCase();
    if (!groupName || !normalizedNames.has(groupName)) {
      return;
    }

    (Array.isArray(group?.facts) ? group.facts : []).forEach((fact) => {
      const factId = String(fact?.id || "").trim();
      if (!factId || seenFactIds.has(factId)) {
        return;
      }

      seenFactIds.add(factId);
      groupedFacts.push(fact);
    });
  });

  return groupedFacts;
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

function isMachineId(value) {
  if (!value || typeof value !== "string") return true;
  return /^[a-z0-9_]{10,}$/i.test(value.trim());
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
  contentAutoHeight = false,
}) {
  const activeFactId = String(factSelection?.factId || "").trim();
  const normalizedCancers = Array.isArray(cancers) ? cancers : [];

  return (
    <Card
      data-testid="cancer-tumor-summary-card"
      elevation={0}
      sx={{
        border: 0,
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        height: contentAutoHeight ? "auto" : "100%",
        minHeight: contentAutoHeight ? "unset" : 0,
        overflow: contentAutoHeight ? "visible" : "hidden",
      }}
    >
      <CardHeader
        title="Cancer and Tumor Detail"
        sx={{
          py: 0.75,
          px: 1.25,
          "& .MuiCardHeader-action": { alignSelf: "center", m: 0 },
        }}
        titleTypographyProps={{ variant: "subtitle1", sx: { fontWeight: 700 } }}
        action={
          normalizedCancers.length > 0 ? (
            <Typography
              variant="caption"
              sx={{
                display: "inline-block",
                px: 1,
                py: 0.25,
                borderRadius: 999,
                fontWeight: 600,
                bgcolor: "info.main",
                color: "#fff",
              }}
            >
              {normalizedCancers.length} cancer{normalizedCancers.length !== 1 ? "s" : ""}
            </Typography>
          ) : null
        }
      />
      <Divider />
      <CardContent
        sx={{
          px: 1.25,
          py: 0.75,
          "&:last-child": { pb: 0.75 },
          ...(contentAutoHeight
            ? {}
            : {
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
              }),
        }}
      >
        {normalizedCancers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No cancer summary data available for this patient.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {normalizedCancers.map((cancer, cancerIndex) => {
              const cancerId = String(cancer?.cancerId || cancer?.title || "").trim();
              const cancerFactGroups = getCancerFactGroups(cancer);
              const locationFacts = getFactsByCategoryNames(cancerFactGroups, ["Location"]);
              const gradeFacts = getFactsByCategoryNames(cancerFactGroups, ["Grade"]);
              const geneFacts = getFactsByCategoryNames(cancerFactGroups, ["Genes", "Gene"]);
              const tnmGroups = getTnmGroups(cancer);
              const tumors = Array.isArray(cancer?.tumors?.listViewData)
                ? cancer.tumors.listViewData
                : [];
              const hasTumorSummary = tumors.some((tumor) => getTumorSummaryGroups(tumor).length > 0);

              return (
                <Box
                  key={cancerId}
                  data-testid="cancer-summary-record"
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 1.25,
                    bgcolor: "background.paper",
                    display: "grid",
                    gap: 0.75,
                    minWidth: 0,
                    "& .MuiTypography-root": { lineHeight: 1.2 },
                  }}
                >
                  {/* Cancer-level facts — a vertical reference grid that keeps
                      the timeline's primary canvas wide. */}
                  <Box
                    data-testid="cancer-fact-grid"
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      alignItems: "center",
                      gap: "6px 10px",
                      minWidth: 0,
                    }}
                  >
                    <Tooltip title={`Full ID: ${cancer.title}`} placement="top-start">
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, cursor: "default", gridColumn: "1 / -1" }}
                      >
                        Cancer {cancerIndex + 1}
                      </Typography>
                    </Tooltip>

                    <FactBadgeGroup
                      label="Location"
                      facts={locationFacts}
                      activeFactId={activeFactId}
                      onFactSelect={onFactSelect}
                      sx={{ gridColumn: "1 / -1" }}
                    />
                    <FactBadgeGroup
                      label="Grade"
                      facts={gradeFacts}
                      activeFactId={activeFactId}
                      onFactSelect={onFactSelect}
                    />
                    <FactBadgeGroup
                      label="Gene(s)"
                      facts={geneFacts}
                      activeFactId={activeFactId}
                      onFactSelect={onFactSelect}
                    />

                    <Box
                      sx={{
                        display: "inline-flex",
                        flexWrap: "nowrap",
                        alignItems: "center",
                        gap: "6px 8px",
                        gridColumn: "1 / -1",
                        minWidth: 0,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        TNM
                      </Typography>
                      {tnmGroups.map((group) => (
                        <FactBadgeGroup
                          key={`${cancerId}-tnm-${group.key}`}
                          label={group.key}
                          facts={group.facts}
                          activeFactId={activeFactId}
                          onFactSelect={onFactSelect}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Tumor rows — each tumor stays compact and wraps by field group. */}
                  {hasTumorSummary
                    ? tumors.map((tumor, tumorIndex) => {
                        const tumorGroups = getTumorSummaryGroups(tumor);
                        if (tumorGroups.length === 0) return null;

                        const tumorLabel = !isMachineId(tumor.type)
                          ? tumor.type
                          : `Tumor ${tumorIndex + 1}`;
                        const tooltipTitle = [tumor.type, tumor.id]
                          .filter(Boolean)
                          .join(" · ");

                        return (
                          <Box
                            key={`${cancerId}-${tumor.id}`}
                            data-testid="tumor-fact-grid"
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              alignItems: "center",
                              gap: "6px 10px",
                              pt: 0.75,
                              minWidth: 0,
                              borderTop: 1,
                              borderColor: "divider",
                            }}
                          >
                            <Tooltip title={tooltipTitle} placement="top-start">
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  fontWeight: 700,
                                  cursor: "default",
                                  gridColumn: "1 / -1",
                                }}
                              >
                                {tumorLabel}
                              </Typography>
                            </Tooltip>
                            {tumorGroups.map((group) => (
                              <FactBadgeGroup
                                key={`${tumor.id}-${group.label}`}
                                label={group.label}
                                facts={group.facts}
                                activeFactId={activeFactId}
                                onFactSelect={onFactSelect}
                                sx={
                                  group.label === "Location"
                                    ? { gridColumn: "1 / -1" }
                                    : undefined
                                }
                              />
                            ))}
                          </Box>
                        );
                      })
                    : null}
                </Box>
              );
            })}

            {factSelection ? (
              <Box
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 1,
                  bgcolor: "background.default",
                }}
              >
                <Stack spacing={0.6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Details
                  </Typography>
                  <Typography variant="body2">
                    <strong>Category:</strong> {factSelection?.categoryName || "Unknown"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Name:</strong> {factSelection?.prettyName || "Unknown"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Negated:</strong> {String(Boolean(factSelection?.valueObj?.negated))}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Confidence:</strong> {Number(factSelection?.valueObj?.confidence) || 0}%
                  </Typography>

                  <Box sx={{ pt: 0.2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Related documents
                    </Typography>
                    <RelatedDocumentList
                      factSelection={factSelection}
                      selectedDocumentId={selectedDocumentId}
                      onSelectDocument={onSelectDocument}
                    />
                  </Box>
                </Stack>
              </Box>
            ) : null}
          </Stack>
        )}
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
  contentAutoHeight: PropTypes.bool,
};
