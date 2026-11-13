import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { compileSitePreviews, generateSitePreviews } from "./generate-site-previews.mjs";

const root = new URL("../", import.meta.url);
const source = Object.fromEntries(
  await Promise.all(
    ["expeditions", "progression", "taxonomy", "resources", "rules", "troops"].map(async (name) => [
      name,
      await readFile(new URL(`src/${name}.cairo`, root), "utf8"),
    ]),
  ),
);

test("the shipped site previews match the current Cairo payout functions", async () => {
  await generateSitePreviews(true);
});

test("resource names resolve from module imports, including multiline imports", () => {
  const declaration = "use crate::resources::{ESSENCE, LABOR, ResourceAmount};";
  assert.ok(source.expeditions.startsWith(declaration));
  const multiline = source.expeditions.replace(
    declaration,
    "use crate::resources::{\n    ESSENCE, LABOR, ResourceAmount,\n};",
  );
  assert.equal(compileSitePreviews({ ...source, expeditions: multiline }), compileSitePreviews(source));
  const local = source.expeditions
    .replace(declaration, "")
    .replace("    let reward =", `    ${declaration}\n    let reward =`);
  assert.throws(() => compileSitePreviews({ ...source, expeditions: local }), /Unsupported site_reward imports/);
});

test("a new category or a changed resource, ratio or XP rule comes from Cairo", () => {
  const changed = {
    ...source,
    expeditions: source.expeditions
      .replace("site.initial_guard_count / 4", "site.initial_guard_count / 8")
      .replace(
        "else {\n        None\n    }",
        "else if category == crate::taxonomy::RUIN_CATEGORY {\n        Some(ResourceAmount { resource_type: ESSENCE, amount: site.initial_guard_count * 7 })\n    } else {\n        None\n    }",
      ),
    progression: source.progression
      .replace("RESOURCE_PRECISION * 25", "RESOURCE_PRECISION * 36")
      .replace("(root / 2)", "(root / 3)"),
    resources: source.resources.replace("LABOR: u8 = 23", "LABOR: u8 = 22"),
    taxonomy: source.taxonomy.replace("BEASTS_CATEGORY: u8 = 11", "BEASTS_CATEGORY: u8 = 12"),
  };
  const output = compileSitePreviews(changed);
  assert.match(output, /category === 12\) return \{ resourceType: 22, amount: depthReward\(initialGuardCount \/ 8n/);
  assert.match(output, /category === 10\) return \{ resourceType: 38, amount: depthReward\(initialGuardCount \* 7n/);
  assert.match(output, /integerSqrt\(initialGuardCount \/ 1000000000n \* 36n\) \/ 3n/);
});

test("the old XP-only Beasts rule cannot match today's generated payout", () => {
  const old = {
    ...source,
    expeditions: source.expeditions.replace(
      / else if category == crate::taxonomy::BEASTS_CATEGORY \{[^]*?\n    \}/,
      "",
    ),
  };
  assert.notEqual(compileSitePreviews(old), compileSitePreviews(source));
  assert.doesNotMatch(compileSitePreviews(old), /category === 11/);
});

test("unsupported formulas, missing constants and changed signatures refuse generation", () => {
  for (const changed of [
    { expeditions: source.expeditions.replace("use crate::resources::{ESSENCE, LABOR, ResourceAmount};", "") },
    {
      expeditions: source.expeditions.replace(
        "use crate::resources::{ESSENCE, LABOR, ResourceAmount};",
        "use crate::resources::{ESSENCE, LABOR as WOOD, ResourceAmount};",
      ),
    },
    { expeditions: source.expeditions.replace("site.initial_guard_count / 4", "site.initial_guard_count / 4 + 1") },
    { expeditions: source.expeditions.replace("else {\n        None\n    }", 'else { panic!("missing") }') },
    { resources: source.resources.replace("pub const LABOR: u8 = 23;", "") },
    { progression: source.progression.replace("(root / 2)", "(root / 2 + 1)") },
    { troops: source.troops.replace("const RIFT_GUARD_PERCENT: u32 = 115;", "") },
    { troops: source.troops.replace("(scaled + step * 50)", "(scaled + step * 50 + 1)") },
    {
      progression: source.progression.replace(
        "clear_xp(strength: u128, depth: u8) -> u32",
        "clear_xp(strength: u128, depth: u8) -> u64",
      ),
    },
  ])
    assert.throws(() => compileSitePreviews({ ...source, ...changed }), /Unsupported|Missing/);
});

test("rift guard bounds execute Cairo's percentage and grid rounding at every depth", async () => {
  const load = async (troops) => {
    const { outputText } = ts.transpileModule(compileSitePreviews({ ...source, troops }), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    });
    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
  };
  const { previewRiftGuardBound } = await load(source.troops);
  assert.deepEqual(
    [
      [1200, 1400],
      [2400, 2800],
      [4700, 5700],
      [9300, 11500],
    ].map((bounds) => bounds.map((bound) => previewRiftGuardBound(bound, 100))),
    [
      [1400, 1600],
      [2800, 3200],
      [5400, 6600],
      [10700, 13200],
    ],
  );
  const stronger = await load(source.troops.replace("RIFT_GUARD_PERCENT: u32 = 115", "RIFT_GUARD_PERCENT: u32 = 120"));
  assert.equal(stronger.previewRiftGuardBound(11500, 100), 13800);
  const rounding = await load(source.troops.replace("step * 50", "step * 1"));
  assert.equal(rounding.previewRiftGuardBound(1200, 100), 1300);
});

test("depth premiums come from the shared Cairo formula", () => {
  const changed = {
    ...source,
    expeditions: source.expeditions.replace("amount * (2 + depth.into()) / 2", "amount * (3 + depth.into()) / 3"),
  };
  assert.match(compileSitePreviews(changed), /3n \+ BigInt\(depth\)/);
});
