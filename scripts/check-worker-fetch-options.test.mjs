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

test("quoted keys and multiline options cannot bypass the Worker guard", () => {
  const findings = findEdgeRefusedFetchOptions([
    {
      path: "packages/identity/src/request.ts",
      text: 'const options = { "redirect":\n`error` }; // redirect: "error"\nconst safe = { redirect: "manual" }',
    },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 1);
});

// Actual failing calls from the held-realms and co-signer revisions; portable to shallow CI checkouts.
const regressions = [
  {
    revision: "e52b21578cd^",
    path: "apps/realms/server/realm-holdings.ts",
    text: 'fetch(`${env.MARKETPLACE_API_URL}/v1/chains/${chain}/${path}`, {\n      signal: AbortSignal.timeout(INDEXER_TIMEOUT_MS),\n      redirect: "error",\n    })',
  },
  {
    revision: "9f0e9d03583",
    path: "apps/value-relay/src/cosigner-client.ts",
    text: 'network(new URL("/sign", url), {\n      method: "POST",\n      redirect: "error",\n      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },\n      body: JSON.stringify(terms),\n      signal: AbortSignal.timeout(10_000),\n    })',
  },
];
test("the guard rejects both historical Worker failures", () => {
  for (const { revision, path, text } of regressions) {
    assert.equal(findEdgeRefusedFetchOptions([{ path, text }]).length, 1, revision);
    assert.equal(
      findEdgeRefusedFetchOptions([{ path, text: text.replace('redirect: "error"', 'redirect: "manual"') }]).length,
      0,
    );
  }
});
