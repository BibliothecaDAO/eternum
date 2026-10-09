import { expect, test } from "bun:test";
import { hash } from "starknet";
import { assertWorkerCreation } from "./launcher-check";

test("activation requires a single real creation signed by the enrolled Worker on this world", () => {
  const expected = { account: "0x12", world: "0x34", name: "0x56", preset: 5 };
  const calldata = ["0x1", expected.world, hash.getSelectorFromName("create_game"), "0x2", expected.name, "0x5"];
  const tx = { type: "INVOKE", sender_address: expected.account, calldata };
  expect(() => assertWorkerCreation(tx, expected)).not.toThrow();
  expect(() => assertWorkerCreation({ ...tx, sender_address: "0x99" }, expected)).toThrow();
  expect(() => assertWorkerCreation({ ...tx, type: "DECLARE" }, expected)).toThrow();
  for (const index of [0, 1, 2, 3, 4, 5]) {
    const invalid = [...calldata];
    invalid[index] = "0x99";
    expect(() => assertWorkerCreation({ ...tx, calldata: invalid }, expected)).toThrow();
  }
  expect(() => assertWorkerCreation({ ...tx, calldata: [...calldata, "0x1"] }, expected)).toThrow();
});
