import type { ConfigurationNetwork } from "../../shared/game-environments";

export type GameType = "blitz" | "eternum" | "frontier";

export interface BuildConfigOptions {
  chain: ConfigurationNetwork;
  gameType: GameType;
  durationMinutes?: number | null;
  durationSeconds?: number | null;
}
