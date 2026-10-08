import { expect, test } from "bun:test";
import { feltBytes, NativeProver } from "./native";
import { fixture } from "./fixtures";
import { invokeHash, type Invoke } from "./transaction";

const chain = "0x5350494b45";
const encode = (tx: Invoke) => new TextEncoder().encode(JSON.stringify(tx));
test("native V3 hashing matches SDK across every hashed field and ignores signatures", () => {
  const prover = new NativeProver(feltBytes("190")); // Public KAT only.
  try {
    const base = fixture();
    const limit = (bits: bigint) => `0x${((1n << bits) - 1n).toString(16)}`;
    const variants: Invoke[] = [
      base,
      { ...base, nonce: "0x1234" },
      { ...base, sender_address: "0x124" },
      { ...base, tip: "0x9" },
      { ...base, calldata: ["0x0", "0x3", "0x123456789abcdef"] },
      { ...base, account_deployment_data: ["0x7", "0x8"] },
      { ...base, paymaster_data: ["0x9", "0xa"] },
      { ...base, nonce_data_availability_mode: "L2" },
      { ...base, fee_data_availability_mode: "L2" },
      {
        ...base,
        resource_bounds: {
          ...base.resource_bounds,
          l1_gas: { max_amount: limit(64n), max_price_per_unit: limit(128n) },
        },
      },
      {
        ...base,
        resource_bounds: { ...base.resource_bounds, l2_gas: { max_amount: "0x6789", max_price_per_unit: "0xabcdef" } },
      },
      {
        ...base,
        resource_bounds: { ...base.resource_bounds, l1_data_gas: { max_amount: "0x23", max_price_per_unit: "0x42" } },
      },
      { ...base, signature: [...base.signature, "0x4", "0x5", "0x6", "0x7", "0x8"] },
    ];
    for (const tx of variants) expect(BigInt(prover.invokeHash(encode(tx), chain))).toBe(BigInt(invokeHash(tx, chain)));
    expect(BigInt(prover.invokeHash(encode(base), "0x42"))).toBe(BigInt(invokeHash(base, "0x42")));
    expect(() =>
      prover.invokeHash(encode({ ...base, version: "0x100000000000000000000000000000003" }), chain),
    ).toThrow();
    expect(() => prover.invokeHash(new TextEncoder().encode("{}"), chain)).toThrow();
  } finally {
    prover.close();
  }
});
