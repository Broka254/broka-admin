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
- an allowlisted server-side proxy for verified, read-only `/admin/*` endpoints.

Tokens are held only in HttpOnly cookies. The browser does not receive tokens, and no token is written to `localStorage` or `sessionStorage`.

The retrieved OpenAPI document leaves success schemas for all inspected admin endpoints empty. Consequently, the UI deliberately renders **response schema unavailable** rather than mapping unverified fields into KPI values, financial tables, charts, risk levels, or activity records. See [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md) and [`BACKEND_GAPS.md`](BACKEND_GAPS.md).

## Railway deployment

1. Create a new Railway service named `broka-admin` from this repository.
2. Set `BROKA_API_URL` and optional `BROKA_API_TIMEOUT` as server-only Railway variables.
3. Use `pnpm build` for build and `pnpm start` for start. Railway should provide `PORT` automatically.
4. Configure `admin.broka.co.ke` with HTTPS.
5. Configure FastAPI CORS/cookie/token behavior for this specific admin origin and verify the final auth response schemas before enabling operational data views.
6. Set `BROKA_COOKIE_SECURE=true` in production. Do not add backend secrets, API keys, M-Pesa credentials, database URLs, or Firebase credentials to this project.

## Quality commands

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm zip
```

`pnpm zip` writes `../broka-admin.zip` and excludes dependencies, build artifacts, `.git`, and environment files.
