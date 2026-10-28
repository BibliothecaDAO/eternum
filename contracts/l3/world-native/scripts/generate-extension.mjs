import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../../../../config/source/frontier/extension.json", import.meta.url);
const target = new URL("../src/approved_frontier_extension.cairo", import.meta.url);
const plan = JSON.parse(readFileSync(source, "utf8"));
const fields = [
  ["CHAIN_ID", "felt252", plan.chainId],
  ["GAME_ID", "u32", plan.gameId],
  ["PRESET_ID", "u32", plan.presetId],
  ["NAME", "felt252", `'${plan.name}'`],
  ["START", "u64", plan.start],
  ["OLD_END", "u64", plan.oldEnd],
  ["END", "u64", plan.end],
  ["SEED", "felt252", plan.seed],
  ["DAY_UNIT", "u32", plan.dayUnit],
  ["CLAIM_WINDOW", "u32", plan.claimWindow],
  ["POOL_LORDS", "u128", plan.poolLords],
  ["RELEASE", "u32", plan.release],
];
const output =
  "// Approved identity: config/source/frontier/extension.json. Run scripts/generate-extension.mjs to update.\n" +
  fields.map(([name, type, value]) => `pub const ${name}: ${type} = ${value};`).join("\n") +
  "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) throw new Error("Regenerate the approved Frontier extension constants");
} else writeFileSync(target, output);
