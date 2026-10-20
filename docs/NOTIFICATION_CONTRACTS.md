# Notification and service-communication contracts

**Status:** backend-dependent. No admin alert-retrieval, acknowledgement, communications or delivery endpoint exists in the verified admin surface inspected for this repository. The frontend does not simulate any of them.

This document separates the two audiences and the contract each one requires.

## 1. Admin Alert Centre

The current `/alerts` page is a **derived operational view**: it renders the live queues in `/admin/ops-snapshot` and the validated checks in `/admin/health/services`. It is not a persisted alert feed. It deliberately shows no unread count, notification-delivery claim or acknowledgement control.

Required backend contract before the page can become a true Alert Centre:

### `GET /admin/alerts`

Query:

- `status`: `open` | `acknowledged` | `resolved` | `all` (default `open`)
- `severity`: `critical` | `warning` | `info` | `all` (optional)
- `limit`, `offset`
- `since` (ISO-8601, optional)

Response:

```json
{
  "items": [
    {
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
      "href": "string (admin-relative path)"
    }
  ],
  "total": 0,
  "unread": 0,
  "generated_at": "ISO-8601"
}
```

Required headers: `X-Total-Count` may repeat `total`. The response must be permission-protected (`ADMIN_SUMMARY` or a dedicated `VIEW_ADMIN_ALERTS` permission), all timestamps must be server-generated, and `href` must be validated against the admin route manifest before rendering.

### `POST /admin/alerts/{id}/acknowledge`

Request: `{ "reason": "string (optional, 3-500 chars)" }` plus `X-Idempotency-Key`.

Response: `{ "ok": true, "changed": true|false, "acknowledged_at": "ISO-8601", "acknowledged_by": "string" }`.

Behavior: authenticated admin only; repeat calls are no-ops (`changed: false`); an audit row records actor, alert id, reason, before/after and request id. Resolution, if supported, must be a separate endpoint or an explicit state transition, not inferred from acknowledgement.

### Explicitly not available

- Browser push, SMS or email delivery of admin alerts.
- Unread counts derived from a browser-side read marker. Read state must be server-side and per-admin.
- Alert creation from the frontend.

## 2. Service Communications

Planned admin workspace for customer-facing maintenance notices, incidents, general announcements and app-release policy. No endpoint is currently implemented. The dashboard shows the capability list and state semantics only.

### Core resource: `communications`

Proposed fields:

```json
{
  "id": "string",
  "kind": "maintenance|incident|announcement|app_release",
  "title": "string",
  "body": "string",
  "status": "draft|scheduled|published|expired|withdrawn",
  "audience": { "type": "all|customer_segment", "segment": "string|null" },
  "starts_at": "ISO-8601|null",
  "expires_at": "ISO-8601|null",
  "minimum_app_version": "string|null",
  "created_by": "string",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "published_at": "ISO-8601|null",
  "withdrawn_at": "ISO-8601|null"
}
```

### Required operations

| Operation | Method and path | Semantics |
|---|---|---|
| List | `GET /admin/communications` | Filters `status`, `kind`, `limit`, `offset`; returns items + total. |
| Create draft | `POST /admin/communications` | Creates only a draft; must not deliver anything. Idempotency-guarded and audited. |
| Read | `GET /admin/communications/{id}` | Returns the resource and its transition history. |
| Update draft/scheduled | `PATCH /admin/communications/{id}` | Rejected with `409` once published; validated audience and time window. |
| Schedule | `POST /admin/communications/{id}/schedule` | Persists `scheduled` and `starts_at`; still does not prove delivery. |
| Publish now | `POST /admin/communications/{id}/publish` | Records publication intent and audit. Delivery is a separate result. |
| Withdraw | `POST /admin/communications/{id}/withdraw` | Stops future visibility; must not claim that already-sent messages were recalled. |
| Delivery status | `GET /admin/communications/{id}/deliveries` | Per channel (`in_app`, `sms`, `email`, `push`): provider, recipient count, accepted/sent/failed counts, provider receipt ids, timestamps and last error. |

Every mutation requires `X-Idempotency-Key`, a permission such as `MANAGE_COMMUNICATIONS`, input validation and an audit row with before/after state. Publication must not be exposed without a documented state machine.

### Delivery-state rules

- **Draft:** saved record; not scheduled and not visible.
- **Scheduled:** future `starts_at` stored; not delivered.
- **Published:** recorded as live for the selected audience. This is not proof that an SMS, email or push reached any recipient.
- **Delivered:** requires a per-channel provider receipt. Until `/deliveries` exists, the dashboard must not display delivery counts.
- Publishing a record must never be labelled "sent" or "delivered".

### Audience and version policy

`audience` must be resolved on the server. The frontend must not send a list of raw customer identifiers or infer a segment. App-release communications need a documented minimum-version policy and a server-side compatibility decision; a free-text version field alone is insufficient.

## 3. Frontend behavior until these contracts exist

- The alert bell links to `/alerts` and shows no unread dot.
- `/alerts` labels itself as a derived ops view and renders only snapshot/health data.
- `/communications` is read-only, shows no editor or publish control, and explicitly states that delivery is not instrumented.
- A 404 from either future endpoint must render the existing "backend upgrade required" state, not an empty success state.
- Contract drift must fail closed at the server proxy with `contract_validation_failed`.
