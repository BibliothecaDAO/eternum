import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { test } = process.env.VITEST ? await import("vitest") : await import("node:test");

import { identityChainOf, l2ChainMismatch } from "./check-l2-chain-matches-identity.mjs";

const WRANGLER = `// The identity Worker, one environment each.
{
  "name": "realms-identity",
  "env": {
    "staging": { "vars": { "ENVIRONMENT": "staging", "L2_CHAIN_ID": "SN_SEPOLIA", "URL": "https://a//b" } },
    "production": { "vars": { "ENVIRONMENT": "production", "L2_CHAIN_ID": "SN_MAIN" }, },
  },
}`;

test("reads the identity Worker's chain for each environment from its commented config", () => {
  assert.equal(identityChainOf(WRANGLER, "staging"), "SN_SEPOLIA");
  assert.equal(identityChainOf(WRANGLER, "production"), "SN_MAIN");
  assert.equal(identityChainOf(WRANGLER, "preview"), undefined);
});

test("passes a client chain equal to the Worker's, and names any difference before the deploy uploads", () => {
  assert.equal(l2ChainMismatch(WRANGLER, "staging", "SN_SEPOLIA"), null);
  assert.match(l2ChainMismatch(WRANGLER, "staging", "SN_MAIN"), /SN_MAIN.*SN_SEPOLIA/);
  assert.match(l2ChainMismatch(WRANGLER, "preview", "SN_SEPOLIA"), /no L2_CHAIN_ID/);
});

test("matches the checked-in identity Worker: staging on Sepolia, production on mainnet", () => {
  const checkedIn = readFileSync(new URL("../../realms/wrangler.jsonc", import.meta.url), "utf8");
  assert.equal(l2ChainMismatch(checkedIn, "staging", "SN_SEPOLIA"), null);
  assert.equal(l2ChainMismatch(checkedIn, "production", "SN_MAIN"), null);
});
