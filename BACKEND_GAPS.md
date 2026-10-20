# BROKA Admin backend gaps and release blockers

**Inspected backend:** `Broka254/broka` at commit `e79a364`, domain
`backend/api/domains/service_communications`.

**Scope:** no backend file was modified in this remediation. The items below are
integration blockers that must be fixed, tested, and deployed in the backend
repository before the corresponding guarantees can be claimed in this admin app.

## Release blockers

### 1. Draft creation is not idempotent on the server

The admin client sends `X-Idempotency-Key`, and the server-side admin proxy
forwards it. The frontend also reuses one key for retries of the same logical
payload and blocks duplicate in-flight submissions. Those are client request
identity controls, **not server-side deduplication**.

Evidence from the inspected backend:

- `POST /admin/communications` is handled by the draft creation handler at
  `backend/api/domains/service_communications/router.py:612`.
- That handler accepts the communication body, authenticated admin, and database
  session; it does not read, persist, scope, or replay an idempotency key.
- The frontend therefore cannot guarantee that a timeout plus retry creates one
  draft, and it cannot guarantee that concurrent identical requests converge.

Required backend behavior:

1. Require and validate an idempotency key for draft creation.
2. Scope the key to the authenticated actor and the create-draft operation.
3. Persist a request fingerprint and result (or a concurrency-safe reservation)
   in durable storage.
4. Reject reuse of the key with a different payload.
5. Return the original result for a valid replay, including concurrent identical
   requests, without creating a second draft.
6. Cover replay, conflicting-payload reuse, and concurrent submission in backend
   tests.

Until that exists, the dashboard must not call draft creation idempotency-safe.
No browser-only registry is used as a substitute for this guarantee.

### 2. `confirmed_delivered` is not device-delivery evidence

The backend records an in-app-only recipient as `status="delivered"` once the
announcement is available in the authenticated feed. The delivery summary then
sets `confirmed_delivered` to the count of recipient rows whose status is
`delivered`.

Evidence from the inspected backend:

- In-app-only delivery is written as `delivered` in
  `backend/api/domains/service_communications/service.py:822-836`.
- The summary maps `confirmed_delivered` directly to
  `by_status["delivered"]` in
  `backend/api/domains/service_communications/router.py:446-475`.
- FCM provider acceptance is a separate recipient status and does not prove that
  a device displayed a notification.

Required backend correction:

- Keep in-app publication/availability, provider acceptance, in-app read
  acknowledgement, and device acknowledgement as distinct states.
- Derive a device-confirmed metric only from evidence that actually proves device
  display or receipt.
- Rename or remove `confirmed_delivered` so a misleading label cannot be rendered
  by another client.
- Add contract fixtures for in-app-only, provider-accepted, read, failed, and
  device-confirmed outcomes.

The admin dashboard hides the confirmed-device metric as **Unavailable** and
labels the backend `delivered` status as “In-app available / device unverified”.
It does not substitute a different statistic under the old label.

### 3. Delivery completion is conflated with incident resolution

The delivery worker automatically marks any published communication
`completed` when no recipient rows remain queued, sending, or retry-scheduled. It
does not check whether an incident is operationally resolved.

Evidence from the inspected backend:

- `complete_published_communications()` in
  `backend/api/domains/service_communications/service.py:1048-1065` updates all
  published communications with terminal recipient rows to `completed`.
- Recipient delivery settlement is therefore used as the incident communication's
  completion trigger, even though delivery success is unrelated to incident
  resolution.
- The manual `POST /admin/communications/{id}/complete` endpoint also completes a
  communication; it is not an incident-resolution record.

Required backend correction:

- Keep “delivery campaign finished” and “operational incident resolved” as
  distinct lifecycle events.
- Do not infer incident resolution from recipient status, statistics, provider
  acceptance, or a `completed_at` communication timestamp.
- Require an explicit, authorized administrator action to resolve the incident,
  with actor, timestamp, reason, and audit evidence.
- Keep communication completion behavior separate for communication types whose
  lifecycle is valid.

The dashboard labels a completed incident as **DELIVERY COMPLETE**, shows a
prominent warning, and never renders “Incident Resolved”. Production approval for
incident management remains blocked until the backend correction is implemented
and verified.

## Verified contract facts and limitations

| Area | Verified backend behavior |
|---|---|
| Audience preview | `POST /admin/communications/preview` validates `{audience:{kind,user_ids}}` and returns `kind`, `count`, `max_audience`, and `allowed`. `/admin/communications/audience/preview` is not a supported route. |
| List search | `GET /admin/communications` supports `status`, `communication_type`, `severity`, `search`, `limit`, and `offset`. `search` is a case-insensitive **title-only** match; message bodies are not searched. |
| Expiry clearing | `PATCH /admin/communications/{id}` accepts `expires_at: null` to clear an existing expiry. The dashboard sends JSON `null`, not an omitted field. |
| Types and severities | `announcement`, `maintenance`, `incident`, `product_update`; `low`, `normal`, `high`, `critical`. |
| Channels | `in_app` (required) and `push` (optional). SMS and email are not implemented. |
| Audience kinds | `all`, `buyers`, `sellers`, `store_owners`, `user_ids`, with at most 5,000 explicit user IDs. |
| Recipient retry | Recipient responses include `retry_eligible`. Retry accepts an optional `recipient_ids` list; an explicit empty selection must not be treated as “retry all”. |
| Provider acceptance | `provider_accepted` means FCM accepted the request. It is not device-display proof. |
| In-app reads | `read_count` counts in-app read acknowledgements. It is not push or device-delivery evidence. |
| Worker diagnostics | The response documents sweep/claim timing, batch/concurrency configuration, process-local counters for the last pass, and durable backlog counts. The `last_pass` counters are process-local and reset on process restart; they are not a durable delivery history. |

## Other open platform gaps

| Gap | Impact |
|---|---|
| Hardened backend not deployed | The inspected source must be reviewed, merged, deployed, and verified in staging before the frontend can rely on it. |
| No persisted admin Alert Centre | `/alerts` remains a derived view over ops/health responses; there is no unread state or acknowledgement endpoint. |
| No post-publication withdrawal | Published notices can expire or be marked delivery-complete, but cannot be recalled through a supported endpoint. |
| FCM configuration dependency | Push attempts require backend Firebase credentials. In-app publication remains available when push is not configured. |

## Production decision

Production approval is **not** justified while blockers 1-3 remain open. The
frontend is intentionally honest about these limitations, but honesty is not a
substitute for backend idempotency, reliable device evidence, or an explicit
incident-resolution lifecycle.
