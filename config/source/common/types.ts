export type Chain = "local" | "mainnet" | "sepolia" | "slot" | "slottest";
export type GameType = "blitz" | "eternum";

export interface BuildConfigOptions {
  chain: Chain;
  gameType: GameType;
  durationMinutes?: number | null;
  durationSeconds?: number | null;
}
