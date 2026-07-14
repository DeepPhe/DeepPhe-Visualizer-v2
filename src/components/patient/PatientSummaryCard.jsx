import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardHeader,
  Chip,
  Divider,
  ListSubheader,
  Menu,
  MenuItem,
  Slider,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { alpha, useTheme } from "@mui/material/styles";
import SectionCollapseToggle from "./SectionCollapseToggle";

// Normalized 0–1 confidence → rounded percentage for display; "—" when absent.
function formatConfidencePercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "—";
  }
  return `${Math.round(numericValue * 100)}%`;
}

// A finding's confidence is the highest mention confidence across its source
// documents (0–1). Returns null when the finding has no traceable mention, so
// callers can distinguish "unknown" from "low confidence".
function getItemConfidence(item) {
  const best = Number(item?.selection?.bestConfidence);
  if (Number.isFinite(best) && best > 0) {
    return best;
  }
  const ranking = item?.selection?.documentRanking;
  const top = Array.isArray(ranking) && ranking.length ? Number(ranking[0]?.confidence) : Number.NaN;
  return Number.isFinite(top) && top > 0 ? top : null;
}

/**
 * A single concept item within a section. Negated items are struck through and
 * dimmed; historic items are secondary; uncertain/conflicted get small chips.
 *
 * When the item resolves to source documents (item.documentIds) and an
 * onSelectItem handler is provided, the name renders as a keyboard-operable
 * button that opens the source document(s) in the viewer.
 */
function SummaryItem({
  item,
  onSelectItem = undefined,
  onOpenMenu = undefined,
  selectedFactId = "",
}) {
  const theme = useTheme();

  const name = String(item?.name ?? item?.value ?? "").trim() || "Unnamed";
  const isNegated = Boolean(item?.negated);
  const isHistoric = Boolean(item?.historic);
  const isUncertain = Boolean(item?.uncertain);
  const isConflicted = Boolean(item?.conflicted);
  const source = item?.source ? String(item.source).trim() : null;

  const selection = item?.selection || null;
  const documentIds = Array.isArray(item?.documentIds)
    ? item.documentIds
    : Array.isArray(selection?.documentIds)
    ? selection.documentIds
    : [];
  const isClickable = typeof onSelectItem === "function" && documentIds.length > 0;
  const isSelected =
    isClickable && Boolean(selectedFactId) && selection?.factId === selectedFactId;
  const documentCount = documentIds.length;
  // Multi-source items open a document picker so the reader can choose which
  // source document to view; single-source items open their one document
  // directly on click.
  const canShowMenu = isClickable && documentCount > 1 && typeof onOpenMenu === "function";

  const confidence = getItemConfidence(item);
  const confidencePercent = formatConfidencePercent(confidence);
  const confidenceTitle = `Confidence: ${confidencePercent}`;

  const textColor = isNegated
    ? "text.disabled"
    : isHistoric
    ? "text.secondary"
    : "text.primary";

  const nameContent = (
    <>
      {isNegated ? <Box component="span" sx={{ fontWeight: 600 }}>No </Box> : null}
      {name}
      {isClickable && documentCount > 1 ? (
        <Box
          component="span"
          aria-hidden="true"
          sx={{ ml: 0.4, fontSize: "0.6rem", fontWeight: 700, color: "text.secondary" }}
        >
          {confidence != null ? `${confidencePercent} ` : ""}({documentCount})
        </Box>
      ) : null}
    </>
  );

  const nameElement = isClickable ? (
        <Box
          component="button"
          type="button"
          onClick={(event) => {
            // Multi-source findings open the document picker so the reader can
            // choose which source document to view; single-source findings have
            // only one document, so open it directly. Anchor the picker to the
            // item's bottom-left so mouse and keyboard activation match.
            if (canShowMenu) {
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenMenu(selection, { x: Math.round(rect.left), y: Math.round(rect.bottom) });
            } else {
              onSelectItem(selection);
            }
          }}
          onContextMenu={(event) => {
            // The document picker is now a left-click action; still suppress the
            // browser's native context menu and keep right-click opening the
            // picker too for users who reach for it out of habit.
            event.preventDefault();
            if (canShowMenu) {
              onOpenMenu(selection, { x: event.clientX, y: event.clientY });
            }
          }}
          aria-pressed={isSelected}
          aria-haspopup={canShowMenu ? "menu" : undefined}
          aria-label={`${name}: ${
            documentCount > 1
              ? `${confidence != null ? `${confidencePercent} confidence, ` : ""}choose from ${documentCount} source documents`
              : "open source document"
          }`}
          sx={{
            appearance: "none",
            border: "none",
            m: 0,
            mx: isSelected ? -0.4 : 0,
            px: isSelected ? 0.4 : 0,
            py: 0,
            borderRadius: 0.5,
            font: "inherit",
            fontSize: "0.875rem",
            lineHeight: 1.25,
            textAlign: "left",
            cursor: "pointer",
            color: isNegated || isHistoric ? textColor : "primary.main",
            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.14) : "transparent",
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            textUnderlineOffset: "2px",
            "&:hover": {
              textDecorationStyle: "solid",
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            },
            "&:focus-visible": {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: "1px",
            },
          }}
        >
          {nameContent}
        </Box>
      ) : (
        <Typography
          variant="body2"
          component="span"
          sx={{
            color: textColor,
            lineHeight: 1.25,
          }}
        >
          {nameContent}
        </Typography>
      );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 0.35,
        py: 0.12,
      }}
    >
      {/* Hover/focus hint surfacing the finding's extraction confidence. */}
      <Tooltip title={confidenceTitle} describeChild placement="top-start">
        {nameElement}
      </Tooltip>

      {isUncertain ? (
        <Chip
          label="uncertain"
          size="small"
          sx={{
            height: 16,
            fontSize: "0.6rem",
            fontWeight: 600,
            bgcolor: alpha(theme.palette.warning.main, 0.12),
            color: theme.palette.warning.dark,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      ) : null}

      {isConflicted ? (
        <Chip
          label="conflicted"
          size="small"
          sx={{
            height: 16,
            fontSize: "0.6rem",
            fontWeight: 600,
            bgcolor: alpha(theme.palette.info.main, 0.12),
            color: theme.palette.info.dark,
            border: `1px solid ${alpha(theme.palette.info.main, 0.35)}`,
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      ) : null}

      {source ? (
        <Typography
          variant="caption"
          component="span"
          sx={{ color: "text.disabled", fontSize: "0.65rem" }}
        >
          via {source}
        </Typography>
      ) : null}
    </Box>
  );
}

SummaryItem.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string,
    value: PropTypes.string,
    negated: PropTypes.bool,
    historic: PropTypes.bool,
    uncertain: PropTypes.bool,
    conflicted: PropTypes.bool,
    source: PropTypes.string,
    documentIds: PropTypes.arrayOf(PropTypes.string),
    selection: PropTypes.shape({
      factId: PropTypes.string,
      documentIds: PropTypes.arrayOf(PropTypes.string),
      documentRanking: PropTypes.arrayOf(PropTypes.object),
    }),
  }),
  onSelectItem: PropTypes.func,
  onOpenMenu: PropTypes.func,
  selectedFactId: PropTypes.string,
};

/**
 * PatientSummaryCard — displays DIAGNOSES, STAGING, GRADING, BIOMARKERS,
 * PROCEDURES, FINDINGS, and BEHAVIOR as a readable card alongside the
 * Cancer and Tumor Detail panel.
 */
export default function PatientSummaryCard({
  sections = [],
  expanded = true,
  onToggleExpanded = undefined,
  collapsiblePanelId = undefined,
  sectionLabel = "Patient Summary",
  onSelectItem = undefined,
  onSelectDocumentForItem = undefined,
  selectedFactId = "",
  selectedDocumentId = "",
  confidenceThreshold: controlledConfidenceThreshold = undefined,
  onConfidenceThresholdChange = undefined,
}) {
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  const upLg = useMediaQuery(theme.breakpoints.up("lg"));
  const upXl = useMediaQuery(theme.breakpoints.up("xl"));

  // Single document-picker menu shared by all items, anchored at the cursor (or
  // the item's rect when opened via keyboard).
  const [contextMenu, setContextMenu] = useState(null);

  // Minimum-confidence filter (percent). Findings below the threshold are hidden;
  // findings with no traceable confidence are always kept so we never silently
  // drop data we can't score.
  const [internalConfidenceThreshold, setInternalConfidenceThreshold] = useState(100);
  const hasControlledConfidenceThreshold = Number.isFinite(
    Number(controlledConfidenceThreshold)
  );
  const confidenceThreshold = hasControlledConfidenceThreshold
    ? Math.min(100, Math.max(50, Number(controlledConfidenceThreshold)))
    : internalConfidenceThreshold;
  const handleConfidenceThresholdChange = (nextValue) => {
    const normalizedValue = Math.min(100, Math.max(50, Number(nextValue) || 50));
    if (!hasControlledConfidenceThreshold) {
      setInternalConfidenceThreshold(normalizedValue);
    }
    onConfidenceThresholdChange?.(normalizedValue);
  };
  const thresholdFraction = confidenceThreshold / 100;

  const filteredSections = useMemo(() => {
    if (thresholdFraction <= 0) {
      return sections;
    }
    return sections
      .map((section) => ({
        ...section,
        items: (section.items || []).filter((item) => {
          const confidence = getItemConfidence(item);
          return confidence == null || confidence >= thresholdFraction - 1e-9;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, thresholdFraction]);

  const totalItemCount = useMemo(
    () => sections.reduce((count, section) => count + (section.items?.length || 0), 0),
    [sections]
  );
  const visibleItemCount = useMemo(
    () => filteredSections.reduce((count, section) => count + (section.items?.length || 0), 0),
    [filteredSections]
  );
  const hiddenItemCount = totalItemCount - visibleItemCount;

  const handleOpenItemMenu = (selection, position) => {
    if (!selection || !Array.isArray(selection.documentRanking) || selection.documentRanking.length <= 1) {
      return;
    }
    setContextMenu({ mouseX: position.x, mouseY: position.y, selection });
  };

  const handleCloseMenu = () => setContextMenu(null);

  const handleMenuSelect = (documentId) => {
    const selection = contextMenu?.selection;
    setContextMenu(null);
    if (selection && typeof onSelectDocumentForItem === "function") {
      onSelectDocumentForItem(selection, documentId);
    }
  };

  const menuRanking = Array.isArray(contextMenu?.selection?.documentRanking)
    ? contextMenu.selection.documentRanking
    : [];

  // Cap the number of columns at the number of sections so a wide layout never
  // renders an empty trailing column, then spread sections across them by
  // estimated height so the tall BIOMARKERS block doesn't strand a column.
  const maxColumns = upXl ? 4 : upLg ? 3 : upSm ? 2 : 1;
  const columnCount = Math.max(1, Math.min(maxColumns, filteredSections.length || 1));
  const balancedColumns = (() => {
    const columns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));
    const estimateHeight = (section) => 30 + (section.items?.length || 0) * 22;
    filteredSections.forEach((section) => {
      const target = columns.reduce(
        (shortest, column) => (column.height < shortest.height ? column : shortest),
        columns[0]
      );
      target.items.push(section);
      target.height += estimateHeight(section);
    });
    return columns;
  })();

  return (
    <Card
      elevation={0}
      sx={{
        border: 0,
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        height: expanded ? "100%" : "auto",
        minHeight: expanded ? 0 : "unset",
        overflow: expanded ? "hidden" : "visible",
      }}
    >
      <CardHeader
        title="Patient Summary"
        sx={{
          py: 0.75,
          px: 1.25,
          gap: 1,
          "& .MuiCardHeader-content": { minWidth: 0 },
          // Keep the slider control vertically centred against the title rather
          // than pinned to the top like a lone icon button.
          "& .MuiCardHeader-action": { alignSelf: "center", m: 0 },
        }}
        titleTypographyProps={{ variant: "subtitle1", sx: { fontWeight: 700 } }}
        action={
          <Stack direction="row" spacing={0.5} alignItems="center">
            {sections.length > 0 && expanded ? (
              <Tooltip title="Hide findings below this extraction confidence">
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  sx={{ pr: 0.5 }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "inherit",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Confidence:{" "}
                    <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
                      {"50%"}
                    </Box>
                  </Typography>
                  <Slider
                    size="small"
                    value={confidenceThreshold}
                    min={50}
                    max={100}
                    step={5}
                    onChange={(_event, value) =>
                      handleConfidenceThresholdChange(Array.isArray(value) ? value[0] : value)
                    }
                    aria-label="Minimum finding confidence percent"
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                    sx={{ width: { xs: 84, sm: 116 } }}
                  />
                  <Typography
                    variant="caption"
                    aria-hidden
                    sx={{
                      fontSize: "inherit",
                      minWidth: 34,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: "text.secondary",
                    }}
                  >
                    100%
                  </Typography>
                </Stack>
              </Tooltip>
            ) : null}
            {onToggleExpanded ? (
              <SectionCollapseToggle
                expanded={expanded}
                onToggle={onToggleExpanded}
                label={sectionLabel}
                panelId={collapsiblePanelId}
              />
            ) : null}
          </Stack>
        }
      />
      {expanded ? (
        <>
      <Divider />

      {sections.length === 0 ? (
        <Box sx={{ px: 1.25, py: 0.9 }}>
          <Typography variant="body2" color="text.secondary">
            No summary data available for this patient.
          </Typography>
        </Box>
      ) : (
        <Box
          data-testid="patient-summary-card-scroll"
          id={collapsiblePanelId}
          sx={{
            overflowX: "hidden",
            overflowY: "auto",
            overscrollBehavior: "contain",
            flex: "1 1 auto",
            minHeight: 0,
            px: 1,
            py: 0.75,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            aria-live="polite"
            sx={{ display: "block", px: 0.25, pb: hiddenItemCount > 0 ? 0.6 : 0 }}
          >
            {hiddenItemCount > 0
              ? `${hiddenItemCount} finding${hiddenItemCount === 1 ? "" : "s"} hidden below ${confidenceThreshold}% confidence.`
              : ""}
          </Typography>

          {filteredSections.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.25 }}>
              No findings at or above {confidenceThreshold}% confidence. Lower the confidence
              filter to show more.
            </Typography>
          ) : (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            {balancedColumns.map((column, columnIndex) => (
              <Box
                key={`summary-column-${columnIndex}`}
                sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}
              >
                {column.items.map((section) => (
                  <Box
                    key={section.key}
                    sx={{
                      p: 0.85,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.background.paper, 0.7),
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", mb: 0.4 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          bgcolor: alpha(theme.palette.success.main, 0.13),
                          color: theme.palette.success.dark,
                          px: 0.75,
                          py: 0.1,
                          borderRadius: "4px",
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}
                      >
                        {section.label}
                      </Typography>
                    </Box>
                    {section.items.map((item, itemIndex) => (
                      <SummaryItem
                        key={`${section.key}-${itemIndex}`}
                        item={item}
                        onSelectItem={onSelectItem}
                        onOpenMenu={handleOpenItemMenu}
                        selectedFactId={selectedFactId}
                      />
                    ))}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
          )}
        </Box>
      )}

      <Menu
        open={Boolean(contextMenu)}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
        MenuListProps={{
          dense: true,
          "aria-label": contextMenu
            ? `Source documents for ${contextMenu.selection.prettyName}`
            : undefined,
        }}
        slotProps={{ paper: { sx: { maxHeight: 360, maxWidth: 420 } } }}
      >
        <ListSubheader
          component="div"
          sx={{
            py: 0.5,
            lineHeight: 1.35,
            color: "text.secondary",
            bgcolor: "background.paper",
          }}
        >
          <Box
            component="div"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {contextMenu?.selection?.prettyName} — source documents
          </Box>
          <Box
            component="div"
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 1.5,
              mt: 0.25,
            }}
          >
            <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 400 }}>
              Select to open
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: "0.62rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "text.disabled",
              }}
            >
              Confidence
            </Box>
          </Box>
        </ListSubheader>
        {menuRanking.map((entry) => {
          const documentId = String(entry?.documentId || "").trim();
          const isActive = Boolean(selectedDocumentId) && documentId === selectedDocumentId;
          const confidenceLabel = formatConfidencePercent(entry?.confidence);
          const metaLabel =
            [entry?.type, entry?.formattedDate].filter(Boolean).join(" · ") ||
            String(entry?.document?.name || documentId);

          return (
            <MenuItem
              key={documentId}
              selected={isActive}
              onClick={() => handleMenuSelect(documentId)}
              aria-label={`Open ${metaLabel}, confidence ${confidenceLabel}${
                isActive ? ", currently open" : ""
              }`}
              sx={{ py: 0.5 }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1.5,
                  width: "100%",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                  <CheckIcon
                    fontSize="small"
                    color="primary"
                    sx={{ visibility: isActive ? "visible" : "hidden", flexShrink: 0 }}
                  />
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ fontWeight: isActive ? 700 : 500, minWidth: 0 }}
                  >
                    {metaLabel}
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: "text.secondary",
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {confidenceLabel}
                </Typography>
              </Box>
            </MenuItem>
          );
        })}
      </Menu>
        </>
      ) : null}
    </Card>
  );
}

PatientSummaryCard.propTypes = {
  expanded: PropTypes.bool,
  onToggleExpanded: PropTypes.func,
  collapsiblePanelId: PropTypes.string,
  sectionLabel: PropTypes.string,
  // Called with a resolved selection object when a clickable item is activated.
  onSelectItem: PropTypes.func,
  // Called with (selection, documentId) when a document is chosen from the
  // document picker.
  onSelectDocumentForItem: PropTypes.func,
  // factId of the currently selected summary item, for highlighting.
  selectedFactId: PropTypes.string,
  // id of the document currently open in the viewer, to flag it in the picker.
  selectedDocumentId: PropTypes.string,
  confidenceThreshold: PropTypes.number,
  onConfidenceThresholdChange: PropTypes.func,
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      items: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          value: PropTypes.string,
          negated: PropTypes.bool,
          historic: PropTypes.bool,
          uncertain: PropTypes.bool,
          conflicted: PropTypes.bool,
          source: PropTypes.string,
          documentIds: PropTypes.arrayOf(PropTypes.string),
          selection: PropTypes.object,
        })
      ).isRequired,
    })
  ),
};
