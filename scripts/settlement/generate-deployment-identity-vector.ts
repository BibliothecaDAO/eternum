import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildA18DeploymentIdentityVector } from "../../packages/settlement-codec/src/deployment-identity-vector";
import { reproduceA18KatanaGenesis } from "./reproduce-a18-katana-genesis";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUTPUT_PATH = resolve(REPOSITORY_ROOT, "packages/settlement-codec/schema/deployment-identity-vector-v1.json");
const GENESIS_OUTPUT_PATH = resolve(REPOSITORY_ROOT, "packages/settlement-codec/schema/katana-genesis-a18-v1.json");
const vector = buildA18DeploymentIdentityVector();
const reproducedGenesis = await reproduceA18KatanaGenesis();
if (reproducedGenesis.stateRoot !== vector.genesisArtifact.stateRoot) {
  throw new Error("pinned Katana reproduced a different A18 genesis state root");
}
const expectedVector = `${JSON.stringify(vector, bigintReplacer, 2)}\n`;
const expectedGenesis = `${JSON.stringify(reproducedGenesis.document, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const actualVector = readFileSync(OUTPUT_PATH, "utf8");
  const actualGenesis = readFileSync(GENESIS_OUTPUT_PATH, "utf8");
  if (actualVector !== expectedVector || actualGenesis !== expectedGenesis) {
    throw new Error("deployment identity golden vector is stale; run generate:deployment-identity-vector");
  }
} else {
  writeFileSync(OUTPUT_PATH, expectedVector);
  writeFileSync(GENESIS_OUTPUT_PATH, expectedGenesis);
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
