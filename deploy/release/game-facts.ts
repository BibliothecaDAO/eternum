#!/usr/bin/env bun
/**
 * Proves a release kept a game's progress: every fact Herald holds for the game, before and after, compared row by row.
 *
 *   bun deploy/release/game-facts.ts snapshot <dev|production> <game_id> <out.json>
 *   bun deploy/release/game-facts.ts diff <before.json> <after.json> [--expect Model,Model.member,...]
 *
 * A snapshot is Herald's own checkpoint (its whole fold, saved every 100 blocks), read from the shard's database over
 * SSH, read-only, and narrowed to the game's rows. It is refused for a game the checkpoint does not hold, or one Herald
 * has finalized (it evicts their gameplay rows, so what is left is not their progress). A diff compares two snapshots
 * of one game on one chain, world and schema, and refuses anything else (exit 2). It lists every row added, removed or
 * changed, with the members that changed, and fails (exit 1) when any of them is outside --expect: the models (or single
 * members) the release is meant to change. A release moves the game's pin, so name it too, as release 4 would:
 * --expect GameRegistry.end_at,GameRelease.release_id. Players' own moves change rows as well, so take both snapshots of
 * a game nobody is playing, the second once its block is past the release's transaction.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { FoldCheckpoint } from "../../apps/herald/src/types";
import { finalizedGames } from "../../apps/herald/src/world-fold";
import { boxRead } from "../first/box";
import { shell } from "../first/process";
import { environments } from "../first/settings";

const USAGE =
  "Usage: game-facts.ts snapshot <dev|production> <game_id> <out.json> | diff <before> <after> [--expect A,B.c]";

type Row = { key: Record<string, unknown>; value: Record<string, unknown> };

/** One game's rows in one checkpoint, with what identifies them: the chain, the Games world and the fact schema. */
export interface GameFacts {
  chain: string;
  world: string;
  schema: string;
  confirmedBlock: number;
  gameId: number;
  models: Record<string, Record<string, Row>>;
}

export interface FactChange {
  model: string;
  entity: string;
  kind: "added" | "removed" | "changed";
  /** For a changed row, the members whose values differ. */
  members?: string[];
  expected: boolean;
}

/** The game's rows in a Herald checkpoint: every game-scoped row whose game_id is this game. */
export function gameFacts(
  checkpoint: FoldCheckpoint,
  at: { chain: string; confirmedBlock: number },
  gameId: number,
): GameFacts {
  if (!checkpoint.native_schema_identity) throw new Error("The checkpoint names no fact schema");
  const models: GameFacts["models"] = {};
  for (const { model, rows } of checkpoint.models) {
    const own = rows.filter((row) => isGameRow(row.key, gameId));
    if (own.length)
      models[model] = Object.fromEntries(own.map((row) => [row.entity_id, { key: row.key, value: row.value }]));
  }
  const facts = {
    chain: felt(at.chain),
    world: felt(checkpoint.world_address),
    schema: checkpoint.native_schema_identity,
    confirmedBlock: at.confirmedBlock,
    gameId,
    models,
  };
  requireProgress(facts);
  return facts;
}

/** Every row that differs between two snapshots of one game, each marked expected or not. */
export function diffFacts(before: GameFacts, after: GameFacts, expect: readonly string[]): FactChange[] {
  requireSameGame(before, after);
  [before, after].forEach(requireProgress);
  const expected = new Set(expect);
  return sortedUnion(Object.keys(before.models), Object.keys(after.models)).flatMap((model) => {
    const was = before.models[model] ?? {};
    const now = after.models[model] ?? {};
    return sortedUnion(Object.keys(was), Object.keys(now)).flatMap(
      (entity) => rowChange(model, entity, was[entity], now[entity], expected) ?? [],
    );
  });
}

/** A snapshot holds a game's progress only while the checkpoint holds the game and Herald has not finalized it. */
function requireProgress(facts: GameFacts) {
  if (!Object.keys(facts.models.GameRegistry ?? {}).length)
    throw new Error(`Game ${facts.gameId} is not in this checkpoint`);
  const rows = (model: string) =>
    Object.values(facts.models[model] ?? {}).map(({ key, value }) => ({ ...key, ...value }));
  if (finalizedGames(rows).includes(String(facts.gameId)))
    throw new Error(
      `Game ${facts.gameId} is finalized: Herald evicts its gameplay rows, so no snapshot holds its progress`,
    );
}

/** Two snapshots compare only as one game on one chain, world and fact schema. */
function requireSameGame(before: GameFacts, after: GameFacts) {
  for (const field of ["chain", "world", "schema"] as const) {
    if (!before[field] || !after[field]) throw new Error(`A snapshot names no ${field}`);
    if (before[field] !== after[field])
      throw new Error(`The snapshots are of different ${field}s: ${before[field]} and ${after[field]}`);
  }
  if (before.gameId !== after.gameId) throw new Error(`Snapshots of games ${before.gameId} and ${after.gameId}`);
}

/** One row's change, if any: a changed row is expected when its model is, or when every changed member is. */
function rowChange(
  model: string,
  entity: string,
  was: Row | undefined,
  now: Row | undefined,
  expected: Set<string>,
): FactChange | null {
  if (!was || !now) return { model, entity, kind: was ? "removed" : "added", expected: expected.has(model) };
  const members = sortedUnion(Object.keys(was.value), Object.keys(now.value)).filter(
    (member) => JSON.stringify(was.value[member]) !== JSON.stringify(now.value[member]),
  );
  if (!members.length) return null;
  const memberExpected = members.every((member) => expected.has(`${model}.${member}`));
  return { model, entity, kind: "changed", members, expected: expected.has(model) || memberExpected };
}

const isGameRow = (key: Record<string, unknown>, gameId: number) =>
  key.game_id !== undefined && BigInt(String(key.game_id)) === BigInt(gameId);

const sortedUnion = (left: string[], right: string[]) => [...new Set([...left, ...right])].sort();

const felt = (value: string) => `0x${BigInt(value).toString(16)}`;

/** The shard's one Herald checkpoint, read from its database on the box: nothing on the box is written. */
async function readCheckpoint(environment: string) {
  if (environment !== "dev" && environment !== "production") throw new Error("Choose dev or production");
  const target = environments[environment];
  const query =
    "select chain || ' ' || world_address || ' ' || confirmed_block || ' ' || " +
    "translate(encode(payload, 'base64'), E'\\n', '') from herald_fold_checkpoints";
  const output = await boxRead(
    target,
    `sudo -n docker compose --project-directory ${shell(target.runDirectory)} exec -T postgres psql -U herald -d herald -At -c ${shell(query)}`,
  );
  const rows = output.trim().split("\n").filter(Boolean);
  if (rows.length !== 1) throw new Error(`Expected one Herald checkpoint, found ${rows.length}`);
  const [chain, world, block, payload] = rows[0]!.split(" ");
  const checkpoint = JSON.parse(gunzipSync(Buffer.from(payload!, "base64")).toString("utf8")) as FoldCheckpoint;
  if (felt(checkpoint.world_address) !== felt(world!)) throw new Error("The checkpoint's world differs from its row");
  return { checkpoint, at: { chain: chain!, confirmedBlock: Number(block) } };
}

async function snapshot(environment: string, game: string, out: string) {
  const gameId = Number(game);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) throw new Error("A game id is required");
  const { checkpoint, at } = await readCheckpoint(environment);
  const facts = gameFacts(checkpoint, at, gameId);
  writeFileSync(out, `${JSON.stringify(facts, null, 1)}\n`, { mode: 0o600 });
  const rows = Object.values(facts.models).reduce((sum, model) => sum + Object.keys(model).length, 0);
  console.log(JSON.stringify({ ...facts, models: Object.keys(facts.models).length, rows }));
}

function diff(beforePath: string, afterPath: string, expect: readonly string[]) {
  const [before, after] = [beforePath, afterPath].map((path) => JSON.parse(readFileSync(path, "utf8")) as GameFacts);
  const changes = diffFacts(before!, after!, expect);
  const unexpected = changes.filter((change) => !change.expected);
  console.log(
    JSON.stringify(
      {
        gameId: before!.gameId,
        chain: before!.chain,
        world: before!.world,
        schema: before!.schema,
        blocks: [before!.confirmedBlock, after!.confirmedBlock],
        changes,
        unexpected: unexpected.length,
      },
      null,
      1,
    ),
  );
  if (unexpected.length) process.exitCode = 1;
}

if (import.meta.main) {
  const [verb, ...args] = process.argv.slice(2);
  const expectAt = args.indexOf("--expect");
  const expect = expectAt < 0 ? [] : (args.splice(expectAt, 2)[1] ?? "").split(",").filter(Boolean);
  try {
    if (verb === "snapshot" && args.length === 3) await snapshot(args[0]!, args[1]!, args[2]!);
    else if (verb === "diff" && args.length === 2) diff(args[0]!, args[1]!, expect);
    else throw new Error(USAGE);
  } catch (error) {
    // A refusal: nothing was compared, so it is never read as a pass or as a progress loss.
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
