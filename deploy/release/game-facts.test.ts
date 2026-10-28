import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeRuleConstants } from "../../contracts/l3/world-native/schema/client.gen";
import { NativeDecoder } from "../../apps/herald/src/native/decoder";
import { manifest } from "../../apps/herald/src/native/fixtures";
import type { FoldCheckpoint, FoldCheckpointRow } from "../../apps/herald/src/types";
import { WorldFold } from "../../apps/herald/src/world-fold";
import { diffFacts, gameFacts, type GameFacts } from "./game-facts";

const CHAIN = "0x4445565f31";
const OLD_END = 1793151960;
const NEW_END = 1793439960;

const registry = (game: number, end: number, settled = false) => ({
  entity_id: `0x${game.toString(16)}`,
  key: { game_id: game },
  value: { name: "frontier", end_at: end, settled },
});
const pin = (game: number, release: number, commitment = "0x4a") => ({
  entity_id: `0x${game.toString(16)}`,
  key: { game_id: game },
  value: { release_id: release, preset_commitment: commitment },
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
const checkpoint = (
  { end = OLD_END, release = 3, commitment = "0x4a", armies = [army(1, 7, "4015")], balance = "91" } = {},
  world = "0x1",
): FoldCheckpoint => ({
  version: 2,
  native_schema_identity: "2fbdecd0",
  world_address: world,
  models: [
    { model: "GameRegistry", rows: [registry(1, end), registry(2, 50)] },
    { model: "GameRelease", rows: [pin(1, release, commitment), pin(2, 3)] },
    { model: "ExplorerTroops", rows: [...armies, army(2, 9, "10")] },
    { model: "Resource", rows: [lords(1, "0xa", balance)] },
    { model: "Preset", rows: [{ entity_id: "0x5", key: { preset_id: 5 }, value: { commitment: "0x4a" } }] },
  ],
});
const at = (confirmedBlock: number, chain = CHAIN) => ({ chain, confirmedBlock });

const before = gameFacts(checkpoint(), at(100), 1);
/** Release 4 on game 1: its pin moves from 3 to 4 and its season ends later. */
const releaseFour = gameFacts(checkpoint({ end: NEW_END, release: 4 }), at(200), 1);

test("a snapshot keeps the game's rows only, with the chain, world and schema they come from", () => {
  expect(before).toEqual({
    chain: CHAIN,
    world: "0x1",
    schema: "2fbdecd0",
    confirmedBlock: 100,
    gameId: 1,
    models: {
      GameRegistry: { "0x1": { key: { game_id: 1 }, value: { name: "frontier", end_at: OLD_END, settled: false } } },
      GameRelease: { "0x1": { key: { game_id: 1 }, value: { release_id: 3, preset_commitment: "0x4a" } } },
      ExplorerTroops: { "0x1:0x7": { key: { game_id: "1", explorer_id: 7 }, value: { count: "4015", stamina: 120 } } },
      Resource: { "0x1:0xa": { key: { game_id: 1, owner: "0xa" }, value: { balance: "91" } } },
    },
  });
});

test("a game nobody touched has no change", () => {
  expect(diffFacts(before, gameFacts(checkpoint(), at(200), 1), [])).toEqual([]);
});

test("release 4's whole transition is expected when its end and its pin are named", () => {
  expect(diffFacts(before, releaseFour, ["GameRegistry.end_at", "GameRelease.release_id"])).toEqual([
    { model: "GameRegistry", entity: "0x1", kind: "changed", members: ["end_at"], expected: true },
    { model: "GameRelease", entity: "0x1", kind: "changed", members: ["release_id"], expected: true },
  ]);
});

test("naming the end alone leaves the release pin unexpected", () => {
  expect(diffFacts(before, releaseFour, ["GameRegistry.end_at"])).toContainEqual({
    model: "GameRelease",
    entity: "0x1",
    kind: "changed",
    members: ["release_id"],
    expected: false,
  });
});

test("a release that also moves the preset commitment is unexpected", () => {
  const moved = gameFacts(checkpoint({ end: NEW_END, release: 4, commitment: "0x4b" }), at(200), 1);
  expect(diffFacts(before, moved, ["GameRegistry.end_at", "GameRelease.release_id"])).toContainEqual({
    model: "GameRelease",
    entity: "0x1",
    kind: "changed",
    members: ["preset_commitment", "release_id"],
    expected: false,
  });
});

test("a lost army and a zeroed balance are unexpected", () => {
  const after = gameFacts(checkpoint({ end: NEW_END, armies: [], balance: "0" }), at(200), 1);
  expect(diffFacts(before, after, ["GameRegistry"])).toEqual([
    { model: "ExplorerTroops", entity: "0x1:0x7", kind: "removed", expected: false },
    { model: "GameRegistry", entity: "0x1", kind: "changed", members: ["end_at"], expected: true },
    { model: "Resource", entity: "0x1:0xa", kind: "changed", members: ["balance"], expected: false },
  ]);
});

test("a new row is listed as added", () => {
  const after = gameFacts(checkpoint({ armies: [army(1, 7, "4015"), army(1, 8, "500")] }), at(200), 1);
  expect(diffFacts(before, after, [])).toEqual([
    { model: "ExplorerTroops", entity: "0x1:0x8", kind: "added", expected: false },
  ]);
});

test("a game the checkpoint does not hold is refused", () => {
  expect(() => gameFacts(checkpoint(), at(100), 99)).toThrow("Game 99 is not in this checkpoint");
});

/** Game 1 settled under a season-closing rule, folded and evicted by Herald itself. */
function settledFrontierGame(evict: boolean): FoldCheckpoint {
  const rows: Record<string, FoldCheckpointRow[]> = {
    GameRegistry: [{ ...registry(1, OLD_END, true), key: { game_id: "1" } }],
    SliceRules: [
      { entity_id: "0x1", key: { game_id: "1" }, value: { mode_rules: String(nativeRuleConstants.SEASON_CLOSE) } },
    ],
    ExplorerTroops: [army(1, 7, "4015")],
  };
  const registryOfModels = new NativeDecoder(manifest).registry;
  const fold = WorldFold.restore(registryOfModels, {
    version: 2,
    native_schema_identity: registryOfModels.nativeSchemaIdentity,
    world_address: manifest.world.address,
    models: registryOfModels.persistent.map(({ definition }) => ({
      model: definition.name,
      rows: rows[definition.name] ?? [],
    })),
    preset_preimages: [],
  });
  if (evict) fold.evictFinalizedGames();
  return fold.checkpoint();
}

test("a finalized game is refused, before Herald evicts its rows and after", () => {
  const kept = settledFrontierGame(false);
  const evicted = settledFrontierGame(true);
  const armies = (checkpoint: FoldCheckpoint) =>
    checkpoint.models.find(({ model }) => model === "ExplorerTroops")!.rows;
  expect([armies(kept).length, armies(evicted).length]).toEqual([1, 0]);
  for (const finalized of [kept, evicted])
    expect(() => gameFacts(finalized, at(100), 1)).toThrow(
      "Game 1 is finalized: Herald evicts its gameplay rows, so no snapshot holds its progress",
    );
});

/** The command as an operator runs it on two snapshot files: its exit code and what it said. */
function diffCommand(left: GameFacts, right: GameFacts, expect: string[] = []) {
  const directory = mkdtempSync(join(tmpdir(), "game-facts-"));
  const [beforePath, afterPath] = [join(directory, "before.json"), join(directory, "after.json")];
  writeFileSync(beforePath, JSON.stringify(left));
  writeFileSync(afterPath, JSON.stringify(right));
  const run = Bun.spawnSync([
    "bun",
    join(import.meta.dir, "game-facts.ts"),
    "diff",
    beforePath,
    afterPath,
    ...(expect.length ? ["--expect", expect.join(",")] : []),
  ]);
  return { exit: run.exitCode, said: run.stderr.toString().trim() };
}

test("the command passes release 4 on one world, and fails it when the pin is not named", () => {
  expect(diffCommand(before, releaseFour, ["GameRegistry.end_at", "GameRelease.release_id"])).toEqual({
    exit: 0,
    said: "",
  });
  expect(diffCommand(before, releaseFour, ["GameRegistry.end_at"]).exit).toBe(1);
});

test("the command refuses snapshots of another world, another chain or another schema", () => {
  const otherWorld = gameFacts(checkpoint({}, "0x2"), at(200), 1);
  const otherChain = gameFacts(checkpoint(), at(200, "0x5052"), 1);
  const otherSchema = { ...gameFacts(checkpoint(), at(200), 1), schema: "2171a8ef" };
  expect([diffCommand(before, otherWorld), diffCommand(before, otherChain), diffCommand(before, otherSchema)]).toEqual([
    { exit: 2, said: "The snapshots are of different worlds: 0x1 and 0x2" },
    { exit: 2, said: `The snapshots are of different chains: ${CHAIN} and 0x5052` },
    { exit: 2, said: "The snapshots are of different schemas: 2fbdecd0 and 2171a8ef" },
  ]);
});

test("the command refuses a snapshot that names no world", () => {
  const unnamed = { ...before, world: undefined } as unknown as GameFacts;
  expect(diffCommand(unnamed, before)).toEqual({ exit: 2, said: "A snapshot names no world" });
});
