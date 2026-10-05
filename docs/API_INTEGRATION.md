# BROKA FastAPI integration audit

**Runtime API:** `https://api.broka.co.ke`  
**Reference archive:** `/home/ubuntu/upload/broka-latest-release(10).zip`  
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

The source router exposes `/admin/summary`, `/users`, `/ai-savings`, `/ledger-integrity`, `/audit-logs`, `/fraud-events`, `/transactions`, `/workflow-versions`, `/event-metrics`, `/event-catalog`, `/diagnostics/econfirm`, and `/diagnostics/client-ip`. The frontend allowlist and Zod schemas mirror the source return dictionaries and arrays.

`GET /health` is also registered and validated as `{status:"healthy",version}`.

## Administrative writes

The source router exposes four confirmed user actions:

- `POST /admin/users/{user_id}/flag`
- `POST /admin/users/{user_id}/unflag`
- `POST /admin/users/{user_id}/recompute-trust`
- `POST /admin/users/{user_id}/promote-admin`

The frontend requires a same-origin browser request, a confirmation flow, and an idempotency key. It forwards that key as `Idempotency-Key`; the supplied backend source currently does not read or enforce it, and the inspected mutations do not call `record_audit()`.

## Authorization finding

Every admin route in `api/domains/admin/router.py` uses `Depends(require_admin)`. `api/core/permissions.py` defines granular flags such as `ADMIN_SUMMARY`, `MANAGE_USERS`, `PROMOTE_ADMIN`, `VIEW_TRANSACTIONS`, and `OVERRIDE_ESCROW`, but those dependencies are not attached to the admin routes in the supplied source. This remains a backend hardening item.

## OpenAPI mismatch

The live OpenAPI document currently advertises empty success schemas for these responses even though the supplied source contains concrete return dictionaries. The frontend therefore labels its schemas **source-derived** and fails closed on drift. The backend CI should publish a regenerated OpenAPI document or a versioned contract artifact consumed by the frontend build.
