import {
  createEmptyActivityBreakdown,
  type HeraldGameDirectory,
  type HeraldGameDirectoryEntry,
  type HeraldLeaderboard,
  type HeraldPlayerStructure,
  type PlayerActivityBreakdown,
  type ShareAllocation,
  sharePointCutoff,
  unclaimedSharePoints,
} from "@bibliothecadao/eternum/game-sync";
import { nativeGameModeOf } from "@bibliothecadao/eternum";
import { expeditionRealmSite, isRealmCategory } from "@bibliothecadao/eternum/expeditions";
import { resolveDirectoryStatus, type DirectoryInput } from "../game-directory";
import type { FoldRow } from "../types";

/** The game-scoped facts a finalized game's directory entry and standings read; its review snapshot keeps the rest. */
export const FINALIZED_GAME_MODELS: ReadonlySet<string> = new Set([
  "GameRegistry",
  "SliceRules",
  "ChestRules",
  "SettlementRules",
  "SettlementProgress",
  "Structure",
  "TileOccupancy",
  "PlayerEntry",
  "BlitzRoster",
  "BlitzResult",
  "PlayerPoints",
  "HyperstructureShares",
]);

import { integer, number, address, record, gameRows, required, type Row } from "./values";

interface DirectoryRows {
  structures: FoldRow[];
  position: DirectoryInput["fold"]["structurePosition"];
  rules: FoldRow[];
  settlementRules: FoldRow[];
  progress: FoldRow[];
  entries: FoldRow[];
  rosters: FoldRow[];
}

export function buildNativeDirectory(input: DirectoryInput): HeraldGameDirectory {
  const rows = (model: string) => input.fold.modelRows(model);
  const facts = directoryRows(input);
  const games = rows("GameRegistry")
    .map(({ value }) => directoryEntry(value, facts, input))
    .sort((left, right) => right.game_id - left.game_id);
  return { chain: input.chain, confirmed_block: input.confirmedBlock, games };
}

/** Add only the requesting player's state to the shared directory; never retain an address-keyed response. */
export function directoryForPlayer(directory: HeraldGameDirectory, input: DirectoryInput): HeraldGameDirectory {
  if (!input.playerAddress) return directory;
  const facts = directoryRows(input);
  const games = new Map(input.fold.modelRows("GameRegistry").map(({ value }) => [number(value.game_id), value]));
  return {
    ...directory,
    games: directory.games.map((entry) => ({
      ...entry,
      player_state: directoryPlayerState(games.get(entry.game_id)!, facts, input),
    })),
  };
}

function directoryRows(input: DirectoryInput): DirectoryRows {
  const rows = (model: string) => input.fold.modelRows(model);
  return {
    structures: rows("Structure"),
    position: (gameId, entityId) => input.fold.structurePosition(gameId, entityId),
    rules: rows("SliceRules"),
    settlementRules: rows("SettlementRules"),
    progress: rows("SettlementProgress"),
    entries: rows("PlayerEntry"),
    rosters: rows("BlitzRoster"),
  };
}

function directoryPlayerState(
  game: Row,
  facts: DirectoryRows,
  input: DirectoryInput,
): HeraldGameDirectoryEntry["player_state"] {
  if (!input.playerAddress) return null;
  const player = address(input.playerAddress);
  const structures = gameRows(facts.structures, game.game_id).filter((row) => address(row.owner) === player);
  const roster = (gameRows(facts.rosters, game.game_id)[0]?.players as Row[] | undefined) ?? [];
  const settlement = required(facts.settlementRules, game.game_id, "SettlementRules");
  return {
    registered: gameRows(facts.entries, game.game_id).some((row) => address(row.player) === player),
    settled: structures.some((row) => number(record(row.base).category) === 1),
    roster_member: roster.some((row) => address(row.account) === player),
    structures: structures.map((row) => playerStructure(row, game, settlement, facts, input.timestamp)),
  };
}

/** Only fields visible in the directory invalidate it; troop combat and production writes do not. */
export function directoryFact(model: string, row: Row | undefined): unknown {
  if (!row) return undefined;
  switch (model) {
    case "GameRegistry":
      return row;
    case "SliceRules":
      return row.epoch_seconds;
    case "SettlementRules":
      return row;
    case "SettlementProgress":
      return row.registered;
    case "PlayerEntry":
      return row.player;
    case "BlitzRoster":
      return row.players;
    case "Structure":
      return [
        row.owner,
        record(row.base).category,
        record(row.base).level,
        record(row.metadata).realm_id,
        row.resources_packed,
      ];
    default:
      return undefined;
  }
}

export function directoryStatus(game: Row, timestamp: number) {
  if (game.ready !== true) return "Registration";
  return resolveDirectoryStatus(
    game.settled ? "Settled" : "Registration",
    { start_main_at: number(game.start_main_at), end_at: number(game.end_at) },
    game.dev_mode_on === true,
    timestamp,
  );
}

function directoryEntry(game: Row, facts: DirectoryRows, input: DirectoryInput): HeraldGameDirectoryEntry {
  const { settlementRules, progress, structures, rosters } = facts;
  const mode = nativeGameModeOf(number(game.preset_id));
  const settlement = required(settlementRules, game.game_id, "SettlementRules");
  const epochSeconds = number(required(facts.rules, game.game_id, "SliceRules").epoch_seconds);
  const state = gameRows(progress, game.game_id)[0];
  const settlements = gameRows(structures, game.game_id).filter(
    (row) => [1, 5].includes(number(record(row.base).category)) && integer(row.owner) !== 0n,
  );
  const realms = settlements.filter((row) => number(record(row.base).category) === 1);
  const roster = (gameRows(rosters, game.game_id)[0]?.players as Row[] | undefined) ?? [];
  const clock = {
    start_settling_at: number(game.start_settling_at),
    start_main_at: number(game.start_main_at),
    end_at: number(game.end_at),
    end_grace_seconds: number(game.end_grace_seconds),
  };
  return {
    game_id: number(game.game_id),
    name: shortString(game.name),
    preset_id: number(game.preset_id),
    mode,
    expedition: epochSeconds === 0 ? null : { epoch_seconds: epochSeconds },
    dev_mode_on: game.dev_mode_on === true,
    ready: game.ready === true,
    status: directoryStatus(game, input.timestamp),
    clock,
    player_count: new Set(settlements.map((row) => address(row.owner))).size,
    player_state: directoryPlayerState(game, facts, input),
    roster_count: roster.length,
    registration: {
      count: state ? number(state.registered) : 0,
      max: number(settlement.registration_limit),
      start_at: number(settlement.registration_start),
    },
    settled_realms_count: realms.length,
    settled_villages_count: settlements.length - realms.length,
    // Native placement is described by SettlementRules and SettlementPool in the snapshot.
    settlement: null,
  };
}

function playerStructure(
  row: Row,
  game: Row,
  settlement: Row,
  facts: DirectoryRows,
  timestamp: number,
): HeraldPlayerStructure {
  const base = record(row.base);
  const position = structurePosition(row, game, settlement, facts, timestamp);
  return {
    entity_id: number(row.entity_id),
    category: number(base.category),
    level: number(base.level),
    realm_id: number(record(row.metadata).realm_id),
    coord_x: position.col,
    coord_y: position.row,
    resources_packed: integer(row.resources_packed).toString(),
  };
}

function structurePosition(
  row: Row,
  game: Row,
  settlement: Row,
  facts: DirectoryRows,
  timestamp: number,
): { col: number; row: number } {
  const rules = required(facts.rules, game.game_id, "SliceRules");
  const epochSeconds = number(rules.epoch_seconds);
  if (epochSeconds !== 0 && isRealmCategory(number(record(row.base).category))) {
    return expeditionRealmSite(
      { epochSeconds, spacing: number(settlement.spacing), startMainAt: number(game.start_main_at) },
      number(record(row.metadata).realm_id),
      timestamp,
    );
  }
  const tile = facts.position(integer(row.game_id).toString(), integer(row.entity_id).toString());
  if (!tile) throw new Error(`Missing native position for entity ${row.game_id}:${row.entity_id}`);
  return { col: number(tile.col), row: number(tile.row) };
}

export function buildNativeLeaderboard(
  modelRows: (model: string) => FoldRow[],
  gameId: string,
  timestamp: number,
  activity: ReadonlyMap<string, PlayerActivityBreakdown> | null,
): HeraldLeaderboard {
  const rows = (model: string) => gameRows(modelRows(model), gameId);
  const game = required(modelRows("GameRegistry"), gameId, "GameRegistry");
  const rules = required(modelRows("SliceRules"), gameId, "SliceRules");
  const result = rows("BlitzResult")[0];
  // Standings carry addresses only: a player's name is their identity profile, resolved by the client.
  if (result?.complete === true) return finalStandings(gameId, result, activity);
  const points = registeredPlayerPoints(rows("PlayerEntry"), rows("PlayerPoints"));
  addUnclaimedSharePoints(points, rows("HyperstructureShares"), game, rules, timestamp);
  return rankPlayers(gameId, points, activity);
}

function finalStandings(
  gameId: string,
  result: Row,
  activity: ReadonlyMap<string, PlayerActivityBreakdown> | null,
): HeraldLeaderboard {
  return {
    mode: "points",
    game_id: integer(gameId).toString(),
    entries: (result.players as Row[]).map((player) => ({
      address: address(player.player),
      totalPoints: Number(integer(player.points)) / 1_000_000,
      rank: number(player.rank),
      activityBreakdown: activity?.get(address(player.player)) ?? createEmptyActivityBreakdown(),
    })),
  };
}

function registeredPlayerPoints(entries: Row[], registered: Row[]): Map<string, bigint> {
  const points = new Map<string, bigint>();
  for (const entry of entries) creditPoints(points, entry.player, 0n);
  for (const player of registered) creditPoints(points, player.address, integer(player.points));
  return points;
}

function addUnclaimedSharePoints(
  points: Map<string, bigint>,
  allocations: Row[],
  game: Row,
  rules: Row,
  timestamp: number,
): void {
  const cutoff = sharePointCutoff(
    { dev_mode_on: game.dev_mode_on === true, end_at: integer(game.end_at) },
    BigInt(timestamp),
  );
  const rate = integer(record(rules.victory_points_grant_config).hyp_points_per_second);
  for (const allocation of allocations)
    for (const share of unclaimedSharePoints(allocation as unknown as ShareAllocation, rate, cutoff))
      creditPoints(points, share.player, share.points);
}

function creditPoints(points: Map<string, bigint>, player: unknown, amount: bigint): void {
  const key = address(player);
  points.set(key, (points.get(key) ?? 0n) + amount);
}

function rankPlayers(
  gameId: string,
  points: Map<string, bigint>,
  activity: ReadonlyMap<string, PlayerActivityBreakdown> | null,
): HeraldLeaderboard {
  const ranked = [...points].sort(([left, a], [right, b]) => (a === b ? left.localeCompare(right) : a > b ? -1 : 1));
  const entries = ranked.map(([player, value], index) => ({
    address: player,
    totalPoints: Number(value) / 1_000_000,
    rank: index + 1,
    activityBreakdown: activity?.get(player) ?? createEmptyActivityBreakdown(),
  }));
  for (let index = 1; index < entries.length; index++) {
    if (ranked[index][1] === ranked[index - 1][1]) entries[index].rank = entries[index - 1].rank;
  }
  return { mode: "points", game_id: integer(gameId).toString(), entries };
}

function shortString(value: unknown): string {
  const hex = integer(value).toString(16);
  return Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex").toString("utf8");
}
