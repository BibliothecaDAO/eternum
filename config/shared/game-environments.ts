/** Preset configuration profiles; shard identity is read separately from its manifest. */
export type GameEnvironmentGameType = import("../source/common/types").GameType;

export const GAME_ENVIRONMENTS = [
  { id: "madara.blitz", chain: "madara", gameType: "blitz" },
  { id: "madara.eternum", chain: "madara", gameType: "eternum" },
  { id: "madara.frontier", chain: "madara", gameType: "frontier" },
] as const satisfies readonly { id: string; chain: string; gameType: GameEnvironmentGameType }[];

export type GameEnvironment = (typeof GAME_ENVIRONMENTS)[number];
export type GameEnvironmentId = GameEnvironment["id"];

export const isGameEnvironmentId = (value: string): value is GameEnvironmentId =>
  GAME_ENVIRONMENTS.some((environment) => environment.id === value);

export type ConfigurationNetwork = GameEnvironment["chain"];
