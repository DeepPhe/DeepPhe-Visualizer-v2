---
title: Cohort Explorer overview
sidebar_label: Overview
---

# Cohort Explorer overview

The **DeepPhe Patient Cohort Explorer** presents available patient characteristics as filter cards. Each card contains values and patient counts.

![Cohort Explorer overview](../assets/screenshots/end-user/cohort-explorer-overview.png)

## Main areas

1. **Page toolbar** — return Home, reset filters, and adjust display or accessibility preferences.
2. **Filter sections** — related filters grouped under headings such as Patient, Cancer Type & Primary Site, Staging & Disease Extent, and Treatment & Interventions.
3. **Filter cards** — selectable values with bars and counts.
4. **Selected Patients drawer** — the matching cohort and patient-level details. It appears after the first filter is selected.

## How filtering works

- Values selected in the **same filter** are alternatives. Selecting `Stage II` and `Stage III`, for example, includes patients matching either value.
- Selections from **different filters** narrow the cohort together. Selecting `Stage III` and `Female` requires both criteria.
- The selected-patient count and the counts shown in other cards update as the cohort changes.
- **Reset filters** clears every active selection.

The exact cards available depend on the data returned by the configured DeepPhe services.

## Recommended workflow

1. Start with a broad characteristic, such as cancer type.
2. Add staging, pathology, biomarker, or treatment criteria.
3. Watch the matching count after each selection.
4. Review patients in the drawer.
5. Export the relevant loaded page or open individual patients for closer review.
