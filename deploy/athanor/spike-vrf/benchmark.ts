import { readFileSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { NativeProver, feltBytes } from "./native";

const [keyFile, output] = process.argv.slice(2);
if (!keyFile || !output) throw new Error("Usage: bun benchmark.ts PRIVATE_VRF_KEY_FILE OUTPUT_JSON");
if ((statSync(keyFile).mode & 0o077) !== 0) throw new Error("VRF key file must be private");
const prover = new NativeProver(feltBytes(readFileSync(keyFile, "utf8").trim()));
const seeds = Array.from({ length: 2000 }, (_, index) => `0x${(BigInt(index) + 42n).toString(16)}`);
const rows = [];
try {
  prover.proofs(seeds.slice(0, 16));
  const expected = prover.proofs(seeds, 1);
  for (const threads of [1, 2, 4] as const) {
    for (let repetition = 0; repetition < 3; repetition++) {
      const start = performance.now();
      const result = prover.proofs(seeds, threads);
      const durationMs = performance.now() - start;
      if (result.some((proof, index) => proof.join() !== expected[index].join()))
        throw new Error("Threaded prover changed a proof");
      rows.push({
        threads,
        repetition,
        proofs: seeds.length,
        durationMs,
        proofsPerSecond: (seeds.length * 1000) / durationMs,
        under500ms: durationMs < 500,
      });
    }
  }
  const report = {
    scope:
      "complete native proof plus SWU hint, FFI, felt encoding/decoding and thread startup; excludes transaction hashing/proxy forwarding",
    availableParallelism: availableParallelism(),
    publicKey: prover.publicKey(),
    rows,
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  prover.close();
}
