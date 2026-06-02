# Patient Details Coverage

This section verifies the `Patient Details` table area and required controls.

## Overview

![Patient Details overview](assets/screenshots/22-patient-details-overview.png)
*Figure 22. Patient details table shell with search, column chooser, export action, and table headers.*

## Required Controls

- Search input placeholder: `Search patient details...`
- Button `aria-label`: `Toggle visible patient columns`
- Button `aria-label`: `Export filtered cohort rows to CSV`

![Patient Details column chooser](assets/screenshots/23-patient-details-column-menu.png)
*Figure 23. Column chooser menu opened, including the `Toggle all columns` option.*

## Table Header Coverage

Expected headers reviewed in capture set:

- `Patient ID`
- `Age at Dx`
- `Gender`
- `Race`
- `Ethnicity`
- `Cancer Type`
- `Stage`
- `Grade`
- `Active Dx`
- `Diagnoses`
- `Biomarkers`
- `Treatments`
- `Procedures`
- `Key Findings`

## Expanded Row Sections

Required expanded section labels:

- `Diagnoses`
- `Staging`
- `Grading`
- `Biomarkers`
- `Treatments`
- `Procedures`
- `Findings`
- `Behavior`

![Expanded patient row details](assets/screenshots/24-patient-details-expanded-row.png)
*Figure 24. Expanded row state displaying detailed clinical sections when available.*

## Empty Search State

![Patient Details empty search state](assets/screenshots/25-patient-details-empty-search.png)
*Figure 25. Empty-result confirmation text: `No patients match your search.`*

## Embedded Patient View

Clicking **Show in Document Viewer** on an expanded patient row opens the embedded patient tab in the floating drawer. The drawer renders the full patient detail experience inline without leaving the filters page.

![Embedded patient view drawer](assets/screenshots/32-embedded-patient-drawer.png)
*Figure 32. Patient drawer expanded with embedded view: demographics bar, Cancer and Tumor Summary, document timeline, and (when available) Patient Summary Card.*

### Patient Summary Card

The Patient Summary Card appears alongside the Cancer and Tumor Summary when the backend provides structured summary data for the patient. It groups NLP-extracted phenotypes into labelled sections (Diagnoses, Staging, Grading, Biomarkers, Treatments, Procedures, Findings, Behavior). Uncertain or conflicted values carry inline badges.

![Patient Summary Card](assets/screenshots/33-patient-summary-card.png)
*Figure 33. Patient Summary Card showing clinical concept groups with negated, uncertain, and conflicted value badges.*
