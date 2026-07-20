import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "starknet";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const mmrRoot = resolve(repositoryRoot, "contracts/mmr");
const observation = JSON.parse(
  readFileSync(resolve(repositoryRoot, "packages/settlement-codec/schema/onchain-observation-a20-v1.json"), "utf8"),
);

execFileSync("scarb", ["--release", "build"], { cwd: mmrRoot, stdio: "inherit" });
const rebuiltClass = JSON.parse(
  readFileSync(resolve(mmrRoot, "target/release/mmr_MMRToken.contract_class.json"), "utf8"),
);
const rebuiltClassHash = hash.computeSierraContractClassHash(rebuiltClass);
const rebuildMatchesObservation = BigInt(rebuiltClassHash) === BigInt(observation.classHash);

assertFeltEqual(rebuiltClassHash, observation.localSourceRebuild.sierraClassHash, "recorded local source class hash");
if (rebuildMatchesObservation !== observation.localSourceRebuild.matchesObservedClass) {
  throw new Error("recorded local/observed MMR class comparison is stale");
}

console.log(
  JSON.stringify({
    localSourceClassHash: rebuiltClassHash,
    matchesObservedClass: rebuildMatchesObservation,
    observedClassHash: observation.classHash,
  }),
);

function assertFeltEqual(actual, expected, label) {
  if (BigInt(actual) !== BigInt(expected)) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
  }
}
