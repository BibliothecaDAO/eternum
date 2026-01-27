import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

export const getExplorerFromToriiEntity = (
  entity: any,
): ComponentValue<ClientComponents["ExplorerTroops"]["schema"]> => {
  console.log({ entity });
  const coordValue = entity.coord?.value;
  return {
    explorer_id: entity.explorer_id.value,
    owner: entity.owner.value,
    troops: {
      category: entity.troops.value.category.value.option,
      tier: entity.troops.value.tier.value.option,
      count: BigInt(entity.troops.value.count.value),
      stamina: {
        amount: BigInt(entity.troops.value.stamina.value.amount.value),
        updated_tick: BigInt(entity.troops.value.stamina.value.updated_tick.value),
      },
      boosts: {
        incr_damage_dealt_percent_num: entity.troops.value.boosts.value.incr_damage_dealt_percent_num.value,
        incr_damage_dealt_end_tick: entity.troops.value.boosts.value.incr_damage_dealt_end_tick.value,
        decr_damage_gotten_percent_num: entity.troops.value.boosts.value.decr_damage_gotten_percent_num.value,
        decr_damage_gotten_end_tick: entity.troops.value.boosts.value.decr_damage_gotten_end_tick.value,
        incr_stamina_regen_percent_num: entity.troops.value.boosts.value.incr_stamina_regen_percent_num.value,
        incr_stamina_regen_tick_count: entity.troops.value.boosts.value.incr_stamina_regen_tick_count.value,
        incr_explore_reward_percent_num: entity.troops.value.boosts.value.incr_explore_reward_percent_num.value,
        incr_explore_reward_end_tick: entity.troops.value.boosts.value.incr_explore_reward_end_tick.value,
      },
      battle_cooldown_end: entity.troops.value.battle_cooldown_end.value,
    },
    coord: {
      alt: coordValue?.alt?.value ?? coordValue?.alt ?? false,
      x: coordValue?.x?.value ?? coordValue?.x,
      y: coordValue?.y?.value ?? coordValue?.y,
    },
  };
};
