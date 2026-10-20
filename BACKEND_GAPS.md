# BROKA Admin backend-gap report

The hardened backend working tree (`/tmp/opencode/broka/backend`) now implements the previously missing admin scope and mutation safety. The gaps below distinguish **implemented-in-working-tree (not yet deployed)** from **genuinely open**.

## Implemented in the backend working tree (tests: 19 new + full suite 2072 passed)

| Gap | Resolution |
|---|---|
| Granular admin RBAC | `require_permission(Permission.*)` dependencies attached to every admin route (`ADMIN_SUMMARY`, `MANAGE_USERS`, `PROMOTE_ADMIN`, `VIEW_TRANSACTIONS`, `VIEW_ALL_DISPUTES`, `OVERRIDE_ESCROW`). All current admins hold every flag → backward compatible; restricted sub-roles would need schema storage and were not added. |
| Audit writes | Every admin mutation (flag/unflag/recompute/promote/fraud-resolve/media-backfill) records `record_audit()` with actor, target, reason, before/after, request id and timestamp. |
| Idempotency | All mutations use `idempotency_guard`, which reads `X-Idempotency-Key` (Redis; fail-open). The frontend now sends that exact header — previously it sent `Idempotency-Key`, which the guard ignored. Replay is covered by a backend test. |
| User operations | `/admin/users` adds `search`, `is_admin`, `account_type`, `flagged_only` and an `X-Total-Count` header; `/admin/users/{id}` returns profile, stats, recent deals, fraud events and audit rows. |
| Admin scope | Added read-only `/admin/ops-snapshot`, `/admin/deals`, `/admin/deals/{id}`, `/admin/listings`, `/admin/stores`, `/admin/disputes`, `/admin/payments`, `/admin/finance-integrity`, `/admin/health/services`, `/admin/zeno/activity` and `POST /admin/fraud-events/{id}/resolve`. |
| Flag semantics | Re-flagging is now a no-op (`changed: false`); the first flag creates a `FraudEvent`; reason is required. The old behavior subtracted another 30 trust points on every retry. |
| Finance correctness | `/admin/finance-integrity` asserts released deals have a release debit and a revenue credit; commission gap, escrow held, refund payable and awaiting-manual-refund queue are exposed with definitions. |

## Genuinely open

| Gap | Evidence | Impact |
|---|---|---|
| Deployment | The hardened backend is a working tree, not the deployed API | Production still runs the old admin surface until reviewed, merged and deployed |
| Published contracts | Live OpenAPI still returns `{}` for inspected admin success responses | Frontend schemas remain source-derived; a regenerated contract artifact is still required |
| Historical analytics | `/admin/event-metrics` and AI savings remain process-local counters (labelled `scope: process_local`, `durability: none`) | No durable time series; a metrics backend (or the audit tables) would be required |
| Zeno instrumentation | Provider/model usage, latency percentiles, token costs, STT/TTS outcomes are not persisted anywhere | `/admin/zeno/activity` lists them in `not_instrumented` instead of estimating |
| Reports workflow | No reports/admin moderation endpoint exists | The Reports page remains explicitly unavailable |
| Admin alert persistence | `/admin/ops-snapshot` exposes current queue counts, but no alert list, unread state, acknowledgement or per-alert timestamps exist | `/alerts` is a derived ops view only; it renders no unread count or acknowledge control. Required contract: `docs/NOTIFICATION_CONTRACTS.md` |
| Incident auto-completion defect (Release Blocker) | service.py:complete_published_communications marks all published communications as completed once recipient rows reach terminal status | Technical incidents are auto-completed on delivery completion, regardless of technical resolution. Backend fix required before production release. |
| Missing communication channels & operations | Backend does not implement SMS, email, app_release type, or withdrawal endpoint (`POST /admin/communications/{id}/withdraw`) | Frontend strictly restricts channels to `in_app` and `push`; withdrawal is not offered once published. |
| Push notification FCM dependency | Push channel delivery requires valid Firebase Admin SDK credentials (`service_account.json`) on the backend | Push attempts fail gracefully when FCM is not configured; in-app announcements operate independently. |
| Dispute resolution | Admin dispute queue is read-only; resolution stays with the existing engine and its fund guards | Deliberate: no unsafe decide/refund mutation was added |
| Admin sub-roles | No storage for per-admin permission sets (schema change not allowed) | All admins remain full admins |
| Live Redis idempotency tests | Local test environment has no Redis | The reservation path is tested with mocks only; CI (which runs Redis) still needs the backend branch |

## Frontend integration completed

- Runtime validation for every admin read, including the new ops surface, detail endpoints and action results.
- Contract drift produces `contract_validation_failed` with a request ID and no payload logging.
- Alert-first Command Center driven by `/admin/ops-snapshot` + `/admin/health/services`; KPI labels now distinguish active listings, released deals, recognized commission and active dispute cases.
- Payments, Finance Integrity, Service Health and Zeno Activity workspaces with real filters; Deals/Listings/Stores/Disputes queues with pagination and server-side counts.
- User detail with reason-gated, confirmed, idempotent actions and backend action results rendered; fraud events resolvable from the queue.
- `/alerts` derived from the ops snapshot and service health, with no fabricated unread/acknowledgement state; the header bell links to it without a fake badge.
- `/communications` workspace: complete production management workspace supporting draft creation, audience preview, editing with concurrency guards, scheduling, publishing, cancellation, completion, recipient ledger inspection with retry triggers, and live worker diagnostics. Truthfully separates FCM provider acceptance from confirmed device receipts and in-app reads.
- The API badge turns green only after a validated `/health` response; the users total uses the upstream `X-Total-Count` instead of page length.

No missing operation is simulated in the dashboard.
