import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { defineFactModels } from "../schema/fact-models.mjs";
import { wireRoots, wireTypeNames } from "./wire-types.mjs";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const struct = (name, ...types) => ({
  type: "struct",
  name,
  members: types.map((type, index) => ({ name: `field_${index}`, type })),
});

function hashedTypes(types, roots) {
  const map = new Map(types.map((type) => [type.name, type]));
  const wire = wireTypeNames(map, roots);
  return sha256(types.filter(({ name }) => wire.has(name)));
}

test("an internal library type leaves the hashed types unchanged, a type a model reaches changes them", () => {
  const roots = { models: [{ members: [{ name: "army", type: "core::option::Option::<x::Army>" }] }] };
  const army = struct("x::Army", "x::Troops");
  const troops = struct("x::Troops", "core::integer::u32");
  const option = {
    type: "enum",
    name: "core::option::Option::<x::Army>",
    variants: [{ name: "Some", type: "x::Army" }],
  };
  const internal = struct("x::LibraryCall", "core::felt252");
  const before = hashedTypes([army, troops, option, internal], roots);
  assert.equal(hashedTypes([army, troops, option, struct("x::LibraryCall", "core::integer::u8")], roots), before);
  assert.equal(hashedTypes([army, troops, option], roots), before);
  assert.notEqual(hashedTypes([army, struct("x::Troops", "core::integer::u64"), option, internal], roots), before);
});

test("the published schema holds exactly the types its models, model structs, events, Games and command reach", async () => {
  const schema = await readJson("schema/schema.json");
  const { commandAbi } = await readJson("schema/bindings.json");
  const types = new Map(Object.entries(schema.types));
  const modelStructs = new Set();
  defineFactModels({
    struct: (name) => {
      modelStructs.add(`world_native::${name}`);
      return types.get(`world_native::${name}`).members;
    },
    model: () => ({}),
  });
  const wire = wireTypeNames(types, wireRoots(schema, commandAbi, modelStructs));
  assert.deepEqual(
    [...types.keys()].filter((name) => !wire.has(name)),
    [],
  );
  assert.ok(types.has("world_native::commands::Command"));
});
