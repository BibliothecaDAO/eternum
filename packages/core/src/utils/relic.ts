import {
  ClientComponents,
  RelicEffect,
  RelicEffectWithEndTick,
  RelicRecipientType,
  RelicRecipientTypeParam,
  RELICS,
  ResourcesIds,
  Troops,
} from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

export const getArmyRelicEffects = (troops: Troops, currentTick: number): RelicEffectWithEndTick[] => {
  const relicEffects: RelicEffectWithEndTick[] = [];

  if (!troops) return relicEffects;

  // Stamina Relics
  if (troops.boosts.incr_stamina_regen_percent_num > 0 && troops.boosts.incr_stamina_regen_tick_count > 0) {
    const staminaRelics = RELICS.filter((r) => r.type === "Stamina" && r.recipientType === RelicRecipientType.Explorer);
    const expectedBonus = (10000 + troops.boosts.incr_stamina_regen_percent_num) / 10000;
    const match = staminaRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.StaminaRelic1;
    // For stamina, use currentTick + tick_count as endTick
    const endTick = Number(troops.stamina.updated_tick) + troops.boosts.incr_stamina_regen_tick_count;
    relicEffects.push({ id, endTick });
  }

  // Damage Relics
  if (troops.boosts.incr_damage_dealt_percent_num > 0 && troops.boosts.incr_damage_dealt_end_tick > currentTick) {
    const damageRelics = RELICS.filter((r) => r.type === "Damage" && r.recipientType === RelicRecipientType.Explorer);
    const expectedBonus = (10000 + troops.boosts.incr_damage_dealt_percent_num) / 10000;
    const match = damageRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.DamageRelic1;
    relicEffects.push({ id, endTick: troops.boosts.incr_damage_dealt_end_tick });
  }

  // Damage Reduction Relics
  if (troops.boosts.decr_damage_gotten_percent_num > 0 && troops.boosts.decr_damage_gotten_end_tick > currentTick) {
    const damageReductionRelics = RELICS.filter(
      (r) => r.type === "Damage Reduction" && r.recipientType === RelicRecipientType.Explorer,
    );
    const expectedBonus = (10000 - troops.boosts.decr_damage_gotten_percent_num) / 10000;
    const match = damageReductionRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.DamageReductionRelic1;
    relicEffects.push({ id, endTick: troops.boosts.decr_damage_gotten_end_tick });
  }

  // Exploration Reward Relics
  if (troops.boosts.incr_explore_reward_percent_num > 0 && troops.boosts.incr_explore_reward_end_tick > currentTick) {
    const explorationRewardRelics = RELICS.filter(
      (r) => r.type === "Exploration" && r.recipientType === RelicRecipientType.Explorer && r.effect.includes("reward"),
    );
    const expectedBonus = (10000 + troops.boosts.incr_explore_reward_percent_num) / 10000;
    const match = explorationRewardRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.ExplorationRewardRelic1;
    relicEffects.push({ id, endTick: troops.boosts.incr_explore_reward_end_tick });
  }

  return relicEffects;
};

export const getStructureRelicEffects = (
  productionBoostBonus: ClientComponents["ProductionBoostBonus"]["schema"],
  currentTick: number,
): RelicEffectWithEndTick[] => {
  const relicEffects: RelicEffectWithEndTick[] = [];

  if (!productionBoostBonus) return relicEffects;

  // Resource Production Relics
  if (
    productionBoostBonus.incr_resource_rate_percent_num > 0 &&
    productionBoostBonus.incr_resource_rate_end_tick > currentTick
  ) {
    const productionRelics = RELICS.filter(
      (r) =>
        r.type === "Production" &&
        r.recipientTypeParam === RelicRecipientTypeParam.StructureProduction &&
        r.effect.includes("resource"),
    );
    const expectedBonus = (10000 + productionBoostBonus.incr_resource_rate_percent_num) / 10000;
    const match = productionRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.ProductionRelic1;
    relicEffects.push({ id, endTick: productionBoostBonus.incr_resource_rate_end_tick });
  }

  // Labor Production Relics
  if (
    productionBoostBonus.incr_labor_rate_percent_num > 0 &&
    productionBoostBonus.incr_labor_rate_end_tick > currentTick
  ) {
    const laborProductionRelics = RELICS.filter(
      (r) =>
        r.type === "Production" &&
        r.recipientTypeParam === RelicRecipientTypeParam.StructureProduction &&
        r.effect.includes("labor"),
    );
    const expectedBonus = (10000 + productionBoostBonus.incr_labor_rate_percent_num) / 10000;
    const match = laborProductionRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.LaborProductionRelic1;
    relicEffects.push({ id, endTick: productionBoostBonus.incr_labor_rate_end_tick });
  }

  // Troop Production Relics
  if (
    productionBoostBonus.incr_troop_rate_percent_num > 0 &&
    productionBoostBonus.incr_troop_rate_end_tick > currentTick
  ) {
    const troopProductionRelics = RELICS.filter(
      (r) =>
        r.type === "Production" &&
        r.recipientTypeParam === RelicRecipientTypeParam.StructureProduction &&
        r.effect.includes("troop"),
    );
    const expectedBonus = (10000 + productionBoostBonus.incr_troop_rate_percent_num) / 10000;
    const match = troopProductionRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.TroopProductionRelic1;
    relicEffects.push({ id, endTick: productionBoostBonus.incr_troop_rate_end_tick });
  }

  return relicEffects;
};

export const getStructureArmyRelicEffects = (
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>,
  currentTick: number,
): RelicEffectWithEndTick[] => {
  const troopBoosts = structure.troop_guards.alpha.boosts;

  const relicEffects: RelicEffectWithEndTick[] = [];

  if (!troopBoosts) return relicEffects;

  // Structure Damage Reduction Relics
  if (troopBoosts.decr_damage_gotten_percent_num > 0 && troopBoosts.decr_damage_gotten_end_tick > currentTick) {
    const structureDamageReductionRelics = RELICS.filter(
      (r) => r.type === "Damage Reduction" && r.recipientTypeParam === RelicRecipientTypeParam.StructureGuard,
    );
    const expectedBonus = (10000 - troopBoosts.decr_damage_gotten_percent_num) / 10000;
    const match = structureDamageReductionRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.StructureDamageReductionRelic1;
    relicEffects.push({ id, endTick: troopBoosts.decr_damage_gotten_end_tick });
  }

  return relicEffects;
};

export const isRelic = (resourceId: ResourcesIds): boolean => {
  return resourceId >= 39; // Relics start from ID 39 onwards
};

export const isRelicActive = ({ end_tick, usage_left }: RelicEffect, currentTick: number): boolean => {
  // Check if the effect is within the active time window
  const isWithinTimeWindow = end_tick > currentTick;

  // Check if there are remaining uses (if applicable)
  const hasUsagesLeft = usage_left > 0;

  return isWithinTimeWindow && hasUsagesLeft;
};

export const relicsArmiesTicksLeft = (end_tick: number, currentArmiesTick: number): number => {
  return Math.max(0, end_tick - currentArmiesTick);
};

export const relicsTimeLeft = (
  end_tick: number,
  currentTick: number,
  secondsPerTick: number,
  partialTickTimeRemaining = 0,
): number => {
  const remainingTicks = relicsArmiesTicksLeft(end_tick, currentTick);
  return remainingTicks > 0 ? remainingTicks * secondsPerTick + partialTickTimeRemaining : 0;
};
