import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ROW_BUILDER,
  ROW_ENCODER,
  findHandWrittenGameRegistryRows,
  gameRegistryMembers,
  isScannedSource,
} from "./check-game-registry-rows.mjs";

const members = gameRegistryMembers(
  JSON.parse(readFileSync(new URL("../contracts/l3/world-native/schema/schema.json", import.meta.url), "utf8")),
);
const handWritten = `{
  game_id: 1, name: "1", family: 1, preset_id: 7, settled: false, ready: true, dev_mode_on: false,
  start_settling_at: "1", start_main_at: "2", end_at: "3", end_grace_seconds: 0, seed: "1", scheduled_end_at: "3",
}`;
const lines = (files) => findHandWrittenGameRegistryRows(files, members).map(({ path, line }) => `${path}:${line}`);

test("the members come from the schema's GameRegistry model, its key first", () => {
  assert.equal(members[0], "game_id");
  assert.ok(members.includes("family") && members.includes("scheduled_end_at"));
});

test("a whole row written by hand is refused, an older row missing a member or two included", () => {
  const older = handWritten.replace("family: 1, ", "").replace('scheduled_end_at: "3",', "");
  assert.deepEqual(
    lines([
      { path: "apps/herald/src/a.test.ts", text: `const game = ${handWritten};` },
      { path: "apps/realms/server/b.ts", text: `\n\nconst rows = [{ key: "1", value: ${older} }];` },
    ]),
    ["apps/herald/src/a.test.ts:1", "apps/realms/server/b.ts:3"],
  );
});

test("a row from the builder passes, however many members its overrides name, and so does a partial read model", () => {
  assert.deepEqual(
    lines([
      { path: "apps/herald/src/a.test.ts", text: `const game = gameRegistryRow(${handWritten});` },
      { path: "apps/herald/src/b.test.ts", text: `const event = gameRegistryEvent({ preset_id: 6, seed: "7" });` },
      { path: "apps/herald/src/c.test.ts", text: `add("GameRegistry", { start_main_at: 100 });` },
      { path: ROW_BUILDER, text: `export const gameRegistryRow = (overrides) => (${handWritten});` },
    ]),
    [],
  );
});

test("a GameRegistry row event is encoded only by the Herald fixture encoder", () => {
  const event = 'rowEvent("GameRegistry", ["1"], values);\nrowEvent("SettlementRules", ["1"], values);';
  assert.deepEqual(
    lines([
      { path: "apps/herald/src/a.test.ts", text: event },
      { path: ROW_ENCODER, text: event },
    ]),
    ["apps/herald/src/a.test.ts:1"],
  );
});

test("the guard reads the app, package, deploy and config sources, not dependencies or contracts", () => {
  assert.equal(isScannedSource("apps/herald/src/home-ring.test.ts"), true);
  assert.equal(isScannedSource("packages/core/src/client/views/views.test.ts"), true);
  assert.equal(isScannedSource("deploy/athanor/harness/burst.ts"), true);
  assert.equal(isScannedSource("apps/game/node_modules/x/index.js"), false);
  assert.equal(isScannedSource("contracts/l3/world-native/schema/client.gen.ts"), false);
});
