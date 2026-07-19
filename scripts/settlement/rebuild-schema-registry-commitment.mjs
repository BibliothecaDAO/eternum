import { readFileSync, writeFileSync } from "node:fs";

import { buildRegistryCommitment } from "./schema-registry-commitment.mjs";

const registryPath = new URL("../../packages/settlement-codec/schema/schema-registry-v1.json", import.meta.url);
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const commitment = buildRegistryCommitment(registry);

writeFileSync(registryPath, `${JSON.stringify({ ...registry, ...commitment }, null, 2)}\n`);
