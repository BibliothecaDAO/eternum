import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash } from "starknet";
import { invoke, identity } from "../../../../deploy/athanor/vrf/fixtures";
import { openProver } from "../../../../deploy/athanor/vrf/native";

const destination = new URL("../tests/vectors.txt", import.meta.url);
// Generation stores only public points/proofs/hashes. Its ephemeral credential is destroyed, never a fixture.
if (process.argv.includes("--generate")) {
  const directory = mkdtempSync(join(tmpdir(), "realms-vrf-vectors-")),
    file = join(directory, "key.json");
  const secret = randomBytes(32);
  secret[0] &= 3;
  writeFileSync(file, JSON.stringify({ privateKey: "0x" + secret.toString("hex") }), { mode: 0o600 });
  secret.fill(0);
  const prover = openProver(file, identity.chainId);
  try {
    const rows = Array.from({ length: 64 }, (_, index) => {
      const tx = { ...invoke(), nonce: `0x${index.toString(16)}` };
      const stamp = prover.stamp(new TextEncoder().encode(JSON.stringify(tx)));
      const proof = stamp.suffix.slice(1);
      const root = hash.computePoseidonHashOnElements([3, proof[0]!, proof[1]!, 0]);
      return [prover.publicKey.x, prover.publicKey.y, stamp.transactionHash, ...proof, root].map(
        (value) => "0x" + BigInt(value).toString(16),
      );
    });
    writeFileSync(destination, ["0x40", ...rows.flat()].join("\n") + "\n");
  } finally {
    prover.close();
    rmSync(directory, { recursive: true });
  }
}
const fields = readFileSync(destination, "utf8").trim().split(/\s+/).map(BigInt);
if (fields[0] !== 64n || fields.length !== 1 + 64 * 9) throw new Error("64 complete vectors required");
for (let row = 0; row < 64; row++) {
  const offset = 1 + row * 9;
  const expected = fields[offset + 8];
  const actual = hash.computePoseidonHashOnElements([3, fields[offset + 3]!, fields[offset + 4]!, 0]);
  if (BigInt(actual) !== expected) throw new Error("Independent Poseidon root differs");
}
console.log(JSON.stringify({ knownAnswers: 64, independentPoseidon: "passed", containsPrivateCredentials: false }));
