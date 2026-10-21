# BROKA FastAPI integration audit

**Runtime API:** `https://api.broka.co.ke`
**Inspected backend source:** `Broka254/broka` at commit `e79a364`
(hardened admin surface; not yet deployed)
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

The admin-domain user/fraud mutations above are guarded by
`idempotency_guard`, which reads **`X-Idempotency-Key`**, and record audit rows.
The frontend previously sent `Idempotency-Key`, which the guard did not read; that
header mismatch is fixed. This statement does **not** extend to Service
Communications draft creation, whose inspected handler has no creation-idempotency
enforcement.

## Authorization

The admin router now attaches granular dependencies from `api/core/permissions.py`: `ADMIN_SUMMARY`, `MANAGE_USERS`, `PROMOTE_ADMIN`, `VIEW_TRANSACTIONS`, `VIEW_ALL_DISPUTES`, `OVERRIDE_ESCROW`. All current admins hold every flag, so behavior is backward compatible; defining restricted admin sub-roles would require schema storage and is intentionally not done.

## OpenAPI mismatch

The live OpenAPI document still advertises empty success schemas for these responses even though the router returns concrete dictionaries. The frontend labels its schemas **source-derived** and fails closed on drift. The backend CI should publish a regenerated OpenAPI document or a versioned contract artifact.

## Notification surfaces

No admin alert-retrieval or acknowledgement endpoint exists. `/alerts` is therefore a derived view over `/admin/ops-snapshot` and `/admin/health/services`; it renders severity, snapshot time and links, but no unread count, notification delivery or acknowledgement state.

The service-communications workspace (`/communications`) is integrated with the
backend source in `Broka254/broka`, domain `service_communications`. Its frontend
work is complete, but production use is blocked by the backend gaps listed below.
It supports:
- CRUD on communication drafts (`GET /admin/communications`, `POST /admin/communications`, `PATCH /admin/communications/{id}`)
- Concurrency control via `expected_version`
- Non-side-effecting audience preview (`POST /admin/communications/preview`)
- Lifecycle actions: `POST /admin/communications/{id}/schedule`, `POST /admin/communications/{id}/publish`, `POST /admin/communications/{id}/cancel`, `POST /admin/communications/{id}/complete`
- Per-recipient delivery ledger and retry: `GET /admin/communications/{id}/recipients`, `POST /admin/communications/{id}/recipients/retry`
- Worker diagnostics: `GET /admin/communications/diagnostics/worker` (durable backlog plus process-local last-pass counters that reset on worker restart)
- Server-side title search and pagination through `search`, `limit`, and `offset`; message bodies are not searchable.
- Delivery telemetry truthfulness: FCM provider acceptance, in-app availability/read acknowledgements, and device evidence are kept distinct. Confirmed device delivery is shown as unavailable because the backend's `confirmed_delivered` field includes in-app-only rows.
- Channels supported: `in_app` (required) and `push` (optional, requires backend FCM configuration). SMS, email, app_release, and withdrawal endpoints do not exist in the backend and are not exposed.
- Expiry updates accept ISO UTC timestamps and JSON `null` to clear an existing expiry.
- Known release blockers: draft creation has no server-side idempotency guarantee; `confirmed_delivered` is not device evidence; and `service.py:complete_published_communications` automatically marks published incidents as complete once recipient delivery attempts settle, regardless of incident resolution.
- Target semantics verified in the inspected backend: publication is guarded by `X-Idempotency-Key` (`router.py:publish_communication`), scheduling validates only status/timestamp/expiry ordering, and `retry_eligible_recipients` treats an omitted `recipient_ids` list as "retry every eligible recipient". The admin client accordingly reuses one key per logical lifecycle action, gates scheduling and publication on a current allowed audience preview, and refuses a retry without an explicit non-empty selection.

The client reuses an idempotency key for retries of the same logical draft payload
and prevents duplicate in-flight submissions. This is request identity only, not a
substitute for persisted server-side deduplication. See
[`BACKEND_GAPS.md`](../BACKEND_GAPS.md).

## Proxy request and error handling

The same-origin proxy (`app/api/broka/[...path]/route.ts`) is the only path from the
browser to the protected API:

- Communications endpoints are explicitly allowlisted for both reads and mutations;
  an unlisted path or method is rejected before any upstream call.
- Mutations require a same-origin `Origin`/`Referer` check and an authenticated
  server-side session cookie; access and refresh tokens stay in HttpOnly cookies.
- Request bodies are read with a 512 KiB ceiling that is enforced against the
  actual byte stream, so a missing or misleading `Content-Length` cannot bypass it.
- Communications request schemas are strict. An unsupported field is rejected with
  `422 validation_failed` instead of being forwarded or silently dropped.
- A 5xx upstream body is never relayed to the browser (it may contain a stack trace
  or an internal payload); a 4xx detail is relayed after being length-capped; a 404
  upstream is reported as `endpoint_unavailable`.
- Responses are validated against the registered response contract. Contract drift
  returns `502 contract_validation_failed` and is logged as a structured event.
- Every proxy response is sent with `Cache-Control: no-store`, and the route is
  `force-dynamic`.

## Deployment automation

`.github/workflows/ci.yml` performs validation only (install, test, typecheck,
lint, production build, artifact upload) and can never deploy. Production
deployment is isolated in `.github/workflows/deploy-railway.yml`, which is
`workflow_dispatch`-only, fails a `require-main` guard when dispatched from a
branch other than `main`, and runs the deployment in the `production` environment
with Railway credentials taken from that environment's secrets. Required reviewers
and deployment protection rules are GitHub repository settings and must be
configured and verified manually.

## Known operational notes

- Middleware authorization calls to `/auth/me` and `/auth/token/refresh` are bounded at 5 seconds; timeouts fail closed to the login screen instead of holding the request open.
- `commission_earned_kes` (and the ops snapshot commission figures) are recognized commission on `released` deals — not proof of reconciled bank cash. `/admin/finance-integrity` exposes the real reconciliation checks.
- `ledger-integrity.balanced` is true by construction; `escrow_integrity_ok` and `negative_escrow_deals` are the assertions that can fail.
- Process-local counters (AI savings, event metrics) are labelled `scope: process_local`, `durability: none` in both backend responses and UI.
- External provider statuses in `/admin/health/services` are configuration checks only (`probe: not_run`); the live E-Confirm probe remains `/admin/diagnostics/econfirm`.
