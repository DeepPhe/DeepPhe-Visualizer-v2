---
title: Patient dots
sidebar_label: Patient dots
---

# Patient dots

When a filter value represents a **small** group, the Visualizer draws one **dot per patient** on that value's row instead of a single solid bar. Dots let you preview and open individual patients without changing your cohort.

![The Age at Dx card showing rows of individual patient dots](../assets/screenshots/end-user/age-at-diagnosis-filter.png)

## When dots appear

Dots appear only when **both** are true:

- the value represents **20 or fewer** patients, and
- patient IDs are available for that value.

A value above the threshold stays a normal proportional bar. The **Bars behind dots** toolbar control adds a faint bar behind the dots for scale while keeping the dots visually dominant; this preference is stored by your browser.

## Hover a dot to preview a patient

Point at a dot to open a **patient summary** tooltip. Depending on the available data, the summary can include diagnoses, stage, biomarkers, treatments and procedures, findings, ruled-out diagnoses, uncertainty flags, and a note count. Hovering never changes your cohort.

## Click a dot to open a patient

What a click does depends on **where** the dot is:

- **On a main Cohort Explorer card** — clicking a dot opens that patient as a **tab in the Selected Patients drawer**. This works even when no filters are active, and it does **not** select the filter value or change the cohort.
- **In the [Filter Details dialog](filter-details.md)** — clicking a dot **pins** the summary in place so you can read it. It does not open a patient tab.

:::note

Clicking a patient dot never selects the filter value. To narrow the cohort, click the value's label or bar instead — see [Select and combine filters](selecting-filters.md).

:::

Continue with [Explore a patient](../explore-patient/overview.md) to see what opens when you open a patient tab.
