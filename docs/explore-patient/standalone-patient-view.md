---
title: Standalone Patient View
sidebar_label: Standalone Patient View
---

# Standalone Patient View

The **Patient View** is a separate page for looking up one patient by ID. Reach it from **Home** → **Open Patient View**.

![The standalone Patient Lookup form with a Patient ID field, Load Patient, and Random](../assets/screenshots/end-user/standalone-patient-lookup.png)

## Look up a patient

1. In **Patient Lookup**, enter a **Patient ID**.
2. Select **Load Patient**.

Or select **Random** to load a randomly chosen patient — useful for demonstrations.

- A **Patient ID** is required; the button stays unavailable until you enter one.
- If the ID cannot be loaded, the page shows an error message. Check the ID and that the services can return that patient.

## After a patient loads

When the patient loads, the **most recent document is opened automatically** in the Document Viewer, so you start with the latest note.

The standalone view shows:

- **Patient demographics** — an overview panel.
- **[Cancer and Tumor Detail](cancer-tumor-detail.md)** — selectable cancer- and tumor-level facts.
- **[Patient Document Timeline](document-timeline.md)** — the patient's notes over time.
- **[Document Viewer](document-viewer.md)** — the selected note, with concept highlights and filters.

:::note Standalone versus embedded

The standalone Patient View does **not** include the structured **Patient Summary** card. For the Patient Summary and its source links, open the patient from the Cohort Explorer instead — see [View an individual patient](overview.md).

:::
