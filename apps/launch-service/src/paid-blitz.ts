import type { LedgerGameKey, LedgerRosterSnapshot } from "@realms-world/value-ledger";
import { RegistrationOpen } from "./blitz-roster";
import type { LaunchEntryStore } from "./entry";
import type { GameEntry } from "@realms-world/identity";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";

export interface BlitzValuePort {
  blitzRoster(key: LedgerGameKey): Promise<LedgerRosterSnapshot>;
  openBlitz(key: LedgerGameKey, window: { start: number; end: number }): Promise<GameEntry>;
  validateBlitz(key: LedgerGameKey, window: { start: number; end: number }): Promise<void>;
  refundBlitz(key: LedgerGameKey): Promise<number | null>;
}
interface PaidBlitzShard {
  create(): Promise<LaunchGameSummary>;
  roster(gameId: number): Promise<readonly { wallet: string; account: string }[]>;
  install(gameId: number, players: readonly { account: string; wallet: string }[]): Promise<void>;
  seat(gameId: number): Promise<number>;
  window(gameId: number): Promise<{ start: number; end: number }>;
}

/** A real empty game precedes registration. The frozen ledger pair survives retries and wallet-link changes. */
export const launchPaidBlitz = async (
  chainId: string,
  shard: PaidBlitzShard,
  value: BlitzValuePort,
  store: LaunchEntryStore,
  plannedStart: number,
): Promise<LaunchGameSummary> => {
  const created = await shard.create();
  if (!created.gameId) throw new Error("created_blitz_has_no_id");
  await store.saveGame(created);
  const key = { chainId, gameId: created.gameId };
  const entry = await value.openBlitz(key, { start: plannedStart, end: plannedStart + created.durationSeconds! });
  await store.saveEntry(created.environment, created.gameName, entry);
  const frozen = await shard.roster(key.gameId);
  if (!frozen.length) {
    const roster = await value.blitzRoster(key);
    if (roster.secondsUntilClose > 0) throw new RegistrationOpen({ secondsUntilClose: roster.secondsUntilClose });
    if (roster.gameId !== key.gameId || !roster.registrations.length) throw new Error("invalid_closed_ledger_roster");
    await shard.install(key.gameId, roster.registrations);
  }
  const settlementTransactions = await shard.seat(key.gameId);
  const actual = await shard.window(key.gameId);
  await value.validateBlitz(key, actual);
  return store.saveGame({
    ...created,
    startTime: actual.start,
    startTimeIso: new Date(actual.start * 1000).toISOString(),
    durationSeconds: actual.end - actual.start,
    finalizeAt: actual.end,
    settlementTransactions,
  });
};
