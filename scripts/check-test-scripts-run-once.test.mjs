import assert from "node:assert/strict";
import { test } from "node:test";
import { findWatchingTestScripts } from "./check-test-scripts-run-once.mjs";

const manifest = (path, scripts) => ({ path, text: JSON.stringify({ name: path, scripts }) });

test("a test script with any command that watches is found; one whose every vitest runs once, or a test:watch, is not", () => {
  const findings = findWatchingTestScripts([
    manifest("packages/a/package.json", { test: "vitest" }),
    manifest("packages/b/package.json", { test: "vitest --passWithNoTests" }),
    manifest("packages/c/package.json", { test: "pnpm build && vitest" }),
    manifest("packages/c-related/package.json", { test: "vitest related probe.mjs" }),
    manifest("packages/c-bench/package.json", { test: "vitest bench" }),
    manifest("packages/c-mixed/package.json", { test: "vitest --run && vitest" }),
    manifest("packages/c-exec/package.json", { test: "vitest run && pnpm exec vitest --passWithNoTests" }),
    manifest("packages/c-path/package.json", { test: "./node_modules/.bin/vitest" }),
    manifest("packages/d/package.json", { test: "vitest run", "test:watch": "vitest" }),
    manifest("packages/e/package.json", { test: "vitest run --passWithNoTests" }),
    manifest("packages/f/package.json", { test: "vitest --run" }),
    manifest("packages/f-related/package.json", { test: "vitest related --run probe.mjs" }),
    manifest("packages/f-bench/package.json", { test: "vitest bench --run" }),
    manifest("packages/f-list/package.json", { test: "vitest list" }),
    manifest("packages/f-chain/package.json", { test: "pnpm build && pnpm exec vitest run; vitest --run" }),
    manifest("packages/f-vitest-word/package.json", { test: "node scripts/vitest-report.mjs" }),
    manifest("packages/g/package.json", { test: "node ./scripts/run-tests.mjs" }),
    manifest("packages/h/package.json", { build: "tsc" }),
  ]);
  assert.deepEqual(
    findings.map(({ path }) => path),
    [
      "packages/a/package.json",
      "packages/b/package.json",
      "packages/c/package.json",
      "packages/c-related/package.json",
      "packages/c-bench/package.json",
      "packages/c-mixed/package.json",
      "packages/c-exec/package.json",
      "packages/c-path/package.json",
    ],
  );
});
