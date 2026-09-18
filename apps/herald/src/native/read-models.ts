import {
  createEmptyActivityBreakdown,
  type HeraldGameDirectory,
  type HeraldGameDirectoryEntry,
  type HeraldLeaderboard,
} from "@bibliothecadao/eternum/game-sync";
import { resolveDirectoryStatus, type DirectoryInput } from "../game-directory";
import type { FoldRow } from "../types";

type Row = Record<string, unknown>;
const integer = (value: unknown): bigint => BigInt(value as string | number | bigint);
const number = (value: unknown): number => {
  const result = Number(integer(value));
  if (!Number.isSafeInteger(result)) throw new Error("Native directory value exceeds safe integer range");
  return result;
};
const address = (value: unknown): string => `0x${integer(value).toString(16)}`;
const record = (value: unknown): Row => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Missing native record");
  return value as Row;
};
const gameRows = (rows: FoldRow[], gameId: unknown): Row[] =>
  rows.filter(({ value }) => integer(value.game_id) === integer(gameId)).map(({ value }) => value);
const required = (rows: FoldRow[], gameId: unknown, model: string): Row => {
  const result = gameRows(rows, gameId)[0];
  if (!result) throw new Error(`Missing native ${model} for game ${String(gameId)}`);
  return result;
};

interface DirectoryRows {
  structures: FoldRow[];
  rules: FoldRow[];
  settlementRules: FoldRow[];
  progress: FoldRow[];
  entries: FoldRow[];
}

export function buildNativeDirectory(input: DirectoryInput): HeraldGameDirectory {
  const rows = (model: string) => input.fold.modelRows(model);
  const facts: DirectoryRows = {
    structures: rows("Structure"),
    rules: rows("SliceRules"),
    settlementRules: rows("SettlementRules"),
    progress: rows("SettlementProgress"),
    entries: rows("PlayerEntry"),
  };
  const games = rows("GameRegistry")
    .map(({ value }) => directoryEntry(value, facts, input))
    .sort((left, right) => right.game_id - left.game_id);
  return { chain: input.chain, confirmed_block: input.confirmedBlock, games };
}

function directoryEntry(game: Row, facts: DirectoryRows, input: DirectoryInput): HeraldGameDirectoryEntry {
  const { rules, settlementRules, progress, structures, entries } = facts;
  const config = required(rules, game.game_id, "SliceRules");
  const settlement = required(settlementRules, game.game_id, "SettlementRules");
  const state = gameRows(progress, game.game_id)[0];
  const settlements = gameRows(structures, game.game_id).filter(
    (row) => [1, 5].includes(number(record(row.base).category)) && integer(row.owner) !== 0n,
  );
  const realms = settlements.filter((row) => number(record(row.base).category) === 1);
  const player = input.playerAddress && address(input.playerAddress);
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
    mode: config.blitz_mode_on ? "blitz" : "eternum",
    dev_mode_on: game.dev_mode_on === true,
    ready: game.ready === true,
    status:
      game.ready !== true
        ? "Registration"
        : resolveDirectoryStatus(
            game.settled ? "Settled" : "Registration",
            clock,
            game.dev_mode_on === true,
            input.timestamp,
          ),
    clock,
    player_count: new Set(settlements.map((row) => address(row.owner))).size,
    player_state: player
      ? {
          registered: gameRows(entries, game.game_id).some((row) => address(row.player) === player),
          settled: realms.some((row) => address(row.owner) === player),
        }
      : null,
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

export function buildNativeLeaderboard(
  modelRows: (model: string) => FoldRow[],
  gameId: string,
  timestamp: number,
  history: HeraldLeaderboard | null,
): HeraldLeaderboard {
  const rows = (model: string) => gameRows(modelRows(model), gameId);
  const game = required(modelRows("GameRegistry"), gameId, "GameRegistry");
  const rules = required(modelRows("SliceRules"), gameId, "SliceRules");
  const points = registeredPlayerPoints(rows("PlayerEntry"), rows("PlayerPoints"));
  addUnclaimedSharePoints(points, rows("HyperstructureShares"), game, rules, timestamp);
  return rankPlayers(gameId, points, history);
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
  const cutoff = pointCutoff(game, timestamp);
  const rate = integer(record(rules.victory_points_grant_config).hyp_points_per_second);
  for (const allocation of allocations) {
    const elapsed = cutoff - integer(allocation.start_at);
    if (elapsed <= 0n) continue;
    for (const share of allocation.shareholders as Row[]) {
      creditPoints(
        points,
        share.player,
        (elapsed * rate * integer(allocation.multiplier) * integer(share.bps)) / 10_000n,
      );
    }
  }
}

function creditPoints(points: Map<string, bigint>, player: unknown, amount: bigint): void {
  const key = address(player);
  points.set(key, (points.get(key) ?? 0n) + amount);
}

function rankPlayers(
  gameId: string,
  points: Map<string, bigint>,
  history: HeraldLeaderboard | null,
): HeraldLeaderboard {
  const activity = new Map(history?.entries.map((entry) => [address(entry.address), entry.activityBreakdown]));
  const ranked = [...points].sort(([left, a], [right, b]) => (a === b ? left.localeCompare(right) : a > b ? -1 : 1));
  const entries = ranked.map(([player, value], index) => ({
    address: player,
    totalPoints: Number(value) / 1_000_000,
    rank: index + 1,
    activityBreakdown: activity.get(player) ?? createEmptyActivityBreakdown(),
  }));
  for (let index = 1; index < entries.length; index++) {
    if (ranked[index][1] === ranked[index - 1][1]) entries[index].rank = entries[index - 1].rank;
  }
  return { game_id: integer(gameId).toString(), entries };
}

function shortString(value: unknown): string {
  const hex = integer(value).toString(16);
  return Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex").toString("utf8");
}

function pointCutoff(game: Row, timestamp: number): bigint {
  const now = BigInt(timestamp);
  return !game.dev_mode_on && now > integer(game.end_at) ? integer(game.end_at) : now;
}
