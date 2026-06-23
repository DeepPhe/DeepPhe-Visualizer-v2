---
title: Printable quick guide
sidebar_label: Printable Guide
description: A concise printable workflow for the DeepPhe Patient Cohort Explorer.
---

# DeepPhe Patient Cohort Explorer

## Quick workflow

1. Find a filter card and select a value.
2. Add values from the same filter as alternatives.
3. Add selections from different filters to narrow the cohort.
4. Check the count in the Selected Patients drawer.
5. Expand the drawer and review the loaded patient page.
6. Open an individual patient when source-level context is needed.
7. Choose visible columns and export the current page to CSV.

![Patient Cohort Explorer](assets/screenshots/end-user/cohort-explorer-overview.png)

## Filtering rules

- Multiple values in one filter mean **value A or value B**.
- Different filters mean **filter A and filter B**.
- Select an active value again to remove it.
- Select **Reset filters** to clear the cohort.

## Read the counts

An unfiltered value normally shows its total count. After criteria are active, another value may display `included/total`, showing how many patients with that value remain in the current cohort.

![Active filter selection](assets/screenshots/end-user/active-filter-selection.png)

<div className="print-page-break" />

## Review selected patients

The drawer supports search, sorting, column visibility, pagination, row expansion, and patient tabs.

![Selected Patients drawer](assets/screenshots/end-user/selected-patients-drawer.png)

Patient search applies to the currently loaded page.

## Export

The CSV download includes the currently loaded page after its search and sort are applied. Only visible columns are included.

## Important limitations

- Available filters depend on the loaded dataset and service configuration.
- Extracted concepts may require validation against source documents.
- An absent value is not automatically a confirmed negative clinical fact.
- Exported files may contain patient-identifying information and must be handled appropriately.
