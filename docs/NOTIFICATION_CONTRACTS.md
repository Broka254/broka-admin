# Notification and service-communication contracts

**Status:** Updated with live backend integration for Service Communications. The admin Alert Centre remains a derived operational snapshot pending backend alert persistence.

This document separates the two audiences and details the implemented and pending contracts.

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

---

## 2. Service Communications Workspace (Integrated)

The service communications management workspace in `/communications` is integrated with the backend implementation (`Broka254/broka`, domain `service_communications`).

### Verified Backend Endpoints

| Operation | Method and path | Semantics & Verification |
|---|---|---|
| List communications | `GET /admin/communications` | Filters `status`, `communication_type`, `severity`, `limit`, `offset`. Returns `items` and `total`. |
| Audience preview | `POST /admin/communications/audience/preview` | Validates target audience without side-effects. Returns `kind`, `count`, `max_audience`, `allowed`. |
| Create draft | `POST /admin/communications` | Creates communication draft in `draft` status. Idempotency-guarded (`X-Idempotency-Key`) and audited. |
| Read detail | `GET /admin/communications/{id}` | Returns communication entity and delivery summary (`total_recipients`, `read_count`, `provider_accepted`, `confirmed_delivered`, `pending`, `failed`, `retry_scheduled`). |
| Update draft | `PATCH /admin/communications/{id}` | Edits draft content or targeting. Requires `expected_version` concurrency guard; returns 409 on version conflict. Disallowed once publishing. |
| Schedule | `POST /admin/communications/{id}/schedule` | Validates future `scheduled_at` timestamp. Transitions status to `scheduled`. |
| Publish now | `POST /admin/communications/{id}/publish` | Initiates immediate worker publication. Locks draft editing permanently. |
| Cancel | `POST /admin/communications/{id}/cancel` | Cancels draft or scheduled communication with optional audit `reason`. |
| Complete | `POST /admin/communications/{id}/complete` | Marks published communication complete. Validated only when all delivery attempts have settled. |
| Recipient ledger | `GET /admin/communications/{id}/recipients` | Returns paginated per-recipient dispatch ledger (`status`, `attempt_count`, `last_attempt_at`, `read_at`, `failure_category`, `retry_eligible`). |
| Retry recipients | `POST /admin/communications/{id}/recipients/retry` | Queues failed eligible recipients for retry with optional `recipient_ids` target list. |
| Delivery stats | `GET /admin/communications/{id}/stats` | Summary statistics and device breakdowns. Formerly proposed as `GET /admin/communications/{id}/deliveries`. |
| Worker diagnostics | `GET /admin/communications/diagnostics/worker` | Real-time worker engine telemetry: runtime mode, sweep intervals, claim lease times, provider concurrency, and queue backlogs. |

### Supported vs. Non-Supported Capabilities

#### Channels:
- **`in_app`**: Supported and **required**. Delivered to the in-app notice inbox.
- **`push`**: Supported and **optional**. Dispatched via Firebase Cloud Messaging (FCM). Requires backend FCM configuration.
- **`sms` & `email`**: **NOT SUPPORTED**. The backend does not expose SMS or email delivery. The admin dashboard strictly forbids claiming SMS or email delivery.

#### Target Audiences:
- Supported: `all`, `buyers`, `sellers`, `store_owners`, `user_ids` (explicit user ID list, limited to 5,000 IDs).

#### Communication Types:
- Supported: `announcement`, `maintenance`, `incident`, `product_update`.
- Note: `app_release` is **NOT SUPPORTED** by the backend and is omitted from the UI.

#### Withdrawal:
- **`POST /admin/communications/{id}/withdraw` does NOT exist**. The backend supports cancellation (`cancel`) prior to/during scheduled state. Once published, notices cannot be withdrawn; they can only expire or be marked complete.

### Delivery-State Truthfulness & Telemetry Rules

The frontend enforces strict truthfulness distinctions across all metrics:
- **FCM Provider Accepted (`provider_accepted`)**: Proves network submission and acceptance by the Firebase Cloud Messaging gateway. **Provider acceptance does NOT prove or confirm that the notification appeared on the user's physical device.**
- **Confirmed Delivered (`confirmed_delivered`)**: Requires real hardware evidence and delivery confirmation telemetry from client applications. It is never fabricated or inferred from provider acceptance.
- **In-App Reads (`read_count`)**: Verified user read timestamps recorded when an authenticated user opens or views the communication in-app.
- **Pending (`pending`) & Retry Scheduled (`retry_scheduled`)**: Unsent or queued for subsequent worker sweeps.

### Documented Release Blocker: Incident Auto-Complete Defect

> [!WARNING] **RELEASE BLOCKER: Backend Incident Auto-Completion Defect**
> In `service.py:complete_published_communications()`, the background worker periodically executes:
> ```python
> stmt = (
>     select(ServiceCommunication)
>     .where(ServiceCommunication.status == "published")
>     ...
> )
> ```
> As soon as delivery attempts settle (`~pending`), the worker automatically mutates `status = "completed"`.
> For technical incidents (`communication_type == "incident"`), this causes the incident communication to be marked `completed` as soon as push delivery finishes, even when the underlying technical outage is actively ongoing!
>
> The frontend exposes an explicit notice highlighting this defect and does not mask or simulate incident state. Resolving this defect in the backend (requiring manual operator completion for incidents) is tracked as a release blocker.

## 3. Frontend Error & Unavailable Handling

- When the backend communications endpoint returns a 404, the dashboard displays `UnavailablePanel` with `Backend Upgrade Required`.
- Response contract drift fails closed at the server proxy with `502 contract_validation_failed`.
- Mutating drafts or publishing enforces CSRF same-origin checking, payload size checks (max 512KB), and `X-Idempotency-Key` headers.
