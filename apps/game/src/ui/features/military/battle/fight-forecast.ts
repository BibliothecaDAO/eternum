import type { FightForecast } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

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

/** A troop count as an estimate reads it: rounded up to two significant figures ("about 1,300"). */
export const aboutTroops = (troops: number): string => {
  if (troops < 100) return Math.ceil(troops).toLocaleString();
  const unit = 10 ** (Math.floor(Math.log10(troops)) - 1);
  return (Math.ceil(troops / unit) * unit).toLocaleString();
};

/** A realm an army can come from, and the largest army it can hold of the attacking troop's tier. */
interface ArmyCap {
  name: string;
  cap: number;
}

/**
 * Advice a newcomer can follow after a certain loss. Within the home realm's army cap it is the troops to add. Past
 * it, the total needed, the cap, and what lifts it: the home's next level, if that holds the army, or another of the
 * player's realms that already holds it.
 */
export const describeSurvivalAdvice = ({
  extra,
  current,
  home,
  nextLevel,
  roomier,
}: {
  extra: number;
  current: number;
  home: ArmyCap | null;
  nextLevel: ArmyCap | null;
  roomier: ArmyCap | null;
}): string => {
  const total = current + extra;
  if (home === null || total <= home.cap) return `about ${aboutTroops(extra)} more troops to survive it`;
  const options = [
    nextLevel && total <= nextLevel.cap
      ? `level it to ${nextLevel.name} (cap ${nextLevel.cap.toLocaleString()})`
      : null,
    roomier ? `raise one from ${roomier.name} (cap ${roomier.cap.toLocaleString()})` : null,
  ].filter(Boolean);
  const needs = `it needs about ${aboutTroops(total)} troops, and ${home.name}'s army cap is ${home.cap.toLocaleString()}`;
  return options.length ? `${needs}: ${options.join(", or ")}` : `${needs}; no realm of yours holds that many yet`;
};
