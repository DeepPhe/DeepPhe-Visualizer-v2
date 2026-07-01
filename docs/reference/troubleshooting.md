---
title: Troubleshooting
sidebar_label: Troubleshooting
---

# Troubleshooting

## The page has no filter cards

- Confirm the DeepPhe Data API is running and the Visualizer points at the correct location.
- Check that the API returns cohort, attribute, or concept summaries.
- Reload the page after the services are available.

## A filter I expected is missing

Cards appear only when their data is present in the loaded dataset. Check the pipeline output and the API summary response. See [Filter categories](filter-categories.md).

## A value is dimmed and I can't select it

That value's in-cohort (numerator) count is **0** — selecting it would empty the cohort, so it is disabled. Remove or broaden another criterion to bring it back. A value you already selected is never disabled. See [Select and combine filters](../cohort-explorer/selecting-filters.md#values-that-cant-add-anyone-are-disabled).

## The cohort count stays at zero

The drawer explains why: either one filter matched nobody on its own, or the filters match separately but do not overlap. Broaden or remove your most recent criterion, or use **Reset filters**. See [Understand cohort results](../cohort-explorer/understanding-results.md#when-no-patients-match).

## The count won't finish updating

Wait for the current request to finish (the count dims while it updates). If it does not complete, check API connectivity, reload the page, and reduce the number of active criteria.

## Patient details don't load

The cohort count can be ready before patient details finish loading. Use **Retry** in the table. If it keeps failing, confirm the API can return patient summaries for the listed IDs.

## Search can't find a patient

Table search applies to the **currently loaded page** only. Move to the page that contains the patient before searching. See [The Selected Patients table](../cohort-explorer/patients-table.md#search-the-loaded-page).

## The CSV has fewer patients than my cohort

CSV export includes the **currently loaded page** only, after its search and sort, and only the visible columns. Export each page you need. See [Export results](../cohort-explorer/exporting-results.md).

## Patient dots aren't showing

Dots appear only for values representing **20 or fewer** patients **and** only when patient IDs are available. Larger values stay solid bars. See [Patient dots](../cohort-explorer/patient-dots.md).

## A patient section is missing

Sections are omitted when their supporting data is unavailable. For example, the standalone Patient View never shows the Patient Summary, and any section is dropped when a patient has no data for it. See [View an individual patient](../explore-patient/overview.md).

## The Document Viewer shows no highlights

If the note arrived without its full text, the viewer says so and cannot draw concept overlays, because the highlights need the note's text. See [Use the Document Viewer](../explore-patient/document-viewer.md#when-a-note-has-no-text).

## A Patient Summary item isn't clickable

Items appear as links only when they resolve to a source note. An item that could not be tied to a note is shown as plain text. See [Patient Summary](../explore-patient/patient-summary.md).

## The timeline shows dropdowns instead of a chart

When a dataset lacks usable distinct timestamps, the timeline falls back to per-episode dropdowns (**Show all documents**, **Hide this episode**, and a document list). This is expected for such data. See [Patient Document Timeline](../explore-patient/document-timeline.md#when-dates-collapse).
