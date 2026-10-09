import { readFileSync, writeFileSync } from "node:fs";
import { hash } from "starknet";

const artifact = new URL("../target/dev/realms_vrf_verifier_Verifier.contract_class.json", import.meta.url);
const destination = new URL("../../world-native/src/vrf_class.cairo", import.meta.url);
const classHash = hash.computeSierraContractClassHash(JSON.parse(readFileSync(artifact, "utf8")));
const source = `// Pin the owned verifier code; the shard chooses its key, never its verification algorithm.\npub const VRF_VERIFIER_CLASS_HASH: felt252 = ${classHash};\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(destination, "utf8") !== source)
    throw new Error("Verifier class hash differs; rebuild and pin the owned class before landing");
} else writeFileSync(destination, source);
console.log(JSON.stringify({ verifierClassHash: classHash, checked: process.argv.includes("--check") }));
