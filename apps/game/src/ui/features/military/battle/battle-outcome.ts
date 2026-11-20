import type { BattleOutcome } from "@bibliothecadao/eternum";

export interface SideOutcome {
  losses: number;
  remaining: number;
}
const sideOutcome = (troops: number, damage: number): SideOutcome => ({
  losses: Math.min(troops, damage),
  remaining: Math.max(0, troops - damage),
});
export const attackerSide = (troops: number, outcome: BattleOutcome): SideOutcome =>
  sideOutcome(troops, outcome.defenderDamage);
export const defenderSide = (troops: number, outcome: BattleOutcome): SideOutcome =>
  sideOutcome(troops, outcome.attackerDamage);
export const survivalOf = (side: SideOutcome): "Eliminated" | "Survives" =>
  side.remaining === 0 ? "Eliminated" : "Survives";
