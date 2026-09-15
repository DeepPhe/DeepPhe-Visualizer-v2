# Local mock API

Serves the DeepPhe data API from the fixtures vendored in `mock-api/fixtures/`
(7 patients, copied byte-for-byte from `DeepPhe-Viz-v2-alpha/public/docs/`) plus
`public/data/demographics/patient_demographics.json`. No sibling checkout is
required; set `FIXTURE_DIR` to serve from elsewhere.

```bash
npm run mock-api      # http://localhost:3333
npm start             # the app expects the API on 3333
```

## Repeatable timeline demo

Start Docker Desktop, then run from the repository root:

```bash
npm run demo
```

This rebuilds the app on port **3002** and starts the matching mock API on
**3333**. Both containers stay running after the terminal closes. Port 3333
must be free; stop any separately running API before using this setup.

Open [fake_patient1](http://localhost:3002/patient?patientId=fake_patient1).
The newest report opens automatically. Close its drawer to see both timelines.

Suggested demo walkthrough:

1. Show the **10 documents** in Patient Document Timeline.
2. Show **34 spans from 56 relations** in Event Timeline: Finding 5, Disease 5,
   Stage/Grade 6, Treatment 18. Grouped marks represent multiple concepts.
3. Hover a mark for its concept names, exact dates, and relation types.
4. Zoom with the mouse wheel or drag the Date band. Collapse and expand a lane,
   then the whole card; the selected range should remain intact.
5. Open the first radiology report in the Document Timeline, then close its
   drawer. Choose **Filtered Patient Events** to see **12 relations**. The
   current report name is displayed, and the date axis stays in place. Return
   to **All Patient Events**. (The newest report contains concepts for all 56
   relations, so filtering to that report does not reduce the count.)
6. Select a mark (or Tab to it and press Enter/Space), then **Open report** to
   inspect its concepts in the current report. Events can refer to concepts
   absent from that report; use the report filter when demonstrating the link.

The age axis is calculated from the fixture birth date, **1960-04-01**.
Only `fake_patient1` currently has the static Event Timeline dataset.

## Why not the real data API?

`dphe-data-api` ships a different ingest of the same fake patients, so its
concept ids don't match the ones in `public/data/event-timelines/fake_patient1.tsv`:

| | |
|---|---|
| TSV / alpha fixtures | `fake_patient1_30072025201756_C_*` |
| dphe-data-api fixture | `fake_patient1_30062026210318_C_*` |

The numbering doesn't correspond either — `C_35` is *Estrogen Receptor Status*
in the alpha fixtures and *N2* in the data-api one — so the ids can't simply be
rewritten. Against the real API the Event Timeline matches 0 of 56 relations and
renders empty.

Until the TSV is re-derived against the data-api database, the Event Timeline
can only be exercised against these fixtures.

## What it serves

- `GET /openapi.json` — the real API's spec, captured verbatim; the client
  discovers endpoints from it before calling anything.
- `GET /v1/deepphe-api/deepphe/patient/:id` and `/documents`, `/documents/episodes`,
  `/cancers`, `/concepts`
- `POST /v1/deepphe-api/deepphe/filter/summary`
- `GET /v1/deepphe-api/omop/summary`, `/deepphe/{attributes,cancers,concepts}/summary`
  and their `/classes` variants — rolled up from the same fixtures, so the cohort
  view and the patient view always agree.

Unmocked routes return 404 with the method and path, so gaps are obvious.
