---
title: Build your first cohort
sidebar_label: First cohort
---

# Build your first cohort

This walkthrough creates a cohort using the Filters screen.

## 1. Choose a starting filter

Find a filter card such as **Cancer**, **Age at Dx**, or **Stage**. Select a value by clicking its bar or label.

![Age at diagnosis filter](../assets/screenshots/end-user/age-at-diagnosis-filter.png)

The card header changes to show the number of selected values.

## 2. Add another criterion

Select a value in another filter. Different filters combine to narrow the cohort.

For example:

- Cancer: `Breast`
- Stage: `Stage II`
- Gender: `Female`

This describes patients matching the selected cancer, stage, and gender criteria.

## 3. Check the result

The **Selected Patients** drawer appears at the bottom of the window. Its count shows the current cohort size.

![Active filter selection](../assets/screenshots/end-user/active-filter-selection.png)

If the result reaches zero, the drawer explains why — see [Understand cohort results](../cohort-explorer/understanding-results.md#when-no-patients-match). Remove one of the recent selections or use **Reset filters** to start over.

## 4. Review matching patients

Expand the Selected Patients drawer to inspect the current page. You can search the loaded rows, sort columns, change visible columns, expand a row for detail, and open a patient. See [The Selected Patients table](../cohort-explorer/patients-table.md).

## 5. Save the current page

Use the CSV download button in the patient table. The export contains the currently loaded, filtered, and sorted rows and the columns that are visible.

For details, see [Export results](../cohort-explorer/exporting-results.md).
