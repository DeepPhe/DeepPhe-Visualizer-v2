# Local mock API

Serves the DeepPhe data API from the fixtures vendored in `mock-api/fixtures/`
(7 patients, copied byte-for-byte from `DeepPhe-Viz-v2-alpha/public/docs/`) plus
`public/data/demographics/patient_demographics.json`. No sibling checkout is
required; set `FIXTURE_DIR` to serve from elsewhere.

```bash
npm run mock-api      # http://localhost:3333
npm start             # the app expects the API on 3333
```

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
