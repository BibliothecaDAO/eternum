import { VRF_STAMP_TAG } from "./wire";
import { expect, test } from "bun:test";
import { invokeHash, isGamesInvoke } from "./transaction";

import { fixture } from "./fixtures";

test("proof suffix changes neither hash nor the player's three-felt signature", () => {
  const tx = fixture();
  const stamped = { ...tx, signature: [...tx.signature, VRF_STAMP_TAG, "0x4", "0x5", "0x6", "0x7", "0x8"] };
  expect(invokeHash(stamped, "0x5350494b45")).toBe(invokeHash(tx, "0x5350494b45"));
  expect(tx.signature).toHaveLength(3);
});

test("only one ordinary Games-bound call qualifies for stamping", () => {
  const tx = fixture();
  expect(isGamesInvoke(tx, "0x456")).toBe(true);
  expect(isGamesInvoke(tx, "0x457")).toBe(false);
  expect(isGamesInvoke({ ...tx, calldata: ["0x2", ...tx.calldata.slice(1)] }, "0x456")).toBe(false);
  expect(isGamesInvoke({ ...tx, version: "0x100000000000000000000000000000003" }, "0x456")).toBe(false);
  expect(isGamesInvoke({ ...tx, signature: [...tx.signature, VRF_STAMP_TAG, "0x4"] }, "0x456")).toBe(false);
});
