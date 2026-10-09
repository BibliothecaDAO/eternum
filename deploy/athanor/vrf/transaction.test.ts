import { expect, test } from "bun:test";
import { playInvoke } from "./transaction";

import { identity, invoke } from "./fixtures";
test("only one canonical V3 Games.play with the manifest bounds is admitted", () => {
  expect(playInvoke(invoke(), identity)).toEqual(invoke());
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
    expect(playInvoke({ ...invoke(), ...patch }, identity)).toBeUndefined();
  for (const index of [0, 1, 2, 3, 4, 5, 7]) {
    const tx = invoke();
    tx.calldata[index] = index === 4 || index === 5 ? "0x100000000" : "0x999";
    expect(playInvoke(tx, identity)).toBeUndefined();
  }
  for (const name of ["l1_gas", "l2_gas", "l1_data_gas"] as const) {
    const tx = invoke();
    tx.resource_bounds[name].max_amount = "0x1";
    expect(playInvoke(tx, identity)).toBeUndefined();
  }
  expect(
    playInvoke(
      { ...invoke(), calldata: ["0x2", ...invoke().calldata.slice(1), ...invoke().calldata.slice(1)] },
      identity,
    ),
  ).toBeUndefined();
  expect(playInvoke({ ...invoke(), calldata: [...invoke().calldata, "0x1"] }, identity)).toBeUndefined();
  expect(playInvoke({ ...invoke(), signature: ["0x1", "0x2", "0x" + "f".repeat(64)] }, identity)).toBeUndefined();
  expect(playInvoke(invoke(), { ...identity, l2GasBound: "bad" })).toBeUndefined();
});
