// Event relation timeline constants.
//
// Ported from DeepPhe-Viz-v2-alpha
// (src/components/Charts/EventRelationTimeline/timelineConstants.js).
// Layout values are kept at the alpha's numbers so the chart lays out identically.

export const FAKE_PATIENT_EVENT_TIMELINE_ID = "fake_patient1";

export const EVENT_RELATION_TIMELINE_ASSET_PATH =
  "/data/event-timelines/fake_patient1.tsv";

export const PATIENT_DEMOGRAPHICS_ASSET_PATH =
  "/data/demographics/patient_demographics.json";

export const EVENT_RELATION_TIMELINE_SCOPE_ALL = "all";
export const EVENT_RELATION_TIMELINE_SCOPE_CURRENT_REPORT = "current-report";

// Domain mapping ----------------------------------------------
// dpheGroup (lowercased) -> lane group label.
export const LANE_GROUPS = Object.freeze({
  behavior: "Stage, Grade",
  "disease stage qualifier": "Stage, Grade",
  "disease grade qualifier": "Stage, Grade",
  "temporal qualifier": "Stage, Grade",
  severity: "Stage, Grade",
  "pathologic tnm finding": "Stage, Grade",
  "generic tnm finding": "Stage, Grade",

  finding: "Finding",
  "clinical test result": "Finding",
  gene: "Finding",
  "gene product": "Finding",

  "disease or disorder": "Disease",
  neoplasm: "Disease",
  mass: "Disease",

  "pharmacologic substance": "Treatment",
  "chemo/immuno/hormone therapy regimen": "Treatment",
  "intervention or procedure": "Treatment",
  "imaging device": "Treatment",

  unknown: "Other",
});

// Lane groups that are actually drawn, in draw order (alpha: `desiredOrder`).
export const LANE_GROUP_ORDER = Object.freeze([
  "Finding",
  "Disease",
  "Stage, Grade",
  "Treatment",
]);

export const UNCATEGORIZED_LANE_GROUP = "Uncategorized";

// The four temporal relations the TSV may carry.
export const TEMPORAL_RELATIONS = Object.freeze(["On", "Overlaps", "After", "Before"]);

// Layout -------------------------------------------------------
export const PADDING = Object.freeze({ top: 15 });

export const MARGINS = Object.freeze({ top: 5, right: 20, bottom: 5, left: 200 });

export const ARROW = Object.freeze({ width: 20, LabelGap: 5, labelPadding: 10 });

export const LEGEND = Object.freeze({
  height: 40,
  spacing: 2,
  anchorX: 40,
  anchorY: 6,
});

export const TEXT = Object.freeze({
  widthPerLetter: 12,
  marginLeft: 10,
  mainRowHeight: 10,
  overviewRowHeight: 3,
});

export const TIMESPAN = Object.freeze({ padding: 8 });

export const LANE = Object.freeze({ height: 15, GROUP_TOP_PADDING: 10 });

// The overview strip's own height comes from computeOverviewStripLayout in
// utils/patientView/timelineViewport.js, shared with the document timeline.
// This is only the space above it, clear of the age axis's guidelines.
export const OVERVIEW_TOP_GAP = 8;

export const AGE_AREA = Object.freeze({ height: 10, bottomPad: 10 });

export const GAPS = Object.freeze({ legendToMain: 5, pad: 25 });

// Chart coordinates still reserve MARGINS.top and LEGEND.height for the alpha's
// in-SVG legend, which is now HTML above the chart. The viewBox starts this far
// down to trim most of that empty band.
export const VIEWBOX_TOP = 20;

export const TIMELINE_PADDING_DAYS = 50;

// Right-hand gutter the alpha subtracts from the container to get the plot width.
export const PLOT_RIGHT_GUTTER = 25;

// Colors -------------------------------------------------------
// The alpha colors every mark green and reserves red for negation; lane group
// is conveyed by the row label, never by color.
export const RELATION_COLOR = "rgb(49, 163, 84)";
export const NEGATED_RELATION_COLOR = "rgb(255, 0, 0)";
export const COLLAPSED_CAP_COLOR = "rgb(128, 128, 128)";
export const SELECTED_OUTLINE_COLOR = "black";
export const DATE_ANCHOR_COLOR = "#d3d3d3";
export const HEATMAP_RANGE = Object.freeze(["#ffffff", "#006d2c"]);
export const HEATMAP_BIN_COUNT = 100;

// Age axis -----------------------------------------------------
// The alpha hardcoded `encounterAges = [53, 56]` with the note "replace with
// dynamic calculation when ready". Ages are now derived from the patient's date
// of birth, and the axis is omitted when no birth date is known rather than
// showing an age that contradicts the record.
