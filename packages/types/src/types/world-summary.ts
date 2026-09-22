export type WorldSummaryMode = "blitz" | "eternum" | "frontier" | "duel" | "unknown";

export interface WorldSummary {
  name: string;
  /** The chain id of the shard the game lives on; with the game id it names the game. */
  chainId: string;
  /** GameRegistry id inside its shard — key[0] of every per-game model. */
  gameId: number;
  alive: boolean;
  ready: boolean;
  lastCheckedAt: number;

  mode: WorldSummaryMode | null;
  startSettlingAt: number | null;
  startMainAt: number | null;
  endAt: number | null;
  devModeOn: boolean | null;
  singleRealmMode: boolean | null;
  twoPlayerMode: boolean | null;

  seasonPassAddress: string | null;
  villagePassAddress: string | null;
  worldAddress: string | null;

  registrationCount: number | null;
  registrationCountMax: number | null;
  registrationStartAt: number | null;
  registrationEndAt: number | null;
  settledPlayersCount: number | null;
  settledRealmsCount: number | null;
  settledVillagesCount: number | null;
}
