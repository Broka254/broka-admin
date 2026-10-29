import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { load as loadYaml } from "js-yaml";

const root = resolve(import.meta.dirname, "..");

async function readWorkflow(name) {
  const source = await readFile(resolve(root, ".github/workflows", name), "utf8");
  return { source, workflow: loadYaml(source) };
}

function stepRuns(job) {
  return (job.steps ?? []).flatMap((step) => (typeof step.run === "string" ? [step.run] : []));
}

async function collectSourceFiles(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(relative)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

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

test("CI validates and uploads an artifact with no deployment job or command", async () => {
  const { source, workflow } = await readWorkflow("ci.yml");
  assert.deepEqual(Object.keys(workflow.jobs), ["validate"]);

  const validate = workflow.jobs.validate;
  const runs = stepRuns(validate);
  const requiredCommands = [
    "pnpm install --frozen-lockfile",
    "pnpm test",
    "pnpm typecheck",
    "pnpm lint",
    "pnpm build",
  ];
  for (const command of requiredCommands) {
    assert.ok(runs.includes(command), `CI must run ${command} as a complete step command`);
  }
  const commandOrder = requiredCommands.map((command) => runs.indexOf(command));
  assert.deepEqual(commandOrder, [...commandOrder].sort((left, right) => left - right), "CI validation commands must run in the declared order");

  const uploadIndex = validate.steps.findIndex(
    (step) => step.uses === "actions/upload-artifact@v4" && step.with?.name === "broka-admin-next-build-${{ github.sha }}",
  );
  assert.ok(uploadIndex > validate.steps.findIndex((step) => step.run === "pnpm build"), "build artifact upload must follow the production build");
  assert.deepEqual(validate.steps[uploadIndex].with.path.split("\n").map((entry) => entry.trim()).filter(Boolean), [
    ".next", "public", "package.json", "pnpm-lock.yaml", "next.config.ts", "railway.toml",
  ]);

  assert.doesNotMatch(source, /railway\s+up/i, "CI must not run a Railway deployment command");
  assert.doesNotMatch(source, /deploy-railway/i, "CI must not reference a deployment job");
  assert.doesNotMatch(source, /secrets\.RAILWAY_/i, "CI must not receive Railway credentials");
  assert.ok(validate.steps.every((step) => step.environment === undefined), "validation must not use a deployment environment");
});

test("Railway deployment is isolated in a manual-only main-branch workflow", async () => {
  const { source, workflow } = await readWorkflow("deploy-railway.yml");
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"], "deployment must only be manually triggered");
  assert.equal(workflow.on.push, undefined);
  assert.equal(workflow.on.pull_request, undefined);
  assert.equal(workflow.on.workflow_run, undefined);

  assert.deepEqual(Object.keys(workflow.jobs), ["require-main", "deploy-railway"]);
  const guard = workflow.jobs["require-main"];
  const guardStep = guard.steps.find((step) => step.if === "github.ref != 'refs/heads/main'");
  assert.ok(guardStep, "deployment workflow must explicitly reject non-main manual runs");
  assert.match(guardStep.run, /exit 1/);

  const deploy = workflow.jobs["deploy-railway"];
  const deployNeeds = Array.isArray(deploy.needs) ? deploy.needs : [deploy.needs];
  assert.deepEqual(deployNeeds, ["require-main"]);
  assert.equal(deploy.if, "github.ref == 'refs/heads/main'");
  assert.equal(deploy.environment?.name, "production", "deployment job must use the protected production environment");
  assert.ok(Object.prototype.hasOwnProperty.call(workflow, "on"), "workflow trigger map must be parsed as YAML structure");

  const deployRuns = stepRuns(deploy);
  assert.ok(deployRuns.some((run) => /railway up --service "\$RAILWAY_SERVICE_ID" --ci/.test(run)));

  for (const step of deploy.steps) {
    if (!step.env) continue;
    if (step.env.RAILWAY_TOKEN !== undefined) {
      assert.equal(step.env.RAILWAY_TOKEN, "${{ secrets.RAILWAY_TOKEN }}");
    }
    if (step.env.RAILWAY_SERVICE_ID !== undefined) {
      assert.equal(step.env.RAILWAY_SERVICE_ID, "${{ secrets.RAILWAY_SERVICE_ID }}");
    }
  }
  assert.match(source, /environment secrets on the\s+production environment/, "workflow must document environment-secret configuration");
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
  assert.match(alertCenter, /useAdminAlerts/);
  assert.match(alertCenter, /useAlertsStream/);
  assert.match(alertCenter, /unread/);
  const shell = await readFile(resolve(root, "components/layout/admin-shell.tsx"), "utf8");
  assert.match(shell, /useUnreadAlerts/);
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

test("browser code never calls the protected backend directly", async () => {
  const browserFiles = [
    ...(await collectSourceFiles("components")),
    ...(await collectSourceFiles("hooks")),
  ];
  for (const file of browserFiles) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /process\.env\./, `${file} must not read server environment values`);
    assert.doesNotMatch(source, /Authorization\s*:/, `${file} must not attach an Authorization header`);
    assert.doesNotMatch(source, /NEXT_PUBLIC_[A-Z_]*API/, `${file} must not read a published API credential`);
  }

  const communications = await readFile(resolve(root, "lib/api/communications.ts"), "utf8");
  assert.match(communications, /\/api\/broka\//, "communications client must use the same-origin proxy");
  assert.doesNotMatch(communications, /https?:\/\//, "communications client must not contain an upstream URL");
});

test("session tokens stay in server-managed cookies", async () => {
  const cookies = await readFile(resolve(root, "lib/auth/cookies.ts"), "utf8");
  assert.match(cookies, /httpOnly: true/);
  assert.match(cookies, /sameSite/);
  assert.match(cookies, /secure/);

  const login = await readFile(resolve(root, "app/api/auth/login/route.ts"), "utf8");
  assert.match(login, /response\.cookies\.set\(ACCESS_COOKIE/);
  assert.match(login, /response\.cookies\.set\(REFRESH_COOKIE/);
  assert.doesNotMatch(login, /NextResponse\.json\(\{\s*tokens/, "login must not return tokens to the browser");

  for (const file of [...(await collectSourceFiles("components")), ...(await collectSourceFiles("hooks"))]) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/, `${file} must not store credentials in the browser`);
  }
});

test("communications client keeps targeted retries explicit and the proxy rejects unsupported fields", async () => {
  const communications = await readFile(resolve(root, "lib/api/communications.ts"), "utf8");
  assert.match(communications, /recipientIds\.length === 0/, "retry client must refuse an empty selection");
  assert.match(communications, /empty_retry_selection/);

  const schemas = await readFile(resolve(root, "lib/api/schemas.ts"), "utf8");
  assert.match(schemas, /CommunicationCreateInSchema[\s\S]{0,1400}?\}\)\.strict\(\)/, "create request schema must reject unknown fields");
  assert.match(schemas, /CommunicationUpdateInSchema[\s\S]{0,1400}?\}\)\.strict\(\)/, "update request schema must reject unknown fields");
  assert.match(schemas, /RetryInSchema[\s\S]{0,400}?\}\)\.strict\(\)/, "retry request schema must reject unknown fields");
});
