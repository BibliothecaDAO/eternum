import type { GameChain } from "@realms-world/chain";

export type WorldSummaryChain = GameChain;

export type WorldSummaryMode = "blitz" | "eternum" | "unknown";

export interface WorldSummary {
  name: string;
  chain: WorldSummaryChain;
  /** World-directory key the game lives in ("blitz" | "eternum"). */
  worldId?: string;
  /** GameRegistry id inside its world — key[0] of every per-game model. */
  gameId?: number | null;
  alive: boolean;
  lastCheckedAt: number;

  mode: WorldSummaryMode | null;
  startSettlingAt: number | null;
  startMainAt: number | null;
  endAt: number | null;
  devModeOn: boolean | null;
  mmrEnabled: boolean | null;
  singleRealmMode: boolean | null;
  twoPlayerMode: boolean | null;

  seasonPassAddress: string | null;
  villagePassAddress: string | null;
  worldAddress: string | null;
  prizeDistributionAddress: string | null;
  entryTokenAddress: string | null;
  feeTokenAddress: string | null;
  feeAmount: string | null;

  registrationCount: number | null;
  registrationCountMax: number | null;
  registrationStartAt: number | null;
  registrationEndAt: number | null;
  settledPlayersCount: number | null;
  settledRealmsCount: number | null;
  settledVillagesCount: number | null;

  winnerJackpotAmount: string | null;
}
