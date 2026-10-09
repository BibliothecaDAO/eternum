import { hash } from "starknet";
import { GAME_ENTRYPOINTS } from "./entrypoints";
import { expect, test } from "bun:test";
import { gameInvoke } from "./transaction";

import { identity, invoke } from "./fixtures";
test("only one canonical V3 Games.play with the manifest bounds is admitted", () => {
  expect(gameInvoke(invoke(), identity)?.transaction).toEqual(invoke());
  for (const patch of [
    { version: "0x100000000000000000000000000000003" },
    { tip: "0x1" },
    { signature: ["0x1", "0x2", "0x3", "0x56524631"] },
    { paymaster_data: ["0x1"] },
    { proof_facts: ["0x1"] },
    { account_deployment_data: ["0x1"] },
    { nonce: "-1" },
    { fee_data_availability_mode: "L2" },
  ])
    expect(gameInvoke({ ...invoke(), ...patch }, identity)).toBeUndefined();
  for (const index of [0, 1, 2, 3, 4, 5, 7]) {
    const tx = invoke();
    tx.calldata[index] = index === 4 || index === 5 ? "0x100000000" : "0x999";
    expect(gameInvoke(tx, identity)).toBeUndefined();
  }
  for (const name of ["l1_gas", "l2_gas", "l1_data_gas"] as const) {
    const tx = invoke();
    tx.resource_bounds[name].max_amount = "0x1";
    expect(gameInvoke(tx, identity)).toBeUndefined();
  }
  expect(
    gameInvoke(
      { ...invoke(), calldata: ["0x2", ...invoke().calldata.slice(1), ...invoke().calldata.slice(1)] },
      identity,
    ),
  ).toBeUndefined();
  expect(gameInvoke({ ...invoke(), calldata: [...invoke().calldata, "0x1"] }, identity)).toBeUndefined();
  expect(gameInvoke({ ...invoke(), signature: ["0x1", "0x2", "0x" + "f".repeat(64)] }, identity)).toBeUndefined();
  expect(gameInvoke(invoke(), { ...identity, l2GasBound: "bad" })).toBeUndefined();
});

test("only the single data-listed Games entries admit administrative invokes", () => {
  expect(GAME_ENTRYPOINTS.map((entry) => entry.name)).toEqual([
    "play",
    "create_game",
    "freeze_blitz_roster",
    "prepare_homes",
    "apply_release",
    "register_release",
    "register_preset",
    "set_launcher",
    "set_ledger_operator",
    "grant_labor",
    "register_entitlement",
    "register_village_pass",
  ]);
  for (const entry of GAME_ENTRYPOINTS.filter((entry) => !entry.stamp)) {
    const tx = {
      ...invoke(),
      signature: ["0x2", "0x3"],
      calldata: ["0x1", identity.games, hash.getSelectorFromName(entry.name), "0x1", "0x1"],
    };
    expect(gameInvoke(tx, identity)).toEqual({ transaction: tx, entrypoint: entry });
    expect(
      gameInvoke({ ...tx, calldata: ["0x2", ...tx.calldata.slice(1), ...tx.calldata.slice(1)] }, identity),
    ).toBeUndefined();
    expect(gameInvoke({ ...tx, calldata: ["0x1", "0xdef", ...tx.calldata.slice(2)] }, identity)).toBeUndefined();
  }
  for (const name of [
    "create_explorer",
    "execute_gameplay",
    "execute",
    "constructor",
    "initialize_realm_traits",
    "settle_blitz_roster",
    "set_vrf_public_key",
    "withdraw",
  ]) {
    const tx = { ...invoke(), calldata: ["0x1", identity.games, hash.getSelectorFromName(name), "0x1", "0x1"] };
    expect(gameInvoke(tx, identity)).toBeUndefined();
  }
});
