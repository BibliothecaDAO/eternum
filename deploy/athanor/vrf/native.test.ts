import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash } from "starknet";
import { startReadRpc } from "../scripts/read-rpc";
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

test("a native job refusal and an oversized serialized job leave the pool stamping", async () => {
  const key = keyFile(),
    prover = openProver(key.file, identity.chainId);
  const pool = await startStampPool(key.file, { ...identity, vrfPublicKey: prover.publicKey }, 2);
  try {
    await expect(pool.stamp({ ...invoke(), version: "0x2" })).rejects.toThrow("Transaction refused");
    await expect(pool.stamp({ ...invoke(), calldata: Array(200000).fill("0x1") })).rejects.toThrow(
      "Transaction refused",
    );
    const expected = prover.stamp(new TextEncoder().encode(JSON.stringify(invoke())));
    expect(await Promise.all(Array.from({ length: 24 }, () => pool.stamp(invoke())))).toEqual(Array(24).fill(expected));
  } finally {
    pool.close();
    prover.close();
    key.close();
  }
});

test("the exact expanding-body attack cannot disable the real stamping endpoint", async () => {
  const key = keyFile(),
    prover = openProver(key.file, identity.chainId);
  const pool = await startStampPool(key.file, { ...identity, vrfPublicKey: prover.publicKey }, 2);
  let forwards = 0;
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = await request.json();
      const result =
        call.method === "starknet_getNonce"
          ? "0x0"
          : call.method === "starknet_getClassHashAt"
            ? identity.accountClassHash
            : { transaction_hash: prover.stamp(new TextEncoder().encode(JSON.stringify(invoke()))).transactionHash };
      if (call.method === "starknet_addInvokeTransaction") forwards++;
      return Response.json({ jsonrpc: "2.0", id: call.id, result });
    },
  });
  const proxy = startReadRpc(
    node.url.origin,
    0,
    { ...identity, vrfPublicKey: prover.publicKey },
    pool,
    undefined,
    "127.0.0.1",
  );
  const call = async (tx: string) =>
    (
      await fetch(proxy.url, {
        method: "POST",
        body: '{"jsonrpc":"2.0","id":1,"method":"starknet_addInvokeTransaction","params":[' + tx + "]}",
      })
    ).json();
  try {
    const attack = JSON.stringify(invoke()).slice(0, -1) + ',"unused":[' + Array(192000).fill("1e30").join(",") + "]}";
    expect(Buffer.byteLength(attack)).toBeLessThan(1024 * 1024);
    expect(Buffer.byteLength(JSON.stringify(JSON.parse(attack)))).toBeGreaterThan(1024 * 1024);
    expect((await call(attack)).error.code).toBe(-32601);
    expect(forwards).toBe(0);
    expect((await call(JSON.stringify(invoke()))).result.transaction_hash).toBeDefined();
    expect(forwards).toBe(1);
    const oversized = await fetch(proxy.url, { method: "POST", body: " ".repeat(1024 * 1024 + 1) });
    expect(oversized.status).toBe(413);
    expect((await call(JSON.stringify(invoke()))).result.transaction_hash).toBeDefined();
  } finally {
    proxy.stop(true);
    node.stop(true);
    pool.close();
    prover.close();
    key.close();
  }
});
