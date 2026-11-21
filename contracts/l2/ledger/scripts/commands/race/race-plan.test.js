import assert from "node:assert/strict";
import test from "node:test";
import { assertLedgerTreasury, buildRacePlan, withRaceRewards } from "./race-plan.js";

const addresses = { ledger: "0x1", lords: "0x2", treasury: "0x03" };
const environment = { STARKNET_ACCOUNT_ADDRESS: "0x13" };
const plan = (step, options = {}, book = addresses) =>
  buildRacePlan({ step, book: "dev", addresses: book, environment, options });

test("deploys the rewards class bound to the book's ledger and treasury", () => {
  assert.deepEqual(plan("deploy").constructorCalldata, ["0x1", "0x3"]);
  assert.equal(plan("deploy").rewards, null);
  assert.equal(plan("deploy", {}, { ...addresses, raceRewards: "0x9" }).rewards, "0x9");
});

test("refuses a ledger whose stored treasury is not the book's", () => {
  assert.doesNotThrow(() => assertLedgerTreasury(plan("deploy"), "0x3"));
  assert.throws(() => assertLedgerTreasury(plan("deploy"), "0x4"), /stores treasury 0x4/);
});

test("funds a race with one approval and one funding call for the same whole LORDS", () => {
  const funded = plan("fund", { shard: "0x456", game: "7", amount: "500000" }, { ...addresses, raceRewards: "0x9" });
  const wei = ["0x69e10de76676d0800000", "0x0"];
  assert.deepEqual(funded.calls, [
    { contractAddress: "0x2", entrypoint: "approve", calldata: ["0x9", ...wei] },
    { contractAddress: "0x9", entrypoint: "fund_race", calldata: ["0x456", "7", ...wei] },
  ]);
});

test("refuses funding before the deploy step wrote the address, and amounts that are not whole LORDS", () => {
  const race = { shard: "0x456", game: "7", amount: "500000" };
  assert.throws(() => plan("fund", race), /names no raceRewards/);
  const deployed = { ...addresses, raceRewards: "0x9" };
  for (const amount of ["0", "1.5", "0x10", undefined])
    assert.throws(() => plan("fund", { ...race, amount }, deployed), /--amount/);
  assert.throws(() => plan("fund", { ...race, game: "0" }, deployed), /--game/);
  assert.throws(() => plan("status", { game: "7" }, deployed), /--shard is required/);
  assert.throws(() => plan("post"), /Unknown race step/);
});

test("writes the deployed address once and refuses to replace another", () => {
  assert.deepEqual(withRaceRewards(addresses, "0x09"), { ...addresses, raceRewards: "0x9" });
  assert.deepEqual(withRaceRewards({ ...addresses, raceRewards: "0x9" }, "0x9").raceRewards, "0x9");
  assert.throws(() => withRaceRewards({ ...addresses, raceRewards: "0x8" }, "0x9"), /already names/);
});
