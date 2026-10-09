import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CallData, uint256 } from "starknet";
import { buildFrontierFundingCall, frontierSeasonManifest } from "./frontier.js";

const { abi } = JSON.parse(
  readFileSync(new URL("../../../target/dev/game_ledger_GameLedger.contract_class.json", import.meta.url), "utf8"),
);

test("rehearsal funds the exact six-argument Frontier ABI, including a full u256 amount", () => {
  const settings = { shard: 17n, start: 100n, seed: 24301n, pool: (1n << 128n) + 9n };
  const call = buildFrontierFundingCall("0x123", settings);
  assert.equal(call.contractAddress, "0x123");
  assert.equal(call.entrypoint, "fund_frontier");
  assert.deepEqual(
    call.calldata,
    new CallData(abi).compile("fund_frontier", {
      shard: settings.shard,
      season_id: 1,
      preset_id: 2,
      start: settings.start,
      seed: settings.seed,
      amount: uint256.bnToUint256(settings.pool),
    }),
  );
  assert.deepEqual(call.calldata, ["17", "1", "2", "100", "24301", "9", "1"]);
});

test("rehearsal reads all eight FrontierSeason fields in ABI order instead of using the Blitz end", () => {
  assert.deepEqual(frontierSeasonManifest(abi, ["1", "100", "200", "1000", "1", "400", "0", "0", "2", "24301"]), {
    funded: true,
    start: "100",
    end: "200",
    pool: ((1n << 128n) + 1000n).toString(),
    paid: "400",
    closed: false,
    preset_id: "2",
    seed: "24301",
  });
});
