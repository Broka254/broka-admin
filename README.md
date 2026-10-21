# BROKA Admin Control Center

A separate, dark-first Next.js administrative application for **BROKA**. This project is an interface over the existing FastAPI API; it does not connect to PostgreSQL, create a new database, duplicate business logic, or invent platform state.

## Requirements

- Node.js 22+
- pnpm 11.25+
- A BROKA FastAPI API URL available only to the server

## Local setup

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Set `BROKA_COOKIE_SECURE=false` only for a plain HTTP local development session. Keep the default secure/SameSite=None cookie behavior for HTTPS Preview and production.

## API boundary

The application uses:

- `POST /auth/login` with the verified `phone` and `password` request body;
- `GET /auth/me` to require `is_admin === true` before rendering protected routes;
- `POST /auth/token/refresh` for one refresh/retry path;
- `POST /auth/token/revoke` at logout; and
- an allowlisted server-side proxy for verified `/admin/*` reads and supported
  communications mutations.

The proxy forwards `X-Total-Count` when the backend returns it, so a filtered users total is never inferred from the number of rows on the current page. Tokens are held only in HttpOnly cookies. The browser does not receive tokens, and no token is written to `localStorage` or `sessionStorage`.

The retrieved OpenAPI document leaves success schemas for all inspected admin endpoints empty. Consequently, the UI deliberately renders **response schema unavailable** rather than mapping unverified fields into KPI values, financial tables, charts, risk levels, or activity records. See [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md) and [`BACKEND_GAPS.md`](BACKEND_GAPS.md).

## Notification surfaces

- `/alerts` is a **derived operational view** over `/admin/ops-snapshot` and `/admin/health/services`. It shows severity, snapshot time and links, but no unread count or acknowledgement because the backend does not record alert state.
- `/communications` is the remediated Service Communications workspace for the BROKA backend service-communications domain. It provides draft CRUD, server-side title search and pagination, current-definition audience preview gating, timezone-safe expiry editing and clearing, scheduling, publication, cancellation, delivery-campaign completion, targeted retry of backend-eligible recipients, and worker diagnostics. FCM provider acceptance, in-app availability/read acknowledgements, and device evidence are kept distinct; device delivery is shown as unavailable because the backend's `confirmed_delivered` metric includes in-app-only rows. Supported channels are `in_app` (required) and `push` (optional); SMS, email, app_release, and withdrawal endpoints are not implemented.

  Production approval for communications remains blocked by three backend gaps: draft creation has no server-side idempotency enforcement, `confirmed_delivered` is not device evidence, and the delivery worker marks published incidents completed without verifying incident resolution. The frontend reuses one request key for retries of the same logical draft payload, but does not claim server deduplication. Publication and scheduling both require a current, allowed audience preview; targeted retry always sends an explicit non-empty list of backend-eligible recipients, because the backend treats an omitted list as "retry every eligible recipient". See [`BACKEND_GAPS.md`](BACKEND_GAPS.md) and [`docs/NOTIFICATION_CONTRACTS.md`](docs/NOTIFICATION_CONTRACTS.md).

The header's API badge only turns green after a validated `/health` response. `BROKA_API_URL` being present is not treated as proof of connectivity or endpoint availability.

## Design system

The admin uses the Broka public product language: ink navy surfaces, violet primary actions, cyan system signals, restrained amber commerce cues, and a compact Montserrat/Inter-style hierarchy. See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). The public Broka site and connected repositories were used as read-only references; this repository is the only implementation target.

## Android admin app

`android-wrapper/` contains a dedicated Android APK (`com.broka.admin`) that opens this hosted dashboard in a restricted HTTPS-only WebView. It changes nothing in the Next.js app, the API proxy, or the authentication flow. Building, signing, and installing are documented in [`docs/ANDROID_ADMIN_APP.md`](docs/ANDROID_ADMIN_APP.md). The APK workflow `.github/workflows/build-admin-apk.yml` is manual-only and independent of `ci.yml` and `deploy-railway.yml`.

## GitHub Actions build

`.github/workflows/ci.yml` is a **validation-only** workflow. It runs on pull requests, pushes to `main`, and manual dispatch, and it only: installs with the frozen pnpm lockfile, runs unit and contract tests, typechecks, lints, builds the production Next.js app, and uploads a 14-day `broka-admin-next-build-<sha>` artifact. It contains no deployment job, no Railway command, and no deployment credentials, so an ordinary push or pull request can never deploy the admin application.

Deployment lives in the separate, **manual-only** `.github/workflows/deploy-railway.yml`:

- The only trigger is `workflow_dispatch`; there is no `push` or `pull_request` trigger.
- A `require-main` guard job fails the run when the workflow is dispatched from a branch other than `main`, and the deploy job also carries a `github.ref == 'refs/heads/main'` condition.
- The deploy job runs in the protected `production` environment and reads `RAILWAY_TOKEN` and `RAILWAY_SERVICE_ID` from that environment's secrets.

To enable the deployment job, add these GitHub **environment secrets** under `Settings → Environments → production`:

- `RAILWAY_TOKEN`: a Railway project token; never commit or paste it into source.
- `RAILWAY_SERVICE_ID`: the service ID for the `broka-admin` Railway service. This is an identifier, not a secret, but keeping it in the environment keeps the workflow portable.

**Manual verification still required:** the YAML can require the `production` environment, but it cannot create required reviewers or deployment protection rules. Configure those in `Settings → Environments → production` and confirm the approval gate before the first manual deployment. The workflow was not run and no `railway up` was executed while these changes were made.

The Railway service variables remain managed by Railway (`BROKA_API_URL`, `BROKA_API_TIMEOUT`, and `BROKA_COOKIE_SECURE`).

## Railway deployment

1. Create a new Railway service named `broka-admin` from this repository.
2. Set `BROKA_API_URL` and optional `BROKA_API_TIMEOUT` as server-only Railway variables.
3. Use `pnpm build` for build and `pnpm start` for start. Railway should provide `PORT` automatically.
4. Configure `admin.broka.co.ke` with HTTPS.
5. Configure FastAPI CORS/cookie/token behavior for this specific admin origin and verify the final auth response schemas before enabling operational data views.
6. Set `BROKA_COOKIE_SECURE=true` in production. Do not add backend secrets, API keys, M-Pesa credentials, database URLs, or Firebase credentials to this project.

## Quality commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm zip
```

Railway uses `/api/live` for process liveness. `/api/health` remains the readiness/API-status endpoint and returns `503` when the BROKA API is unreachable; it no longer determines whether the web process is restarted.

`pnpm zip` writes `../broka-admin.zip` and excludes dependencies, build artifacts, `.git`, and environment files.
