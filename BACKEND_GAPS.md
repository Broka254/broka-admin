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
| Recipient retry | Recipient responses include `retry_eligible`. Retry accepts an optional `recipient_ids` list; an explicit empty selection must not be treated as “retry all”. `service.py:retry_eligible_recipients` confirms that an **omitted** list means every eligible recipient, so the admin client only ever sends an explicit, non-empty selection. |
| Publication idempotency | `POST /admin/communications/{id}/publish` is guarded by `idempotency_guard` and by a per-communication `publish_idempotency_key` (`router.py:publish_communication`). The admin client therefore reuses one key for a retry of the same lifecycle action. This guard does **not** cover draft creation. |
| Schedule validation | `POST /admin/communications/{id}/schedule` validates only the draft status, a future `scheduled_at`, and that `scheduled_at` precedes `expires_at`. It does not re-validate the audience, so the admin UI requires a current, allowed audience preview before scheduling. |
| Provider acceptance | `provider_accepted` means FCM accepted the request. It is not device-display proof. |
| In-app reads | `read_count` counts in-app read acknowledgements. It is not push or device-delivery evidence. |
| Worker diagnostics | The response documents sweep/claim timing, batch/concurrency configuration, process-local counters for the last pass, and durable backlog counts. The `last_pass` counters are process-local and reset on process restart; they are not a durable delivery history. |

### 4. Production cost ledger implementation awaits merge/deployment and coverage completion

The backend implementation is available in
[Broka254/broka PR #5](https://github.com/Broka254/broka/pull/5). It adds
`GET /admin/production-costs`, durable manual entries, permission checks,
actor attribution, and idempotency. PR #5 is still draft/unmerged, so the live
API must not be assumed to serve these routes. The dashboard remains in its
explicit unavailable state until merge, deployment, and live verification.

Verified scope in the PR:

- Existing `PlatformCost` records supply SMS cost/usage and AI estimates/known
  token counts. Payment fees are derived through the existing revenue
  calculator and are presented as estimates to avoid double counting.
- Successful email and image-generation usage is recorded, but pricing is
  unconfigured and monetary totals remain unavailable for those services.
- Database, storage, Redis/cache, and push-notification usage instrumentation
  is not connected. Hosting and miscellaneous provider invoices can be entered
  manually; automatic provider invoice sync is not implemented.
- `estimated_max_minor` remains null because the implementation has no
  defensible upper bound. AI rate assumptions are surfaced as estimates, but a
  pricing-version identifier is not yet returned.
- Manual entries are durable, include the admin actor and audit event, and use
  `X-Idempotency-Key`; a replay with the same payload returns the same entry,
  while a conflicting payload is rejected. The manual total becomes the
  selected basis for that service/currency/date window while provider and
  estimate figures remain visible for comparison.
- Cost permissions are named and checked at the route boundary. At present,
  every `is_admin` user receives both permissions; restricted administrator
  sub-roles are not implemented.
- The PR includes tests for authorization, unpriced usage, source handling,
  date boundaries, manual-entry audit, replay, and conflict rejection.
  PostgreSQL/staging validation and deployed API verification remain required.

Release checks before the dashboard can be considered live:

1. Review and merge backend PR #5, then deploy the backend change.
2. Run the production-cost API against the target PostgreSQL database and verify
   the manual-entry table is created and persisted correctly.
3. Verify an admin can read costs and create a manual entry, while a
   non-admin is denied; verify idempotent replay and conflict rejection.
4. Confirm the deployed response validates against the dashboard's Zod schema,
   including date boundaries, currency-separated rows, and null/unpriced data.
5. Keep uninstrumented services visibly unavailable; do not convert missing
   telemetry or unconfigured prices into zero cost.
## Other open platform gaps

| Gap | Impact |
|---|---|
| Hardened backend not deployed | The inspected source must be reviewed, merged, deployed, and verified in staging before the frontend can rely on it. |
| No persisted admin Alert Centre | `/alerts` remains a derived view over ops/health responses; there is no unread state or acknowledgement endpoint. |
| No post-publication withdrawal | Published notices can expire or be marked delivery-complete, but cannot be recalled through a supported endpoint. |
| FCM configuration dependency | Push attempts require backend Firebase credentials. In-app publication remains available when push is not configured. |
| Production environment protection not verifiable from the repository | The manual deploy workflow requires the `production` environment and reads Railway credentials from its environment secrets, but required reviewers and deployment protection rules are GitHub repository settings that must be configured and verified manually. |

## Production decision

Production approval is **not** justified while blockers 1-3 remain open. The
frontend is intentionally honest about these limitations, but honesty is not a
substitute for backend idempotency, reliable device evidence, or an explicit
incident-resolution lifecycle.
