import type { BattleRange } from "@bibliothecadao/eternum";

/** One side's troops after a battle. */
interface SideOutcome {
  losses: number;
  remaining: number;
}

/** One side's troops at the attacker's worst and best rolls; without dice both are the battle's one outcome. */
export interface SideRange {
  worst: SideOutcome;
  best: SideOutcome;
}

const sideOutcome = (troops: number, damageTaken: number): SideOutcome => {
  const losses = Math.min(troops, damageTaken);
  return { losses, remaining: Math.max(0, troops - losses) };
};

export const attackerSideRange = (troops: number, range: BattleRange): SideRange => ({
  worst: sideOutcome(troops, range.worst.defenderDamage),
  best: sideOutcome(troops, range.best.defenderDamage),
});

export const defenderSideRange = (troops: number, range: BattleRange): SideRange => ({
  worst: sideOutcome(troops, range.worst.attackerDamage),
  best: sideOutcome(troops, range.best.attackerDamage),
});

/** Whether a side falls: settled when the dice cannot change it, "May fall" when they can. */
export const survivalOf = (side: SideRange): "Eliminated" | "Survives" | "May fall" => {
  const fallen = [side.worst, side.best].filter((outcome) => outcome.remaining <= 0).length;
  if (fallen === 2) return "Eliminated";
  return fallen === 0 ? "Survives" : "May fall";
};

/** A value across the dice, low to high, or one number where the dice cannot move it. */
export const formatAcross = (a: number, b: number, format: (value: number) => string): string => {
  const [low, high] = [format(Math.min(a, b)), format(Math.max(a, b))];
  return low === high ? low : `${low}–${high}`;
};
