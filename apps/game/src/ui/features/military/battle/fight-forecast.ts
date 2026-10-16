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
 * A combat panel's title: the two sides, as the battle lab and raid results name them. An unowned target is the
 * Bandits; before the target is known, the attacker alone.
 */
export const combatTitle = (attacker: string | null, target: { loaded: boolean; owner: string | null }): string => {
  const you = attacker || "Your army";
  return target.loaded ? `${you} vs ${target.owner ?? "Bandits"}` : you;
};
