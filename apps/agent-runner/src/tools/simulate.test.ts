import { expect, it } from "vitest";
import {
  createFakeGame,
  PLAYER,
  seedExplorer,
  seedGameRegistry,
  seedStructure,
  writeFact,
} from "../test-support/fake-game";
import { createSimulateTool } from "./simulate";

it("reports a realm without a map site before attempting a raid preview", async () => {
  const game = createFakeGame();
  const start = Math.floor(Date.now() / 1000) + 86400;
  seedGameRegistry(game.store, { status: "Registration", startMainAt: start, endAt: start + 86400 });
  seedStructure(game.store, { entityId: 12, owner: PLAYER, x: 100, y: 100 });
  seedExplorer(game.store, { explorerId: 101, owner: 12, x: 101, y: 100 });
  const structure = game.store.require("Structure", { game_id: 28, entity_id: 12 });
  writeFact(game.store, "Structure", [28, 12], { ...structure, base: { ...structure.base, troop_max_guard_count: 0 } });
  const rules = game.store.require("SliceRules", { game_id: 28 });
  writeFact(game.store, "SliceRules", [28], { ...rules, day_unit_seconds: 14400 });
  const result = await createSimulateTool(game).execute("raid", { kind: "raid", attackerId: 101, structureId: 12 });
  expect(result.content).toEqual([{ type: "text", text: "Structure 12 has no map site yet." }]);
});
