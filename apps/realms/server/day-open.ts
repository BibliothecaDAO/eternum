import { fetchHeraldGameSnapshot, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { dayOf } from "@bibliothecadao/eternum/expeditions";
import type { PushGame } from "@bibliothecadao/notifications";
import { isSeasonGame } from "@bibliothecadao/types";

export type DayOpenGame = Pick<HeraldGameDirectoryEntry, "game_id" | "mode" | "status" | "expedition"> & {
  clock: Pick<HeraldGameDirectoryEntry["clock"], "start_main_at" | "end_at" | "scheduled_end_at">;
};

/** One Frontier game day about to open. Instants are milliseconds; `day` is the day's index (Day 1 is 0). */
export interface DayOpening {
  gameId: number;
  game: PushGame;
  day: number;
  opensAt: number;
  /** The day's end, or the season's when the season ends first. */
  endsAt: number;
  /** The season ends with this day. */
  last: boolean;
}

/**
 * The next day to open in each running Frontier game, from the contract's shared calendar: prepared from
 * `prepareAheadMs` before it opens until it opens, never reconstructed after. Also when the notifier next needs to wake.
 */
export function planDayOpenings(
  games: readonly DayOpenGame[],
  now: number,
  prepareAheadMs: number,
): { prepare: DayOpening[]; nextAlarmAt: number | null } {
  const prepare: DayOpening[] = [];
  let nextAlarmAt: number | null = null;
  for (const game of games) {
    if (game.mode !== "frontier" || game.status === "Ended" || game.status === "Settled") continue;
    const opening = nextOpening(game, now);
    if (!opening) continue;
    const prepareAt = opening.opensAt - prepareAheadMs;
    const wakeAt = now < prepareAt ? prepareAt : opening.opensAt;
    nextAlarmAt = nextAlarmAt === null ? wakeAt : Math.min(nextAlarmAt, wakeAt);
    if (now >= prepareAt) prepare.push(opening);
  }
  return { prepare, nextAlarmAt };
}

/** A Frontier game's day calendar, as its directory entry states it. */
const calendarOf = (game: DayOpenGame) => {
  if (!game.expedition) throw new Error(`Game ${game.game_id} has no Frontier calendar`);
  return {
    seed: BigInt(game.expedition.seed),
    startMainAt: game.clock.start_main_at,
    scheduledEndAt: game.clock.scheduled_end_at,
    endAt: game.clock.end_at,
    dayUnitSeconds: game.expedition.day_unit_seconds,
  };
};

/** The ids of the Frontier games in a day at `now`; a game between days, or not running, is left out. */
export function runningFrontierGameIds(games: readonly DayOpenGame[], now: number): number[] {
  return games
    .filter((game) => game.mode === "frontier" && game.status !== "Ended" && game.status !== "Settled")
    .filter((game) => dayOf(calendarOf(game), now) !== null)
    .map((game) => game.game_id);
}

export function openSeasonGameIds(
  games: readonly (DayOpenGame & Pick<HeraldGameDirectoryEntry, "name">)[],
  now: number,
): number[] {
  return games
    .filter((game) => game.mode === "frontier" && isSeasonGame(game.name))
    .filter((game) => game.status !== "Ended" && game.status !== "Settled")
    .filter((game) => game.clock.end_at === 0 || now < game.clock.end_at)
    .map((game) => game.game_id);
}

function nextOpening(game: DayOpenGame, now: number): DayOpening | null {
  const calendar = calendarOf(game);
  const seasonEnd = game.clock.end_at;
  if (!Number.isSafeInteger(calendar.startMainAt) || !Number.isSafeInteger(seasonEnd))
    throw new Error(`Game ${game.game_id} has an invalid Frontier calendar`);
  const seconds = now / 1000;
  if (seconds >= seasonEnd) return null;
  const day =
    seconds < calendar.startMainAt
      ? dayOf(calendar, calendar.startMainAt)
      : dayOf(calendar, dayOf(calendar, seconds)!.end);
  if (!day) return null;
  return {
    gameId: game.game_id,
    game: { mode: game.mode },
    day: day.index,
    opensAt: day.start * 1000,
    endsAt: day.end * 1000,
    last: day.end >= seasonEnd,
  };
}

/** Confirmed enrollment includes idle players, not merely actors in the recent story page. */
export async function readEnrolledAccounts(shardUrl: string, gameId: number): Promise<string[]> {
  const snapshot = await fetchHeraldGameSnapshot({ url: shardUrl }, gameId, ["PlayerEntry"]);
  if (BigInt(snapshot.game_id) !== BigInt(gameId)) throw new Error(`Game ${gameId} snapshot named another game`);
  const enrollment = snapshot.models.find(({ model }) => model === "PlayerEntry");
  if (!enrollment) throw new Error(`Game ${gameId} snapshot omitted PlayerEntry`);
  const store = new NativeFactStore();
  store.applyFacts(enrollment.rows.map((row) => ({ model: "PlayerEntry", key: row.key, value: row.value })));
  return [...new Set([...store.inGame("PlayerEntry", gameId)].map((entry) => `0x${entry.owner.toString(16)}`))];
}
