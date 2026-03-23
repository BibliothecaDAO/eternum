import assert from "node:assert/strict";
import test from "node:test";

import { buildAmmIndexerEnvContent, resolveAmmIndexerEnvPath } from "./link-indexer-env.js";

test("buildAmmIndexerEnvContent replaces existing AMM linkage values", () => {
  const existing = [
    "POSTGRES_CONNECTION_STRING=postgresql://example",
    "AMM_ADDRESS=0xoldamm",
    "LORDS_ADDRESS=0xoldlords",
    "API_PORT=3000",
  ].join("\n");

  const next = buildAmmIndexerEnvContent(existing, {
    ammAddress: "0xnewamm",
    lordsAddress: "0xnewlords",
  });

  assert.match(next, /POSTGRES_CONNECTION_STRING=postgresql:\/\/example/);
  assert.match(next, /AMM_ADDRESS=0xnewamm/);
  assert.match(next, /LORDS_ADDRESS=0xnewlords/);
  assert.match(next, /API_PORT=3000/);
  assert.equal((next.match(/AMM_ADDRESS=/g) ?? []).length, 1);
  assert.equal((next.match(/LORDS_ADDRESS=/g) ?? []).length, 1);
});

test("buildAmmIndexerEnvContent appends missing linkage values", () => {
  const existing = "POSTGRES_CONNECTION_STRING=postgresql://example";

  const next = buildAmmIndexerEnvContent(existing, {
    ammAddress: "0xamm",
    lordsAddress: "0xlords",
  });

  assert.match(next, /POSTGRES_CONNECTION_STRING=postgresql:\/\/example/);
  assert.match(next, /AMM_ADDRESS=0xamm/);
  assert.match(next, /LORDS_ADDRESS=0xlords/);
});

test("resolveAmmIndexerEnvPath writes network-scoped env files", () => {
  assert.equal(resolveAmmIndexerEnvPath("local"), "client/apps/amm-indexer/.env.local");
  assert.equal(resolveAmmIndexerEnvPath("sepolia"), "client/apps/amm-indexer/.env.sepolia");
});
