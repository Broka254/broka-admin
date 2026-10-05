# BROKA Admin backend-gap report

The supplied backend archive removes the previous source-availability blocker. It provides concrete admin router return dictionaries, authentication service payloads, a database layer, permissions, audit utilities, and tests. The remaining gaps below are implementation and deployment gaps, not missing source.

## Must harden in the backend

| Gap | Evidence | Impact |
|---|---|---|
| Granular admin RBAC | Admin router consistently uses `require_admin`; granular `Permission` enum exists but is not attached | Operations, Trust & Safety, Finance, Support, and Analyst roles cannot be safely separated |
| Audit writes | `record_audit()` exists, but inspected user mutations do not call it | Flag/unflag/trust recompute/promote actions lack authoritative before/after audit evidence |
| Idempotency | `core/idempotency.py` and tests exist, but inspected admin user action signatures do not accept/use an idempotency key | Retries can repeat state-changing admin operations |
| Published contracts | Live OpenAPI returns `{}` for inspected success responses | Frontend schemas are source-derived until backend publishes a versioned artifact |
| User operations | `/admin/users` supports limit/offset/flagged_only only | No search, total count, cursor metadata, detail, suspension, or restore workflow |
| Admin scope | No admin router entries for listings, deals, stores, disputes, escrow queue, commissions, or reports | Required operational sections cannot be made data-backed |
| Historical analytics | `/admin/event-metrics` returns in-process counters | No 24H/7D/30D/90D/1Y history or durable metric definitions |
| Diagnostics policy | E-Confirm and client-IP diagnostics expose operational details | Requires explicit sensitive-diagnostic role policy, retention, and redaction review |

## Frontend integration now completed

- Runtime validation for summary, users, fraud events, transactions, audit logs, ledger integrity, AI savings, workflow versions, event metrics/catalog, health, login, current admin, and refresh payloads.
- Server proxy returns validated backend data rather than placeholder availability objects.
- Contract drift produces `contract_validation_failed` with a request ID and no payload logging.
- Overview KPI cards consume verified `/admin/summary` values.
- Users workspace consumes verified `/admin/users` records.
- Confirmed user mutations enforce same-origin requests and forward idempotency keys.

## Required next backend changes

1. Attach `require_permission(Permission.*)` dependencies to each admin route.
2. Add explicit response models or publish the source-derived contract artifact from backend CI.
3. Add idempotency handling and `record_audit()` calls to every admin mutation, including actor, target, before/after, request ID, and IP policy.
4. Add admin list/detail contracts for listings, deals, stores, disputes, escrow, commissions, and reports.
5. Add pagination metadata and safe search/filter parameters to users, fraud, transactions, and audit logs.
6. Run the backend test suite against a seeded Postgres/Redis environment and connect frontend integration/E2E checks to the same contract.

No missing operation is simulated in the dashboard.
