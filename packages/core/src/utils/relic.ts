import { staminaClock } from "../managers/troop-stamina";
import {
  RelicEffect,
  RelicRecipientType,
  RelicRecipientTypeParam,
  RELICS,
  ResourcesIds,
  Troops,
} from "@bibliothecadao/types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

export const getArmyRelicEffects = (troops: Troops, timestamp: number): RelicEffect[] => {
  const relicEffects: RelicEffect[] = [];

  if (!troops) return relicEffects;

  // Stamina Relics
  if (troops.boosts.incr_stamina_regen_percent_num > 0 && troops.boosts.incr_stamina_regen_tick_count > 0) {
    const staminaRelics = RELICS.filter((r) => r.type === "Stamina" && r.recipientType === RelicRecipientType.Explorer);
    const expectedBonus = (10000 + troops.boosts.incr_stamina_regen_percent_num) / 10000;
    const match = staminaRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.StaminaRelic1;
    const endAt = staminaClock.read(troops.stamina).settledAt + troops.boosts.incr_stamina_regen_tick_count;
    if (bonusActive(endAt, timestamp)) relicEffects.push({ id, endAt });
  }

  // Damage Relics
  if (
    troops.boosts.incr_damage_dealt_percent_num > 0 &&
    bonusActive(troops.boosts.incr_damage_dealt_end_tick, timestamp)
  ) {
    const damageRelics = RELICS.filter((r) => r.type === "Damage" && r.recipientType === RelicRecipientType.Explorer);
    const expectedBonus = (10000 + troops.boosts.incr_damage_dealt_percent_num) / 10000;
    const match = damageRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.DamageRelic1;
    relicEffects.push({ id, endAt: troops.boosts.incr_damage_dealt_end_tick });
  }

  // Damage Reduction Relics
  if (
    troops.boosts.decr_damage_gotten_percent_num > 0 &&
    bonusActive(troops.boosts.decr_damage_gotten_end_tick, timestamp)
  ) {
    const damageReductionRelics = RELICS.filter(
      (r) => r.type === "Damage Reduction" && r.recipientType === RelicRecipientType.Explorer,
    );
    const expectedBonus = (10000 - troops.boosts.decr_damage_gotten_percent_num) / 10000;
    const match = damageReductionRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.DamageReductionRelic1;
    relicEffects.push({ id, endAt: troops.boosts.decr_damage_gotten_end_tick });
  }

  // Exploration Reward Relics
  if (
    troops.boosts.incr_explore_reward_percent_num > 0 &&
    bonusActive(troops.boosts.incr_explore_reward_end_tick, timestamp)
  ) {
    const explorationRewardRelics = RELICS.filter(
      (r) => r.type === "Exploration" && r.recipientType === RelicRecipientType.Explorer && r.effect.includes("reward"),
    );
    const expectedBonus = (10000 + troops.boosts.incr_explore_reward_percent_num) / 10000;
    const match = explorationRewardRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.ExplorationRewardRelic1;
    relicEffects.push({ id, endAt: troops.boosts.incr_explore_reward_end_tick });
  }

  return relicEffects;
};

export const getStructureRelicEffects = (
  productionBoostBonus: NativeRows["ProductionBonus"],
  timestamp: number,
): RelicEffect[] => {
  const relicEffects: RelicEffect[] = [];

  if (!productionBoostBonus) return relicEffects;

  // Resource Production Relics
  if (
    productionBoostBonus.incr_resource_rate_percent_num > 0 &&
    bonusActive(productionBoostBonus.incr_resource_rate_end_tick, timestamp)
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
    relicEffects.push({ id, endAt: productionBoostBonus.incr_resource_rate_end_tick });
  }

  // Labor Production Relics
  if (
    productionBoostBonus.incr_labor_rate_percent_num > 0 &&
    bonusActive(productionBoostBonus.incr_labor_rate_end_tick, timestamp)
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
    relicEffects.push({ id, endAt: productionBoostBonus.incr_labor_rate_end_tick });
  }

  // Troop Production Relics
  if (
    productionBoostBonus.incr_troop_rate_percent_num > 0 &&
    bonusActive(productionBoostBonus.incr_troop_rate_end_tick, timestamp)
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
    relicEffects.push({ id, endAt: productionBoostBonus.incr_troop_rate_end_tick });
  }

  return relicEffects;
};

export const getStructureArmyRelicEffects = (
  guard: { troops: Pick<Troops, "boosts"> } | undefined,
  timestamp: number,
): RelicEffect[] => {
  const troopBoosts = guard?.troops.boosts;

  const relicEffects: RelicEffect[] = [];

  if (!troopBoosts) return relicEffects;

  // Structure Damage Reduction Relics
  if (
    troopBoosts.decr_damage_gotten_percent_num > 0 &&
    bonusActive(troopBoosts.decr_damage_gotten_end_tick, timestamp)
  ) {
    const structureDamageReductionRelics = RELICS.filter(
      (r) => r.type === "Damage Reduction" && r.recipientTypeParam === RelicRecipientTypeParam.StructureGuard,
    );
    const expectedBonus = (10000 - troopBoosts.decr_damage_gotten_percent_num) / 10000;
    const match = structureDamageReductionRelics.find((r) => r.bonus === expectedBonus);
    const id = match ? match.id : ResourcesIds.StructureDamageReductionRelic1;
    relicEffects.push({ id, endAt: troopBoosts.decr_damage_gotten_end_tick });
  }

  return relicEffects;
};

export const isRelic = (resourceId: ResourcesIds): boolean => {
  return resourceId >= 39; // Relics start from ID 39 onwards
};

/** Legacy *_end_tick fields hold exclusive end seconds until the landing schema regeneration. */
export const bonusActive = (endAt: number, timestamp: number): boolean => timestamp < endAt;
