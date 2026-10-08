import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findTaxonomyViolations, parseTaxonomy, readCheckedTaxonomy } from "./taxonomy.mjs";

const sourceDirectory = fileURLToPath(new URL("../src/", import.meta.url));
const generatedClient = new URL("../schema/client.gen.ts", import.meta.url);

test("no production source defines an id or writes one as a bare number", async () => {
  await assert.doesNotReject(readCheckedTaxonomy(sourceDirectory));
});

test("the generated enums hold every id the taxonomy module names", async () => {
  const { structureCategories, tileOccupiers } = await readCheckedTaxonomy(sourceDirectory);
  const generated = await readFile(generatedClient, "utf8");
  assert.deepEqual(generatedEnum(generated, "NativeStructureCategory"), structureCategories);
  assert.deepEqual(generatedEnum(generated, "NativeTileOccupier"), tileOccupiers);
});

test("each form that writes or compares an id is refused outside the module", () => {
  const forms = [
    "pub const RUIN_CATEGORY: u8 = 9;",
    'assert!(structure.base.category == 1, "not a realm");',
    "if occupied.category != 40 {",
    "let base = StructureBase { level: 0, category: 7, ..Default::default() };",
    "MapState::occupy(tile_key(game_id, coord), id,\n    35, true);",
  ];
  for (const source of forms) {
    assert.equal(findTaxonomyViolations([{ path: "logic/example.cairo", source }]).length, 1, source);
  }
  const named = "assert!(structure.base.category == crate::taxonomy::REALM_CATEGORY && base.category != 0);";
  assert.deepEqual(findTaxonomyViolations([{ path: "logic/example.cairo", source: named }]), []);
});

test("an id is named once per family", () => {
  const source =
    "pub const CAMP_CATEGORY: u8 = 7;\npub const RUIN_CATEGORY: u8 = 7;\npub const NONE_OCCUPIER: u8 = 0;\n";
  assert.throws(() => parseTaxonomy(source), /reuses CATEGORY id 7/);
});

function generatedEnum(source, name) {
  const body = source.match(new RegExp(`export enum ${name} \\{([^}]*)\\}`))?.[1];
  assert.ok(body, `missing generated enum ${name}`);
  return Object.fromEntries([...body.matchAll(/(\w+) = (\d+),/g)].map(([, member, value]) => [member, Number(value)]));
}
