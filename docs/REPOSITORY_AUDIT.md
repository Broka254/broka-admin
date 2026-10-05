# BROKA Admin repository audit

**Audit date:** 2026-10-03  
**Frontend revision before this pass:** `f04cb0d`  
**Backend reference:** `/home/ubuntu/upload/broka-latest-release(10).zip`  
**Backend source root:** `broka-latest-release/backend`

## Scope inspected

The supplied archive contains a substantial FastAPI backend, SQLAlchemy database layer, migrations, fine-grained permissions, audit utilities, domain routers, and a large pytest suite. It is a reference archive, not the canonical repository bound to the managed BROKA Admin project; no backend files were copied into the frontend repository.

| Area | Reference evidence | Admin integration status |
|---|---|---|
| FastAPI application | `backend/main.py`, domain routers, `requirements.txt` | Source inspected; live API remains runtime authority. |
| Admin router | `backend/api/domains/admin/router.py` | Verified route paths and return shapes integrated into runtime schemas. |
| Authentication | `backend/api/domains/auth/router.py`, `service.py`, `refresh_router.py` | Login, `/auth/me`, refresh and revoke payloads integrated and validated. |
| Database models | `backend/api/database.py`, migrations, domain models | Read for field semantics; not duplicated into frontend. |
| Permissions | `backend/api/core/permissions.py` | `require_admin` is used by every admin router operation; granular permission flags exist but are not attached to admin routes. |
| Audit utility | `backend/api/core/audit.py` | Exists and is intended for writes, but the inspected admin user mutations do not call `record_audit()`. |
| Tests | `backend/tests/` | Extensive backend tests exist, including auth hardening, fraud, ledger integrity, idempotency, and route ordering. They were not executed because the archive does not include a configured runtime/database environment. |
| Frontend | `brokaadmin` Next.js project | Uses server-only proxy, runtime Zod validation, protected shell, and verified backend payloads. |

## Verified backend admin routes and response shapes

The source router exposes:

- `GET /admin/summary` → `users`, `listings`, `deals`, `commission_earned_kes`, `disputes`, `flagged_users`.
- `GET /admin/users` → array of user records with identity, verification, trust, flag, deal, rating, and created-at fields. Supports `limit`, `offset`, and `flagged_only`; it does not return pagination metadata.
- `POST /admin/users/{id}/promote-admin` → `{ok, user_id}`.
- `POST /admin/users/{id}/flag` → `{ok, user_id, trust_score}`.
- `POST /admin/users/{id}/unflag` → `{ok, user_id, trust_score}`.
- `POST /admin/users/{id}/recompute-trust` → `{user_id, trust_score, trust_band}`.
- `GET /admin/ai-savings` → process-local classification savings counters.
- `GET /admin/ledger-integrity` → ledger totals, discrepancy, negative escrow deals, and `escrow_integrity_ok`.
- `GET /admin/audit-logs` → audit records with actor, action, resource, detail, IP, and timestamp fields.
- `GET /admin/fraud-events` → fraud records with reason, trust score, reviewer, resolution, and timestamp fields.
- `GET /admin/transactions` → transaction records with deal/buyer, phone, amount, receipt, status, and timestamp fields.
- `GET /admin/workflow-versions`, `/event-metrics`, `/event-catalog`, `/diagnostics/econfirm`, and `/diagnostics/client-ip` → source-defined operational payloads.
- `GET /health` → `{status: "healthy", version}`.

The frontend now validates these payloads at the server proxy boundary and returns a structured `contract_validation_failed` response instead of forwarding malformed or opaque data.

## Verified authentication source contract

- `POST /auth/login` accepts `{phone, password}` and returns bearer tokens plus user fields.
- `GET /auth/me` returns the full account dictionary, including `is_admin`, `trust_score`, `trust_band`, and `is_flagged`.
- `POST /auth/token/refresh` accepts `{refresh_token}` and returns an access token, bearer type, expiry, and optionally a rotated refresh token.
- `POST /auth/token/revoke` accepts `{refresh_token}` and returns `204`.

The frontend accepts only source-compatible token and admin identity payloads, retains tokens in HttpOnly cookies, and keeps only a minimal identity projection in client components.

## Remaining production risks

1. The deployed OpenAPI still advertises empty success schemas, so the synchronized contracts are source-derived rather than generated from a published backend contract.
2. The backend admin router depends on `require_admin`, not the granular `Permission` flags defined in `api/core/permissions.py`; role-specific admin access is not yet enforceable from the route source.
3. The inspected user mutations update state and commit, but do not call `record_audit()` or accept/verify an idempotency key. The frontend sends an idempotency key and enforces same-origin browser requests, but backend enforcement remains required.
4. The users endpoint has limit/offset but no total count, cursor, search, detail, suspension, or pagination metadata.
5. Disputes, listings, deals, stores, escrow intervention, commission analytics, historical analytics, and admin reports remain without dedicated admin-scoped contracts in the inspected admin router.
6. The backend tests were not run in this sandbox because no backend dependency environment, database, or secret configuration was supplied.

## Delivery state

The frontend is **source-contract integrated but not production-ready** until the backend route enforcement, audit/idempotency behavior, published OpenAPI, and end-to-end environment are validated together.
