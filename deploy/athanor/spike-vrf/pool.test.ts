import { VRF_STAMP_TAG } from "./wire";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProverPool } from "./pool";
import { feltBytes, NativeProver } from "./native";
import { fixture } from "./fixtures";
import { invokeHash } from "./transaction";

test("Bun worker pool produces the same native proof while preserving each transaction hash", async () => {
  const directory = mkdtempSync(join(tmpdir(), "spike-vrf-pool-"));
  const path = join(directory, "key");
  writeFileSync(path, "190", { mode: 0o600 }); // Public known-answer fixture.
  const pool = new ProverPool(path, 2);
  const prover = new NativeProver(feltBytes("190"));
  try {
    expect(await pool.ready).toEqual(prover.publicKey());
    const txs = Array.from({ length: 8 }, (_, index) => ({ ...fixture(), nonce: `0x${index.toString(16)}` }));
    const results = await Promise.all(txs.map((tx) => pool.stamp(tx, "0x5350494b45")));
    for (let index = 0; index < results.length; index++) {
      const seed = invokeHash(txs[index], "0x5350494b45");
      expect(results[index].signature.slice(3)).toEqual([VRF_STAMP_TAG, ...prover.proofs([seed])[0].slice(0, 5)]);
      expect(invokeHash(results[index], "0x5350494b45")).toBe(seed);
    }
  } finally {
    pool.stop();
    prover.close();
    rmSync(directory, { recursive: true });
  }
});
