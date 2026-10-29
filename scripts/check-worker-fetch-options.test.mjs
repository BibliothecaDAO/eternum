import assert from "node:assert/strict";
import { test } from "node:test";
import { findEdgeRefusedFetchOptions, isWorkerSource } from "./check-worker-fetch-options.mjs";

test("a fetch asking for redirect error is found in any quoting; manual and follow are not", () => {
  const findings = findEdgeRefusedFetchOptions([
    { path: "apps/realms/server/a.ts", text: 'fetch(url, {\n  redirect: "error",\n})' },
    { path: "apps/realms/server/b.ts", text: "fetch(url, { redirect:'error' })" },
    { path: "apps/realms/server/c.ts", text: 'fetch(url, { redirect: "manual" })\nfetch(url, { redirect: "follow" })' },
  ]);
  assert.deepEqual(
    findings.map(({ path, line }) => `${path}:${line}`),
    ["apps/realms/server/a.ts:2", "apps/realms/server/b.ts:1"],
  );
});

test("Worker apps and packages count as Worker source; their tests, scripts elsewhere and deploy tools do not", () => {
  const apps = ["apps/realms", "apps/value-relay"];
  assert.equal(isWorkerSource("apps/realms/server/realm-holdings.ts", apps), true);
  assert.equal(isWorkerSource("apps/value-relay/src/worker.ts", apps), true);
  assert.equal(isWorkerSource("packages/identity/src/client.ts", apps), true);
  assert.equal(isWorkerSource("apps/realms/server/realm-holdings.test.ts", apps), false);
  assert.equal(isWorkerSource("apps/game/scripts/ensure-pwa-cache-rule.mjs", apps), false);
  assert.equal(isWorkerSource("deploy/first/publish.ts", apps), false);
});
