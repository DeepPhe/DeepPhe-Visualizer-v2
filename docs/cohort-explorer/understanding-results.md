---
title: Understand cohort results
sidebar_label: Understanding results
---

# Understand cohort results

## Matching-patient count

After you select a filter, the Selected Patients drawer shows the number of matching patients.

![Identified patients summary](../assets/screenshots/end-user/identified-patients-summary.png)

The count updates when criteria are added or removed. While a request is running, the drawer indicates that the cohort is being updated.

## Counts inside filter cards

When no filters are active, a value usually shows its total patient count.

After filters are active, other cards can show:

```text
included/total
```

For example, `12/40` means:

- 40 patients have that value in the broader data; and
- 12 of those patients also satisfy the current criteria from other filters.

This lets you preview how a value relates to the current cohort before selecting it.

## Patient dots

When a filter value matches a small number of patients, each patient appears as a **dot** on that value's bar.

- **Hover** a dot to preview that patient's summary without leaving the screen.
- **Select** a dot to open that patient's document view as a tab in the Selected Patients drawer. This works even when no filters are active and does not change the current cohort.

See [View an individual patient](viewing-a-patient.md) for what the document view contains.

## Zero results

If no patients satisfy the selected criteria:

1. review the most recent selection;
2. remove one restrictive value;
3. broaden alternatives within the same filter; or
4. select **Reset filters**.

## Data availability

A missing filter or value does not necessarily mean the clinical fact is absent. It may reflect the loaded data, extraction configuration, service availability, or terminology normalization.

:::caution

Do not treat an absent Visualizer value as a confirmed negative clinical finding without checking the source record.

:::
