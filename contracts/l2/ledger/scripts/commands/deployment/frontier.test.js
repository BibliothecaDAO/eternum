import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CallData, uint256 } from "starknet";
import { buildFrontierFundingCalls } from "./frontier.js";

const abi = JSON.parse(readFileSync(new URL("../../../schema/abi.json", import.meta.url), "utf8"));

test("rehearsal funds the exact seven-argument Frontier ABI, including a full u256 amount", () => {
  const settings = {
    presetId: 2,
    shard: 17n,
    frontierSeasonId: 7n,
    start: 100n,
    end: 2100n,
    seed: 24301n,
    pool: (1n << 128n) + 9n,
  };
  const [approval, call] = buildFrontierFundingCalls("0x123", "0x456", settings);
  assert.deepEqual(approval, { contractAddress: "0x456", entrypoint: "approve", calldata: ["291", "9", "1"] });
  assert.equal(call.contractAddress, "0x123");
  assert.equal(call.entrypoint, "fund_frontier");
  assert.deepEqual(
    call.calldata,
    new CallData(abi).compile("fund_frontier", {
      shard: settings.shard,
      season_id: settings.frontierSeasonId,
      preset_id: 2,
      start: settings.start,
      end: settings.end,
      seed: settings.seed,
      amount: uint256.bnToUint256(settings.pool),
    }),
  );
  assert.deepEqual(call.calldata, ["17", "7", "2", "100", "2100", "24301", "9", "1"]);
});
