import type { GameChain } from "@realms-world/chain";

export type GameType = "blitz" | "eternum" | "frontier" | "duel";

export interface BuildConfigOptions {
  chain: GameChain;
  gameType: GameType;
  durationMinutes?: number | null;
  durationSeconds?: number | null;
}
