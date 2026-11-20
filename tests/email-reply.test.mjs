import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function sourceFiles(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(relative)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

test("the Resend credential and API never appear in the admin application", async () => {
  // The dashboard only ever talks to the BROKA API through its own proxy; the
  // sending key lives in the backend and nowhere here.
  const files = [
    ...(await sourceFiles("app")),
    ...(await sourceFiles("components")),
    ...(await sourceFiles("hooks")),
    ...(await sourceFiles("lib")),
    "middleware.ts",
    "next.config.ts",
    ".env.example",
  ];
  for (const file of files) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /RESEND/i, `${file} must not mention the Resend key or settings`);
    assert.doesNotMatch(source, /api\.resend\.com/i, `${file} must not call the email provider`);
    assert.doesNotMatch(source, /\bre_[A-Za-z0-9]{8,}/, `${file} must not hold something shaped like a Resend key`);
  }
});

test("the Email Reply browser code reaches the backend only through the same-origin proxy", async () => {
  const client = await readFile(resolve(root, "lib/api/email.ts"), "utf8");
  assert.match(client, /\/api\/broka\/admin\/email\/send/);
  assert.doesNotMatch(client, /https?:\/\//, "the client must not contain an upstream URL");
  assert.doesNotMatch(client, /process\.env/, "the client must not read server environment values");
  assert.match(client, /X-Idempotency-Key/, "every send carries a key");
  assert.match(client, /credentials: "same-origin"/);

  for (const file of ["components/email/email-composer.tsx", "hooks/use-send-admin-email.ts", "app/(dashboard)/email-reply/page.tsx"]) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /Authorization\s*:/, `${file} must not attach an Authorization header`);
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/, `${file} must not store anything in the browser`);
  }
});

test("the request schema is strict and carries no sender, Reply-To or HTML field", async () => {
  const schemas = await readFile(resolve(root, "lib/api/email-schemas.ts"), "utf8");
  const request = schemas.slice(schemas.indexOf("export const AdminEmailSendInSchema"), schemas.indexOf("export type AdminEmailSendIn"));
  assert.match(request, /\}\)\.strict\(\)/, "unknown fields must be refused");
  for (const field of ["from", "sender", "reply_to", "replyTo", "html", "cc", "bcc"]) {
    assert.doesNotMatch(request, new RegExp(`\\b${field}\\s*:`), `the request must not define a ${field} field`);
  }
});

test("the proxy allowlists exactly POST admin/email/send, and demands an idempotency key for it", async () => {
  const proxy = await readFile(resolve(root, "app/api/broka/[...path]/route.ts"), "utf8");
  assert.match(proxy, /pattern: \/\^admin\\\/email\\\/send\$\//);
  const entry = proxy.slice(proxy.indexOf("pattern: /^admin\\/email\\/send$/"));
  const block = entry.slice(0, entry.indexOf("},"));
  assert.match(block, /requestSchema: AdminEmailSendInSchema/);
  assert.match(block, /responseSchema: AdminEmailSendOutSchema/);
  assert.match(block, /requiresIdempotencyKey: true/);
  assert.equal((proxy.match(/admin\\\/email/g) ?? []).length, 1, "no other email path is allowlisted");
});

test("Email Reply is in the navigation and the route manifest, and is not an inbox", async () => {
  const shell = await readFile(resolve(root, "components/layout/admin-shell.tsx"), "utf8");
  assert.match(shell, /label: "Email Reply", href: "\/email-reply"/);
  const manifest = JSON.parse(await readFile(resolve(root, "public/manus-routes.json"), "utf8"));
  assert.ok(manifest.routes.some((route) => route.path === "/email-reply"), "missing /email-reply in the route manifest");

  // Sending only: nothing here fetches mail or lists what was sent.
  for (const file of ["lib/api/email.ts", "hooks/use-send-admin-email.ts", "components/email/email-composer.tsx"]) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /useQuery|admin\/email\/(inbox|messages|sent|list|threads)/i, `${file} must not read mail`);
  }
});
