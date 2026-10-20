# Notification and service-communication contracts

**Status:** The Service Communications admin frontend is remediated against the
backend source at `Broka254/broka` commit `e79a364`. Production approval is still
blocked by the backend gaps documented in [`BACKEND_GAPS.md`](../BACKEND_GAPS.md).

## 1. Admin Alert Centre

The current `/alerts` page is a **derived operational view** over
`/admin/ops-snapshot` and `/admin/health/services`. It is not a persisted alert
feed and deliberately shows no unread count, delivery claim, or acknowledgement
control.

Required backend contract before it can become a true Alert Centre:

### `GET /admin/alerts`

Query: `status` (`open` | `acknowledged` | `resolved` | `all`), optional
`severity`, `limit`, `offset`, and `since`.

Response:

```json
{
  "items": [{
    "id": "string",
    "severity": "critical|warning|info",
    "title": "string",
    "detail": "string",
    "source": "string",
    "resource_type": "string|null",
    "resource_id": "string|null",
    "occurred_at": "ISO-8601",
    "acknowledged_at": "ISO-8601|null",
    "acknowledged_by": "string|null",
    "resolved_at": "ISO-8601|null",
    "href": "admin-relative path"
  }],
  "total": 0,
  "unread": 0,
  "generated_at": "ISO-8601"
}
```

The endpoint must be permission-protected, generate all timestamps server-side,
and validate `href` against the admin route manifest.

### `POST /admin/alerts/{id}/acknowledge`

Request: optional `reason` plus `X-Idempotency-Key`. Response:
`{ok, changed, acknowledged_at, acknowledged_by}`. Replays are no-ops and audited.
Resolution must be a separate explicit transition, not inferred from
acknowledgement.

## 2. Service Communications

### Supported endpoint contract

| Operation | Method and path | Contract |
|---|---|---|
| List | `GET /admin/communications` | `status`, `communication_type`, `severity`, `search`, `limit`, `offset`; returns `items`, `total`, `limit`, `offset`. `search` matches titles only and does not search message bodies. |
| Preview audience | `POST /admin/communications/preview` | Request `{audience:{kind,user_ids}}`; returns `kind`, `count`, `max_audience`, `allowed`. The formerly documented `/admin/communications/audience/preview` route does not exist. |
| Create draft | `POST /admin/communications` | Creates a `draft`. The client sends `X-Idempotency-Key`, but the inspected backend create handler does not enforce server-side creation idempotency. |
| Read detail | `GET /admin/communications/{id}` | Returns `communication` and `delivery` summary. |
| Update draft | `PATCH /admin/communications/{id}` | Edits draft content/targeting and checks optional `expected_version`. JSON `expires_at: null` clears an existing expiry. |
| Schedule | `POST /admin/communications/{id}/schedule` | Requires future `scheduled_at`; transitions to `scheduled`. |
| Publish now | `POST /admin/communications/{id}/publish` | Starts immediate publication and returns `{communication, accepted}`. Accepted means the campaign was accepted for processing, not that every recipient received it. |
| Cancel | `POST /admin/communications/{id}/cancel` | Cancels a draft or scheduled communication with optional audit reason. |
| Complete | `POST /admin/communications/{id}/complete` | Marks a published communication complete after delivery settles. This is delivery-campaign completion, **not** incident resolution. |
| Recipient ledger | `GET /admin/communications/{id}/recipients` | Paginated recipient rows including `status`, `attempt_count`, timestamps, sanitized `failure_category`, and `retry_eligible`. |
| Retry | `POST /admin/communications/{id}/recipients/retry` | Queues eligible recipients. Supports a targeted `recipient_ids` list; an explicit empty list is not a retry-all instruction. Returns the number accepted for retry queuing. |
| Delivery stats | `GET /admin/communications/{id}/stats` | `communication_id`, `status`, nullable `audience_count`, delivery summary, `generated_at`. `/deliveries` is not supported. |
| Worker diagnostics | `GET /admin/communications/diagnostics/worker` | Worker configuration, last-pass counters, and durable backlog counts. See the limitation below. |

### Finite values

- Communication types: `announcement`, `maintenance`, `incident`, `product_update`.
- Severities: `low`, `normal`, `high`, `critical`.
- Communication statuses: `draft`, `scheduled`, `publishing`, `published`, `completed`, `cancelled`, `failed`.
- Channels: `in_app` (required) and `push` (optional). SMS, email, app-release delivery, and post-publication withdrawal are not supported.
- Audience kinds: `all`, `buyers`, `sellers`, `store_owners`, `user_ids` (maximum 5,000 explicit IDs).
- Recipient statuses: `queued`, `sending`, `provider_accepted`, `delivered`, `failed`, `retry_scheduled`.

### Delivery and lifecycle semantics

- **In-app availability**: The backend writes recipient status `delivered` for an
  in-app-only communication. This proves the row is available in the authenticated
  feed; it does **not** prove that the customer opened or saw it.
- **In-app reads (`read_count`)**: Read acknowledgements recorded in the app. They
  are not push or device-delivery evidence.
- **Provider acceptance (`provider_accepted`)**: FCM accepted the request. This is
  not proof that a device displayed the notification.
- **Confirmed device delivery**: Unavailable. The backend's
  `confirmed_delivered` field currently equals the count of rows with status
  `delivered`, including in-app-only rows, so the dashboard must not present it as
  device evidence.
- **Retry acceptance**: A successful retry request means the recipients were
  queued for another attempt, not that delivery succeeded. The detail and recipient
  ledger are refreshed after acceptance.
- **Completion**: A completed communication means the delivery campaign has no
  pending recipient rows. It does not prove operational incident resolution.

### Expiry representation

- API timestamps are ISO-8601 UTC instants.
- The edit form converts a stored instant to the browser's local wall-clock value
  for `datetime-local`.
- An unchanged local value reuses the original instant exactly, avoiding shifts
  from seconds truncation or daylight-saving ambiguity.
- A changed local value is interpreted in the browser timezone and converted back
  to UTC.
- An invalid or nonexistent DST time is rejected before submission.
- A cleared expiry sends JSON `expires_at: null`; the backend documents and accepts
  `null` for clearing.

### Worker diagnostics limitation

The diagnostics response exposes `sweep_seconds`, `claim_seconds`,
`recipient_batch`, `provider_concurrency`, `provider_timeout_seconds`,
`retention_days`, durable backlog counts, and a `last_pass` object. The `last_pass`
counters are process-local and reset when the process restarts. They are useful
for current worker visibility, not as a durable delivery history or cross-instance
aggregate.

### Backend release blockers

The following cannot be fixed in this frontend and remain production blockers:

1. `POST /admin/communications` does not enforce draft-creation idempotency.
2. `confirmed_delivered` is not trustworthy device-delivery evidence.
3. Delivery settlement automatically completes published incident communications
   without verifying that the incident was resolved.

See [`BACKEND_GAPS.md`](../BACKEND_GAPS.md) for evidence, required server behavior,
and impact.

## 3. Frontend handling and verification

- The browser never calls the backend directly; all communications requests go
  through the authenticated, same-origin, allowlisted server proxy.
- Mutation bodies are read with a 512 KiB byte ceiling based on the actual stream,
  not only the declared `Content-Length`.
- Proxy request and response schemas reject unsupported finite values and malformed
  counters.
- Search is debounced, uses the server's `search` parameter, resets the offset on
  query/filter changes, and relies on React Query query keys plus abort signals to
  prevent a stale response from replacing newer results.
- Audience preview is invalidated whenever the audience definition changes. A
  preview is informational and must match the current definition before publish is
  enabled; the backend still revalidates at publication time.
- The dashboard never sends a real broadcast during automated tests.

### Staging verification

1. Install with the frozen pnpm lockfile and run unit, contract, typecheck, lint,
   and production-build checks.
2. Point `BROKA_API_URL` at the staging API and sign in with a restricted test
   administrator.
3. Verify list filtering/search across pages, empty results, and backend-unavailable
   handling without publishing.
4. Preview all audience kinds, including an empty and an over-limit explicit list.
5. Create and edit a draft with expiry values in UTC, `Africa/Nairobi`, and another
   DST-observing timezone; confirm clearing sends `null` and an unchanged value
   preserves the instant.
6. Verify targeted retry only exposes backend-eligible recipients and refreshes
   detail, ledger, and totals after acceptance.
7. Confirm the dashboard shows provider acceptance, in-app reads, and
   “Device Delivery Evidence: Unavailable”; no screen may claim confirmed device
   display.
8. Confirm an incident delivery-complete state is labelled as delivery completion
   and that no incident-resolution claim is rendered.
9. Do not approve production until the three backend blockers are corrected and
   their concurrency/idempotency/lifecycle behavior is verified in backend tests.
