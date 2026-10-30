import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileSitePreviews, generateSitePreviews } from "./generate-site-previews.mjs";

const root = new URL("../", import.meta.url);
const source = Object.fromEntries(
  await Promise.all(
    ["expeditions", "progression", "taxonomy", "resources", "rules"].map(async (name) => [
      name,
      await readFile(new URL(`src/${name}.cairo`, root), "utf8"),
    ]),
  ),
);

test("the shipped site previews match the current Cairo payout functions", async () => {
  await generateSitePreviews(true);
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
  assert.match(output, /category === 12\) return \{ resourceType: 22, amount: initialGuardCount \/ 8n/);
  assert.match(output, /category === 10\) return \{ resourceType: 38, amount: initialGuardCount \* 7n/);
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
    { expeditions: source.expeditions.replace("site.initial_guard_count / 4", "site.initial_guard_count / 4 + 1") },
    { expeditions: source.expeditions.replace("else {\n        None\n    }", 'else { panic!("missing") }') },
    { resources: source.resources.replace("pub const LABOR: u8 = 23;", "") },
    { progression: source.progression.replace("(root / 2)", "(root / 2 + 1)") },
    { progression: source.progression.replace("clear_xp(strength: u128) -> u32", "clear_xp(strength: u128) -> u64") },
  ])
    assert.throws(() => compileSitePreviews({ ...source, ...changed }), /Unsupported|Missing/);
});
