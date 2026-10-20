import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("route manifest is valid and unique", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "public/manus-routes.json"), "utf8"));
  assert.ok(Array.isArray(manifest.routes));
  const paths = manifest.routes.map((route) => route.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/users/:id"));
  assert.ok(paths.includes("/diagnostics/client-ip"));
});

test("source-derived resource registry includes all verified admin reads", async () => {
  const source = await readFile(resolve(root, "lib/api/admin.ts"), "utf8");
  for (const path of [
    "/admin/summary", "/admin/users", "/admin/fraud-events", "/admin/transactions", "/admin/audit-logs",
    "/admin/ledger-integrity", "/admin/diagnostics/econfirm", "/admin/diagnostics/client-ip",
    "/admin/ops-snapshot", "/admin/deals", "/admin/listings", "/admin/stores", "/admin/disputes",
    "/admin/payments", "/admin/finance-integrity", "/admin/health/services", "/admin/zeno/activity",
  ]) {
    assert.ok(source.includes(path), `missing ${path}`);
  }
  assert.match(source, /admin\\\/users\\\/\(\[\^\/\]\+\)/, "user detail path pattern missing");
  assert.match(source, /admin\\\/deals\\\/\(\[\^\/\]\+\)/, "deal detail path pattern missing");
  assert.match(source, /RESOURCE_BY_PATH[\s\S]{0,200}path\.slice\(1\)/, "allowlist keys must be normalised without a leading slash");
  assert.match(source, /function normalizePath/, "allowlist must normalise both path spellings");
});

test("mutation boundary keeps all four verified user actions allowlisted with reasons", async () => {
  const admin = await readFile(resolve(root, "lib/api/admin.ts"), "utf8");
  for (const action of ["flag", "unflag", "recompute-trust", "promote-admin"]) assert.match(admin, new RegExp(`/admin/users/\\{user_id\\}/${action}`), `missing ${action}`);
  assert.match(admin, /reasonRequired: true/);
  const route = await readFile(resolve(root, "app/api/broka/users/[userId]/[action]/route.ts"), "utf8");
  assert.match(route, /requireSameOrigin/);
  assert.match(route, /reason_required/);
  const fraudRoute = await readFile(resolve(root, "app/api/broka/fraud-events/[eventId]/resolve/route.ts"), "utf8");
  assert.match(fraudRoute, /requireSameOrigin/);
  assert.match(fraudRoute, /FRAUD_EVENT_ACTIONS/);
});

test("idempotency header matches the backend guard and retries reuse the key", async () => {
  const admin = await readFile(resolve(root, "lib/api/admin.ts"), "utf8");
  assert.match(admin, /X-Idempotency-Key/);
  assert.doesNotMatch(admin, /headers\["Idempotency-Key"\]/);
  const recordDetail = await readFile(resolve(root, "components/dashboard/record-detail.tsx"), "utf8");
  assert.match(recordDetail, /attempt\?\.action === selectedAction \? attempt\.key : crypto\.randomUUID\(\)/);
  assert.match(recordDetail, /"Idempotency-Key": idempotencyKey/);
  const fraud = await readFile(resolve(root, "components/dashboard/validated-resource-view.tsx"), "utf8");
  assert.match(fraud, /idempotencyKey \|\| crypto\.randomUUID\(\)/);
  assert.match(fraud, /"Idempotency-Key": key/);
});

test("KPI grid labels filtered counts, not unfiltered totals", async () => {
  const kpi = await readFile(resolve(root, "components/dashboard/kpi-grid.tsx"), "utf8");
  assert.match(kpi, /s\.listings_active/);
  assert.match(kpi, /s\.deals_released/);
  assert.match(kpi, /s\.dispute_cases_active/);
  assert.doesNotMatch(kpi, /label: "Active listings"[^}]*s\.listings\.toLocaleString/);
});

test("summary tolerates pre-upgrade backends without fabricating counts", async () => {
  const schemas = await readFile(resolve(root, "lib/api/schemas.ts"), "utf8");
  for (const field of ["listings_active", "deals_released", "dispute_cases_active"]) {
    assert.match(schemas, new RegExp(`${field}: z\\.number\\(\\)\\.int\\(\\)\\.nonnegative\\(\\)\\.optional\\(\\)`), `${field} must stay optional`);
  }
  const kpi = await readFile(resolve(root, "components/dashboard/kpi-grid.tsx"), "utf8");
  assert.match(kpi, /Backend upgrade required/);
});

test("new ops response contracts are registered", async () => {
  const schemas = await readFile(resolve(root, "lib/api/schemas.ts"), "utf8");
  for (const schema of ["OpsSnapshotSchema", "AdminDealsSchema", "AdminDealDetailSchema", "AdminListingsSchema", "AdminStoresSchema", "AdminDisputesSchema", "AdminPaymentsSchema", "FinanceIntegritySchema", "ServiceHealthSchema", "ZenoActivitySchema", "AdminUserDetailSchema"]) {
    assert.match(schemas, new RegExp(schema), `missing ${schema}`);
  }
});

test("production workflow uploads a build artifact without deployment side effects", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /pnpm build/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /broka-admin-next-build-/);
});

test("Broka design system keeps the public-site visual anchors", async () => {
  const system = await readFile(resolve(root, "docs/DESIGN_SYSTEM.md"), "utf8");
  for (const token of ["#05060d", "#8b75ff", "#54d7e9", "#dbb75d"]) assert.match(system, new RegExp(token.replace("#", "\\#")));
  assert.match(system, /read-only references/);
});

test("financial labels separate external escrow and recognised commission from cash", async () => {
  const command = await readFile(resolve(root, "components/dashboard/command-center.tsx"), "utf8");
  assert.match(command, /Escrow held externally/);
  assert.match(command, /not BROKA cash/);
  assert.match(command, /Commission recognised/);
  assert.match(command, /not reconciled bank cash/);
  const finance = await readFile(resolve(root, "components/dashboard/validated-resource-view.tsx"), "utf8");
  assert.match(finance, /Escrow held externally/);
  assert.match(finance, /external funds/);
});

test("users total comes from the upstream header, never from page length", async () => {
  const proxy = await readFile(resolve(root, "app/api/broka/[...path]/route.ts"), "utf8");
  assert.match(proxy, /x-total-count/);
  assert.match(proxy, /headers\["X-Total-Count"\] = total/);
  const hook = await readFile(resolve(root, "hooks/use-admin-resource.ts"), "utf8");
  assert.match(hook, /total: number \| null/);
  assert.doesNotMatch(hook, /total: Number\.isFinite\(total\) \? total : rows\.length/);
  const workspace = await readFile(resolve(root, "components/dashboard/resource-workspace.tsx"), "utf8");
  assert.match(workspace, /filtered total unavailable/);
});

test("API status badge reflects verified health, not env presence", async () => {
  const shell = await readFile(resolve(root, "components/layout/admin-shell.tsx"), "utf8");
  assert.match(shell, /useAdminResource\("health"/);
  assert.match(shell, /API health verified/);
  assert.match(shell, /API health check failed/);
  assert.doesNotMatch(shell, /apiConfigured \? "success"/);
  assert.match(shell, /href="\/alerts"/);
  assert.doesNotMatch(shell, /Notifications unavailable until backend event delivery is configured/);
  assert.doesNotMatch(shell, /absolute right-2 top-2 h-1\.5 w-1\.5 rounded-full bg-\[#54d7e9\]/);
});

test("filter clearing updates all filters at once and lists have an empty state", async () => {
  const workspace = await readFile(resolve(root, "components/dashboard/resource-workspace.tsx"), "utf8");
  assert.match(workspace, /onSetMany/);
  assert.match(workspace, /Object\.fromEntries\(active/);
  assert.doesNotMatch(workspace, /active\.forEach/);
  assert.match(workspace, /state="empty"/);
});

test("notification surfaces are honest about backend contracts and delivery evidence", async () => {
  const alertCenter = await readFile(resolve(root, "components/dashboard/alert-center.tsx"), "utf8");
  assert.match(alertCenter, /derived from the live operations snapshot/);
  assert.match(alertCenter, /No bell badge or unread indicator is rendered/);
  const communications = await readFile(resolve(root, "app/(dashboard)/communications/page.tsx"), "utf8");
  assert.match(communications, /Backend Upgrade Required/);
  assert.match(communications, /useAdminCommunications/);
  const deliveryEvidence = await readFile(resolve(root, "components/dashboard/communications/delivery-evidence.tsx"), "utf8");
  assert.match(deliveryEvidence, /FCM Accepted/);
  assert.match(deliveryEvidence, /Device Delivery Evidence/);
  assert.match(deliveryEvidence, /Unavailable/);
  assert.doesNotMatch(deliveryEvidence, /Confirmed Device/);
  const manifest = JSON.parse(await readFile(resolve(root, "public/manus-routes.json"), "utf8"));
  for (const path of ["/alerts", "/communications"]) assert.ok(manifest.routes.some((route) => route.path === path), `missing ${path}`);
  const contracts = await readFile(resolve(root, "docs/NOTIFICATION_CONTRACTS.md"), "utf8");
  for (const endpoint of ["GET /admin/alerts", "POST /admin/alerts/{id}/acknowledge", "GET /admin/communications", "POST /admin/communications/preview", "GET /admin/communications/{id}/stats"]) {
    assert.ok(contracts.includes(endpoint), `missing ${endpoint}`);
  }
});

test("middleware bounds authorization checks and fails closed", async () => {
  const middleware = await readFile(resolve(root, "middleware.ts"), "utf8");
  assert.match(middleware, /AUTH_TIMEOUT_MS = 5000/);
  assert.equal((middleware.match(/AbortSignal\.timeout\(AUTH_TIMEOUT_MS\)/g) ?? []).length, 2);
  assert.match(middleware, /Fail closed/);
});

test("Railway liveness does not depend on the BROKA API", async () => {
  const live = await readFile(resolve(root, "app/api/live/route.ts"), "utf8");
  assert.match(live, /status: "ok"/);
  assert.doesNotMatch(live, /import .*upstreamFetch|process\.env\.BROKA_API_URL/);
  const railway = await readFile(resolve(root, "railway.toml"), "utf8");
  assert.match(railway, /healthcheckPath = "\/api\/live"/);
  const readiness = await readFile(resolve(root, "app/api/health/route.ts"), "utf8");
  assert.match(readiness, /status: response\.ok \? "operational" : "degraded"/);
});
