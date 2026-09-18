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

The chart opens showing the full range of the patient's events, padded by 50 days at both ends. It works the same way as the [Patient Document Timeline](document-timeline.md#zoom-into-a-date-range).

The **Date** strip beneath the chart is an overview of the full range. It never moves: its left and right dates stay fixed, and it draws a small copy of every mark, one row per lane. Two handles on it select the range the chart above shows.

- **Drag a handle** to move that end of the range. While zoomed in, each handle shows its date underneath. The handles cannot cross.
- **Drag the shaded window** to move the range, or **press the strip outside the window** to center the range there.
- Use the buttons above the chart to **zoom in**, **zoom out**, **pan earlier**, **pan later**, or **reset**. Each pan moves the range by a fifth of its length. Zoom goes up to 1600%.
- When zoomed in, **drag the chart** sideways to pan.
- With a mark focused, press `+` or `-` to zoom, `0` to reset, and `←` or `→` to pan. On a focused handle, `←` and `→` move it, and `Home` and `End` jump to either end.

Scrolling the mouse wheel over the chart scrolls the page; it does not zoom. Collapsing a lane, or switching **Showing**, keeps the current range.

The Event Timeline is **linked to the [Patient Document Timeline](document-timeline.md#linked-to-the-event-timeline)**. Both show the same date range, changing it in either one changes both, and their strips and date axes line up vertically, so an event sits directly below the documents written at the same time.

All dates on this chart are calendar dates, shown the same in every time zone.

## Collapse a lane

Select the caret at the right-hand end of a lane to fold it. A collapsed lane is replaced by a **density strip** — a band shaded from white to dark green showing where that lane's events cluster in time — so you keep a sense of the lane's activity without its rows.

Select the caret again to unfold it.

## Link a mark to the report text

Select a mark to select every concept it covers. The matching concepts are highlighted in the [Document Viewer](document-viewer.md)'s concept list, so you can read the sentence each one came from.

Selecting a concept in the Document Viewer works the other way too, and clearing it there clears it here. Select the mark again to deselect it.

Closing the document drawer keeps the current report selected. Use **Open report**
above the Event Timeline to reopen it and inspect the selected concepts.

Marks are reachable with the keyboard: **Tab** to a mark and press **Enter** or **Space** to select it.

## Show only the current report

The **Showing** control above the chart filters the timeline:

- **All Patient Events** — every temporal relation for the patient.
- **Filtered Patient Events** — only relations whose concepts appear in the report currently open in the Document Viewer.

The count beside the panel title tells you how many relations are in view.
The current report name appears above the chart. Filtering preserves the date
range so that the remaining events stay in the same positions. If a report has
no matching events, the Showing control remains available to return to all events.

:::note

The timeline draws only the four lanes above. A concept whose type falls outside them is not plotted, and the panel says how many were left out.

:::
