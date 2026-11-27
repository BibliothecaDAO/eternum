import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { compileSitePreviews, generateSitePreviews } from "./generate-site-previews.mjs";

const root = new URL("../", import.meta.url);
const source = Object.fromEntries(
  await Promise.all(
    ["expeditions", "taxonomy", "resources", "rules", "army_relics"].map(async (name) => [
      name,
      await readFile(new URL(`src/${name}.cairo`, root), "utf8"),
    ]),
  ),
);

test("the shipped site previews match the current Cairo payout functions", async () => {
  await generateSitePreviews(true);
});

test("a new category or a changed resource or ratio comes from Cairo", () => {
  const changed = {
    ...source,
    expeditions: source.expeditions
      .replace("site.initial_guard_count * 4", "site.initial_guard_count * 8")
      .replace(
        "else {\n        None\n    }",
        "else if category == crate::taxonomy::RUIN_CATEGORY {\n        Some(ResourceAmount { resource_type: ESSENCE, amount: site.initial_guard_count * 7 })\n    } else {\n        None\n    }",
      ),
    resources: source.resources.replace("WHEAT: u8 = 35", "WHEAT: u8 = 22"),
    taxonomy: source.taxonomy.replace("BEASTS_CATEGORY: u8 = 11", "BEASTS_CATEGORY: u8 = 12"),
  };
  const output = compileSitePreviews(changed);
  assert.match(output, /category === 12\) return \{ resourceType: 22, amount: depthReward\(initialGuardCount \* 8n/);
  assert.match(output, /category === 10\) return \{ resourceType: 38, amount: depthReward\(initialGuardCount \* 7n/);
});

test("a missing beast resource rule cannot match today's generated payout", () => {
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
    { expeditions: source.expeditions.replace("site.initial_guard_count * 4", "site.initial_guard_count * 4 + 1") },
    { expeditions: source.expeditions.replace("else {\n        None\n    }", 'else { panic!("missing") }') },
    { resources: source.resources.replace("pub const LABOR: u8 = 23;", "") },
    { expeditions: source.expeditions.replace("depth: u8, band: bool", "depth: u64, band: bool") },
  ]) {
    for (const [name, input] of Object.entries(changed)) assert.notEqual(input, source[name]);
    assert.throws(() => compileSitePreviews({ ...source, ...changed }), /Unsupported|Missing/);
  }
});

test("depth premiums come from the shared Cairo formula", () => {
  const changed = {
    ...source,
    expeditions: source.expeditions.replace("amount * (2 + depth.into()) / 2", "amount * (3 + depth.into()) / 3"),
  };
  assert.match(compileSitePreviews(changed), /3n \+ BigInt\(depth\)/);
});

test("ruin bounds follow the relic's place on its layer, doubled each layer down, and the Cairo spread", async () => {
  const load = async (rules) =>
    import(
      `data:text/javascript;base64,${Buffer.from(ts.transpileModule(compileSitePreviews({ ...source, army_relics: rules }), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString("base64")}`
    );
  const normal = await load(source.army_relics);
  assert.deepEqual(
    [
      [1, 0],
      [2, 0],
      [3, 0],
      [2, 1],
      [4, 1],
      [5, 2],
    ].map(([rank, depth]) => normal.previewRuinGuardBounds(rank, depth)),
    [
      [900, 1100],
      [1350, 1650],
      [2250, 2750],
      [1800, 2200],
      [4500, 5500],
      [9000, 11000],
    ],
  );
  assert.throws(() => normal.previewRuinGuardBounds(4, 0), /Relic outside its layer/);
  assert.throws(() => normal.previewRuinGuardBounds(1, 1), /Relic outside its layer/);
  const changed = await load(
    source.army_relics
      .replace("1 => 1500", "1 => 2000")
      .replace("RUIN_GUARD_SPREAD_PERCENT: u128 = 10", "RUIN_GUARD_SPREAD_PERCENT: u128 = 20"),
  );
  assert.deepEqual(changed.previewRuinGuardBounds(2, 0), [1600, 2400]);
});

test("Band and Herd rewards follow the executable Cairo rules", async () => {
  const load = async (expeditions) =>
    import(
      `data:text/javascript;base64,${Buffer.from(ts.transpileModule(compileSitePreviews({ ...source, expeditions }), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText).toString("base64")}`
    );
  const preview = await load(source.expeditions);
  const rules = { rift_essence_bps: 15000 };
  assert.equal(preview.previewSiteReward(11, 450000000000n, 0, true, rules), null);
  assert.deepEqual(preview.previewSiteReward(11, 350000000000n, 0, false, rules), {
    resourceType: 35,
    amount: 1400000000000n,
  });
  assert.deepEqual(preview.previewSiteReward(9, 100000000000n, 0, false, rules), {
    resourceType: 38,
    amount: 150000000000n,
  });
  assert.throws(() => preview.previewSiteReward(9, 100000000000n, 0, false), /DepthRules required/);
  assert.throws(
    () =>
      compileSitePreviews({
        ...source,
        expeditions: source.expeditions.replace(
          "if band {\n        return None;",
          "if band {\n        return Some(ResourceAmount { resource_type: WHEAT, amount: 1 });",
        ),
      }),
    /Unsupported/,
  );
});
