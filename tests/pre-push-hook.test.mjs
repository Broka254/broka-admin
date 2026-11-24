import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const hook = new URL("../.githooks/pre-push", import.meta.url).pathname;

function run(testCmd) {
  return spawnSync("sh", [hook], {
    env: { ...process.env, PRE_PUSH_TEST_CMD: testCmd },
    encoding: "utf8",
  });
}

test("pre-push hook exits non-zero when the tests fail", () => {
  const result = run("exit 3");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /push blocked/);
});

test("pre-push hook exits zero when the tests pass", () => {
  assert.equal(run("true").status, 0);
});
