# BROKA Admin implementation status

**Status:** Source-contract integrated; production validation still required.  
**Reference:** `broka-latest-release/backend/api/domains/admin/router.py`, auth service/router, permissions, audit utility, and backend tests.

| Endpoint | Frontend surface | Source response contract | Source authorization | Audit/idempotency | Status |
|---|---|---|---|---|---|
| `/admin/summary` | Overview KPI cards | Verified six-field summary object | `require_admin` | Read-only | Integrated with runtime validation |
| `/admin/users` | Users workspace | Verified user array; limit/offset/flagged_only only | `require_admin` | Read-only | Integrated; search/count/detail still unavailable |
| `/admin/users/{id}/flag` | User detail action | Verified `{ok,user_id,trust_score}` | `require_admin` | Source does not record audit or enforce idempotency | Frontend guarded; backend hardening required |
| `/admin/users/{id}/unflag` | User detail action | Verified `{ok,user_id,trust_score}` | `require_admin` | Source does not record audit or enforce idempotency | Frontend guarded; backend hardening required |
| `/admin/users/{id}/recompute-trust` | User detail action | Verified `{user_id,trust_score,trust_band}` | `require_admin` | Source does not record audit or enforce idempotency | Frontend guarded; backend hardening required |
| `/admin/users/{id}/promote-admin` | User detail action | Verified `{ok,user_id}` | `require_admin`; granular flag exists but is not attached | High-impact action has no source audit call | Frontend guarded; backend hardening required |
| `/admin/fraud-events` | Fraud workspace | Verified fraud event array | `require_admin` | Read-only route | Integrated schema; resolution workflow absent |
| `/admin/transactions` | Transactions workspace | Verified transaction array | `require_admin` | Read-only route | Integrated schema; filters/pagination policy absent |
| `/admin/audit-logs` | Audit Logs workspace | Verified audit record array | `require_admin` | Read-only route | Integrated schema; append-only writes not proven for admin actions |
| `/admin/ledger-integrity` | Diagnostics boundary | Verified ledger integrity object | `require_admin` | Diagnostic read | Integrated schema; UI detail surface pending |
| `/admin/ai-savings` | Zeno savings workspace | Verified process-local counters | `require_admin` | Read-only, resets per worker | Integrated schema; not historical/billing data |
| `/admin/workflow-versions` | Workflow workspace | Verified current version + versions | `require_admin` | Read-only | Integrated schema; mutation intentionally absent |
| `/admin/event-metrics` | Platform analytics | Verified in-process counts | `require_admin` | Read-only, resets per worker | Integrated schema; historical series absent |
| `/admin/event-catalog` | Events workspace | Verified catalog object | `require_admin` | Read-only | Integrated schema; event instances absent |
| `/admin/diagnostics/econfirm` | Diagnostics | Source-defined diagnostic object | `require_admin` | Sensitive read | Schema registered; UI detail pending |
| `/admin/diagnostics/client-ip` | Diagnostics | Source-defined IP/config object | `require_admin` | Sensitive read | Schema registered; PII policy needs review |
| `/health` | Overview health handshake | `{status:"healthy",version}` | Public | Read-only | Integrated schema |
| `/auth/login` | Login | Phone/password login + bearer/refresh tokens | Rate-limited source route | Security event behavior not admin-specific | Integrated schema and cookies |
| `/auth/me` | Protected shell | Full account dictionary with `is_admin` | Bearer auth | Existing auth source | Integrated minimal projection |
| `/auth/token/refresh` | Session renewal | Access token + optional rotated refresh token | Refresh token | Existing rotation/grace source | Integrated |
| `/auth/token/revoke` | Logout | `204` | Refresh token | Existing revoke source | Integrated |

## Completed in this pass

- Added runtime Zod validation for source-derived admin and authentication payloads.
- Replaced the allowlisted proxy’s placeholder availability responses with validated FastAPI payloads.
- Connected Overview KPI cards and health status to verified backend data with semantically conservative total labels.
- Connected the Users workspace to verified user records.
- Added request IDs and structured contract-failure responses without logging payload values.
- Added verified renderers for fraud events, transactions, audit logs, AI savings, ledger integrity, event metrics/catalog, workflow versions, E-Confirm diagnostics, and client-IP diagnostics.
- Added route-manifest coverage, CSP/HSTS headers, Node smoke tests, and GitHub Actions CI.
- Forwarded idempotency keys from confirmed user mutations; retained same-origin browser checks.

## Still required before production claim

- Add granular permission dependencies to backend admin routes and define role policy.
- Add `record_audit()` calls and backend-enforced idempotency to administrative mutations.
- Publish non-empty response schemas in the live OpenAPI or generate frontend schemas from CI artifacts.
- Add admin-scoped listings, deals, stores, disputes, escrow, commissions, reports, and historical analytics endpoints.
- Run the supplied backend pytest suite with its database/secret environment and add frontend integration/E2E coverage.
- Validate the deployed API and admin app together against a seeded non-production environment.
