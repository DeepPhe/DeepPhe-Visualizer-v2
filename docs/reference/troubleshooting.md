---
title: Troubleshooting
---

# Troubleshooting

## The page has no filter cards

- Confirm that the DeepPhe Data API is running.
- Confirm the Visualizer is configured for the correct API location.
- Check whether the API returns OMOP, attribute, or concept summaries.
- Reload the page after the services are available.

## A filter I expected is missing

Filters appear only when their classes are available in the loaded data. Check the pipeline output and API summary response.

## The cohort count remains at zero

Remove the latest criterion or use **Reset filters**. Values from different filters combine and can produce a very restrictive cohort.

## Counts do not finish updating

Wait for the current request to complete. If it does not:

- verify API connectivity;
- reload the page;
- reduce the number of active criteria; and
- report any error message shown in the interface.

## Patient details do not load

The cohort count can be available before patient summaries finish loading. Retry the page from the drawer. If the problem continues, verify that the API can return patient summaries for the listed IDs.

## Patient search cannot find a patient on another page

The search field applies to the currently loaded page. Navigate to the relevant page before searching.

## CSV contains fewer patients than the cohort count

CSV export contains the currently loaded page, not every page in the cohort. It also respects the table search and visible columns.
