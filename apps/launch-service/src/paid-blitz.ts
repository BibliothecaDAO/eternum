import { Effect } from "effect";
import type { LedgerGameKey } from "@realms-world/value-ledger";
import { freezeBlitzRoster, type BlitzRegistrationSource, type D1BlitzRosterStore } from "./blitz-roster";
import type { LaunchEntryStore } from "./entry";
import type { GameEntry } from "@realms-world/identity";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";

export interface BlitzValuePort {
  openBlitz(key: LedgerGameKey, window: { start: number; end: number }): Promise<GameEntry>;
  validateBlitz(key: LedgerGameKey, window: { start: number; end: number }): Promise<void>;
  refundBlitz(key: LedgerGameKey): Promise<number | null>;
}
interface PaidBlitzShard {
  create(): Promise<LaunchGameSummary>;
  install(gameId: number, players: readonly { account: string; wallet: string }[]): Promise<void>;
  seat(gameId: number): Promise<number>;
  window(gameId: number): Promise<{ start: number; end: number }>;
}

/** A real empty game precedes registration. The frozen ledger pair survives retries and wallet-link changes. */
export const launchPaidBlitz = async (
  chainId: string,
  gameName: string,
  shard: PaidBlitzShard,
  value: BlitzValuePort,
  source: BlitzRegistrationSource,
  rosters: Pick<D1BlitzRosterStore, "read" | "save">,
  store: LaunchEntryStore,
  plannedStart: number,
): Promise<LaunchGameSummary> => {
  const created = await shard.create();
  if (!created.gameId) throw new Error("created_blitz_has_no_id");
  await store.saveGame(created);
  const key = { chainId, gameId: created.gameId };
  const entry = await value.openBlitz(key, { start: plannedStart, end: plannedStart + created.durationSeconds! });
  await store.saveEntry(created.environment, created.gameName, entry);
  const roster = await Effect.runPromise(freezeBlitzRoster({ chainId, gameName }, source, rosters));
  if (roster.gameId !== key.gameId) throw new Error("frozen_ledger_game_differs");
  await shard.install(key.gameId, roster.registrations);
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
