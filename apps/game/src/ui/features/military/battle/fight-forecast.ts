import type { FightForecast } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

/** Whole troops from a scaled count, as the contract counts them. */
export const wholeTroops = (scaled: bigint): number => Number(scaled / BigInt(RESOURCE_PRECISION));

const exchanges = (count: number) => (count === 1 ? "1 exchange" : `${count} exchanges`);

/**
 * The whole fight in one line, exact because every exchange is the contract's own result: "Wins in 2 exchanges ·
 * loses 420 · 60 stamina". Null when the first attack cannot be made at all.
 */
export const describeFight = (forecast: FightForecast): string | null => {
  if (forecast.outcome === "refused") return null;
  const cost = `${forecast.staminaSpent} stamina`;
  const lost = wholeTroops(forecast.attackerLoss).toLocaleString();
  if (forecast.outcome === "wins") return `Wins in ${exchanges(forecast.exchanges)} · loses ${lost} · ${cost}`;
  if (forecast.outcome === "loses") return `Falls in ${exchanges(forecast.exchanges)} · ${cost}`;
  const standing = wholeTroops(forecast.defender.count).toLocaleString();
  return `Out of stamina after ${exchanges(forecast.exchanges)} · ${standing} still defend · loses ${lost}`;
};
