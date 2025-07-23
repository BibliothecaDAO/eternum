import {
  ClientComponents,
  RelicEffectWithEndTick,
  RelicRecipientType,
  RelicRecipientTypeParam,
  RELICS,
  ResourcesIds,
  TroopBoosts,
} from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

export const getArmyRelicEffects = (troopBoosts: TroopBoosts, currentTick: number): RelicEffectWithEndTick[] => {
  const relicEffects: RelicEffectWithEndTick[] = [];

  if (!troopBoosts) return relicEffects;

  // Stamina Relics
  if (troopBoosts.incr_stamina_regen_percent_num > 0 && troopBoosts.incr_stamina_regen_tick_count > 0) {
    const staminaRelics = RELICS.filter((r) => r.type === "Stamina" && r.recipientType === RelicRecipientType.Explorer);
    const match = staminaRelics.find((r) => r.bonus === 1 + troopBoosts.incr_stamina_regen_percent_num / 100);
    const id = match ? match.id : ResourcesIds.StaminaRelic1;
    // For stamina, use currentTick + tick_count as endTick
    const endTick = currentTick + troopBoosts.incr_stamina_regen_tick_count;
    relicEffects.push({ id, endTick });
  }

  // Damage Relics
  if (troopBoosts.incr_damage_dealt_percent_num > 0 && troopBoosts.incr_damage_dealt_end_tick > currentTick) {
    const damageRelics = RELICS.filter((r) => r.type === "Damage" && r.recipientType === RelicRecipientType.Explorer);
    const match = damageRelics.find((r) => r.bonus === 1 + troopBoosts.incr_damage_dealt_percent_num / 100);
    const id = match ? match.id : ResourcesIds.DamageRelic1;
    relicEffects.push({ id, endTick: troopBoosts.incr_damage_dealt_end_tick });
  }

  // Damage Reduction Relics
  if (troopBoosts.decr_damage_gotten_percent_num > 0 && troopBoosts.decr_damage_gotten_end_tick > currentTick) {
    const damageReductionRelics = RELICS.filter(
      (r) => r.type === "Damage Reduction" && r.recipientType === RelicRecipientType.Explorer,
    );
    const expectedBonus = 1 - troopBoosts.decr_damage_gotten_percent_num / 100;
    const match = damageReductionRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.DamageReductionRelic1;
    relicEffects.push({ id, endTick: troopBoosts.decr_damage_gotten_end_tick });
  }

  // Exploration Reward Relics
  if (troopBoosts.incr_explore_reward_percent_num > 0 && troopBoosts.incr_explore_reward_end_tick > currentTick) {
    const explorationRewardRelics = RELICS.filter(
      (r) => r.type === "Exploration" && r.recipientType === RelicRecipientType.Explorer && r.effect.includes("reward"),
    );
    const expectedBonus = 1 + troopBoosts.incr_explore_reward_percent_num / 100;
    const match = explorationRewardRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.ExplorationRewardRelic1;
    relicEffects.push({ id, endTick: troopBoosts.incr_explore_reward_end_tick });
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
    const expectedBonus = 1 + productionBoostBonus.incr_resource_rate_percent_num / 100;
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
    const expectedBonus = 1 + productionBoostBonus.incr_labor_rate_percent_num / 100;
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
    const expectedBonus = 1 + productionBoostBonus.incr_troop_rate_percent_num / 100;
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

  console.log({ troopBoosts });

  // Structure Damage Reduction Relics
  if (troopBoosts.decr_damage_gotten_percent_num > 0 && troopBoosts.decr_damage_gotten_end_tick > currentTick) {
    const structureDamageReductionRelics = RELICS.filter(
      (r) => r.type === "Damage Reduction" && r.recipientTypeParam === RelicRecipientTypeParam.StructureGuard,
    );
    const expectedBonus = (10000 - troopBoosts.decr_damage_gotten_percent_num) / 10000;
    console.log("expectedBonus", expectedBonus);
    const match = structureDamageReductionRelics.find((r) => r.bonus === expectedBonus);
    console.log("match", match);
    const id = match ? match.id : ResourcesIds.StructureDamageReductionRelic1;
    console.log("id", id);
    relicEffects.push({ id, endTick: troopBoosts.decr_damage_gotten_end_tick });
  }

  return relicEffects;
};
