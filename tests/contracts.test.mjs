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

test("idempotency header matches the backend guard (X-Idempotency-Key)", async () => {
  const admin = await readFile(resolve(root, "lib/api/admin.ts"), "utf8");
  assert.match(admin, /X-Idempotency-Key/);
  assert.doesNotMatch(admin, /headers\["Idempotency-Key"\]/);
  const recordDetail = await readFile(resolve(root, "components/dashboard/record-detail.tsx"), "utf8");
  assert.match(recordDetail, /"Idempotency-Key": crypto\.randomUUID\(\)/);
});

test("KPI grid labels filtered counts, not unfiltered totals", async () => {
  const kpi = await readFile(resolve(root, "components/dashboard/kpi-grid.tsx"), "utf8");
  assert.match(kpi, /s\.listings_active/);
  assert.match(kpi, /s\.deals_released/);
  assert.match(kpi, /s\.dispute_cases_active/);
  assert.doesNotMatch(kpi, /label: "Active listings"[^}]*s\.listings\.toLocaleString/);
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
