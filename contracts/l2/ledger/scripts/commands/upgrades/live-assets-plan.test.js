import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveAssetPlan } from "./live-assets-plan.js";

const addresses = {
  ledger: "0x1",
  mmrToken: "0x2",
};

const environment = {
  MMR_ADMIN_ADDRESS: "0x10",
  MMR_ADMIN_PRIVATE_KEY: "0x101",
  MMR_UPGRADER_ADDRESS: "0x11",
  MMR_UPGRADER_PRIVATE_KEY: "0x111",
  STARKNET_ACCOUNT_ADDRESS: "0x13",
  STARKNET_ACCOUNT_PRIVATE_KEY: "0x131",
};

test("orders the MMR upgrade before its ledger role grant", () => {
  const plan = buildLiveAssetPlan(addresses, environment, true);

  assert.deepEqual(
    plan.assets.map(({ id }) => id),
    ["mmr"],
  );
  assert.deepEqual(
    plan.roleGrants.map(({ assetId, roleName }) => [assetId, roleName]),
    [
      ["mmr", "UPDATER_ROLE"],
    ],
  );
  assert.equal(plan.roleGrants[0].grantee, "0x1");
  assert.equal(plan.assets[0].upgradeSigner.privateKey, "0x111");
});

test("check mode validates authorities without requiring private keys", () => {
  const publicEnvironment = Object.fromEntries(
    Object.entries(environment).filter(([name]) => !name.endsWith("PRIVATE_KEY")),
  );

  assert.equal(buildLiveAssetPlan(addresses, publicEnvironment, false).declarationSigner.address, "0x13");
});

test("fails closed on a missing live contract", () => {
  assert.throws(
    () => buildLiveAssetPlan({ ...addresses, mmrToken: "" }, environment, true),
    /mainnet\.json:mmrToken is required/,
  );
});
