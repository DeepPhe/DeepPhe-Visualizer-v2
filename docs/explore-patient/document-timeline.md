---
title: Patient Document Timeline
sidebar_label: Patient Document Timeline
---

# Patient Document Timeline

The **Patient Document Timeline** plots a patient's notes over time so you can pick the one you want to read.

## Read the timeline

- **Report types** are arranged as **rows** (for example, pathology, clinical notes).
- Each **document** is a point positioned by its **date**.
- **Episode colors** group documents that belong to the same care episode.
- A **document count** near the heading shows how many notes the patient has.

## Open a document

- **Click a point** to open that document in the [Document Viewer](document-viewer.md).
- With the keyboard, move focus to a point and press **Enter** or **Space**.
- The **currently open** document is drawn as a larger point with a ring around it, so you can see where you are.
- Points for documents linked to a selected [cancer or tumor fact](cancer-tumor-detail.md) or a [Patient Summary](patient-summary.md) item are drawn with **dashed outlines**.

## When dates collapse

Sometimes a dataset does not carry usable, distinct timestamps — for example, when every note resolves to a single date. When that happens, the ordinary date-positioned timeline is replaced by **episode dropdowns**:

- Each episode has a dropdown labeled with the episode and its document count.
- **Show all documents** keeps every document in that episode visible.
- **Hide this episode** removes that episode's documents from view; the timeline reports how many documents are hidden.
- Choose a specific document from the dropdown to open it.

:::note

The episode-dropdown controls appear **only** when timestamps collapse. Most patients show the ordinary date-positioned timeline.

:::
