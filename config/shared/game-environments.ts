import type { GameChain } from "@realms-world/chain";

/**
 * Every launchable game environment, `<chain>.<gameType>`. This is the one
 * list a new deployment adds itself to: the factory page offers the entries
 * for its build chain, and the launch worker accepts exactly these ids.
 */
export type GameEnvironmentGameType = "blitz" | "eternum";

export const GAME_ENVIRONMENTS = [
  { id: "madara.blitz", chain: "madara", gameType: "blitz" },
] as const satisfies readonly { id: string; chain: GameChain; gameType: GameEnvironmentGameType }[];

export type GameEnvironment = (typeof GAME_ENVIRONMENTS)[number];
export type GameEnvironmentId = GameEnvironment["id"];

export const isGameEnvironmentId = (value: string): value is GameEnvironmentId =>
  GAME_ENVIRONMENTS.some((environment) => environment.id === value);

export const getGameEnvironmentsForChain = (chain: GameChain): GameEnvironment[] =>
  GAME_ENVIRONMENTS.filter((environment) => environment.chain === chain);
