import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAmmIndexerEnvContent, resolveAmmIndexerEnvPath } from "./link-indexer-env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..", "..", "..", "..", "..");

const network = process.env.STARKNET_NETWORK ?? "local";
const addressesPath = path.join(repoRoot, "contracts", "common", "addresses", `${network}.json`);
const envExamplePath = path.join(repoRoot, "client", "apps", "amm-indexer", ".env.example");
const envTargetPath = path.join(repoRoot, resolveAmmIndexerEnvPath(network));

const addresses = JSON.parse(await fs.readFile(addressesPath, "utf8"));

if (!addresses.amm) {
  throw new Error(`AMM address is missing from ${addressesPath}`);
}

if (!addresses.lords) {
  throw new Error(`LORDS address is missing from ${addressesPath}`);
}

let existingContent;
try {
  existingContent = await fs.readFile(envTargetPath, "utf8");
} catch (error) {
  existingContent = await fs.readFile(envExamplePath, "utf8");
}

const nextContent = buildAmmIndexerEnvContent(existingContent, {
  ammAddress: addresses.amm,
  lordsAddress: addresses.lords,
});

await fs.writeFile(envTargetPath, nextContent);

console.log(`Linked AMM indexer environment for ${network}`);
console.log(`  env file: ${envTargetPath}`);
console.log(`  AMM_ADDRESS=${addresses.amm}`);
console.log(`  LORDS_ADDRESS=${addresses.lords}`);
