#!/usr/bin/env node

/**
 * Copy ABI sections from one Dojo manifest JSON to another.
 *
 * Configure parameters below (no CLI args).
 *
 * Examples:
 *   FROM_JSON = 'contracts/game/manifest_slot.json'
 *   TO_JSON   = 'contracts/game/manifest_mainnet.json'
 *   WORLD_ONLY = false
 *   CONTRACTS_ONLY = false
 *   DRY_RUN = false
 */

// ====== Parameters (edit as needed) ======
const FROM_JSON = 'contracts/game/manifest_local.json';
const TO_JSON = 'contracts/game/manifest_mainnet.json';
const WORLD_ONLY = false;       // if true, copy only world.abi
const CONTRACTS_ONLY = false;   // if true, copy only contract ABIs by tag
const DRY_RUN = false;          // if true, do not write file
// ========================================

import fs from "fs";
import path from "path";

function readJson(p) {
  const full = path.resolve(p);
  const raw = fs.readFileSync(full, "utf8");
  return { json: JSON.parse(raw), fullPath: full };
}

function writeJson(p, obj) {
  const full = path.resolve(p);
  const raw = JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(full, raw);
}

function copyWorldAbi(source, target) {
  if (!source?.world?.abi) throw new Error("Source manifest has no world.abi to copy");
  if (!target?.world) throw new Error("Target manifest missing world object");
  target.world.abi = source.world.abi;
  return 1;
}

function copyContractAbis(source, target) {
  const sContracts = Array.isArray(source?.contracts) ? source.contracts : [];
  const tContracts = Array.isArray(target?.contracts) ? target.contracts : [];
  const byTag = new Map();
  for (const c of sContracts) if (c?.tag && c?.abi) byTag.set(c.tag, c.abi);
  let updated = 0;
  for (const c of tContracts) {
    if (!c) continue;
    if (c.tag && byTag.has(c.tag)) {
      c.abi = byTag.get(c.tag);
      updated++;
    }
  }
  return updated;
}

async function main() {
  if (WORLD_ONLY && CONTRACTS_ONLY) {
    throw new Error('Set only one of WORLD_ONLY or CONTRACTS_ONLY to true');
  }
  const { json: src, fullPath: srcPath } = readJson(FROM_JSON);
  const { json: dst, fullPath: dstPath } = readJson(TO_JSON);

  let worldCount = 0;
  let contractCount = 0;

  if (!CONTRACTS_ONLY) {
    worldCount = copyWorldAbi(src, dst);
  }
  if (!WORLD_ONLY) {
    contractCount = copyContractAbis(src, dst);
  }

  if (DRY_RUN) {
    console.log(
      `Dry run: would copy world ABI (${worldCount}) and ${contractCount} contract ABI(s) from ${srcPath} -> ${dstPath}`,
    );
    return;
  }

  writeJson(TO_JSON, dst);
  console.log(
    `Copied world ABI (${worldCount}) and ${contractCount} contract ABI(s) from ${srcPath} -> ${dstPath}`,
  );
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
