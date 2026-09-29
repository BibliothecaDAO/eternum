/** Writes today's generated Frontier configuration for the dev-only HUD lab. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { toJsonValue } from "../../herald/src/model-registry";
import { currentPresetFixture } from "../../herald/src/native/current-preset-fixture";

const out = process.argv[2];
if (!out) throw new Error("Usage: bun frontier-lab-facts.ts <out.json>");
const target = resolve(out);
const facts = currentPresetFixture(5).rows.map((row) => {
  if (row.kind !== "set") throw new Error(`Projected ${row.model.name} is not a complete fact`);
  return { model: row.model.name, value: toJsonValue({ ...row.key, ...row.value }) };
});
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(facts));
console.log(`Wrote the current Frontier rules to ${target}`);
