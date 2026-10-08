import { expect, test } from "bun:test";
import { invokeHash, isGamesInvoke, type Invoke } from "./transaction";

export const fixture = (): Invoke => ({
  type: "INVOKE", version: "0x3", sender_address: "0x123", nonce: "0x1", tip: "0x0",
  signature: ["0x1", "0x2", "0x3"], calldata: ["0x1", "0x456", "0x789", "0x1", "0x1"],
  resource_bounds: { l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }, l2_gas: { max_amount: "0x47868c00", max_price_per_unit: "0x1" }, l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" } },
  paymaster_data: [], account_deployment_data: [], nonce_data_availability_mode: "L1", fee_data_availability_mode: "L1",
});

test("proof suffix changes neither hash nor the player's three-felt signature", () => {
  const tx = fixture();
  const stamped = { ...tx, signature: [...tx.signature, "0x4", "0x5", "0x6", "0x7", "0x8"] };
  expect(invokeHash(stamped, "0x5350494b45")).toBe(invokeHash(tx, "0x5350494b45"));
  expect(tx.signature).toHaveLength(3);
});

test("only one ordinary Games-bound call qualifies for stamping", () => {
  const tx = fixture();
  expect(isGamesInvoke(tx, "0x456")).toBe(true);
  expect(isGamesInvoke(tx, "0x457")).toBe(false);
  expect(isGamesInvoke({ ...tx, calldata: ["0x2", ...tx.calldata.slice(1)] }, "0x456")).toBe(false);
  expect(isGamesInvoke({ ...tx, version: "0x100000000000000000000000000000003" }, "0x456")).toBe(false);
  expect(isGamesInvoke({ ...tx, signature: [...tx.signature, "0x4"] }, "0x456")).toBe(false);
});
