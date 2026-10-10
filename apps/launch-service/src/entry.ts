import { readGameEntry, type GameEntry } from "@realms-world/identity";
import type { LaunchRunStore } from "../../../config/deployer/clean/launch/run-store";
import type { GameEnvironmentId } from "../../../config/shared/game-environments";
export interface LaunchEntryStore extends LaunchRunStore {
  saveEntry(environment: GameEnvironmentId, gameName: string, entry: GameEntry): Promise<void>;
}
/** The record and the ledger reference must identify the very same native game. */
export const entryForGame = (value: unknown, chainId: string, gameId: number): GameEntry => {
  const entry = readGameEntry(value);
  if (entry.kind === "paid" && (BigInt(entry.ledger.shard) !== BigInt(chainId) || entry.ledger.gameId !== gameId))
    throw new Error("game_entry_key_differs");
  return entry;
};
