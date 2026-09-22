import type { ConfigurationNetwork } from "../../shared/game-environments";

export type GameType = "blitz" | "eternum" | "frontier" | "duel";

export interface BuildConfigOptions {
  chain: ConfigurationNetwork;
  gameType: GameType;
  durationMinutes?: number | null;
  durationSeconds?: number | null;
}
