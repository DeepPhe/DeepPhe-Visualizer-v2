---
title: Understand cohort results
sidebar_label: Understanding results
---

# Understand cohort results

The Visualizer gives you several kinds of feedback as you build a cohort. This page explains each one.

## The toolbar patient count

The count beside the title is the size of your cohort:

- **All *N* patients** before any selection — the whole dataset.
- ***N* of *total* patients selected** once filters are active.

While a new result is being calculated the count **dims**, then brightens when it is ready.

![The toolbar showing an active "N of total patients selected" count](../assets/screenshots/end-user/identified-patients-summary.png)

## Counts inside filter cards

When no filters are active, a value shows its total patient count. Once other filters are active, a value can show two numbers:

```text
included / total
```

For example `12/40` means:

- **40** patients have that value in the broader data (the denominator), and
- **12** of those also satisfy your current criteria from other cards (the numerator).

This previews how a value relates to your current cohort *before* you select it. A value whose numerator is **0** is [disabled](selecting-filters.md#values-that-cant-add-anyone-are-disabled).

## In the Selected Patients drawer

The [Selected Patients drawer](selected-patients.md) adds more context:

- The **active-filter summary** above the drawer lists your current filter selections, each with a per-filter patient count.
- When the drawer is minimized, a **plain-language summary** describes the cohort — for example, *"7 asian female patients with breast cancer."*

Each filter matches patients **independently**; your cohort is the **intersection** of those matches. A value can match many patients on its own and still contribute to a small cohort once combined with other cards.

## When no patients match

If your criteria produce zero patients, the drawer explains *why*, in one of two ways:

{/* Uncomment once `zero-result-guidance.png` is captured & committed:
![The identified-patients panel explaining why a cohort is empty](../assets/screenshots/end-user/zero-result-guidance.png)
*/}

- **One filter matched nobody.** If a single filter matches 0 patients on its own, the Visualizer names that filter — for example, *"Grade matched 0 patients before intersection. Check spelling and selected values."* Review that filter's selected values.
- **The filters don't overlap.** If every filter matches patients on its own but their intersection is empty, the Visualizer explains that the filters have no overlap and suggests broadening one — *"Each filter matches patients independently, but their overlap is 0. Try broadening one filter."*

To recover, remove or broaden your most recent criterion, or use **Reset filters** to start over.

## Data availability

A missing filter, value, or finding does not necessarily mean a clinical fact is absent. It may reflect the loaded data, the extraction configuration, service availability, or terminology normalization.

:::caution

Do not treat an absent Visualizer value as a confirmed negative clinical finding without checking the source record.

:::
