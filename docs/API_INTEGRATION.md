# BROKA FastAPI integration audit

**Runtime API:** `https://api.broka.co.ke`
**Backend working tree:** `/tmp/opencode/broka/backend` (hardened admin surface; not yet deployed)
**Source version observed:** backend health returns `6.0.0`.

## Authentication

| Operation | Path | Verified source contract |
|---|---|---|
| Sign in | `POST /auth/login` | JSON `{phone,password}`; returns `access_token`, `refresh_token`, `token_type`, user identity fields |
| Current user | `GET /auth/me` | Full account dictionary; `is_admin`, `trust_score`, `trust_band`, `is_flagged` available |
| Refresh | `POST /auth/token/refresh` | JSON `{refresh_token}`; returns access token and optional rotated refresh token |
| Revoke | `POST /auth/token/revoke` | JSON `{refresh_token}`; `204` response |

The admin app validates these source-compatible payloads on the server and stores tokens only in HttpOnly cookies.

## Administrative reads

Original reads: `/admin/summary`, `/users`, `/ai-savings`, `/ledger-integrity`, `/audit-logs`, `/fraud-events`, `/transactions`, `/workflow-versions`, `/event-metrics`, `/event-catalog`, `/diagnostics/econfirm`, `/diagnostics/client-ip`.

Added in the working tree: `/admin/ops-snapshot`, `/admin/deals`, `/admin/deals/{id}`, `/admin/listings`, `/admin/stores`, `/admin/disputes`, `/admin/payments`, `/admin/finance-integrity`, `/admin/health/services`, `/admin/zeno/activity`, `/admin/users/{user_id}`, `POST /admin/fraud-events/{event_id}/resolve`.

The frontend allowlist, dynamic detail patterns, and Zod schemas mirror these return dictionaries; contract drift fails closed with a 502 and a structured log line.

## Administrative writes

- `POST /admin/users/{user_id}/flag` — requires `reason` (3-500 chars), no-op when already flagged, creates a fraud event on first flag.
- `POST /admin/users/{user_id}/unflag`
- `POST /admin/users/{user_id}/recompute-trust`
- `POST /admin/users/{user_id}/promote-admin` — requires `reason`.
- `POST /admin/fraud-events/{event_id}/resolve` — records `reviewed_by_admin` and an audit row.

Every mutation is guarded by `idempotency_guard`, which reads **`X-Idempotency-Key`**, and records an audit row with actor, action, target, reason, before/after values, request id and timestamp. The frontend previously sent `Idempotency-Key`, which the guard did not read; this is fixed end-to-end and covered by tests.

## Authorization

The admin router now attaches granular dependencies from `api/core/permissions.py`: `ADMIN_SUMMARY`, `MANAGE_USERS`, `PROMOTE_ADMIN`, `VIEW_TRANSACTIONS`, `VIEW_ALL_DISPUTES`, `OVERRIDE_ESCROW`. All current admins hold every flag, so behavior is backward compatible; defining restricted admin sub-roles would require schema storage and is intentionally not done.

## OpenAPI mismatch

The live OpenAPI document still advertises empty success schemas for these responses even though the router returns concrete dictionaries. The frontend labels its schemas **source-derived** and fails closed on drift. The backend CI should publish a regenerated OpenAPI document or a versioned contract artifact.

## Notification surfaces

No admin alert-retrieval or acknowledgement endpoint exists. `/alerts` is therefore a derived view over `/admin/ops-snapshot` and `/admin/health/services`; it renders severity, snapshot time and links, but no unread count, notification delivery or acknowledgement state.

The service-communications workspace (`/communications`) is fully integrated with the backend implementation (`Broka254/broka`, domain `service_communications`).
It supports:
- CRUD on communication drafts (`GET /admin/communications`, `POST /admin/communications`, `PATCH /admin/communications/{id}`)
- Concurrency control via `expected_version`
- Non-side-effecting audience preview (`POST /admin/communications/audience/preview`)
- Lifecycle actions: `POST /admin/communications/{id}/schedule`, `POST /admin/communications/{id}/publish`, `POST /admin/communications/{id}/cancel`, `POST /admin/communications/{id}/complete`
- Per-recipient delivery ledger and retry: `GET /admin/communications/{id}/recipients`, `POST /admin/communications/{id}/recipients/retry`
- Durable worker telemetry: `GET /admin/communications/diagnostics/worker`
- Delivery telemetry truthfulness: FCM provider acceptance is strictly separated from confirmed device receipts and in-app reads.
- Channels supported: `in_app` (required) and `push` (optional, requires backend FCM configuration). SMS, email, app_release, and withdrawal endpoints do not exist in the backend and are not exposed.
- Known release blocker: `service.py:complete_published_communications` automatically marks published incidents as complete once recipient delivery attempts settle, regardless of incident resolution.

## Known operational notes

- Middleware authorization calls to `/auth/me` and `/auth/token/refresh` are bounded at 5 seconds; timeouts fail closed to the login screen instead of holding the request open.
- `commission_earned_kes` (and the ops snapshot commission figures) are recognized commission on `released` deals — not proof of reconciled bank cash. `/admin/finance-integrity` exposes the real reconciliation checks.
- `ledger-integrity.balanced` is true by construction; `escrow_integrity_ok` and `negative_escrow_deals` are the assertions that can fail.
- Process-local counters (AI savings, event metrics) are labelled `scope: process_local`, `durability: none` in both backend responses and UI.
- External provider statuses in `/admin/health/services` are configuration checks only (`probe: not_run`); the live E-Confirm probe remains `/admin/diagnostics/econfirm`.
