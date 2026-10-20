import { VICTORY, ARMY_LOST, GUARD_HOLDS } from "../words";

export type FightVerdict = "victory" | "army-lost" | "guard-holds";
export const VERDICT_WORDS: Record<FightVerdict, string> = {
  victory: VICTORY,
  "army-lost": ARMY_LOST,
  "guard-holds": GUARD_HOLDS,
};
/** One exchange: a lost army takes precedence, then a cleared guard, then a standing guard. */
export const fightVerdict = (after: { army: number | bigint; guard: number | bigint }): FightVerdict =>
  BigInt(after.army) === 0n ? "army-lost" : BigInt(after.guard) === 0n ? "victory" : "guard-holds";
