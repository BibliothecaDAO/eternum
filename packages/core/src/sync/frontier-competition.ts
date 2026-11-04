import type { HeraldFrontierLeaderboard } from "./herald-http-types";

/** Season 0's approved competition identity; extending gameplay never moves this cutoff. */
export const SEASON_ZERO_COMPETITION = {
  chainId: "0x50524f44554354494f4e5f31386534326539316432343133646337",
  gameId: 1,
  presetId: 6,
  start: 1793682000,
  seed: "0x744294fbe70e87074e1e7f65807334427f2061bc04bf140183490202bd48483",
  cutoff: 1793988000,
} as const;

export function frontierCompetitionCutoff(
  chainId: string,
  gameId: number,
  game: { presetId: number; start: number; seed: string },
): number | undefined {
  const policy = SEASON_ZERO_COMPETITION;
  if (!/^0x[0-9a-f]+$/i.test(chainId)) return undefined;
  if (BigInt(chainId) !== BigInt(policy.chainId) || gameId !== policy.gameId) return undefined;
  if (game.presetId !== policy.presetId || game.start !== policy.start || BigInt(game.seed) !== BigInt(policy.seed))
    throw new Error("Season 0 competition identity differs");
  return policy.cutoff;
}

/** Both client surfaces stop the race at the confirmed chain clock, even while a final-board read is delayed. */
export function frontierCompetitionPhase(
  board: HeraldFrontierLeaderboard | undefined,
  confirmedAt = board?.competition?.confirmed_at ?? 0,
) {
  const competition = board?.competition;
  if (!competition) return "live" as const;
  if (competition.status === "final") return "final" as const;
  return competition.status === "confirming" || confirmedAt >= competition.cutoff
    ? ("confirming" as const)
    : ("live" as const);
}
