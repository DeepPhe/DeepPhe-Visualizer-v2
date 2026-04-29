import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { buildTimelineChartModel } from "../../utils/patientView/timelineChartLayout";

const RELATED_STROKE = "#1976d2";
const AXIS_STROKE = "#707070";
const EPISODE_SELECT_ALL = "__all__";
const EPISODE_SELECT_HIDDEN = "__hidden__";

function getPointAriaLabel(point) {
  return [
    `Document ${point.name || point.id}`,
    `ID ${point.id}`,
    `Type ${point.type}`,
    `Episode ${point.episodeLabel}`,
    `Date ${point.dateLabel}`,
  ].join(". ");
}

function formatEpisodeDocumentOption(point) {
  return `${point.dateLabel} • ${point.type} • ${point.name}`;
}

function EpisodeFilterDropdown({
  episode,
  points = [],
  value = EPISODE_SELECT_ALL,
  onChange = undefined,
}) {
  const selectId = `episode-filter-${episode.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <FormControl size="small" sx={{ minWidth: 260, flex: "1 1 260px", maxWidth: 380 }}>
      <InputLabel id={`${selectId}-label`} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box
          component="span"
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: episode.color,
            border: `1px solid ${alpha("#000", 0.35)}`,
          }}
        />
        {`${episode.label} (${episode.count})`}
      </InputLabel>
      <Select
        native
        labelId={`${selectId}-label`}
        id={selectId}
        value={value}
        label={`${episode.label} (${episode.count})`}
        onChange={(event) => onChange?.(episode.label, event.target.value)}
      >
        <option value={EPISODE_SELECT_ALL}>Show all documents</option>
        <option value={EPISODE_SELECT_HIDDEN}>Hide this episode</option>
        {points.map((point) => (
          <option key={`${episode.key}:${point.id}`} value={point.id}>
            {formatEpisodeDocumentOption(point)}
          </option>
        ))}
      </Select>
    </FormControl>
  );
}

EpisodeFilterDropdown.propTypes = {
  episode: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    count: PropTypes.number.isRequired,
    color: PropTypes.string.isRequired,
  }).isRequired,
  points: PropTypes.arrayOf(PropTypes.object),
  value: PropTypes.string,
  onChange: PropTypes.func,
};

export default function PatientDocumentsCard({
  timelineData = null,
  selectedDocumentId = "",
  relatedDocumentIds = [],
  onSelectDocument = undefined,
  embedded = false,
}) {
  const [hiddenEpisodes, setHiddenEpisodes] = useState(() => new Set());
  const [episodeSelections, setEpisodeSelections] = useState({});

  const relatedIdSet = useMemo(
    () =>
      new Set(
        (Array.isArray(relatedDocumentIds) ? relatedDocumentIds : [])
          .map((documentId) => String(documentId || "").trim())
          .filter(Boolean)
      ),
    [relatedDocumentIds]
  );

  const chartModel = useMemo(() => buildTimelineChartModel(timelineData || {}), [timelineData]);
  const timelineSignature = useMemo(
    () => chartModel.points.map((point) => point.id).join("|"),
    [chartModel.points]
  );

  useEffect(() => {
    setHiddenEpisodes(new Set());
    setEpisodeSelections({});
  }, [timelineSignature]);

  const visiblePoints = useMemo(
    () =>
      chartModel.points.filter((point) => {
        return !hiddenEpisodes.has(point.episodeLabel);
      }),
    [chartModel.points, hiddenEpisodes]
  );
  const isCollapsedTimestampMode = Boolean(chartModel.dateDiagnostics?.hasDateCollapse);

  const selectedPoint = useMemo(() => {
    const normalizedSelectedId = String(selectedDocumentId || "").trim();
    if (!normalizedSelectedId) {
      return null;
    }

    return chartModel.points.find((point) => point.id === normalizedSelectedId) || null;
  }, [chartModel.points, selectedDocumentId]);

  const pointsByEpisode = useMemo(() => {
    const map = new Map();
    chartModel.episodes.forEach((episode) => {
      map.set(
        episode.label,
        chartModel.points.filter((point) => point.episodeLabel === episode.label)
      );
    });
    return map;
  }, [chartModel.episodes, chartModel.points]);

  const handleEpisodeSelection = (episodeLabel, nextValue) => {
    const normalizedLabel = String(episodeLabel || "").trim();
    if (!normalizedLabel) {
      return;
    }

    const normalizedValue = String(nextValue || "").trim() || EPISODE_SELECT_ALL;
    setEpisodeSelections((previousSelections) => ({
      ...previousSelections,
      [normalizedLabel]: normalizedValue,
    }));

    if (normalizedValue === EPISODE_SELECT_HIDDEN) {
      setHiddenEpisodes((previousSet) => {
        const nextSet = new Set(previousSet);
        nextSet.add(normalizedLabel);
        return nextSet;
      });
      return;
    }

    setHiddenEpisodes((previousSet) => {
      if (!previousSet.has(normalizedLabel)) {
        return previousSet;
      }
      const nextSet = new Set(previousSet);
      nextSet.delete(normalizedLabel);
      return nextSet;
    });

    if (normalizedValue !== EPISODE_SELECT_ALL) {
      onSelectDocument?.(normalizedValue);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        border: embedded ? 0 : 1,
        borderColor: "divider",
        borderRadius: embedded ? 0 : 1,
        ...(embedded
          ? {
              display: "flex",
              flexDirection: "column",
              maxHeight: { xs: "none", lg: "none" },
              overflow: "hidden",
            }
          : {}),
      }}
    >
      <CardHeader
        title="Patient Document Timeline"
        titleTypographyProps={{ variant: "subtitle1", sx: { fontWeight: 700 } }}
        sx={{ py: 1, px: 1.5 }}
        action={
          chartModel.totalReports > 0 ? (
            <Typography
              variant="caption"
              sx={{
                display: "inline-block",
                mt: 0.9,
                mr: 0.75,
                px: 1,
                py: 0.25,
                borderRadius: 999,
                fontWeight: 600,
                bgcolor: "info.main",
                color: "#fff",
              }}
            >
              {chartModel.totalReports} doc{chartModel.totalReports !== 1 ? "s" : ""}
            </Typography>
          ) : null
        }
      />
      <Divider />
      <CardContent
        sx={{
          px: 1.5,
          py: 1.25,
          "&:last-child": { pb: 1.25 },
          ...(embedded
            ? {
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
              }
            : {}),
        }}
      >
        {chartModel.totalReports === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No documents were returned for this patient.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {chartModel.dateDiagnostics?.hasDateCollapse ? (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                All documents currently resolve to the same timestamp (
                {chartModel.dateDiagnostics.collapsedDateLabel || "unknown"}). Timeline points will stack
                vertically.
              </Alert>
            ) : null}

            {isCollapsedTimestampMode ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Document Episode Type:
                </Typography>
                {chartModel.episodes.map((episode) => (
                  <EpisodeFilterDropdown
                    key={episode.key}
                    episode={episode}
                    points={pointsByEpisode.get(episode.label) || []}
                    value={episodeSelections[episode.label] || EPISODE_SELECT_ALL}
                    onChange={handleEpisodeSelection}
                  />
                ))}
              </Stack>
            ) : null}

            {!isCollapsedTimestampMode ? (
              <>
                <Box
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    overflowX: "auto",
                    bgcolor: "background.paper",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    role="img"
                    aria-label="Patient document timeline chart"
                    viewBox={`0 0 ${chartModel.dimensions.svgWidth} ${chartModel.dimensions.svgHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                      width: "100%",
                      maxWidth: 1700,
                      minWidth: 900,
                      height: "auto",
                      display: "block",
                    }}
                  >
                    <desc>
                      Timeline chart showing one row per report type with clickable document points
                      positioned by report date.
                    </desc>

                    {chartModel.rows.map((row) => (
                      <g key={`row:${row.type}`}>
                        <line
                          x1={chartModel.dimensions.plotLeft}
                          y1={row.y}
                          x2={chartModel.dimensions.plotLeft + chartModel.dimensions.plotWidth}
                          y2={row.y}
                          stroke={alpha(AXIS_STROKE, 0.6)}
                          strokeWidth={1}
                        />
                        <text
                          x={chartModel.dimensions.plotLeft - 10}
                          y={row.y + 4}
                          textAnchor="end"
                          fill="#2f2f2f"
                          fontSize="13"
                          fontWeight="500"
                        >
                          {`${row.type} (${row.count}):`}
                        </text>
                      </g>
                    ))}

                    <line
                      x1={chartModel.dimensions.plotLeft}
                      y1={chartModel.dimensions.baselineY + 8}
                      x2={chartModel.dimensions.plotLeft + chartModel.dimensions.plotWidth}
                      y2={chartModel.dimensions.baselineY + 8}
                      stroke={alpha(AXIS_STROKE, 0.75)}
                      strokeWidth={1.2}
                    />

                    {chartModel.ticks.map((tick, tickIndex) => {
                      const isFirstTick = tickIndex === 0;
                      const isLastTick = tickIndex === chartModel.ticks.length - 1;
                      const tickLabelX = isFirstTick ? tick.x + 6 : isLastTick ? tick.x - 6 : tick.x;
                      const tickTextAnchor = isFirstTick ? "start" : isLastTick ? "end" : "middle";

                      return (
                        <g key={`tick:${tick.date.toISOString()}`}>
                          <line
                            x1={tick.x}
                            y1={chartModel.dimensions.baselineY + 8}
                            x2={tick.x}
                            y2={chartModel.dimensions.baselineY + 14}
                            stroke={alpha(AXIS_STROKE, 0.8)}
                            strokeWidth={1}
                          />
                          <text
                            x={tickLabelX}
                            y={chartModel.dimensions.baselineY + 28}
                            textAnchor={tickTextAnchor}
                            fill="#3e3e3e"
                            fontSize="11.5"
                          >
                            {tick.label}
                          </text>
                        </g>
                      );
                    })}

                    <text
                      x={chartModel.dimensions.plotLeft - 38}
                      y={chartModel.dimensions.baselineY + 30}
                      textAnchor="end"
                      fill="#2f2f2f"
                      fontSize="12"
                      fontWeight="600"
                    >
                      Date
                    </text>

                    {visiblePoints.map((point) => {
                      const isSelected = point.id === selectedDocumentId;
                      const isRelated = relatedIdSet.has(point.id);

                      return (
                        <g key={`point:${point.id}`}>
                          {isRelated && !isSelected ? (
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={7}
                              fill="none"
                              stroke={RELATED_STROKE}
                              strokeWidth={1.4}
                              strokeDasharray="2 2"
                              pointerEvents="none"
                            />
                          ) : null}

                          <circle
                            className="patient-timeline-point"
                            data-document-id={point.id}
                            data-episode={point.episodeLabel}
                            data-related={isRelated ? "true" : "false"}
                            data-selected={isSelected ? "true" : "false"}
                            cx={point.x}
                            cy={point.y}
                            r={isSelected ? 5.5 : 4.5}
                            fill={point.episodeColor}
                            fillOpacity={isSelected ? 0.95 : 0.72}
                            stroke={
                              isSelected ? "#101010" : isRelated ? RELATED_STROKE : alpha("#111", 0.55)
                            }
                            strokeWidth={isSelected ? 2 : isRelated ? 1.4 : 1}
                            tabIndex={0}
                            role="button"
                            aria-label={getPointAriaLabel(point)}
                            style={{ cursor: "pointer" }}
                            onClick={() => onSelectDocument?.(point.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onSelectDocument?.(point.id);
                              }
                            }}
                          >
                            <title>{getPointAriaLabel(point)}</title>
                          </circle>
                        </g>
                      );
                    })}
                  </svg>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Click a point to load that document. Use Tab + Enter/Space for keyboard selection.
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Timeline chart is hidden because all documents share one timestamp. Use the episode
                dropdowns to select documents.
              </Typography>
            )}

            {selectedPoint ? (
              <Tooltip title={selectedPoint.id} placement="top-start">
                <Typography variant="body2" sx={{ cursor: "default" }}>
                  <strong>Selected:</strong> {selectedPoint.name} • {selectedPoint.type} •{" "}
                  {selectedPoint.dateLabel}
                </Typography>
              </Tooltip>
            ) : null}

            {hiddenEpisodes.size > 0 ? (
              <Typography variant="caption" color="text.secondary">
                Hidden by episode filter: {chartModel.points.length - visiblePoints.length} document(s).
              </Typography>
            ) : null}

            {relatedIdSet.size > 0 ? (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Dashed-outline points are fact-linked documents derived from the selected cancer/tumor
                  fact.
                </Typography>
              </Box>
            ) : null}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

PatientDocumentsCard.propTypes = {
  timelineData: PropTypes.shape({
    reportData: PropTypes.arrayOf(PropTypes.object),
    reportTypes: PropTypes.arrayOf(PropTypes.string),
    episodeCounts: PropTypes.object,
  }),
  selectedDocumentId: PropTypes.string,
  relatedDocumentIds: PropTypes.arrayOf(PropTypes.string),
  onSelectDocument: PropTypes.func,
  embedded: PropTypes.bool,
};
