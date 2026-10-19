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
| Dispute resolution | Admin dispute queue is read-only; resolution stays with the existing engine and its fund guards | Deliberate: no unsafe decide/refund mutation was added |
| Admin sub-roles | No storage for per-admin permission sets (schema change not allowed) | All admins remain full admins |
| Live Redis idempotency tests | Local test environment has no Redis | The reservation path is tested with mocks only; CI (which runs Redis) still needs the backend branch |

## Frontend integration completed

- Runtime validation for every admin read, including the new ops surface, detail endpoints and action results.
- Contract drift produces `contract_validation_failed` with a request ID and no payload logging.
- Alert-first Command Center driven by `/admin/ops-snapshot` + `/admin/health/services`; KPI labels now distinguish active listings, released deals, recognized commission and active dispute cases.
- Payments, Finance Integrity, Service Health and Zeno Activity workspaces with real filters; Deals/Listings/Stores/Disputes queues with pagination and server-side counts.
- User detail with reason-gated, confirmed, idempotent actions and backend action results rendered; fraud events resolvable from the queue.

No missing operation is simulated in the dashboard.
