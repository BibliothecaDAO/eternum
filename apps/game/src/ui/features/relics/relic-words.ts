import { formatTimeRemaining } from "@/ui/features/economy/resources/entity-resource-table/utils";
import { configManager } from "@bibliothecadao/eternum";
import { getRelicInfo, relicEffect, type ResourcesIds } from "@bibliothecadao/types";

/** "Damage Relic I" reads "Damage I": the word "Relic" is the chip's shape already. */
export const relicShortName = (relicId: ResourcesIds): string => {
  const relic = getRelicInfo(relicId);
  if (!relic) throw new Error(`Resource ${relicId} is not a relic`);
  return relic.name.replace(" Relic", "");
};

/** What a relic does and for how long, from the game's relic rules: "Increases damage by 20% for 30m". */
export const relicEffectLine = (relicId: ResourcesIds): string => {
  const { durationSeconds } = configManager.getRelicActivation(relicId);
  return durationSeconds > 0
    ? `${relicEffect(relicId)} for ${formatTimeRemaining(durationSeconds)}`
    : relicEffect(relicId);
};

/**
 * The one line every relic's hover says: its name, what it does, for how long, and what activating it costs ("Damage
 * I: Increases damage by 20% for 30m. Costs 500 Essence to activate."); given the Essence its holder can pay with, what
 * it lacks ("Costs 500 Essence to activate; you have 200.").
 */
export const relicLine = (relicId: ResourcesIds, essenceHeld?: number): string => {
  const { essenceCost } = configManager.getRelicActivation(relicId);
  const short = essenceHeld !== undefined && essenceHeld < essenceCost;
  const cost = `Costs ${essenceCost.toLocaleString()} Essence to activate`;
  const held = short ? `; you have ${Math.floor(essenceHeld).toLocaleString()}` : "";
  return `${relicShortName(relicId)}: ${relicEffectLine(relicId)}. ${cost}${held}.`;
};

/** Whether the Essence a relic's holder can pay with covers activating it; an unknown balance never does. */
export const coversRelicCost = (relicId: ResourcesIds, essenceHeld: number | undefined): boolean =>
  essenceHeld !== undefined && essenceHeld >= configManager.getRelicActivation(relicId).essenceCost;
