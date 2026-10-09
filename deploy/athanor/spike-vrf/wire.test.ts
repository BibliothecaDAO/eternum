import { expect, test } from "bun:test";
import { hash } from "starknet";
import { NativeProver, feltBytes } from "./native";
import { fixture } from "./fixtures";
import { invokeHash } from "./transaction";
import { VRF_STAMP_TAG } from "./wire";

test("the tagged suffix has nine felts and its root depends on gamma alone", () => {
  const prover = new NativeProver(feltBytes("190")); // Published upstream known-answer scalar, no deployed credential.
  try {
    const tx = fixture(),
      seed = invokeHash(tx, "0x5350494b45"),
      proof = prover.proofs([seed])[0]!;
    const stamped = { ...tx, signature: [...tx.signature, VRF_STAMP_TAG, ...proof.slice(0, 5)] };
    expect(stamped.signature).toHaveLength(9);
    expect(invokeHash(stamped, "0x5350494b45")).toBe(seed);
    const gammaRoot = (fields: string[]) => hash.computePoseidonHashOnElements(["3", fields[0]!, fields[1]!, "0"]);
    expect(BigInt(gammaRoot(proof))).toBe(BigInt(proof[5]!));
    expect(gammaRoot([proof[0]!, proof[1]!, "0", "0", "0"])).toBe(gammaRoot(proof));
  } finally {
    prover.close();
  }
});
