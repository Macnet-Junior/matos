# Privacy retention, export, and deletion

These controls are scaffolds. A human still reviews a request before it is completed.

## Retention

| Record | Days |
|---|---|
| Content metrics | 365 |
| Activity | 180 |
| Publications | 730 |
| Privacy requests | 30 |

`retentionCutoff()` computes the boundary from that table. Automatic purges are not scheduled in this scaffold.

## Export

`POST /api/ops/privacy` with `{ "action": "export", "subjectEmail": "..." }` requires Ops manage permission. The export includes Desk jobs created by that email and strips fields whose names look like tokens, secrets, or credentials. Provider error strings are redacted.

## Deletion

`POST /api/ops/privacy` with `{ "kind": "deletion", "subjectEmail": "..." }` records a pending `PrivacyRequest`. Completing it with `{ "action": "complete", "requestId": "..." }` deletes Desk jobs created by that subject email and marks the request completed. It does not delete shared skills, knowledge files, or other people's content.

## Metrics

Metric ingestion and CSV/JSON import reject private audience fields such as email, phone, IP, tokens, and raw comments. Imports are capped at 500 rows.
