---
title: Event Timeline
sidebar_label: Event Timeline
---

# Event Timeline

The **Event Timeline** plots a patient's extracted concepts against the dates they relate to, so you can see when findings, diseases, stage and grade values, and treatments occurred relative to one another.

It appears in both the embedded and the [Standalone Patient View](standalone-patient-view.md) for patients that have temporal relation data.

## How the chart is organised

Events are grouped into four lanes, labelled on the left with the number of marks in each:

- **Finding**;
- **Disease**;
- **Stage, Grade**; and
- **Treatment**.

Within a lane, marks are packed onto as few rows as possible — two events share a row when their date ranges do not overlap. A row is not a single concept, so hover a mark to read which concepts it covers.

Where several concepts in the same lane share exactly the same start and end date, they are drawn as **one mark**. The tooltip lists every concept it stands for, with a `(xN)` count when a name repeats.

## Reading a mark

The shape of each end tells you how precisely the date is known:

| End | Meaning |
| --- | --- |
| Vertical bar | **On** — the event falls on that date |
| Open end (no cap) | **Overlaps** — the event extends beyond the date shown |
| Arrow pointing right | **After** — the event occurred some time after that date |
| Arrow pointing left | **Before** — the event occurred some time before that date |

The legend above the chart shows each of these.

Marks are **green**. A **red** mark means the concept is **negated** — the note records its absence, not its presence. Colour is not the only cue: the tooltip and the screen-reader label both state the negation, and the relation and dates are given in words.

Dashed vertical guidelines mark every date that carries an event, so you can line marks up across lanes.

## Patient Age axis

Below the chart, the **Patient Age** axis shows the patient's age at each end of the visible date range, with a tick at each birthday in between.

:::note

The age axis only appears when the patient's date of birth is known. When it is not, the axis is omitted rather than estimated.

:::

## Change the date range

The chart opens showing the full range of the patient's events, padded slightly at both ends.

- **Scroll** over the chart to zoom the date axis in and out.
- **Drag** on the **Date** band beneath the chart to select a narrower window.

The two stay in step: zooming moves the band, and dragging the band rescales the chart.

## Collapse a lane

Select the caret at the right-hand end of a lane to fold it. A collapsed lane is replaced by a **density strip** — a band shaded from white to dark green showing where that lane's events cluster in time — so you keep a sense of the lane's activity without its rows.

Select the caret again to unfold it.

## Link a mark to the report text

Select a mark to select every concept it covers. The matching concepts are highlighted in the [Document Viewer](document-viewer.md)'s concept list, so you can read the sentence each one came from.

Selecting a concept in the Document Viewer works the other way too, and clearing it there clears it here. Select the mark again to deselect it.

Marks are reachable with the keyboard: **Tab** to a mark and press **Enter** or **Space** to select it.

## Show only the current report

The **Showing** control above the chart filters the timeline:

- **All Patient Events** — every temporal relation for the patient.
- **Filtered Patient Events** — only relations whose concepts appear in the report currently open in the Document Viewer.

The count beside the panel title tells you how many relations are in view.

:::note

The timeline draws only the four lanes above. A concept whose type falls outside them is not plotted, and the panel says how many were left out.

:::
