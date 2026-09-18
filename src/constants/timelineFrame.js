// Horizontal frame shared by the patient timelines.
//
// The Patient Document Timeline and the Event Timeline stack in one column and
// share one date range, so a date must land at the same x in both, and so must
// their overview strips and handles. Both cards pad their content by
// TIMELINE_CONTENT_PADDING_X, and both plots start and end TIMELINE_PLOT_INSET
// pixels inside that padding. Each card subtracts its own chrome (the document
// chart's border) to get its SVG gutters.
//
// Alignment holds from COMPACT_TIMELINE_WIDTH up. Below it the document timeline
// moves its lane labels above the lanes and the Event Timeline has no narrow
// layout, so the two stay linked but no longer line up.

// Theme spacing units, for CardContent `px`.
export const TIMELINE_CONTENT_PADDING_X = 1;

// Pixels from the content edge to the plot. The left inset fits the longest
// lane label ("Surgical Pathology Report (4):"); the right one fits the Event
// Timeline's lane collapse chevrons.
export const TIMELINE_PLOT_INSET = Object.freeze({ left: 237, right: 26 });

// The document chart sits in a box with a 1px border; the Event chart has none.
export const DOCUMENT_CHART_BORDER_WIDTH = 1;

export const COMPACT_TIMELINE_WIDTH = 620;
