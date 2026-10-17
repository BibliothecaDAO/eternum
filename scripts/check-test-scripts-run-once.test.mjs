import assert from "node:assert/strict";
import { test } from "node:test";
import { findWatchingTestScripts } from "./check-test-scripts-run-once.mjs";

const manifest = (path, scripts) => ({ path, text: JSON.stringify({ name: path, scripts }) });

test("a test script that watches is found; one that runs once, or a test:watch, is not", () => {
  const findings = findWatchingTestScripts([
    manifest("packages/a/package.json", { test: "vitest" }),
    manifest("packages/b/package.json", { test: "vitest --passWithNoTests" }),
    manifest("packages/c/package.json", { test: "pnpm build && vitest" }),
    manifest("packages/d/package.json", { test: "vitest run", "test:watch": "vitest" }),
    manifest("packages/e/package.json", { test: "vitest run --passWithNoTests" }),
    manifest("packages/f/package.json", { test: "vitest --run" }),
    manifest("packages/g/package.json", { test: "node ./scripts/run-tests.mjs" }),
    manifest("packages/h/package.json", { build: "tsc" }),
  ]);
  assert.deepEqual(
    findings.map(({ path }) => path),
    ["packages/a/package.json", "packages/b/package.json", "packages/c/package.json"],
  );
});
