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
