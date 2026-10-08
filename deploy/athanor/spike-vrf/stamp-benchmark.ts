import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { cpus, availableParallelism } from "node:os";
import { ProverPool } from "./pool";
import { NativeProver, feltBytes } from "./native";
import { invokeHash, type Invoke } from "./transaction";

const [keyFile, transactionsFile, chain, output] = process.argv.slice(2);
if (!keyFile || !transactionsFile || !chain || !output)
  throw new Error("Usage: bun stamp-benchmark.ts PRIVATE_VRF_KEY TXS_JSON CHAIN OUTPUT_JSON");
const txs = JSON.parse(readFileSync(transactionsFile, "utf8")) as Invoke[];
if (txs.length !== 2000) throw new Error("Stamp benchmark requires exactly2000 unsigned-proof V3 transactions");
if (txs.some((tx) => tx.signature.length !== 3))
  throw new Error("Stamp benchmark requires the original three-felt signatures");
const prover = new NativeProver(feltBytes(readFileSync(keyFile, "utf8").trim()));
const rows = [];
try {
  const expectedSeeds = txs.map((tx) => invokeHash(tx, chain));
  const expected = prover.proofs(expectedSeeds);
  for (const threads of [1, 2, 4, 8] as const) {
    const start = performance.now();
    const pool = new ProverPool(keyFile, threads);
    try {
      await pool.ready;
      const startupMs = performance.now() - start;
      await Promise.all(txs.slice(0, 16).map((tx) => pool.stamp(tx, chain)));
      for (let repetition = 0; repetition < 3; repetition++) {
        const started = performance.now();
        const stamped = await Promise.all(txs.map((tx) => pool.stamp(tx, chain)));
        const durationMs = performance.now() - started;
        for (let index = 0; index < txs.length; index++) {
          if (
            stamped[index].signature.slice(3).join() !== expected[index].slice(0, 5).join() ||
            invokeHash(stamped[index], chain) !== expectedSeeds[index]
          )
            throw new Error("Stamp/proof/hash mismatch");
        }
        rows.push({
          threads,
          repetition,
          transactions: txs.length,
          startupMs,
          durationMs,
          stampsPerSecond: (txs.length * 1000) / durationMs,
          under500ms: durationMs < 500,
        });
      }
    } finally {
      pool.stop();
    }
  }
  const report = {
    machine: cpus()[0]?.model,
    availableParallelism: availableParallelism(),
    datasetSha256: createHash("sha256").update(readFileSync(transactionsFile)).digest("hex"),
    publicKey: prover.publicKey(),
    scope:
      "transaction hashing, Bun worker dispatch, complete native proof+hint and suffix copying; excludes RPC guards and network forwarding; startup reported separately",
    rows,
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  prover.close();
}
