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
  for (const path of ["/admin/summary", "/admin/users", "/admin/fraud-events", "/admin/transactions", "/admin/audit-logs", "/admin/ledger-integrity", "/admin/diagnostics/econfirm", "/admin/diagnostics/client-ip"]) {
    assert.ok(source.includes(path), `missing ${path}`);
  }
});

test("mutation boundary keeps all four verified user actions allowlisted", async () => {
  const source = await readFile(resolve(root, "app/api/broka/users/[userId]/[action]/route.ts"), "utf8");
  for (const action of ["flag", "unflag", "recompute-trust", "promote-admin"]) assert.match(source, new RegExp(action), `missing ${action}`);
  assert.match(source, /idempotency-key/);
  assert.match(source, /requireSameOrigin/);
});
