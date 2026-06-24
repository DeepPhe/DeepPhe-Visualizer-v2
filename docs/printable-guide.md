---
title: Printable quick guide
sidebar_label: Printable Guide
description: A concise printable workflow for the DeepPhe Patient Cohort Explorer.
---

# DeepPhe Patient Cohort Explorer

This guide follows the three core features in order: **build a cohort**, **review patient results**, then **explore an individual patient**.

![Patient Cohort Explorer](assets/screenshots/end-user/cohort-explorer-overview.png)

## 1. Build a cohort

1. Find a filter card and select a value.
2. Add values from the same filter as alternatives.
3. Add selections from different filters to narrow the cohort.

Filtering rules:

- Multiple values in one filter mean **value A or value B**.
- Different filters mean **filter A and filter B**.
- Select an active value again to remove it.
- Select **Reset filters** to clear the cohort.

An unfiltered value normally shows its total count. After criteria are active, another value may display `included/total`, showing how many patients with that value remain in the current cohort.

![Active filter selection](assets/screenshots/end-user/active-filter-selection.png)

<div className="print-page-break" />

## 2. Review patient results

Check the count in the Selected Patients drawer, then expand it to review the loaded patient page. The drawer supports search, sorting, column visibility, pagination, row expansion, and patient tabs. Patient search applies to the currently loaded page.

![Selected Patients drawer](assets/screenshots/end-user/selected-patients-drawer.png)

## 3. Explore an individual patient

Open a single patient with **Show in Document Viewer** when source-level context is needed, or select a **patient dot** on any filter bar to open that patient directly (hovering a dot previews its summary). The patient opens as a tab inside the drawer, showing demographics, cancer and tumor summaries, the document timeline, source text with concept overlays, and a structured Patient Summary Card when the data is available.

![Embedded patient view](assets/screenshots/end-user/embedded-patient-view.png)

## Export

The CSV download includes the currently loaded page after its search and sort are applied. Only visible columns are included.

## Important limitations

- Available filters depend on the loaded dataset and service configuration.
- Extracted concepts may require validation against source documents.
- An absent value is not automatically a confirmed negative clinical fact.
- Exported files may contain patient-identifying information and must be handled appropriately.
