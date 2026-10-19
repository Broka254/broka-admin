# BROKA Admin implementation status

**Status:** Backend hardening implemented and tested in the backend working tree; the dashboard has been validated end-to-end against that backend locally (SQLite smoke environment). Deployment and seeded non-production validation still required.
**Reference:** `broka/backend/api/domains/admin/{router,ops,common}.py`, `api/core/{permissions,audit,idempotency,worker_health}.py`, `tests/test_admin_ops.py`, and the frontend contracts in `lib/api/`.

## Read surface

| Endpoint | Frontend surface | Contract | Authorization | Status |
|---|---|---|---|---|
| `/admin/summary` | Overview KPI cards | Six original fields plus `listings_active`, `deals_released`, `dispute_cases_active` | `require_permission(ADMIN_SUMMARY)` | Integrated; `X-Total-Count` used on the users list |
| `/admin/users` | Users workspace | User array; `search`, `is_admin`, `account_type`, `flagged_only`, limit/offset, `X-Total-Count` | `MANAGE_USERS` | Integrated with server-side filters |
| `/admin/ops-snapshot` | Command Center alerts, money position, window comparisons | Durable queue counts and definitions | `ADMIN_SUMMARY` | Integrated |
| `/admin/deals`, `/admin/deals/{id}` | Deals workspace, Deal detail | Queue + ledger entries, external escrow, M-Pesa, dispute cases | `ADMIN_SUMMARY` / `VIEW_TRANSACTIONS` | Integrated |
| `/admin/listings` | Listings workspace | Status/category/seller/name filters + status counts | `ADMIN_SUMMARY` | Integrated |
| `/admin/stores` | Stores workspace | search/county/category, soft-deleted excluded by default | `ADMIN_SUMMARY` | Integrated |
| `/admin/disputes` | Disputes workspace | Case queue with state counts, rule/AI context, deal amounts | `VIEW_ALL_DISPUTES` | Integrated, read-only |
| `/admin/payments` | Payments workspace | Normalized M-Pesa + ZetuPay queue and whole-table counts | `VIEW_TRANSACTIONS` | Integrated |
| `/admin/finance-integrity` | Finance Integrity workspace | Reconciliation checks that can actually fail | `VIEW_TRANSACTIONS` | Integrated |
| `/admin/health/services` | Service Health workspace + Command Center | Live DB/Redis probes; providers configuration-only (`probe: not_run`) | `ADMIN_SUMMARY` | Integrated |
| `/admin/zeno/activity` | Zeno AI Activity | Durable negotiation/audit counts; explicit `not_instrumented` list | `ADMIN_SUMMARY` | Integrated |
| `/admin/users/{id}` | User detail | Profile, stats, recent deals, fraud events, recent audit | `MANAGE_USERS` | Integrated |
| `/admin/fraud-events` | Fraud workspace | Event array; open events resolvable with reviewer + audit | `MANAGE_USERS` | Integrated |
| `/admin/transactions` | Transactions workspace | Legacy M-Pesa rows with status filter | `VIEW_TRANSACTIONS` | Integrated |
| `/admin/audit-logs` | Audit Logs workspace | action/actor/resource filters | `ADMIN_SUMMARY` | Integrated |
| `/admin/ledger-integrity`, `/admin/ai-savings`, `/admin/workflow-versions`, `/admin/event-metrics`, `/admin/event-catalog`, `/admin/diagnostics/*` | Diagnostics/analytics surfaces | Process-local or diagnostic contracts, labelled as such | `ADMIN_SUMMARY` | Integrated |
| `/health` | Overview handshake | `{status:"healthy",version}` | Public | Integrated |

## Write surface

| Endpoint | Backend behavior |
|---|---|
| `POST /admin/users/{id}/flag` | Reason required; no-op when already flagged (no repeated -30); first flag creates a `FraudEvent`; idempotency-guarded; audited with before/after and request id |
| `POST /admin/users/{id}/unflag` | Audited, idempotency-guarded |
| `POST /admin/users/{id}/recompute-trust` | 404 for unknown user; audited |
| `POST /admin/users/{id}/promote-admin` | Reason required; audited |
| `POST /admin/fraud-events/{id}/resolve` | Records reviewer + audit; repeat calls report `changed: false` |
| `POST /admin/media/backfill` | Audited |

All mutations use granular `require_permission` dependencies. The frontend sends `X-Idempotency-Key` (the header the guard reads) and a `reason` body where required.

## Verification evidence

- Backend: `tests/test_admin_ops.py` — 19 tests covering authorization, summary accuracy, flag-once semantics, audit contents, idempotency replay, finance-integrity transitions, payments normalization, dispute counts, health probes, Zeno durability labels. Full backend suite in this environment: **2072 passed, 92 skipped**.
- Frontend: `pnpm test` (8 contract tests), `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
- Route registration verified with unauthenticated ASGI requests (401) for every new admin route.
- Live end-to-end smoke: local backend (SQLite, no Redis) + production build of this dashboard, admin login through `/api/auth/login`, then every read endpoint proxied and contract-validated (20/20 HTTP 200), including dynamic `/admin/users/{id}` and `/admin/deals/{id}` detail routes.
- Mutations through the dashboard proxy: flag (`changed: true`, trust 100 → 70, audit row with before/after), replay with the same key and repeat with a fresh key both stay at 70 (`already_flagged`) — no repeated penalty; missing reason → 422 `reason_required`; missing/short idempotency key → 400 `idempotency_key_required`; promote, unflag, recompute, and fraud resolve (verified `resolved: true`, `reviewed_by_admin: true`) all return audited results.
- Audit correlation: the dashboard request id is forwarded as `X-Request-ID` and recorded in the backend audit `detail.request_id`.
- Unauthenticated page access redirects to `/login?reason=restricted`; `/`, `/deals`, `/deals/{id}`, `/users/{id}`, `/payments`, `/finance-integrity`, `/service-health` all render 200.
- Two integration bugs were found and fixed by this smoke run: the allowlist key normalization (proxy paths lack the leading slash that `ADMIN_ENDPOINTS` values carry) and `event-metrics.registered_handlers`, which is a subscriber-count map, not a number.

## Still required before production claim

- Push/redeploy the backend changes (the working tree is not the deployed API) and configure the Railway deploy secrets.
- Add real Redis to the local test environment to exercise the idempotency reservation/replay path against a live store (the flag-once database guard was verified live; literal response replay needs Redis).
- Seed a non-production environment with realistic data and validate the dashboard end-to-end against it (the smoke run used a minimal SQLite database).
- Publish regenerated OpenAPI/contract artifacts so frontend schemas can be generated rather than mirrored.
- Define admin sub-roles if distinct admin capabilities are ever required (the permission enum exists; all current admins hold every flag).
