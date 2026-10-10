import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { identityChainOf } from "./identity-l2-chain.mjs";

const WRANGLER = `// The identity Worker, one environment each.
{
  "name": "realms-identity",
  "env": {
    "staging": { "vars": { "ENVIRONMENT": "staging", "L2_CHAIN_ID": "SN_SEPOLIA", "URL": "https://a//b" } },
    "production": { "vars": { "ENVIRONMENT": "production", "L2_CHAIN_ID": "SN_MAIN" }, },
    "preview": { "vars": { "L2_CHAIN_ID": "0x534e5f4d41494e" } },
  },
}`;

test("reads the identity Worker's chain for each environment from its commented config", () => {
  assert.equal(identityChainOf(WRANGLER, "staging"), "SN_SEPOLIA");
  assert.equal(identityChainOf(WRANGLER, "production"), "SN_MAIN");
});

test("refuses, before any build, an environment the Worker names no L2 for or names one the client cannot build", () => {
  assert.throws(() => identityChainOf(WRANGLER, "dev"), /names no L2 .* for dev/);
  assert.throws(() => identityChainOf(WRANGLER, "preview"), /names no L2 .* for preview/);
});

test("reads the checked-in identity Worker: staging on Sepolia, production on mainnet", () => {
  const checkedIn = readFileSync(new URL("../../realms/wrangler.jsonc", import.meta.url), "utf8");
  assert.equal(identityChainOf(checkedIn, "staging"), "SN_SEPOLIA");
  assert.equal(identityChainOf(checkedIn, "production"), "SN_MAIN");
});
