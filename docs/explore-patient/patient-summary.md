---
title: Patient Summary
sidebar_label: Patient Summary
---

# Patient Summary

The **Patient Summary** card gives a structured, at-a-glance overview of a patient and lets you jump from any finding to the note it came from. It appears in the [embedded patient view](overview.md) when the patient has summary data.

![The Patient Summary card with grouped findings and source-linked items](../assets/screenshots/end-user/patient-summary-card.png)

## What it groups

The card organizes findings into sections, shown when data is present:

- diagnoses;
- staging;
- grading;
- biomarkers;
- treatments;
- procedures;
- findings; and
- behavior.

Use the collapse/expand control in the card header to fold the card to a slim strip and back.

## Reading the indicators

Items are styled to convey clinical meaning:

- **Negated** items (findings recorded as absent) are struck through and dimmed, and read as "No …".
- **Historic** items appear muted.
- **Uncertain** and **Conflicted** items carry a small labeled chip.
- A **source** label notes where a value came from.

## Follow an item to its source note

An item that resolves to one or more source notes is shown as an **interactive link**:

- A **single-source** item opens its source note directly in the [Document Viewer](document-viewer.md).
- A **multi-source** item shows a **count** (for example, "(4)") and, when clicked, opens a **document picker** listing its sources.

In the picker:

- sources are **ranked by confidence**, highest first;
- the **highest-confidence** source is labeled;
- the note that is **currently open** is marked; and
- choosing a note opens it in the Document Viewer.

![The multi-source document picker, ranked by confidence](../assets/screenshots/end-user/patient-summary-source-picker.png)

Selecting the same **single-source** item again clears the selection and closes its note.

:::note

Not every summary item has a resolvable source note. Items that cannot be tied to a note are shown as plain text rather than links.

:::
