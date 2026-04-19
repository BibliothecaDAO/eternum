export type WorldSummaryChain = "mainnet" | "slot";

export type WorldSummaryMode = "blitz" | "eternum" | "unknown";

export interface WorldSummary {
  name: string;
  chain: WorldSummaryChain;
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
  prizeDistributionAddress: string | null;
  feeTokenAddress: string | null;

  registrationCount: number | null;
  registrationCountMax: number | null;
  settledPlayersCount: number | null;
  settledRealmsCount: number | null;
  settledVillagesCount: number | null;
  numHyperstructuresLeft: number | null;

  winnerJackpotAmount: string | null;
}
