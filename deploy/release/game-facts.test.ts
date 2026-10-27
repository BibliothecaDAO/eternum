import { expect, test } from "bun:test";
import type { FoldCheckpoint } from "../../apps/herald/src/types";
import { diffFacts, gameFacts, type GameFacts } from "./game-facts";

const registry = (game: number, end: number) => ({
  entity_id: `0x${game.toString(16)}`,
  key: { game_id: game },
  value: { name: "frontier", end_at: end, settled: false },
});
const army = (game: number, id: number, troops: string) => ({
  entity_id: `0x${game.toString(16)}:0x${id.toString(16)}`,
  key: { game_id: String(game), explorer_id: id },
  value: { count: troops, stamina: 120 },
});
const lords = (game: number, owner: string, balance: string) => ({
  entity_id: `0x${game.toString(16)}:${owner}`,
  key: { game_id: game, owner },
  value: { balance },
});

/** A Herald checkpoint holding two games and a deployment-wide row, as Herald saves it. */
const checkpoint = (end: number, armies = [army(1, 7, "4015")], balance = "91"): FoldCheckpoint => ({
  version: 2,
  native_schema_identity: "2fbdecd0",
  world_address: "0x1",
  models: [
    { model: "GameRegistry", rows: [registry(1, end), registry(2, 50)] },
    { model: "ExplorerTroops", rows: [...armies, army(2, 9, "10")] },
    { model: "Resource", rows: [lords(1, "0xa", balance)] },
    { model: "Preset", rows: [{ entity_id: "0x5", key: { preset_id: 5 }, value: { commitment: "0x4a" } }] },
  ],
});

const OLD_END = 1793151960;
const NEW_END = 1793439960;
const before = gameFacts(checkpoint(OLD_END), 100, 1);

test("a snapshot keeps the game's rows only, with the checkpoint's block and schema", () => {
  expect(before).toEqual({
    confirmedBlock: 100,
    schema: "2fbdecd0",
    gameId: 1,
    models: {
      GameRegistry: { "0x1": { key: { game_id: 1 }, value: { name: "frontier", end_at: OLD_END, settled: false } } },
      ExplorerTroops: { "0x1:0x7": { key: { game_id: "1", explorer_id: 7 }, value: { count: "4015", stamina: 120 } } },
      Resource: { "0x1:0xa": { key: { game_id: 1, owner: "0xa" }, value: { balance: "91" } } },
    },
  });
});

test("a game nobody touched has no change", () => {
  expect(diffFacts(before, gameFacts(checkpoint(OLD_END), 200, 1), [])).toEqual([]);
});

test("release 4's extension changes the season end alone, as expected", () => {
  const after = gameFacts(checkpoint(NEW_END), 200, 1);
  expect(diffFacts(before, after, ["GameRegistry.end_at"])).toEqual([
    { model: "GameRegistry", entity: "0x1", kind: "changed", members: ["end_at"], expected: true },
  ]);
});

test("a lost army and a changed balance are unexpected", () => {
  const after = gameFacts(checkpoint(NEW_END, [], "0"), 200, 1);
  expect(diffFacts(before, after, ["GameRegistry"])).toEqual([
    { model: "ExplorerTroops", entity: "0x1:0x7", kind: "removed", expected: false },
    { model: "GameRegistry", entity: "0x1", kind: "changed", members: ["end_at"], expected: true },
    { model: "Resource", entity: "0x1:0xa", kind: "changed", members: ["balance"], expected: false },
  ]);
});

test("expecting one member does not excuse another member of the same row", () => {
  const settled: GameFacts = structuredClone(gameFacts(checkpoint(NEW_END), 200, 1));
  settled.models.GameRegistry!["0x1"]!.value.settled = true;
  expect(diffFacts(before, settled, ["GameRegistry.end_at"])).toEqual([
    { model: "GameRegistry", entity: "0x1", kind: "changed", members: ["end_at", "settled"], expected: false },
  ]);
});

test("a new row is listed as added", () => {
  const after = gameFacts(checkpoint(OLD_END, [army(1, 7, "4015"), army(1, 8, "500")]), 200, 1);
  expect(diffFacts(before, after, [])).toEqual([
    { model: "ExplorerTroops", entity: "0x1:0x8", kind: "added", expected: false },
  ]);
});

test("snapshots of two games are refused", () => {
  expect(() => diffFacts(before, gameFacts(checkpoint(OLD_END), 200, 2), [])).toThrow("Snapshots of games 1 and 2");
});
