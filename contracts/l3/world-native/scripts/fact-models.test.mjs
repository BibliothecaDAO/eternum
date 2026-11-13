import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { defineFactModels } from "../schema/fact-models.mjs";

const declarations = {
  struct: () => [
    { name: "key", type: "core::integer::u32" },
    { name: "value", type: "core::felt252" },
  ],
  model: (name, scope, keys, members) => ({ name, scope, keys, members }),
};

test("Aspect activity has one shared declaration independent of world bane rules", () => {
  const models = defineFactModels(declarations);
  const activity = models.filter(({ name }) => name === "AspectActivity");
  assert.equal(activity.length, 1);
  assert.deepEqual(
    activity[0].keys.map(({ name }) => name),
    ["game_id", "aspect", "day"],
  );
  assert.deepEqual(activity[0].members, [{ name: "active", type: "core::integer::u32" }]);
  assert.equal(activity[0].absence.parent, "GameRegistry");
  assert.equal(activity[0].absence.value, "zero");
});

test("a second AspectActivity declaration cannot overwrite the shared model", async (t) => {
  const source = await readFile(new URL("../schema/fact-models.mjs", import.meta.url), "utf8");
  const duplicate = `model("AspectActivity", "game", [
    { name: "game_id", type: "core::integer::u32" },
    { name: "aspect", type: "core::integer::u8" },
    { name: "day", type: "core::integer::u64" },
  ], [{ name: "members", type: "core::integer::u32" }]),`;
  const collision = source.replace('model("TileOpt",', `${duplicate}\nmodel("TileOpt",`);
  assert.notEqual(collision, source);
  const directory = await mkdtemp(join(tmpdir(), "native-fact-models-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "collision.mjs");
  await writeFile(path, collision);
  const module = await import(pathToFileURL(path));
  assert.throws(
    () => module.defineFactModels(declarations),
    /Duplicate fact model AspectActivity: keep one declaration and migrate its consumers/,
  );
});
