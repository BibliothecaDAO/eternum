import {
  COMBAT_DIE_FACES,
  forecastFight,
  resolveExchange,
  type CombatRules,
  type FightForecast,
} from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, type Troops } from "@bibliothecadao/types";
import { survivalOf, type SideRange } from "./battle-range";

/** Whole troops from a scaled count, as the contract counts them. */
export const wholeTroops = (scaled: bigint): number => Number(scaled / BigInt(RESOURCE_PRECISION));

const exchanges = (count: number) => (count === 1 ? "1 exchange" : `${count} exchanges`);

/**
 * What the whole fight takes, the one part of it the casualty lines do not show: "2 exchanges · 60 stamina", "Out of
 * stamina after 5 exchanges", or "One attack, then cooldown · 30 stamina". Null when the first attack cannot be made.
 */
export const describeFightCost = (forecast: FightForecast): string | null => {
  if (forecast.outcome === "refused") return null;
  const cost = `${forecast.staminaSpent} stamina`;
  if (forecast.outcome === "stalls" && forecast.stoppedBy === "cooldown") return `One attack, then cooldown · ${cost}`;
  if (forecast.outcome === "stalls") return `Out of stamina after ${exchanges(forecast.exchanges)}`;
  return `${exchanges(forecast.exchanges)} · ${cost}`;
};

/**
 * A combat panel's title: the two sides, as the battle lab and raid results name them, the target by its owner's
 * display name (the Vanguard when no player holds it); before the target is known, the attacker alone.
 */
export const combatTitle = (attacker: string | null, targetOwner: string | null): string => {
  const you = attacker || "Your army";
  return targetOwner === null ? you : `${you} vs ${targetOwner}`;
};

/**
 * How many more troops (scaled, as the contract counts them) the attacker needs to come out of this attack alive at
 * its worst roll: the smallest count `survives` accepts, less the count it has. Zero when it already survives; null
 * when even 64 times its army would not.
 */
export const extraTroopsToSurvive = (current: bigint, survives: (count: bigint) => boolean): bigint | null => {
  if (current <= 0n) return null;
  if (survives(current)) return 0n;
  let low = current;
  let high = current * 2n;
  while (!survives(high)) {
    if (high >= current * 64n) return null;
    low = high;
    high *= 2n;
  }
  const step = BigInt(RESOURCE_PRECISION);
  while (high - low > step) {
    const middle = low + (high - low) / 2n;
    if (survives(middle)) high = middle;
    else low = middle;
  }
  // Whole troops, rounded up: a fraction short of surviving is still short.
  return ((high - current + step - 1n) / step) * step;
};

/**
 * A troop count as an estimate reads it: rounded up to two significant figures ("about 1,300"), and exact where
 * rounding up would pass `atMost`, the most that fits. Never rounded down: a fraction short of surviving is still short.
 */
export const aboutTroops = (troops: number, atMost = Infinity): string => {
  const exact = Math.ceil(troops);
  if (troops < 100) return exact.toLocaleString();
  const unit = 10 ** (Math.floor(Math.log10(troops)) - 1);
  const rounded = Math.ceil(troops / unit) * unit;
  return (rounded <= atMost ? rounded : exact).toLocaleString();
};

/** A realm an army can come from, and the largest army it can hold of the attacking troop's tier. */
interface ArmyCap {
  name: string;
  cap: number;
}

/** Another of the player's realms with a free field army slot and a cap that holds the army, and the troops it lacks. */
interface ArmySource extends ArmyCap {
  /** Troops of the attacking kind it must still train before it can raise the army; zero when it can now. */
  short: number;
}

/**
 * Advice a newcomer can follow after a certain loss. Within the home realm's army cap it is the troops to add. Past
 * it, the total needed, the cap, and what lifts it: the home's next level, if that holds the army, or another of the
 * player's realms with room for it, saying the troops to train there first when it lacks them.
 */
export const describeSurvivalAdvice = ({
  extra,
  current,
  troop,
  home,
  nextLevel,
  source,
}: {
  extra: number;
  current: number;
  /** The attacking troop: "T1 Knight". */
  troop: string;
  home: ArmyCap | null;
  nextLevel: ArmyCap | null;
  source: ArmySource | null;
}): string => {
  const total = current + extra;
  if (home === null) return `about ${aboutTroops(extra)} more troops to survive it`;
  if (total <= home.cap) return `about ${aboutTroops(extra, home.cap - current)} more troops to survive it`;
  const lift = nextLevel && total <= nextLevel.cap ? nextLevel : null;
  const cap = (realm: ArmyCap) => `cap ${realm.cap.toLocaleString()}`;
  const options = [
    lift ? `level it to ${lift.name} (${cap(lift)})` : null,
    source === null
      ? null
      : source.short === 0
        ? `raise one from ${source.name} (${cap(source)})`
        : `train ${aboutTroops(source.short, source.cap - total + source.short)} more ${troop} at ${source.name} and raise one there (${cap(source)})`,
  ].filter(Boolean);
  // The total read against the smallest cap offered, so no option is asked for more than it holds.
  const atMost = Math.min(...[lift, source].map((realm) => realm?.cap ?? Infinity));
  const needs = `it needs about ${aboutTroops(total, atMost)} troops, and ${home.name}'s army cap is ${home.cap.toLocaleString()}`;
  return options.length ? `${needs}: ${options.join(", or ")}` : `${needs}; no realm of yours can raise that many yet`;
};

/** One attack's circumstances, the dice aside: when, how far, on which biomes, and whether each side is a guard. */
type AttackCircumstances = Omit<Parameters<typeof resolveExchange>[2], "attackerRoll" | "defenderRoll">;

/**
 * One attack and the whole fight, as the contract computes them, at both ends of the dice (the attacker's worst roll
 * against the defender's best, and the reverse; without dice the two ends are one exact result): each side's losses,
 * how many more troops the attacker needs to come through at its worst roll, and whether it is wiped out at any roll.
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
  // A certain loss says how much army would come through: the same exchange at the worst roll, with more troops.
  const survivesWith = (count: bigint) => {
    const exchange = resolveExchange(
      { ...attacker, count },
      defender,
      { ...circumstances, attackerRoll, defenderRoll },
      rules,
    );
    return exchange.ok && exchange.attacker.count > 0n;
  };
  const extraToSurvive =
    worst.exchange.ok && worst.exchange.attacker.count === 0n ? extraTroopsToSurvive(attacker.count, survivesWith) : 0n;
  const sides = exchangeSides(worst.exchange, best.exchange);
  const certainLoss = sides !== null && survivalOf(sides.attacker) === "Eliminated";
  return { worst, best, extraToSurvive, sides, certainLoss };
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
