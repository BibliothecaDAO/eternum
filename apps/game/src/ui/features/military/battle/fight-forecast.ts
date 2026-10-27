import {
  COMBAT_DIE_FACES,
  forecastFight,
  resolveExchange,
  type CombatRules,
  type FightForecast,
} from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, type Troops, formatCount } from "@bibliothecadao/types";
import { survivalOf, type SideRange } from "./battle-range";

/** Whole troops from a scaled count, as the contract counts them. */
export const wholeTroops = (scaled: bigint): number => Number(scaled / BigInt(RESOURCE_PRECISION));

/**
 * What the whole fight takes, the one part of it the casualty lines do not show: "2 exchanges · 60 stamina", "Out of
 * stamina after 5 exchanges", or "One attack, then cooldown · 30 stamina". Null when the first attack cannot be made.
 */
export const describeFightCost = (forecast: FightForecast): string | null => {
  if (forecast.outcome === "refused") return null;
  const cost = `${forecast.staminaSpent} stamina`;
  if (forecast.outcome === "stalls" && forecast.stoppedBy === "cooldown") return `One attack, then cooldown · ${cost}`;
  if (forecast.outcome === "stalls") return `Out of stamina after ${formatCount(forecast.exchanges, "exchange")}`;
  return `${formatCount(forecast.exchanges, "exchange")} · ${cost}`;
};

/**
 * A combat panel's title: the two sides, as the battle lab and raid results name them, the target by its owner's
 * display name (the Vanguard when no player holds it); before the target is known, the attacker alone.
 */
export const combatTitle = (attacker: string | null, targetOwner: string | null): string => {
  const you = attacker || "Your army";
  return targetOwner === null ? you : `${you} vs ${targetOwner}`;
};

/** One attack's circumstances, the dice aside: when, how far, on which biomes, and whether each side is a guard. */
type AttackCircumstances = Omit<Parameters<typeof resolveExchange>[2], "attackerRoll" | "defenderRoll">;

/**
 * One attack and the whole fight, as the contract computes them, at both ends of the dice (the attacker's worst roll
 * against the defender's best, and the reverse; without dice the two ends are one exact result): each side's losses,
 * and whether the attacker is wiped out at any roll.
 * The attack preview words it; the coach reads its certain loss.
 */
export const forecastAttack = (
  attacker: Troops,
  defender: Troops,
  circumstances: AttackCircumstances,
  { rules, rollsDice }: { rules: CombatRules; rollsDice: boolean },
) => {
  const [attackerRoll, defenderRoll] = rollsDice ? [1, COMBAT_DIE_FACES] : [0, 0];
  const at = (rolls: { attackerRoll: number; defenderRoll: number }) => {
    const context = { ...circumstances, ...rolls };
    return {
      exchange: resolveExchange(attacker, defender, context, rules),
      forecast: forecastFight(attacker, defender, context, rules),
    };
  };
  const worst = at({ attackerRoll, defenderRoll });
  const best = rollsDice ? at({ attackerRoll: COMBAT_DIE_FACES, defenderRoll: 1 }) : worst;
  const sides = exchangeSides(worst.exchange, best.exchange);
  const certainLoss = sides !== null && survivalOf(sides.attacker) === "Eliminated";
  return { worst, best, sides, certainLoss };
};

/** Each side's losses at both ends of the dice, from this attack's exact exchanges; null when the attack is refused. */
const exchangeSides = (
  worst: ReturnType<typeof resolveExchange>,
  best: ReturnType<typeof resolveExchange>,
): { attacker: SideRange; defender: SideRange } | null => {
  if (!worst.ok || !best.ok) return null;
  const side = (loss: bigint, remaining: bigint) => ({ losses: wholeTroops(loss), remaining: wholeTroops(remaining) });
  return {
    attacker: {
      worst: side(worst.attackerLoss, worst.attacker.count),
      best: side(best.attackerLoss, best.attacker.count),
    },
    defender: {
      worst: side(worst.defenderLoss, worst.defender.count),
      best: side(best.defenderLoss, best.defender.count),
    },
  };
};
