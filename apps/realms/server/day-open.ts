import { fetchHeraldGameSnapshot, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { dayOf, homeDailyClaim, isRealmCategory, type HomeDailyClaim } from "@bibliothecadao/eternum/expeditions";

export type DayOpenGame = Pick<HeraldGameDirectoryEntry, "game_id" | "name" | "mode" | "status" | "expedition"> & {
  clock: Pick<HeraldGameDirectoryEntry["clock"], "start_main_at" | "end_at">;
};

/** One Frontier game day about to open. Instants are milliseconds; `day` is the day's index (Day 1 is 0). */
export interface DayOpening {
  gameId: number;
  gameName: string;
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

function nextOpening(game: DayOpenGame, now: number): DayOpening | null {
  if (!game.expedition) throw new Error(`Game ${game.game_id} has no Frontier calendar`);
  const calendar = {
    seed: BigInt(game.expedition.seed),
    startMainAt: game.clock.start_main_at,
    dayUnitSeconds: game.expedition.day_unit_seconds,
  };
  const seasonEnd = game.clock.end_at;
  if (!Number.isSafeInteger(calendar.startMainAt) || !Number.isSafeInteger(seasonEnd))
    throw new Error(`Game ${game.game_id} has an invalid Frontier calendar`);
  const seconds = now / 1000;
  const day =
    seconds < calendar.startMainAt
      ? dayOf(calendar, calendar.startMainAt)!
      : dayOf(calendar, dayOf(calendar, seconds)!.end)!;
  if (day.start >= seasonEnd) return null;
  return {
    gameId: game.game_id,
    gameName: game.name,
    day: day.index,
    opensAt: day.start * 1000,
    endsAt: Math.min(day.end, seasonEnd) * 1000,
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

/** What the account's realm claims each day in this game, as the game's Realm sheet reads it; null for none. */
export async function readHomeClaim(shardUrl: string, gameId: number, account: string): Promise<HomeDailyClaim | null> {
  const snapshot = await fetchHeraldGameSnapshot(
    { url: shardUrl },
    gameId,
    ["Structure", "SettledRealm", "CampaignHome", "LaborRules"],
    account,
    account,
  );
  if (BigInt(snapshot.game_id) !== BigInt(gameId)) throw new Error(`Game ${gameId} snapshot named another game`);
  const store = new NativeFactStore();
  store.applyFacts(
    snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, key: row.key, value: row.value }))),
  );
  for (const structure of store.inGame("Structure", gameId)) {
    if (!isRealmCategory(structure.base.category) || structure.owner !== BigInt(account)) continue;
    const claim = homeDailyClaim(store, {
      gameId,
      entityId: structure.entity_id,
      realmId: structure.metadata.realm_id,
    });
    if (claim) return claim;
  }
  return null;
}
