import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash } from "starknet";
import { openProver } from "./native";
import { startStampPool, workerCount } from "./pool";
import { identity, invoke } from "./fixtures";
import { STAMP_TAG, type PlayInvoke } from "./transaction";

function keyFile() {
  const dir = mkdtempSync(join(tmpdir(), "realms-vrf-test-")),
    file = join(dir, "key.json");
  const key = randomBytes(32);
  key[0] &= 3;
  writeFileSync(file, JSON.stringify({ privateKey: "0x" + key.toString("hex") }), { mode: 0o600 });
  key.fill(0);
  return {
    file,
    close() {
      rmSync(dir, { recursive: true });
    },
  };
}
function sdkHash(tx: PlayInvoke) {
  const bounds = Object.fromEntries(
    Object.entries(tx.resource_bounds).map(([name, bound]) => [
      name,
      { max_amount: BigInt(bound.max_amount), max_price_per_unit: BigInt(bound.max_price_per_unit) },
    ]),
  );
  return hash.calculateInvokeTransactionHash({
    senderAddress: tx.sender_address,
    version: "0x3",
    compiledCalldata: tx.calldata,
    chainId: identity.chainId as Parameters<typeof hash.calculateInvokeTransactionHash>[0]["chainId"],
    nonce: tx.nonce,
    accountDeploymentData: tx.account_deployment_data,
    nonceDataAvailabilityMode: 0,
    feeDataAvailabilityMode: 0,
    resourceBounds: bounds as Parameters<typeof hash.calculateInvokeTransactionHash>[0]["resourceBounds"],
    tip: tx.tip,
    paymasterData: tx.paymaster_data,
  });
}
test("native transaction hashing matches SDK and the signature cannot choose the root", () => {
  const key = keyFile(),
    prover = openProver(key.file, identity.chainId);
  try {
    const stamp = (tx: PlayInvoke) => prover.stamp(new TextEncoder().encode(JSON.stringify(tx)));
    for (const patch of [
      {},
      { nonce: "0x987" },
      { sender_address: "0x987" },
      { calldata: ["0x0", "0x99"] },
      { paymaster_data: ["0x1"] },
      { account_deployment_data: ["0x2"] },
      { tip: "0x1" },
    ]) {
      const tx = { ...invoke(), ...patch };
      expect(BigInt(stamp(tx).transactionHash)).toBe(BigInt(sdkHash(tx)));
    }
    expect(stamp({ ...invoke(), signature: ["0x9"] })).toEqual(stamp(invoke()));
    expect(stamp(invoke()).suffix[0]).toBe(STAMP_TAG);
    expect(stamp(invoke()).suffix).toHaveLength(6);
  } finally {
    prover.close();
    expect(() => prover.stamp(new Uint8Array([1]))).toThrow("Transaction refused");
    key.close();
  }
});
test("workers independently load the protected key, agree on its point and recover no missing setting", async () => {
  const key = keyFile(),
    prover = openProver(key.file, identity.chainId);
  try {
    const expected = prover.stamp(new TextEncoder().encode(JSON.stringify(invoke())));
    const pool = await startStampPool(key.file, { ...identity, vrfPublicKey: prover.publicKey }, 2);
    try {
      expect(await Promise.all(Array.from({ length: 24 }, () => pool.stamp(invoke())))).toEqual(
        Array(24).fill(expected),
      );
    } finally {
      pool.close();
    }
    await expect(pool.stamp(invoke())).rejects.toThrow("Transaction refused");
    await expect(startStampPool(key.file, identity, 1)).rejects.toThrow("VRF worker initialization failed");
    chmodSync(key.file, 0o644);
    expect(() => openProver(key.file, identity.chainId)).toThrow("mode 0600");
    for (const value of [undefined, "0", "1.5", "65", "04"]) expect(() => workerCount(value)).toThrow();
    expect(workerCount("4")).toBe(4);
  } finally {
    prover.close();
    expect(() => prover.stamp(new Uint8Array([1]))).toThrow("Transaction refused");
    key.close();
  }
});
