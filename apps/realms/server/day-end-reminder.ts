import { fetchHeraldGameSnapshot, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { dayOf } from "@bibliothecadao/eternum/expeditions";

export type ReminderGame = Pick<HeraldGameDirectoryEntry, "game_id" | "name" | "mode" | "status" | "expedition"> & {
  clock: Pick<HeraldGameDirectoryEntry["clock"], "start_main_at" | "end_at">;
};

export interface DayEndReminder {
  gameId: number;
  day: number;
  dueAt: number;
  endsAt: number;
  tomorrowSeconds: number;
}

/** Prepare before the trigger, never reconstruct after it. All bounds come from the contract's shared mirror. */
export function planDayEndReminders(
  games: readonly ReminderGame[],
  now: number,
  prepareAheadMs: number,
): {
  prepare: DayEndReminder[];
  nextAlarmAt: number | null;
} {
  const prepare: DayEndReminder[] = [];
  let nextAlarmAt: number | null = null;
  for (const game of games) {
    if (game.mode !== "frontier" || game.status === "Ended" || game.status === "Settled") continue;
    if (!game.expedition) throw new Error(`Game ${game.game_id} has no Frontier calendar`);
    const calendar = {
      seed: BigInt(game.expedition.seed),
      startMainAt: game.clock.start_main_at,
      dayUnitSeconds: game.expedition.day_unit_seconds,
    };
    if (!Number.isSafeInteger(calendar.startMainAt) || !Number.isSafeInteger(game.clock.end_at))
      throw new Error(`Game ${game.game_id} has an invalid Frontier calendar`);
    if (now >= game.clock.end_at * 1000) continue;
    const today = dayOf(calendar, Math.max(now / 1000, calendar.startMainAt))!;
    const dueAt = (today.end - 3600) * 1000;
    if (dueAt >= game.clock.end_at * 1000) continue;
    if (now >= dueAt) continue;
    const prepareAt = dueAt - prepareAheadMs;
    const wakeAt = now < prepareAt ? prepareAt : dueAt;
    nextAlarmAt = nextAlarmAt === null ? wakeAt : Math.min(nextAlarmAt, wakeAt);
    if (now >= prepareAt)
      prepare.push({
        gameId: game.game_id,
        day: today.index,
        dueAt,
        endsAt: today.end,
        tomorrowSeconds: dayOf(calendar, today.end)!.end - today.end,
      });
  }
  return { prepare, nextAlarmAt };
}

/** Confirmed enrollment includes idle players, not merely actors in the recent story page. */
export async function readReminderPlayers(shardUrl: string, gameId: number): Promise<string[]> {
  const snapshot = await fetchHeraldGameSnapshot({ url: shardUrl }, gameId, ["PlayerEntry"]);
  if (BigInt(snapshot.game_id) !== BigInt(gameId)) throw new Error(`Game ${gameId} snapshot named another game`);
  const enrollment = snapshot.models.find(({ model }) => model === "PlayerEntry");
  if (!enrollment) throw new Error(`Game ${gameId} snapshot omitted PlayerEntry`);
  const store = new NativeFactStore();
  store.applyFacts(enrollment.rows.map((row) => ({ model: "PlayerEntry", key: row.key, value: row.value })));
  return [...new Set([...store.inGame("PlayerEntry", gameId)].map((entry) => `0x${entry.owner.toString(16)}`))];
}
