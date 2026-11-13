import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("player fixtures bind deployed accounts through the shared constructor", async () => {
  const root = new URL("../tests/", import.meta.url);
  const paths = (await readdir(root, { recursive: true })).filter(
    (path) => path.endsWith(".cairo") && path !== "support/src/tests.cairo",
  );
  const violations = [];
  for (const path of paths) {
    const source = (await readFile(new URL(path, root), "utf8")).replace(/->\s+(?:\w+::)*Deployment\s*\{/g, "{");
    if (/\bDeployment\s*\{/.test(source)) violations.push(path);
  }
  assert.deepEqual(
    violations,
    [],
    "Use world_test_support::tests::bind_player; a plain address is not an authenticated player",
  );
});
